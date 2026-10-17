const { pool, q, qOne, insert } = require('../db/init');

const { FREE_THRESHOLD: FREE_SHIPPING, SHIPPING_COST } = require('../utils/shippingConstants');

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


function finalPrice(p){
  return Math.round(p.price * (1 - p.off/100) / 1000) * 1000;
}

async function getOrderItems(conn, orderId){
  const [rows] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  return rows;
}

function buildOrder(order, items, forAdmin){
  const out = {
    id: order.id, _id: order.id,
    items: items.map(i => ({
      _id: i.id, product: i.product_id, name: i.name, art: i.art,
      color: i.color_name ? { name: i.color_name, hex: i.color_hex } : null,
      price: i.price, qty: i.qty, lineTotal: i.line_total
    })),
    shippingAddress: {
      name: order.shipping_name, phone: order.shipping_phone,
      province: order.shipping_province, city: order.shipping_city,
      street: order.shipping_street, postalCode: order.shipping_postal
    },
    itemsPrice: order.items_price,
    shippingPrice: order.shipping_price,
    totalPrice: order.total_price,
    paymentMethod: order.payment_method,
    trackingCode: order.tracking_code,
    status: order.status,
    paymentSimulated: !!order.payment_simulated,
    customerNote: order.note || '',
    createdAt: order.created_at
  };
  if(forAdmin){
    out.discountAmount = Number(order.discount || 0);
    out.tax = Number(order.tax || 0);
    out.internalNote = order.internal_note || '';
    out.shipmentTracking = order.shipment_tracking || null;
    out.shipmentCarrier = order.shipment_carrier || null;
    out.refundedAmount = Number(order.refunded_amount || 0);
    out.returnedAt = order.returned_at;
    out.returnReason = order.return_reason;
    out.refundedAt = order.refunded_at;
    out.refundNote = order.refund_note;
    out.stockRestored = !!order.stock_restored;
  }
  return out;
}

async function hydrateOrder(row, forAdmin){
  const items = await q('SELECT * FROM order_items WHERE order_id = ?', [row.id]);
  return buildOrder(row, items, forAdmin);
}

function isAdmin(req){ return req && req.user && req.user.role === 'admin'; }

