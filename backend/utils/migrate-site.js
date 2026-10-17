require('dotenv').config();
const { pool } = require('../db/init');
async function hasTable(t){
  const [r] = await pool.query('SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [process.env.DB_NAME, t]);
  return r[0].c > 0;
}
(async ()=>{
  try{
    /* site_features — آیتم‌های فروشگاه */
    if(!await hasTable('site_features')){
      await pool.query('CREATE TABLE site_features (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(80) NOT NULL, subtitle VARCHAR(150), icon VARCHAR(40) DEFAULT "shield", color VARCHAR(20) DEFAULT "#c81e3a", sort_order INT DEFAULT 0, is_active TINYINT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
      console.log('[ADD]  site_features');
    } else console.log('[SKIP] site_features');

    /* site_festivals — جشنواره‌ها */
    if(!await hasTable('site_festivals')){
      await pool.query('CREATE TABLE site_festivals (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(120) NOT NULL, subtitle VARCHAR(200), link VARCHAR(300), ends_at DATETIME NULL, bg_color VARCHAR(20) DEFAULT "#d92a3f", sort_order INT DEFAULT 0, is_active TINYINT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
      console.log('[ADD]  site_festivals');
    } else console.log('[SKIP] site_festivals');

    /* seed features اگه خالی بود */
    const [cnt] = await pool.query('SELECT COUNT(*) c FROM site_features');
    if(cnt[0].c === 0){
      const F = [
        ['ارسال سریع','تحویل ۱ تا ۳ روز کاری','truck','#0ea5e9',1],
        ['ضمانت اصالت کالا','همهٔ کالاها با گارانتی معتبر','shield','#c9a961',2],
        ['بازگشت ۷ روزه','برای کالاهای سالم','ret','#0e7c5f',3],
        ['پرداخت امن','درگاه بانکی یا در محل','card','#7b1e3a',4]
      ];
      for(const x of F){
        await pool.query('INSERT INTO site_features (title,subtitle,icon,color,sort_order) VALUES (?,?,?,?,?)', x);
      }
      console.log('[SEED] 4 features');
    }

    /* seed festival اگه خالی بود */
    const [fCnt] = await pool.query('SELECT COUNT(*) c FROM site_festivals');
    if(fCnt[0].c === 0){
      await pool.query('INSERT INTO site_festivals (title,subtitle,link,ends_at,bg_color,sort_order) VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL 1 DAY),?,?)',
        ['شگفت‌انگیزها','تخفیف‌های ویژهٔ امروز','#offers','#7b1e3a',1]);
      console.log('[SEED] 1 festival');
    }

    /* seed categories اگه خالی بود */
    const [cCnt] = await pool.query('SELECT COUNT(*) c FROM categories');
    if(cCnt[0].c === 0){
      const C = [
        ['موبایل','phone','#3b82f6',1],
        ['لپ‌تاپ','laptop','#64748b',2],
        ['صوتی و تصویری','headphones','#8b5cf6',3],
        ['ساعت هوشمند','watch','#14b8a6',4],
        ['مد و پوشاک','sneaker','#f97316',5],
        ['خانه و آشپزخانه','kettle','#0ea5e9',6],
        ['کتاب','book','#eab308',7]
      ];
      for(const x of C){
        var slug = x[0].trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '');
        await pool.query('INSERT INTO categories (name,slug,icon,color,order_num) VALUES (?,?,?,?,?)', [x[0], slug, x[1], x[2], x[3]]);
      }
      console.log('[SEED] 7 categories');
    }

    console.log('done');
    await pool.end();
    process.exit(0);
  }catch(e){ console.error('ERR: ' + e.message); process.exit(1); }
})();