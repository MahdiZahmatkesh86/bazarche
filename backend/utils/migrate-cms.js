require('dotenv').config();
const { pool } = require('../db/init');

async function hasTable(name){
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?',
    [process.env.DB_NAME, name]
  );
  return r[0].c > 0;
}

(async ()=>{
  try{
    if(!await hasTable('cms_pages')){
      await pool.query(`
        CREATE TABLE cms_pages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          slug VARCHAR(120) UNIQUE NOT NULL,
          title VARCHAR(200) NOT NULL,
          content LONGTEXT,
          meta_title VARCHAR(200),
          meta_description VARCHAR(320),
          is_published TINYINT DEFAULT 1,
          show_in_menu TINYINT DEFAULT 0,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_cms_pages_slug (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('[ADD] cms_pages');
    }else{ console.log('[SKIP] cms_pages'); }

    if(!await hasTable('cms_banners')){
      await pool.query(`
        CREATE TABLE cms_banners (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(200),
          image_url VARCHAR(500) NOT NULL,
          link VARCHAR(500),
          position VARCHAR(30) DEFAULT 'top',
          is_active TINYINT DEFAULT 1,
          sort_order INT DEFAULT 0,
          start_at TIMESTAMP NULL DEFAULT NULL,
          end_at TIMESTAMP NULL DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_cms_banners_pos (position, is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('[ADD] cms_banners');
    }else{ console.log('[SKIP] cms_banners'); }

    if(!await hasTable('cms_sliders')){
      await pool.query(`
        CREATE TABLE cms_sliders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(200),
          subtitle VARCHAR(300),
          image_url VARCHAR(500) NOT NULL,
          link VARCHAR(500),
          button_text VARCHAR(80),
          bg_color VARCHAR(20),
          is_active TINYINT DEFAULT 1,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_cms_sliders_active (is_active, sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('[ADD] cms_sliders');
    }else{ console.log('[SKIP] cms_sliders'); }

    const [count] = await pool.query('SELECT COUNT(*) c FROM cms_pages');
    if(count[0].c === 0){
      const defaults = [
        ['about-us','درباره ما','<p>ما یک فروشگاه اینترنتی هستیم که با هدف ارائه بهترین کالاها با قیمت مناسب فعالیت می‌کنیم.</p>',1,1,1],
        ['contact','تماس با ما','<p>برای تماس با ما از راه‌های زیر استفاده کنید:</p><p>ایمیل: info@example.com</p><p>تلفن: 021-00000000</p>',1,1,2],
        ['terms','قوانین و مقررات','<p>با استفاده از این سایت، شما قوانین زیر را می‌پذیرید...</p>',1,1,3],
        ['privacy','حریم خصوصی','<p>ما به حریم خصوصی شما احترام می‌گذاریم...</p>',1,1,4],
        ['faq','سوالات متداول','<p>پاسخ پرسش‌های پرتکرار مشتریان در این صفحه منتشر می‌شود.</p>',1,1,5]
      ];
      for(const d of defaults){
        await pool.query(
          'INSERT INTO cms_pages (slug,title,content,is_published,show_in_menu,sort_order) VALUES (?,?,?,?,?,?)',
          d
        );
      }
      console.log('[SEED] 5 default pages created');
    }

    console.log('Migration done.');
    await pool.end();
    process.exit(0);
  }catch(e){ console.error('Migration error:', e.message); process.exit(1); }
})();