/* ============ Create — with transaction ============ */
exports.create = async (req, res, next) => {
  let conn = null;
  let __released = false;
  try{
    conn = await pool.getConnection();
    const { items, shippingAddress, paymentMethod, note } = req.body;
    if(!Array.isArray(items) || !items.length){
      if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'سبد خرید خالی است.' });
    }
    if(!shippingAddress || !shippingAddress.name || !shippingAddress.city || !shippingAddress.street){
      if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'اطلاعات نشانی ناقص است.' });
    }
    const pm = paymentMethod === 'cod' ? 'cod' : 'online';

    // merge duplicate products
    const merged = {};
    for(const raw of items){
      const pid = Number(raw.product);
      const qty = Number(raw.qty);
      if(!Number.isInteger(pid) || pid <= 0) continue;
      if(!Number.isInteger(qty) || qty <= 0 || qty > 10){
        if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
        return res.status(400).json({ success:false, message:'تعداد کالا نامعتبر است.' });
      }
      /* کلید = product + color تا دو رنگ مختلف با هم ادغام نشن */
      const cname = (raw.color && raw.color.name) ? String(raw.color.name).trim() : '';
      const chex  = (raw.color && raw.color.hex)  ? String(raw.color.hex).trim()  : '';
      const key = pid + '::' + cname;
      if(!merged[key]){
        merged[key] = { product: pid, qty: 0, color: cname ? { name: cname, hex: chex } : null };
      }
      merged[key].qty += qty;
    }
    const list = Object.values(merged);
    if(!list.length){
      if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'سبد خرید خالی است.' });
    }

    await conn.beginTransaction();

    let itemsPrice = 0;
    const prepared = [];

    for(const it of list){
      const [rows] = await conn.query('SELECT * FROM products WHERE id = ? AND is_active = 1 FOR UPDATE', [it.product]);
      const p = rows[0];
      if(!p){
        await conn.rollback();
        if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
        return res.status(400).json({ success:false, message:'کالای انتخاب‌شده در دسترس نیست.' });
      }
      if(p.stock < it.qty){
        await conn.rollback();
        if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
        return res.status(400).json({ success:false, message:'موجودی «' + p.name + '» کافی نیست.' });
      }
      const fp = finalPrice(p);
      const lineTotal = fp * it.qty;
      itemsPrice += lineTotal;
      let color = it.color;
      if(!color || !color.name){
        const [cs] = await conn.query('SELECT name, hex FROM product_colors WHERE product_id = ? LIMIT 1', [p.id]);
        if(cs[0]) color = { name: cs[0].name, hex: cs[0].hex };
      }
      prepared.push({
        product_id: p.id, name: p.name, art: p.art,
        color_name: color ? color.name : null,
        color_hex: color ? color.hex : null,
        price: fp, qty: it.qty, line_total: lineTotal
      });
    }

    const shippingPrice = itemsPrice >= FREE_SHIPPING ? 0 : SHIPPING_COST;
    const totalPrice = itemsPrice + shippingPrice;
    const trackCode = 'BZ-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random()*1000);

    // online: pending until confirmed. cod: pending too.
    const status = 'pending';
    const paymentSimulated = pm === 'online' ? 1 : 0;

    const ttlMinutes = Math.max(1, Number(process.env.ORDER_PAYMENT_TTL_MINUTES || 30));
    const paymentExpiresAt = pm === 'online'
      ? new Date(Date.now() + ttlMinutes * 60 * 1000)
      : null;

    const [orderRes] = await conn.query(
      'INSERT INTO orders (user_id, payment_method, items_price, shipping_price, total_price, status, tracking_code, note, shipping_name, shipping_phone, shipping_province, shipping_city, shipping_street, shipping_postal, payment_simulated, payment_expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.user.id, pm, itemsPrice, shippingPrice, totalPrice, status, trackCode, note || '', shippingAddress.name, shippingAddress.phone, shippingAddress.province || null, shippingAddress.city, shippingAddress.street, shippingAddress.postalCode || null, paymentSimulated, paymentExpiresAt]
    );
    const orderId = orderRes.insertId;

    for(const it of prepared){
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, name, art, color_name, color_hex, price, qty, line_total) VALUES (?,?,?,?,?,?,?,?,?)',
        [orderId, it.product_id, it.name, it.art, it.color_name, it.color_hex, it.price, it.qty, it.line_total]
      );
      await conn.query('UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?', [it.qty, it.qty, it.product_id]);
    }

    await conn.commit();
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }

    const order = await qOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    const items2 = await q('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    res.status(201).json({ success:true, order: buildOrder(order, items2, true) });
  }catch(err){
    try{ if(conn) await conn.rollback(); }catch(e){}
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    next(err);
  }
};

/* ============ Confirm payment (simulated gateway) ============ */
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
};

/* ============ My Orders ============ */
exports.myOrders = async (req, res, next) => {
  try{
    const rows = await q('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    const orders = [];
    for(const r of rows){
      const items = await q('SELECT * FROM order_items WHERE order_id = ?', [r.id]);
      orders.push(buildOrder(r, items, false));
    }
    res.json({ success:true, orders });
  }catch(err){ next(err); }
};

exports.getOne = async (req, res, next) => {
  try{
    const order = await qOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if(!order) return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' });
    const owner = order.user_id === req.user.id;
    if(!owner && req.user.role !== 'admin'){
      return res.status(403).json({ success:false, message:'دسترسی ندارید.' });
    }
    const items = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(order, items, isAdmin(req)) });
  }catch(err){ next(err); }
};

