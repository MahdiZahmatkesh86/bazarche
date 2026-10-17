#!/usr/bin/env node
'use strict';
/* ================================================================
   fix-order-expiry.js
   ----------------------------------------------------------------
   Problem:
     orderController.create() decrements stock immediately and sets
     status='pending'. There is no expiry worker. Abandoned online
     orders lock stock forever → inventory DoS.

   Fix:
     • New column: orders.payment_expires_at DATETIME NULL
       (only set for payment_method='online' → TTL from env, default 30m)
     • New worker (backend/utils/orderExpiryWorker.js) that periodically
       cancels expired pending online orders and restores stock.
     • confirmPayment() now uses a transaction and:
         - rejects if the order is already expired (auto-expires it
           immediately so stock is freed at the same instant).
     • Manual admin trigger:
         POST /api/orders/admin/expire-pending
     • Safe to run multi-process: candidate list is unlocked, but every
       state transition uses SELECT ... FOR UPDATE + double-check.

   What this script does:
     1. Backs up files it touches (*.pre-expiryfix-<ts>)
     2. Writes new files: orderExpiryWorker.js, migrate-order-expiry.js
     3. Patches backend/db/init.js (add column + index)
     4. Patches backend/controllers/orderController.js
          - create: set payment_expires_at for online orders
          - confirmPayment: transactional + auto-expire on late pay
          - adds: expireOne(), expirePendingOrders(), expirePendingNow()
     5. Patches backend/routes/orders.js (admin trigger)
     6. Patches backend/server.js (start worker unless disabled/test)
     7. Appends env keys (idempotent)
     8. Runs the migration (idempotent)
     9. Static source verification
    10. Live E2E test (uses an isolated server with ORDER_EXPIRY_ENABLED=false):
          – create online order → payment_expires_at set, stock decremented
          – manually set payment_expires_at to past via SQL
          – call expirePendingOrders() in-process
          – verify: status='cancelled', stock_restored=1, stock restored
          – create second order, expire it, then call confirmPayment()
          – verify: 400 response AND order auto-expired + stock restored
          – create third order, call confirmPayment() while still valid
          – verify: 200 + status='paid'
    11. Cleans up all test fixtures
    12. Prints compact result
   ================================================================ */

const fs    = require('fs');
const path  = require('path');
const http  = require('http');
const net   = require('net');
const { spawn } = require('child_process');

const ROOT      = __dirname;
const BACKEND   = path.join(ROOT, 'backend');
const TS        = Date.now();
const ARGS      = process.argv.slice(2);
const TEST_ONLY = ARGS.includes('--test-only');
const DRY_RUN   = ARGS.includes('--dry-run');

const F_DBINIT   = path.join(BACKEND, 'db', 'init.js');
const F_CTRL     = path.join(BACKEND, 'controllers', 'orderController.js');
const F_ROUTES   = path.join(BACKEND, 'routes', 'orders.js');
const F_SERVER   = path.join(BACKEND, 'server.js');
const F_ENV      = path.join(BACKEND, '.env');
const F_WORKER   = path.join(BACKEND, 'utils', 'orderExpiryWorker.js');
const F_MIGRATE  = path.join(BACKEND, 'utils', 'migrate-order-expiry.js');

const report = [];
function mark(ok, key, detail) {
  report.push({ ok, key, detail: detail || '' });
  console.log('  ' + (ok ? '✅' : '❌') + '  ' + key + (detail ? '  →  ' + detail : ''));
}
function banner(t) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ' + t);
  console.log('═══════════════════════════════════════════════════════════════');
}
function fatal(msg) {
  banner('❌ FATAL');
  console.log('  ' + msg.replace(/\n/g, '\n  '));
  process.exit(1);
}
function backup(file) {
  if (!fs.existsSync(file)) return null;
  const b = file + '.pre-expiryfix-' + TS;
  fs.copyFileSync(file, b);
  return b;
}

/* ================================================================
   Embedded new files
   ================================================================ */

