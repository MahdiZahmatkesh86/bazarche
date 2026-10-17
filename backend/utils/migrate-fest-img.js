require('dotenv').config();
const { pool } = require('../db/init');
async function hasCol(t, c){
  const [r] = await pool.query('SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [process.env.DB_NAME, t, c]);
  return r[0].c > 0;
}
(async ()=>{
  try{
    if(!await hasCol('site_festivals', 'image_url')){
      await pool.query('ALTER TABLE site_festivals ADD COLUMN image_url VARCHAR(500)');
      console.log('[add] site_festivals.image_url');
    } else {
      console.log('[skip] site_festivals.image_url');
    }
    console.log('done');
    await pool.end();
    process.exit(0);
  }catch(e){ console.error('ERR:', e.message); process.exit(1); }
})();