/* ============ Cancel — with transaction ============ */
exports.cancel = async (req, res, next) => {
  let conn = null;
  let __released = false;
  try{
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [oRows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    const order = oRows[0];
    if(!order){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' });
    }
    if(order.user_id !== req.user.id && req.user.role !== 'admin'){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(403).json({ success:false, message:'دسترسی ندارید.' });
    }
    const isAdmin = req.user.role === 'admin';
    if(['shipped','delivered','cancelled','refunded'].includes(order.status)){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'این سفارش قابل لغو نیست.' });
    }
    /* کاربر فقط می‌تونه سفارش pending رو لغو کنه (پرداخت‌نشده) */
    if(!isAdmin && order.status !== 'pending'){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({
        success:false,
        message:'فقط سفارش در انتظار پرداخت قابل لغو است. برای لغو سفارش پرداخت‌شده با پشتیبانی تماس بگیرید.'
      });
    }
    if(order.stock_restored){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'موجودی این سفارش قبلاً برگشت داده شده.' });
    }
    await conn.query("UPDATE orders SET status = 'cancelled', stock_restored = 1 WHERE id = ?", [order.id]);
    const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    for(const it of items){
      await conn.query('UPDATE products SET stock = stock + ?, sales = GREATEST(sales - ?, 0) WHERE id = ?', [it.qty, it.qty, it.product_id]);
    }
    await conn.commit();
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    const updated = await qOne('SELECT * FROM orders WHERE id = ?', [order.id]);
    const items2 = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(updated, items2, true) });
  }catch(err){
    try{ if(conn) await conn.rollback(); }catch(e){}
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    next(err);
  }
};

/* ============ Admin: list ============ */
exports.listAll = async (req, res, next) => {
  try{
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30));
    const offset = (page - 1) * limit;
    const where = []; const params = [];
    if(req.query.status){ where.push('o.status = ?'); params.push(req.query.status); }
    if(req.query.q){ where.push('(o.tracking_code LIKE ? OR o.shipment_tracking LIKE ?)'); const like = '%' + req.query.q + '%'; params.push(like, like); }
    if(req.query.customer){ where.push('(o.shipping_name LIKE ? OR o.shipping_phone LIKE ?)'); const like = '%' + req.query.customer + '%'; params.push(like, like); }
    if(req.query.from){ where.push('o.created_at >= ?'); params.push(req.query.from + ' 00:00:00'); }
    if(req.query.to){ where.push('o.created_at <= ?'); params.push(req.query.to + ' 23:59:59'); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const sql = 'SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON u.id = o.user_id ' + whereSql + ' ORDER BY o.created_at DESC LIMIT ' + limit + ' OFFSET ' + offset;
    const rows = await q(sql, params);
    const totalRow = await qOne('SELECT COUNT(*) c FROM orders o ' + whereSql, params);
    const items = await Promise.all(rows.map(async r => {
      const its = await q('SELECT * FROM order_items WHERE order_id = ?', [r.id]);
      const built = buildOrder(r, its, true);
      built.user = { name: r.user_name, email: r.user_email };
      return built;
    }));
    res.json({ success:true, items, pagination: { page, limit, total: totalRow.c, pages: Math.ceil(totalRow.c / limit) } });
  }catch(err){ next(err); }
};

exports.updateStatus = async (req, res, next) => {
  let conn = null;
  let __released = false;
  try{
    conn = await pool.getConnection();
    const { status } = req.body;
    const allowed = ['pending','paid','processing','shipped','delivered','cancelled','refunded'];
    if(!allowed.includes(status)){
      if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'وضعیت نامعتبر است.' });
    }
    /* State machine — گذارهای مجاز */
    const TRANSITIONS = {
      pending:    ['paid','cancelled'],
      paid:       ['processing','shipped','cancelled','refunded'],
      processing: ['shipped','cancelled','refunded'],
      shipped:    ['delivered','refunded'],
      delivered:  ['refunded'],
      cancelled:  [],
      refunded:   [],
    };
    await conn.beginTransaction();
    const [oRows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    const order = oRows[0];
    if(!order){ await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} } return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' }); }

    /* چک گذار مجاز */
    if(status !== order.status){
      const allowedNext = TRANSITIONS[order.status] || [];
      if(allowedNext.indexOf(status) === -1){
        await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
        return res.status(400).json({
          success:false,
          message: 'گذار از «' + order.status + '» به «' + status + '» مجاز نیست.'
        });
      }
    }

    // if transitioning to cancelled and stock not yet restored, restore it
    if(status === 'cancelled' && !order.stock_restored && order.status !== 'cancelled'){
      const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      for(const it of items){
        await conn.query('UPDATE products SET stock = stock + ?, sales = GREATEST(sales - ?, 0) WHERE id = ?', [it.qty, it.qty, it.product_id]);
      }
      await conn.query('UPDATE orders SET stock_restored = 1 WHERE id = ?', [order.id]);
    }
    const fields = ['status = ?']; const vals = [status];
    if(status === 'delivered') fields.push('delivered_at = NOW()');
    if(status === 'paid' && !order.paid_at) fields.push('paid_at = NOW()');
    vals.push(order.id);
    await conn.query('UPDATE orders SET ' + fields.join(', ') + ' WHERE id = ?', vals);
    await conn.commit();
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    const updated = await qOne('SELECT * FROM orders WHERE id = ?', [order.id]);
    const items2 = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(updated, items2, true) });
  }catch(err){
    try{ if(conn) await conn.rollback(); }catch(e){}
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    next(err);
  }
};