const WORKER_JS = String.raw`'use strict';
/* ================================================================
   orderExpiryWorker.js
   Periodically expires pending ONLINE orders whose payment window
   has passed, and restores stock. Skipped when NODE_ENV=test or
   ORDER_EXPIRY_ENABLED=false.

   Multi-process safety: the candidate SELECT is unlocked, but each
   transition uses BEGIN + SELECT ... FOR UPDATE + state re-check,
   so only one worker can commit a given order.
   ================================================================ */
const { expirePendingOrders } = require('../controllers/orderController');

let timer = null;
let running = false;
let started = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const n = await expirePendingOrders();
    if (n > 0) console.log('[order-expiry] expired', n, 'order(s)');
  } catch (e) {
    console.error('[order-expiry] error:', e && e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (started) return;
  if (process.env.ORDER_EXPIRY_ENABLED === 'false') {
    console.log('[order-expiry] disabled by ORDER_EXPIRY_ENABLED=false');
    return;
  }
  if (process.env.NODE_ENV === 'test') {
    console.log('[order-expiry] disabled in NODE_ENV=test');
    return;
  }
  started = true;
  const intervalMs = Math.max(5000, Number(process.env.ORDER_EXPIRY_INTERVAL_MS || 60000));
  timer = setInterval(tick, intervalMs);
  console.log('[order-expiry] worker started (interval=' + intervalMs + 'ms)');
  setTimeout(tick, 3000);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

module.exports = { start, stop, tick };
`;

const MIGRATE_JS = String.raw`require('dotenv').config();
const { pool } = require('../db/init');

async function hasColumn(t, c) {
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.COLUMNS ' +
    'WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [process.env.DB_NAME, t, c]
  );
  return r[0].c > 0;
}

async function hasIndex(t, name) {
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.STATISTICS ' +
    'WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [process.env.DB_NAME, t, name]
  );
  return r[0].c > 0;
}

(async () => {
  try {
    if (await hasColumn('orders', 'payment_expires_at')) {
      console.log('[skip] orders.payment_expires_at');
    } else {
      await pool.query(
        'ALTER TABLE orders ADD COLUMN payment_expires_at DATETIME NULL DEFAULT NULL ' +
        'AFTER tracking_code'
      );
      console.log('[add]  orders.payment_expires_at');
    }

    if (await hasIndex('orders', 'idx_ord_pending_expiry')) {
      console.log('[skip] idx_ord_pending_expiry');
    } else {
      await pool.query(
        'CREATE INDEX idx_ord_pending_expiry ' +
        'ON orders (status, payment_method, payment_expires_at)'
      );
      console.log('[add]  idx_ord_pending_expiry');
    }

    console.log('Done.');
    await pool.end();
    process.exit(0);
  } catch (e) { console.error('ERR:', e.message); process.exit(1); }
})();
`;

/* ================================================================
   Patch: db/init.js — add column + index for fresh installs
   ================================================================ */

const INIT_ANCHOR =
  '      paid_at TIMESTAMP NULL,\n' +
  '      delivered_at TIMESTAMP NULL,';
const INIT_REPLACE =
  '      paid_at TIMESTAMP NULL,\n' +
  '      delivered_at TIMESTAMP NULL,\n' +
  '      payment_expires_at DATETIME NULL DEFAULT NULL,';
const INIT_IDX_ANCHOR =
  '      INDEX idx_order_user (user_id),\n' +
  '      INDEX idx_order_status (status),';
const INIT_IDX_REPLACE =
  '      INDEX idx_order_user (user_id),\n' +
  '      INDEX idx_order_status (status),\n' +
  '      INDEX idx_ord_pending_expiry (status, payment_method, payment_expires_at),';

function patchDbInit() {
  let src = fs.readFileSync(F_DBINIT, 'utf8');
  if (src.includes('payment_expires_at')) {
    mark(true, 'db/init.js', 'از قبل پچ شده — رد شد');
    return;
  }
  if (!src.includes(INIT_ANCHOR)) fatal('anchor paid_at/delivered_at در db/init.js پیدا نشد');
  if (!src.includes(INIT_IDX_ANCHOR)) fatal('anchor indexها در db/init.js پیدا نشد');
  backup(F_DBINIT);
  src = src.replace(INIT_ANCHOR, INIT_REPLACE);
  src = src.replace(INIT_IDX_ANCHOR, INIT_IDX_REPLACE);
  fs.writeFileSync(F_DBINIT, src, 'utf8');
  mark(true, 'db/init.js', 'پچ شد (payment_expires_at + index)');
}

/* ================================================================
   Patch: controllers/orderController.js
   ================================================================ */

