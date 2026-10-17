require('dotenv').config();
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
