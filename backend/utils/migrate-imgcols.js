require('dotenv').config();
const { pool } = require('../db/init');
async function hasCol(t, c){
  const [r] = await pool.query('SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [process.env.DB_NAME, t, c]);
  return r[0].c > 0;
}
async function add(t, c, def){
  if(await hasCol(t, c)){ console.log('[skip] ' + t + '.' + c); return; }
  try{ await pool.query('ALTER TABLE ' + t + ' ADD COLUMN ' + c + ' ' + def); console.log('[add]  ' + t + '.' + c); }
  catch(e){ console.log('[fail] ' + t + '.' + c); }
}
(async ()=>{
  try{
    await add('categories', 'image_url', 'VARCHAR(500)');
    await add('site_features', 'image_url', 'VARCHAR(500)');
    console.log('done');
    await pool.end();
    process.exit(0);
  }catch(e){ console.error('ERR:', e.message); process.exit(1); }
})();