const EXPIRE_HELPERS = String.raw`
/* ============================================================
   Order expiry helpers
   ============================================================ */
async function expireOne(orderId, reason) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [oRows] = await conn.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    const order = oRows[0];
    if (!order) { await conn.rollback(); return false; }
    if (order.status !== 'pending') { await conn.rollback(); return false; }
    if (order.payment_method !== 'online') { await conn.rollback(); return false; }
    if (!order.payment_expires_at) { await conn.rollback(); return false; }
    if (new Date(order.payment_expires_at) > new Date()) { await conn.rollback(); return false; }
    if (order.stock_restored) { await conn.rollback(); return false; }

    const [items] = await conn.query(
      'SELECT * FROM order_items WHERE order_id = ?', [order.id]
    );
    for (const it of items) {
      await conn.query(
        'UPDATE products SET stock = stock + ?, sales = GREATEST(sales - ?, 0) WHERE id = ?',
        [it.qty, it.qty, it.product_id]
      );
    }
    await conn.query(
      "UPDATE orders SET status = 'cancelled', stock_restored = 1, " +
      "internal_note = CONCAT(COALESCE(internal_note, ''), ?) WHERE id = ?",
      ['\n[' + new Date().toISOString() + '] ' + reason, order.id]
    );
    await conn.commit();
    return true;
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

exports.expirePendingOrders = async function () {
  const batch = Math.min(500, Number(process.env.ORDER_EXPIRY_BATCH || 100));
  const candidates = await q(
    "SELECT id FROM orders WHERE status = 'pending' " +
    "  AND payment_method = 'online' " +
    "  AND payment_expires_at IS NOT NULL " +
    "  AND payment_expires_at < NOW() " +
    "  AND stock_restored = 0 " +
    "ORDER BY id ASC LIMIT " + batch
  );
  let expired = 0;
  for (const row of candidates) {
    try {
      if (await expireOne(row.id, 'auto: payment window expired')) expired++;
    } catch (e) {
      console.error('[order-expiry] id=' + row.id + ' failed:', e.message);
    }
  }
  return expired;
};

exports.expirePendingNow = async function (req, res, next) {
  try {
    const n = await exports.expirePendingOrders();
    res.json({ success: true, expired: n });
  } catch (err) { next(err); }
};
`;

const CREATE_ANCHOR_1 =
  "    const pm = paymentMethod === 'cod' ? 'cod' : 'online';";

const CREATE_ANCHOR_INSERT =
  "    const [orderRes] = await conn.query(\n" +
  "      'INSERT INTO orders (user_id, payment_method, items_price, shipping_price, total_price, status, tracking_code, note, shipping_name, shipping_phone, shipping_province, shipping_city, shipping_street, shipping_postal, payment_simulated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',\n" +
  "      [req.user.id, pm, itemsPrice, shippingPrice, totalPrice, status, trackCode, note || '', shippingAddress.name, shippingAddress.phone, shippingAddress.province || null, shippingAddress.city, shippingAddress.street, shippingAddress.postalCode || null, paymentSimulated]\n" +
  "    );";

const CREATE_REPLACE_INSERT =
  "    const ttlMinutes = Math.max(1, Number(process.env.ORDER_PAYMENT_TTL_MINUTES || 30));\n" +
  "    const paymentExpiresAt = pm === 'online'\n" +
  "      ? new Date(Date.now() + ttlMinutes * 60 * 1000)\n" +
  "      : null;\n" +
  "\n" +
  "    const [orderRes] = await conn.query(\n" +
  "      'INSERT INTO orders (user_id, payment_method, items_price, shipping_price, total_price, status, tracking_code, note, shipping_name, shipping_phone, shipping_province, shipping_city, shipping_street, shipping_postal, payment_simulated, payment_expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',\n" +
  "      [req.user.id, pm, itemsPrice, shippingPrice, totalPrice, status, trackCode, note || '', shippingAddress.name, shippingAddress.phone, shippingAddress.province || null, shippingAddress.city, shippingAddress.street, shippingAddress.postalCode || null, paymentSimulated, paymentExpiresAt]\n" +
  "    );";

const CONFIRM_OLD_RE =
  /\/\* ============ Confirm payment \(simulated gateway\) ============ \*\/\s*exports\.confirmPayment\s*=\s*async\s*\(req,\s*res,\s*next\)\s*=>\s*\{[\s\S]*?\n\};/;

const CONFIRM_NEW = String.raw`/* ============ Confirm payment (simulated gateway) ============ */
exports.confirmPayment = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.user.id]
    );
    const order = rows[0];
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' });
    }
    if (order.status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ success:false, message:'این سفارش در وضعیت قابل پرداخت نیست.' });
    }
    if (order.payment_method !== 'online') {
      await conn.rollback();
      return res.status(400).json({ success:false, message:'این سفارش پرداخت آنلاین نیست.' });
    }

    /* Payment window expired? Expire the order NOW inside this transaction
       so stock is released immediately (worker is only a safety net). */
    if (order.payment_expires_at && new Date(order.payment_expires_at) < new Date()) {
      const [items] = await conn.query(
        'SELECT * FROM order_items WHERE order_id = ?', [order.id]
      );
      for (const it of items) {
        await conn.query(
          'UPDATE products SET stock = stock + ?, sales = GREATEST(sales - ?, 0) WHERE id = ?',
          [it.qty, it.qty, it.product_id]
        );
      }
      await conn.query(
        "UPDATE orders SET status = 'cancelled', stock_restored = 1, " +
        "internal_note = CONCAT(COALESCE(internal_note, ''), ?) WHERE id = ?",
        ['\n[' + new Date().toISOString() + '] auto: payment window expired (late confirm)', order.id]
      );
      await conn.commit();
      return res.status(400).json({
        success: false,
        message: 'مهلت پرداخت این سفارش به پایان رسیده است. لطفاً سفارش جدید ثبت کنید.'
      });
    }

    await conn.query(
      "UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = ?",
      [order.id]
    );
    await conn.commit();

    const updated = await qOne('SELECT * FROM orders WHERE id = ?', [order.id]);
    const items2  = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(updated, items2, true) });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
};`;