/* ============ Admin: shipment ============ */
exports.updateShipment = async (req, res, next) => {
  try{
    const { shipmentTracking, shipmentCarrier } = req.body;
    const fields = []; const vals = [];
    if(shipmentTracking !== undefined){ fields.push('shipment_tracking = ?'); vals.push(shipmentTracking || null); }
    if(shipmentCarrier !== undefined){ fields.push('shipment_carrier = ?'); vals.push(shipmentCarrier || null); }
    if(shipmentTracking){
      const cur = await qOne('SELECT status FROM orders WHERE id = ?', [req.params.id]);
      if(cur && ['paid','processing'].includes(cur.status)){
        fields.push("status = 'shipped'");
      }
    }
    if(fields.length){ vals.push(req.params.id); await q('UPDATE orders SET ' + fields.join(', ') + ' WHERE id = ?', vals); }
    const order = await qOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if(!order) return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' });
    const items = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(order, items, true) });
  }catch(err){ next(err); }
};

exports.updateFinancial = async (req, res, next) => {
  try{
    const order = await qOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if(!order) return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' });
    const tax = req.body.tax !== undefined ? Math.max(0, Number(req.body.tax) || 0) : Number(order.tax || 0);
    const discount = req.body.discount !== undefined ? Math.max(0, Number(req.body.discount) || 0) : Number(order.discount || 0);
    const shipping = req.body.shippingCost !== undefined ? Math.max(0, Number(req.body.shippingCost) || 0) : Number(order.shipping_price || 0);
    const total = Math.max(0, Number(order.items_price || 0) + tax + shipping - discount);
    await q('UPDATE orders SET tax = ?, discount = ?, shipping_price = ?, total_price = ? WHERE id = ?', [tax, discount, shipping, total, order.id]);
    const updated = await qOne('SELECT * FROM orders WHERE id = ?', [order.id]);
    const items = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(updated, items, true) });
  }catch(err){ next(err); }
};

exports.updateNotes = async (req, res, next) => {
  try{
    const { internalNote, customerNote } = req.body;
    const fields = []; const vals = [];
    if(internalNote !== undefined){ fields.push('internal_note = ?'); vals.push(String(internalNote).slice(0, 2000)); }
    if(customerNote !== undefined){ fields.push('note = ?'); vals.push(String(customerNote).slice(0, 1000)); }
    if(fields.length){ vals.push(req.params.id); await q('UPDATE orders SET ' + fields.join(', ') + ' WHERE id = ?', vals); }
    const order = await qOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if(!order) return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' });
    const items = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(order, items, true) });
  }catch(err){ next(err); }
};

/* ============ Refund — idempotent ============ */
exports.refund = async (req, res, next) => {
  let conn = null;
  let __released = false;
  try{
    conn = await pool.getConnection();
    const { amount, note } = req.body;
    await conn.beginTransaction();
    const [oRows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    const order = oRows[0];
    if(!order){ await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} } return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' }); }
    if(order.status === 'refunded'){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'این سفارش قبلاً بازپرداخت شده.' });
    }
    /* فقط سفارش‌هایی که واقعاً پول گرفته‌ان قابل بازپرداخت هستن */
    if(['pending','cancelled'].includes(order.status)){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({
        success:false,
        message:'این سفارش پرداخت نشده — بازپرداخت مجاز نیست.'
      });
    }
    const amt = Math.max(0, Number(amount) || 0);
    if(amt <= 0){ await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} } return res.status(400).json({ success:false, message:'مبلغ بازپرداخت الزامی است.' }); }
    if(amt > Number(order.total_price)){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'مبلغ بازپرداخت از مبلغ سفارش بیشتر است.' });
    }
    // restore stock only if not already
    if(!order.stock_restored){
      const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      for(const it of items){
        await conn.query('UPDATE products SET stock = stock + ?, sales = GREATEST(sales - ?, 0) WHERE id = ?', [it.qty, it.qty, it.product_id]);
      }
    }
    await conn.query("UPDATE orders SET refunded_amount = ?, refund_note = ?, refunded_at = NOW(), status = 'refunded', stock_restored = 1 WHERE id = ?", [amt, String(note || '').slice(0, 2000), order.id]);
    await conn.commit();
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    const updated = await qOne('SELECT * FROM orders WHERE id = ?', [order.id]);
    const items2 = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(updated, items2, true) });
  }catch(err){
    try{ if(conn) await conn.rollback(); }catch(e){}
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    next(err);
  }
};

