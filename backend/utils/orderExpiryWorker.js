'use strict';
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