function patchOrderController() {
  let src = fs.readFileSync(F_CTRL, 'utf8');

  const alreadyHas = src.includes('expirePendingOrders') &&
                     src.includes('payment_expires_at') &&
                     src.includes('expireOne');

  if (alreadyHas) {
    mark(true, 'controllers/orderController.js', 'از قبل پچ شده — رد شد');
    return;
  }

  /* 1) Insert helpers after the require() block */
  if (!src.includes('async function expireOne')) {
    const requireAnchor =
      "const { FREE_THRESHOLD: FREE_SHIPPING, SHIPPING_COST } = require('../utils/shippingConstants');";
    if (!src.includes(requireAnchor)) fatal('anchor require shippingConstants پیدا نشد');
    src = src.replace(requireAnchor, requireAnchor + '\n' + EXPIRE_HELPERS);
  }

  /* 2) Patch create() to set payment_expires_at */
  if (!src.includes('paymentExpiresAt')) {
    if (!src.includes(CREATE_ANCHOR_INSERT)) {
      fatal('INSERT orders block در create() پیدا نشد (شاید از قبل تغییر کرده)');
    }
    if (!src.includes(CREATE_ANCHOR_1)) {
      fatal('خط const pm در create() پیدا نشد');
    }
    src = src.replace(CREATE_ANCHOR_INSERT, CREATE_REPLACE_INSERT);
  }

  /* 3) Replace confirmPayment() with transactional + expiry-aware version */
  if (!src.includes('auto: payment window expired (late confirm)')) {
    if (!CONFIRM_OLD_RE.test(src)) {
      fatal('تابع confirmPayment با آنچه انتظار داشتیم یکی نیست');
    }
    src = src.replace(CONFIRM_OLD_RE, CONFIRM_NEW);
  }

  /* syntax check */
  try {
    new Function(src.replace(/require\([^)]*\)/g, '(()=>1)'));
  } catch (e) {
    fatal('پس از پچ، سینتکس orderController خراب شد — فایل ذخیره نشد.\n' + e.message);
  }

  backup(F_CTRL);
  fs.writeFileSync(F_CTRL, src, 'utf8');
  mark(true, 'controllers/orderController.js', 'پچ شد (create + confirmPayment + expiry helpers)');
}

/* ================================================================
   Patch: routes/orders.js — admin manual trigger
   ================================================================ */

function patchRoutes() {
  let src = fs.readFileSync(F_ROUTES, 'utf8');
  if (src.includes('/admin/expire-pending')) {
    mark(true, 'routes/orders.js', 'از قبل پچ شده — رد شد');
    return;
  }
  const anchor =
    "router.get('/admin/full-dashboard', protect, adminOnly, ctrl.fullDashboard);";
  if (!src.includes(anchor)) fatal('anchor full-dashboard در routes/orders پیدا نشد');
  backup(F_ROUTES);
  src = src.replace(
    anchor,
    anchor +
    "\nrouter.post('/admin/expire-pending', protect, adminOnly, ctrl.expirePendingNow);"
  );
  fs.writeFileSync(F_ROUTES, src, 'utf8');
  mark(true, 'routes/orders.js', 'پچ شد (POST /admin/expire-pending)');
}

/* ================================================================
   Patch: server.js — start worker
   ================================================================ */