exports.markReturned = async (req, res, next) => {
  let conn = null;
  let __released = false;
  try{
    conn = await pool.getConnection();
    const { reason } = req.body;
    if(!reason || String(reason).trim().length < 3){
      if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'دلیل مرجوعی الزامی است.' });
    }
    await conn.beginTransaction();
    const [oRows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    const order = oRows[0];
    if(!order){ await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} } return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' }); }
    if(order.status === 'refunded'){
      await conn.rollback(); if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
      return res.status(400).json({ success:false, message:'این سفارش قبلاً مرجوع/بازپرداخت شده.' });
    }
    if(!order.stock_restored){
      const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      for(const it of items){
        await conn.query('UPDATE products SET stock = stock + ?, sales = GREATEST(sales - ?, 0) WHERE id = ?', [it.qty, it.qty, it.product_id]);
      }
    }
    await conn.query("UPDATE orders SET returned_at = NOW(), return_reason = ?, status = 'refunded', stock_restored = 1 WHERE id = ?", [String(reason).trim().slice(0, 2000), order.id]);
    await conn.commit();
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    const updated = await qOne('SELECT * FROM orders WHERE id = ?', [order.id]);
    const items2 = await q('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ success:true, order: buildOrder(updated, items2, true) });
  }catch(err){
    try{ if(conn) await conn.rollback(); }catch(e){}
    if(!__released){ __released = true; try{ conn.release(); }catch(e){} }
    next(err);
  }
};

/* ============ Dashboard — فقط سفارش‌های موفق ============ */
exports.dashboard = async (req, res, next) => {
  try{
    const SUC = "status IN ('paid','processing','shipped','delivered')";
    const total = await qOne('SELECT COUNT(*) c FROM orders');
    const pending = await qOne("SELECT COUNT(*) c FROM orders WHERE status='pending'");
    const paid = await qOne("SELECT COUNT(*) c FROM orders WHERE status='paid'");
    const delivered = await qOne("SELECT COUNT(*) c FROM orders WHERE status='delivered'");
    const cancelled = await qOne("SELECT COUNT(*) c FROM orders WHERE status='cancelled'");
    const revenue = await qOne('SELECT COALESCE(SUM(total_price),0) s FROM orders WHERE ' + SUC);
    res.json({ success:true, stats: { totalOrders: total.c, pending: pending.c, paid: paid.c, delivered: delivered.c, cancelled: cancelled.c, revenue: Number(revenue.s) } });
  }catch(err){ next(err); }
};

