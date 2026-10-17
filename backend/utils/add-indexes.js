require('dotenv').config();
const { pool } = require('../db/init');

async function hasIdx(t, n){
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?',
    [process.env.DB_NAME, t, n]
  );
  return r[0].c > 0;
}
async function add(t, n, c){
  if(await hasIdx(t, n)){ console.log('[skip] ' + n); return; }
  try{
    await pool.query('CREATE INDEX ' + n + ' ON ' + t + ' (' + c + ')');
    console.log('[add]  ' + n);
  }catch(e){ console.log('[fail] ' + n + ' — ' + e.message); }
}
(async ()=>{
  try{
    await add('products', 'idx_prod_created', 'created_at');
    await add('products', 'idx_prod_price', 'price');
    await add('products', 'idx_prod_off', 'off');
    await add('products', 'idx_prod_stock', 'stock');
    await add('products', 'idx_prod_rating', 'rating');
    await add('products', 'idx_prod_sales', 'sales');
    await add('products', 'idx_prod_cat_active', 'category_id, is_active');
    await add('orders', 'idx_ord_created', 'created_at');
    await add('orders', 'idx_ord_status', 'status');
    await add('orders', 'idx_ord_user', 'user_id');
    await add('order_items', 'idx_oi_prod', 'product_id');
    await add('users', 'idx_usr_role', 'role');
    await add('users', 'idx_usr_created', 'created_at');
    await add('reviews', 'idx_rev_created', 'created_at');
    await add('cms_pages', 'idx_cms_menu', 'show_in_menu');
    console.log('Indexes done.');
    await pool.end();
    process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
})();