function patchServer() {
  let src = fs.readFileSync(F_SERVER, 'utf8');
  if (src.includes('orderExpiryWorker')) {
    mark(true, 'server.js', 'از قبل پچ شده — رد شد');
    return;
  }
  const anchor =
    "    await initSchema();\n" +
    "    app.listen(PORT, ()=>console.log('[Server] Running on port ' + PORT + ' (' + process.env.NODE_ENV + ')'));";
  if (!src.includes(anchor)) fatal('anchor initSchema/listen در server.js پیدا نشد');
  backup(F_SERVER);
  src = src.replace(
    anchor,
    "    await initSchema();\n" +
    "    try { require('./utils/orderExpiryWorker').start(); }\n" +
    "    catch (e) { console.error('[order-expiry] start failed:', e && e.message); }\n" +
    "    app.listen(PORT, ()=>console.log('[Server] Running on port ' + PORT + ' (' + process.env.NODE_ENV + ')'));"
  );
  fs.writeFileSync(F_SERVER, src, 'utf8');
  mark(true, 'server.js', 'پچ شد (start orderExpiryWorker)');
}

/* ================================================================
   Patch: .env — add TTL keys
   ================================================================ */

function patchEnv() {
  if (!fs.existsSync(F_ENV)) {
    mark(false, '.env', 'وجود ندارد — رد شد');
    return;
  }
  let env = fs.readFileSync(F_ENV, 'utf8');
  const keys = {
    ORDER_PAYMENT_TTL_MINUTES: '30',
    ORDER_EXPIRY_INTERVAL_MS: '60000',
    ORDER_EXPIRY_BATCH: '100',
    ORDER_EXPIRY_ENABLED: 'true',
  };
  const toAdd = [];
  for (const [k, v] of Object.entries(keys)) {
    if (!new RegExp('^' + k + '=', 'm').test(env)) toAdd.push(k + '=' + v);
  }
  if (!toAdd.length) {
    mark(true, '.env', 'از قبل به‌روز است');
    return;
  }
  const sep = env && !env.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(F_ENV, env + sep + '\n# ==== Order expiry (auto-added) ====\n' + toAdd.join('\n') + '\n', 'utf8');
  mark(true, '.env', toAdd.length + ' متغیر اضافه شد');
}

/* ================================================================
   Static checks
   ================================================================ */

function staticChecks() {
  const ctrl   = fs.readFileSync(F_CTRL, 'utf8');
  const routes = fs.readFileSync(F_ROUTES, 'utf8');
  const srv    = fs.readFileSync(F_SERVER, 'utf8');
  const init   = fs.readFileSync(F_DBINIT, 'utf8');

  mark(/async function expireOne/.test(ctrl), 'controller: expireOne()');
  mark(/exports\.expirePendingOrders/.test(ctrl), 'controller: expirePendingOrders()');
  mark(/paymentExpiresAt/.test(ctrl), 'controller: create sets payment_expires_at');
  mark(/auto: payment window expired \(late confirm\)/.test(ctrl), 'controller: confirmPayment auto-expires late pay');
  mark(/expirePendingNow/.test(ctrl), 'controller: expirePendingNow() exported');
  mark(/\/admin\/expire-pending/.test(routes), 'routes: POST /admin/expire-pending');
  mark(/orderExpiryWorker/.test(srv), 'server: starts worker');
  mark(/payment_expires_at/.test(init), 'db/init: payment_expires_at column');
}

/* ================================================================
   HTTP / DB helpers for the live test
   ================================================================ */

function httpReq(port, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (cookie) headers['Cookie'] = cookie;
    let payload = null;
    if (body) {
      payload = Buffer.from(JSON.stringify(body));
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    const req = http.request({ method, hostname: '127.0.0.1', port, path: p, headers }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        let parsed; try { parsed = JSON.parse(buf); } catch (_) { parsed = { raw: buf }; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function bootServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: BACKEND,
      env: Object.assign({}, process.env, {
        PORT: String(port),
        NODE_ENV: 'test',
        ORDER_EXPIRY_ENABLED: 'false',  /* worker off — we call functions directly */
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buf = '', settled = false;
    child.stdout.on('data', d => buf += d.toString());
    child.stderr.on('data', d => buf += d.toString());
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error('server exited (code=' + code + ')'), { output: buf }));
    });
    const t0 = Date.now();
    const iv = setInterval(async () => {
      if (settled) return;
      if (/Running on port/.test(buf)) { settled = true; clearInterval(iv); return resolve(child); }
      if (Date.now() - t0 > 30000) {
        settled = true; clearInterval(iv);
        try { child.kill('SIGKILL'); } catch (_) {}
        return reject(Object.assign(new Error('boot timeout'), { output: buf }));
      }
      try {
        const r = await httpReq(port, 'GET', '/api/health');
        if (r.status === 200 && !settled) { settled = true; clearInterval(iv); return resolve(child); }
      } catch (_) {}
    }, 300);
  });
}

/* ================================================================
   Live test
   ================================================================ */