/* ============ Full dashboard ============ */
exports.fullDashboard = async (req, res, next) => {
  try{
    const SUC = "status IN ('paid','processing','shipped','delivered')";
    const today = await qOne("SELECT COUNT(*) c, COALESCE(SUM(total_price),0) s FROM orders WHERE DATE(created_at)=CURDATE() AND " + SUC);
    const week = await qOne("SELECT COUNT(*) c, COALESCE(SUM(total_price),0) s FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND " + SUC);
    const month = await qOne("SELECT COUNT(*) c, COALESCE(SUM(total_price),0) s FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND " + SUC);
    const year = await qOne("SELECT COUNT(*) c, COALESCE(SUM(total_price),0) s FROM orders WHERE YEAR(created_at)=YEAR(NOW()) AND " + SUC);
    const statusRows = await q('SELECT status, COUNT(*) c FROM orders GROUP BY status');
    const statusCounts = { pending:0, paid:0, processing:0, shipped:0, delivered:0, cancelled:0, refunded:0 };
    statusRows.forEach(r => { statusCounts[r.status] = r.c; });
    const usersRow = await qOne("SELECT COUNT(*) c FROM users WHERE role='user'");
    const prodRow = await qOne("SELECT COUNT(*) total, SUM(CASE WHEN stock=0 THEN 1 ELSE 0 END) oos, SUM(CASE WHEN stock>0 AND stock<=5 THEN 1 ELSE 0 END) low FROM products WHERE is_active=1");
    const revRow = await qOne('SELECT COALESCE(SUM(total_price),0) s FROM orders WHERE ' + SUC);
    const pendingRow = await qOne("SELECT COALESCE(SUM(total_price),0) s FROM orders WHERE status='pending'");
    const dailyRaw = await q("SELECT DATE_FORMAT(created_at,'%Y-%m-%d') d, COUNT(*) c, COALESCE(SUM(total_price),0) s FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND " + SUC + ' GROUP BY DATE_FORMAT(created_at,\'%Y-%m-%d\') ORDER BY d');
    const dailyMap = {};
    dailyRaw.forEach(r => { dailyMap[r.d] = { c: Number(r.c), s: Number(r.s) }; });
    const chartDaily = [];
    for(let i = 6; i >= 0; i--){
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const row = dailyMap[key] || { c:0, s:0 };
      chartDaily.push({ date:key, orders: row.c, revenue: row.s });
    }
    const monthlyRaw = await q("SELECT DATE_FORMAT(created_at,'%Y-%m') m, COALESCE(SUM(total_price),0) s FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) AND " + SUC + ' GROUP BY DATE_FORMAT(created_at,\'%Y-%m\') ORDER BY m');
    const monthlyMap = {};
    monthlyRaw.forEach(r => { monthlyMap[r.m] = Number(r.s); });
    const chartMonthly = [];
    for(let i = 5; i >= 0; i--){
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      chartMonthly.push({ month:key, revenue: monthlyMap[key] || 0 });
    }
    const bestSellers = await q('SELECT id, name, brand, sales, price, off, art, stock FROM products WHERE is_active=1 ORDER BY sales DESC LIMIT 5');
    const latestOrders = await q('SELECT id, tracking_code, shipping_name, total_price, status, created_at FROM orders ORDER BY created_at DESC LIMIT 6');
    const alerts = [];
    if(Number(prodRow.oos) > 0) alerts.push({ type:'danger', icon:'box', text: prodRow.oos + ' محصول ناموجود شده است.' });
    if(Number(prodRow.low) > 0) alerts.push({ type:'warn', icon:'trend', text: prodRow.low + ' محصول موجودی کمتر از ۵ عدد دارد.' });
    if(statusCounts.pending > 0) alerts.push({ type:'info', icon:'cart', text: statusCounts.pending + ' سفارش در انتظار پرداخت است.' });
    if(statusCounts.refunded > 0) alerts.push({ type:'warn', icon:'ret', text: statusCounts.refunded + ' سفارش مرجوع شده است.' });
    res.json({
      success:true,
      today: { orders: Number(today.c), revenue: Number(today.s) },
      week: { orders: Number(week.c), revenue: Number(week.s) },
      month: { orders: Number(month.c), revenue: Number(month.s) },
      year: { orders: Number(year.c), revenue: Number(year.s) },
      statusCounts,
      users: Number(usersRow.c),
      products: { total: Number(prodRow.total) || 0, lowStock: Number(prodRow.low) || 0, outOfStock: Number(prodRow.oos) || 0 },
      revenue: Number(revRow.s),
      pendingAmount: Number(pendingRow.s),
      chartDaily, chartMonthly,
      bestSellers: bestSellers.map(p => {
        const fp = Math.round(p.price * (1 - p.off/100) / 1000) * 1000;
        return { id:p.id, name:p.name, brand:p.brand, art:p.art, sales: Number(p.sales) || 0, revenue: fp * (Number(p.sales)||0) };
      }),
      latestOrders: latestOrders.map(o => ({ id:o.id, trackingCode:o.tracking_code, customer:o.shipping_name, total: Number(o.total_price), status:o.status, createdAt:o.created_at })),
      alerts
    });
  }catch(err){ next(err); }
};
