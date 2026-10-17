
require('dotenv').config();
const { pool } = require('../db/init');

const COLS = [
  ['sku',                'VARCHAR(64)'],
  ['purchase_price',     'INT DEFAULT 0'],
  ['short_description',  'VARCHAR(320)'],
  ['images',             'JSON'],
  ['video_url',          'VARCHAR(500)'],
  ['min_stock',          'INT DEFAULT 3'],
  ['weight',             'INT DEFAULT 0'],
  ['dimensions',         'VARCHAR(60)'],
  ['features',           'JSON'],
  ['sizes',              'JSON'],
  ['warranty',           'VARCHAR(120)'],
  ['meta_title',         'VARCHAR(200)'],
  ['meta_description',   'VARCHAR(320)'],
  ['published_at',       'TIMESTAMP NULL DEFAULT NULL']
];

async function hasColumn(table, col){
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',
    [process.env.DB_NAME, table, col]
  );
  return r[0].c > 0;
}

(async ()=>{
  for(const [name, def] of COLS){
    if(await hasColumn('products', name)){ console.log('[SKIP] products.' + name); continue; }
    await pool.query('ALTER TABLE products ADD COLUMN ' + name + ' ' + def);
    console.log('[ADD]  products.' + name);
  }
  console.log('Migration done.');
  await pool.end();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