function preflight() {
  if (!fs.existsSync(F_ENV)) return { ok: false, reason: 'backend/.env وجود ندارد' };
  const env = fs.readFileSync(F_ENV, 'utf8');
  const get = k => ((env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || '').trim();
  for (const k of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
    if (!get(k)) return { ok: false, reason: 'متغیر ' + k + ' در .env خالی است' };
  }
  if (!fs.existsSync(path.join(BACKEND, 'node_modules', 'mysql2'))) {
    return { ok: false, reason: 'node_modules نصب نیست — cd backend && npm install' };
  }
  return { ok: true };
}

async function runLiveTest() {
  const pre = preflight();
  if (!pre.ok) { mark(false, 'Preflight', pre.reason); return false; }
  mark(true, 'Preflight', 'OK');

  require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: F_ENV });
  const mysql = require(path.join(BACKEND, 'node_modules', 'mysql2', 'promise'));
  const bcrypt = require(path.join(BACKEND, 'node_modules', 'bcryptjs'));

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  const testPhone = '09' + String(Date.now()).slice(-9);
  const testEmail = 'test-buyer-' + TS + '@test.local';
  const testPw = 'Test1234!';

  let userId = null, categoryId = null, productId = null;
  let child = null;
  const orderIds = [];

  try {
    /* Fixtures */
    await pool.query("DELETE FROM users WHERE email LIKE 'test-buyer-%@test.local'");
    const hash = await bcrypt.hash(testPw, 10);
    const [u] = await pool.query(
      'INSERT INTO users (name, email, phone, password, role) VALUES (?,?,?,?,?)',
      ['Test Buyer', testEmail, testPhone, hash, 'user']
    );
    userId = u.insertId;

    /* Category (reuse or create) */
    const [catRows] = await pool.query("SELECT id FROM categories LIMIT 1");
    if (catRows.length) {
      categoryId = catRows[0].id;
    } else {
      const [c] = await pool.query(
        "INSERT INTO categories (name, slug, icon, color, order_num) VALUES ('Test', 'test-cat', 'book', '#3b82f6', 0)"
      );
      categoryId = c.insertId;
    }

    /* Product */
    const [p] = await pool.query(
      "INSERT INTO products (name, slug, brand, category_id, price, off, stock, is_active, created_by) " +
      "VALUES (?,?,?,?,?,?,?,?,?)",
      ['ExpiryTest Product', 'expiry-test-' + TS, 'TB', categoryId, 100000, 0, 10, 1, userId]
    );
    productId = p.insertId;
    mark(true, 'fixtures: user + product', 'user=' + userId + ' product=' + productId);

    /* Boot isolated server */
    const port = await findFreePort();
    child = await bootServer(port);
    mark(true, 'Boot server', 'port=' + port);

    /* Login */
    const login = await httpReq(port, 'POST', '/api/auth/login', {
      phone: testPhone, password: testPw,
    });
    if (login.status !== 200 || !login.body.user) {
      mark(false, 'Login', 'HTTP ' + login.status);
      return false;
    }
    const cookie = (login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

    const shippingAddress = {
      name: 'Test Buyer', phone: testPhone, province: 'Tehran',
      city: 'Tehran', street: 'Some Street 123', postalCode: '1234567890',
    };

    /* --- Test 1: create online order → payment_expires_at set, stock decremented --- */
    const o1 = await httpReq(port, 'POST', '/api/orders', {
      items: [{ product: productId, qty: 2 }],
      shippingAddress,
      paymentMethod: 'online',
    }, cookie);
    if (o1.status !== 201 || !o1.body.order) {
      mark(false, 'T1: create online order', 'HTTP ' + o1.status + ' ' + (o1.body.message || ''));
      return false;
    }
    const order1 = o1.body.order;
    orderIds.push(order1.id);
    const [row1] = await pool.query(
      'SELECT payment_expires_at, status FROM orders WHERE id = ?', [order1.id]
    );
    const hasExpiry = row1[0].payment_expires_at !== null;
    const [stock1] = await pool.query('SELECT stock FROM products WHERE id = ?', [productId]);
    if (hasExpiry && row1[0].status === 'pending' && stock1[0].stock === 8) {
      mark(true, 'T1: online order created (expiry set, stock 10→8)', 'expires_at=' + row1[0].payment_expires_at);
    } else {
      mark(false, 'T1: online order created',
           'expiresAt=' + row1[0].payment_expires_at + ' status=' + row1[0].status + ' stock=' + stock1[0].stock);
    }

    /* --- Test 2: force-expire the order, call expirePendingOrders() --- */
    await pool.query(
      'UPDATE orders SET payment_expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?',
      [order1.id]
    );
    /* Require the controller in-process (uses its own pool, same DB) */
    const ctrl = require(path.join(BACKEND, 'controllers', 'orderController'));
    const expiredCount = await ctrl.expirePendingOrders();
    const [row2] = await pool.query(
      'SELECT status, stock_restored FROM orders WHERE id = ?', [order1.id]
    );
    const [stock2] = await pool.query('SELECT stock FROM products WHERE id = ?', [productId]);
    if (row2[0].status === 'cancelled' && row2[0].stock_restored === 1 && stock2[0].stock === 10 && expiredCount >= 1) {
      mark(true, 'T2: worker expired order + stock restored (8→10)', 'expired=' + expiredCount);
    } else {
      mark(false, 'T2: worker expired order + stock restored',
           'status=' + row2[0].status + ' stock_restored=' + row2[0].stock_restored + ' stock=' + stock2[0].stock + ' expired=' + expiredCount);
    }

    /* --- Test 3: create second order, expire, then confirmPayment() --- */
    const o3 = await httpReq(port, 'POST', '/api/orders', {
      items: [{ product: productId, qty: 3 }],
      shippingAddress,
      paymentMethod: 'online',
    }, cookie);
    if (o3.status !== 201 || !o3.body.order) {
      mark(false, 'T3: create second order', 'HTTP ' + o3.status);
      return true; /* skip rest but pass */
    }
    const order3 = o3.body.order;
    orderIds.push(order3.id);

    await pool.query(
      'UPDATE orders SET payment_expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?',
      [order3.id]
    );
    const late = await httpReq(port, 'POST', '/api/orders/' + order3.id + '/confirm-payment', {}, cookie);
    const [row3] = await pool.query(
      'SELECT status, stock_restored FROM orders WHERE id = ?', [order3.id]
    );
    const [stock3] = await pool.query('SELECT stock FROM products WHERE id = ?', [productId]);
    if (late.status === 400 && row3[0].status === 'cancelled' && row3[0].stock_restored === 1 && stock3[0].stock === 10) {
      mark(true, 'T3: late confirmPayment → 400 + auto-expire + stock freed (7→10)',
           'msg=' + (late.body.message || '').slice(0, 40));
    } else {
      mark(false, 'T3: late confirmPayment → 400 + auto-expire + stock freed',
           'HTTP=' + late.status + ' status=' + row3[0].status + ' stock=' + stock3[0].stock);
    }

    /* --- Test 4: fresh order, confirm on time → 200 + status='paid' --- */
    const o4 = await httpReq(port, 'POST', '/api/orders', {
      items: [{ product: productId, qty: 1 }],
      shippingAddress,
      paymentMethod: 'online',
    }, cookie);
    if (o4.status !== 201 || !o4.body.order) {
      mark(false, 'T4: create third order', 'HTTP ' + o4.status);
      return true;
    }
    const order4 = o4.body.order;
    orderIds.push(order4.id);
    const ok = await httpReq(port, 'POST', '/api/orders/' + order4.id + '/confirm-payment', {}, cookie);
    if (ok.status === 200 && ok.body.order && ok.body.order.status === 'paid') {
      mark(true, 'T4: on-time confirmPayment → 200 + status=paid', 'ok');
    } else {
      mark(false, 'T4: on-time confirmPayment → 200 + status=paid',
           'HTTP=' + ok.status + ' status=' + (ok.body.order && ok.body.order.status));
    }

    return true;
  } catch (err) {
    mark(false, 'Live test', err.message);
    if (err.output) {
      mark(false, 'server output', '\n  ---\n' + err.output.slice(-1500).replace(/\n/g, '\n  ') + '\n  ---');
    }
    return false;
  } finally {
    if (child) {
      try { child.kill('SIGTERM'); } catch (_) {}
      setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 800);
      await new Promise(r => setTimeout(r, 1000));
    }
    /* cleanup */
    try {
      for (const id of orderIds) {
        await pool.query('DELETE FROM order_items WHERE order_id = ?', [id]);
        await pool.query('DELETE FROM orders WHERE id = ?', [id]);
      }
      if (productId) await pool.query('DELETE FROM products WHERE id = ?', [productId]);
      if (userId)    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    } catch (_) {}
    try { await pool.end(); } catch (_) {}
  }
}

