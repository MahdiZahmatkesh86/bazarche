
require('dotenv').config();
const { pool } = require('../db/init');

const COLUMNS = [
  ['tax',               'INT DEFAULT 0'],
  ['shipment_tracking', 'VARCHAR(80)'],
  ['shipment_carrier',  'VARCHAR(60)'],
  ['internal_note',     'TEXT'],
  ['refunded_amount',   'INT DEFAULT 0'],
  ['returned_at',       'TIMESTAMP NULL DEFAULT NULL'],
  ['return_reason',     'TEXT'],
  ['refunded_at',       'TIMESTAMP NULL DEFAULT NULL'],
  ['refund_note',       'TEXT']
];

async function columnExists(table, col){
  const [rows] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',
    [process.env.DB_NAME, table, col]
  );
  return rows[0].c > 0;
}

(async ()=>{
  for(const [name, def] of COLUMNS){
    if(await columnExists('orders', name)){
      console.log('[SKIP] orders.' + name);
      continue;
    }
    await pool.query('ALTER TABLE orders ADD COLUMN ' + name + ' ' + def);
    console.log('[ADD]  orders.' + name);
  }
  console.log('Done.');
  await pool.end();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
