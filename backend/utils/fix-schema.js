require('dotenv').config();
const { pool } = require('../db/init');

async function hasColumn(t, c){
  const [r] = await pool.query('SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [process.env.DB_NAME, t, c]);
  return r[0].c > 0;
}
async function hasTable(t){
  const [r] = await pool.query('SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [process.env.DB_NAME, t]);
  return r[0].c > 0;
}
async function addCol(t, c, def){
  if(await hasColumn(t, c)){ console.log('[skip] ' + t + '.' + c); return; }
  try{ await pool.query('ALTER TABLE ' + t + ' ADD COLUMN ' + c + ' ' + def); console.log('[add]  ' + t + '.' + c); }
  catch(e){ console.log('[fail] ' + t + '.' + c + ' — ' + e.message); }
}

(async ()=>{
  try{
    // products columns
    await addCol('products', 'sku', 'VARCHAR(64)');
    await addCol('products', 'purchase_price', 'INT DEFAULT 0');
    await addCol('products', 'short_description', 'VARCHAR(320)');
    await addCol('products', 'images', 'JSON');
    await addCol('products', 'video_url', 'VARCHAR(500)');
    await addCol('products', 'min_stock', 'INT DEFAULT 3');
    await addCol('products', 'weight', 'INT DEFAULT 0');
    await addCol('products', 'dimensions', 'VARCHAR(60)');
    await addCol('products', 'features', 'JSON');
    await addCol('products', 'sizes', 'JSON');
    await addCol('products', 'warranty', 'VARCHAR(120)');
    await addCol('products', 'meta_title', 'VARCHAR(200)');
    await addCol('products', 'meta_description', 'VARCHAR(320)');

    // orders columns
    await addCol('orders', 'tax', 'INT DEFAULT 0');
    await addCol('orders', 'shipment_tracking', 'VARCHAR(80)');
    await addCol('orders', 'shipment_carrier', 'VARCHAR(60)');
    await addCol('orders', 'internal_note', 'TEXT');
    await addCol('orders', 'refunded_amount', 'INT DEFAULT 0');
    await addCol('orders', 'returned_at', 'TIMESTAMP NULL DEFAULT NULL');
    await addCol('orders', 'return_reason', 'TEXT');
    await addCol('orders', 'refunded_at', 'TIMESTAMP NULL DEFAULT NULL');
    await addCol('orders', 'refund_note', 'TEXT');
    await addCol('orders', 'stock_restored', 'TINYINT DEFAULT 0');
    await addCol('orders', 'payment_simulated', 'TINYINT DEFAULT 0');

    // users columns
    await addCol('users', 'token_version', 'INT DEFAULT 0');

    // cms tables
    if(!await hasTable('cms_pages')){
      await pool.query('CREATE TABLE cms_pages (id INT AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(120) UNIQUE NOT NULL, title VARCHAR(200) NOT NULL, content LONGTEXT, meta_title VARCHAR(200), meta_description VARCHAR(320), is_published TINYINT DEFAULT 1, show_in_menu TINYINT DEFAULT 0, sort_order INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_cms_pages_slug (slug)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
      console.log('[add]  cms_pages');
    } else console.log('[skip] cms_pages');
    if(!await hasTable('cms_banners')){
      await pool.query('CREATE TABLE cms_banners (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200), image_url VARCHAR(500) NOT NULL, link VARCHAR(500), position VARCHAR(30) DEFAULT \'top\', is_active TINYINT DEFAULT 1, sort_order INT DEFAULT 0, start_at TIMESTAMP NULL DEFAULT NULL, end_at TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_cms_banners_pos (position, is_active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
      console.log('[add]  cms_banners');
    } else console.log('[skip] cms_banners');
    if(!await hasTable('cms_sliders')){
      await pool.query('CREATE TABLE cms_sliders (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200), subtitle VARCHAR(300), image_url VARCHAR(500) NOT NULL, link VARCHAR(500), button_text VARCHAR(80), bg_color VARCHAR(20), is_active TINYINT DEFAULT 1, sort_order INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_cms_sliders_active (is_active, sort_order)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
      console.log('[add]  cms_sliders');
    } else console.log('[skip] cms_sliders');

    // indexes
    const indexes = [
      ['products', 'idx_prod_created', 'created_at'],
      ['products', 'idx_prod_active', 'is_active'],
      ['products', 'idx_prod_cat_active', 'category_id, is_active'],
      ['orders', 'idx_ord_created', 'created_at'],
      ['orders', 'idx_ord_status', 'status'],
      ['orders', 'idx_ord_user', 'user_id'],
      ['order_items', 'idx_oi_prod', 'product_id'],
      ['users', 'idx_usr_role', 'role'],
      ['users', 'idx_usr_created', 'created_at']
    ];
    for(const [t, n, c] of indexes){
      try{
        const [r] = await pool.query('SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?', [process.env.DB_NAME, t, n]);
        if(r[0].c > 0){ console.log('[skip] ' + n); continue; }
        await pool.query('CREATE INDEX ' + n + ' ON ' + t + ' (' + c + ')');
        console.log('[add]  ' + n);
      }catch(e){ console.log('[fail] ' + n); }
    }

    console.log('');
    console.log('Migration done.');
    await pool.end();
    process.exit(0);
  }catch(e){ console.error('FATAL:', e.message); process.exit(1); }
})();