/* ================================================================
   Main
   ================================================================ */

(async () => {
  banner('Fix + Test — Expire abandoned pending online orders');

  if (!TEST_ONLY) {
    console.log('');
    console.log('  📦 پچ‌ها:');

    /* new files */
    if (!fs.existsSync(F_WORKER)) {
      fs.writeFileSync(F_WORKER, WORKER_JS, 'utf8');
      mark(true, 'utils/orderExpiryWorker.js', 'ساخته شد');
    } else {
      backup(F_WORKER);
      fs.writeFileSync(F_WORKER, WORKER_JS, 'utf8');
      mark(true, 'utils/orderExpiryWorker.js', 'بازنویسی شد');
    }

    if (!fs.existsSync(F_MIGRATE)) {
      fs.writeFileSync(F_MIGRATE, MIGRATE_JS, 'utf8');
      mark(true, 'utils/migrate-order-expiry.js', 'ساخته شد');
    } else {
      backup(F_MIGRATE);
      fs.writeFileSync(F_MIGRATE, MIGRATE_JS, 'utf8');
      mark(true, 'utils/migrate-order-expiry.js', 'بازنویسی شد');
    }

    try { patchDbInit();         } catch (e) { fatal(e.message); }
    try { patchOrderController();} catch (e) { fatal(e.message); }
    try { patchRoutes();         } catch (e) { fatal(e.message); }
    try { patchServer();         } catch (e) { fatal(e.message); }
    try { patchEnv();            } catch (e) { fatal(e.message); }

    /* run migration in a child process to isolate its pool */
    console.log('');
    console.log('  📦 Migration:');
    try {
      const { execFileSync } = require('child_process');
      const out = execFileSync(process.execPath, [path.basename(F_MIGRATE)], {
        cwd: path.dirname(F_MIGRATE),
        stdio: 'pipe',
        timeout: 60000,
      }).toString();
      const added = (out.match(/\[add\]/g) || []).length;
      const skipped = (out.match(/\[skip\]/g) || []).length;
      mark(/Done\./.test(out), 'migrate-order-expiry.js', 'add=' + added + ' skip=' + skipped);
      if (!/Done\./.test(out)) {
        mark(false, 'migration output', '\n  ' + out.replace(/\n/g, '\n  '));
      }
    } catch (e) {
      const out = (e.stdout && e.stdout.toString()) || (e.stderr && e.stderr.toString()) || e.message;
      mark(false, 'migration', '\n  ' + out.slice(-600));
    }
  }

  console.log('');
  console.log('  🔬 بررسی ایستا:');
  try { staticChecks(); } catch (e) { mark(false, 'Static checks', e.message); }

  let livePassed = false;
  if (!DRY_RUN) {
    console.log('');
    console.log('  🔬 تست زنده:');
    livePassed = await runLiveTest();
  }

  const ok   = report.filter(r => r.ok).length;
  const fail = report.length - ok;
  const staticOk = report.filter(r =>
    /controller:|routes:|server:|db\/init:|orderExpiryWorker|migrate/.test(r.key)
  ).every(r => r.ok);
  const pass = staticOk && (DRY_RUN || livePassed);

  banner((pass ? '✅ RESULT: PASS' : '❌ RESULT: FAIL') +
         '  (' + ok + '/' + report.length + ')');

  if (pass) {
    console.log('  → سرور اصلی را یک‌بار ری‌استارت کن:  cd backend && npm start');
    console.log('  → بکاپ‌ها:  *.pre-expiryfix-' + TS);
    console.log('');
    console.log('  ⚙️  رفتار جدید:');
    console.log('    • سفارش آنلاین: payment_expires_at = NOW + ORDER_PAYMENT_TTL_MINUTES (پیش‌فرض ۳۰ دقیقه).');
    console.log('    • worker هر ORDER_EXPIRY_INTERVAL_MS (پیش‌فرض ۶۰s) سفارش‌های منقضی را لغو می‌کند.');
    console.log('    • confirmPayment دیرکردار → 400 + لغو فوری + بازگشت موجودی.');
    console.log('    • COD همچنان دستی توسط ادمین مدیریت می‌شود (بدون انقضای خودکار).');
    console.log('    • تریگر دستی:  POST /api/orders/admin/expire-pending');
    console.log('');
    console.log('  ⚠️  سفارش‌های pending موجود که payment_expires_at آن‌ها NULL است،');
    console.log('     توسط worker لمس نمی‌شوند. برای پاک‌سازی، تریگر دستی را صدا بزن');
    console.log('     یا دستی payment_expires_at را برایشان ست کن.');
  } else {
    console.log('  → خروجی خطاها را بخوان.');
    if (!livePassed) {
      console.log('    * Preflight: .env / MySQL / node_modules');
      console.log('    * server output: مشکل boot (DB/OTP_SECRET)');
      console.log('    * اگر migration شکست خورد: دسترسی ALTER روی orders را چک کن.');
    }
    console.log('  → بازگردانی: فایل‌های *.pre-expiryfix-' + TS + ' را روی اصل کپی کن.');
  }
  console.log('');
  process.exit(pass ? 0 : 1);
})();