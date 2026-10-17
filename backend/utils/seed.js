require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, q, qOne, insert, initSchema } = require('../db/init');

const CATS = [
  { name:'موبایل', icon:'phone', color:'#3b82f6', order:1 },
  { name:'لپ‌تاپ', icon:'laptop', color:'#64748b', order:2 },
  { name:'صوتی و تصویری', icon:'headphones', color:'#8b5cf6', order:3 },
  { name:'ساعت هوشمند', icon:'watch', color:'#14b8a6', order:4 },
  { name:'مد و پوشاک', icon:'sneaker', color:'#f97316', order:5 },
  { name:'خانه و آشپزخانه', icon:'kettle', color:'#0ea5e9', order:6 },
  { name:'کتاب', icon:'book', color:'#eab308', order:7 }
];

const PRODUCTS = [
  { name:'گوشی موبایل نووا مدل X12 Pro ظرفیت ۲۵۶ گیگابایت رم ۸ گیگابایت', brand:'نووا', cat:'موبایل', price:32900000, off:12, rating:4.6, numReviews:1284, stock:14, sales:9420, art:'phone', colors:[{name:'مشکی',hex:'#1f2937'},{name:'آبی',hex:'#2563eb'},{name:'سبز',hex:'#0f9d76'}], description:'گوشی نووا X12 Pro با صفحه‌نمایش روان و پردازندهٔ قدرتمند.' },
  { name:'گوشی موبایل آریان مدل A55 Lite ظرفیت ۱۲۸ گیگابایت رم ۶ گیگابایت', brand:'آریان', cat:'موبایل', price:14500000, off:8, rating:4.3, numReviews:864, stock:32, sales:7310, art:'phone', colors:[{name:'خاکستری',hex:'#64748b'},{name:'بنفش',hex:'#7c3aed'}], description:'انتخابی اقتصادی با باتری خوب.' },
  { name:'گوشی موبایل پارس‌تک مدل Z7 5G ظرفیت ۲۵۶ گیگابایت رم ۱۲ گیگابایت', brand:'پارس‌تک', cat:'موبایل', price:21800000, off:0, rating:4.5, numReviews:612, stock:6, sales:4100, art:'phone', colors:[{name:'نقره‌ای',hex:'#cbd5e1'},{name:'مشکی',hex:'#111827'}], description:'پشتیبانی از ۵G و رم ۱۲ گیگابایت.' },
  { name:'گوشی موبایل سیمرغ مدل S3 Mini ظرفیت ۶۴ گیگابایت رم ۴ گیگابایت', brand:'سیمرغ', cat:'موبایل', price:9900000, off:20, rating:4.1, numReviews:2210, stock:40, sales:12050, art:'phone', colors:[{name:'قرمز',hex:'#e11d48'},{name:'مشکی',hex:'#111827'},{name:'آبی',hex:'#0ea5e9'}], description:'گوشی کوچک و سبک برای استفادهٔ روزمره.' },
  { name:'لپ‌تاپ ۱۵٫۶ اینچی نووا مدل Book Air پردازندهٔ Core i7 رم ۱۶ گیگابایت', brand:'نووا', cat:'لپ‌تاپ', price:48500000, off:5, rating:4.7, numReviews:356, stock:9, sales:2200, art:'laptop', colors:[{name:'نقره‌ای',hex:'#cbd5e1'},{name:'خاکستری',hex:'#475569'}], description:'لپ‌تاپی باریک و سبک برای کار اداری.' },
  { name:'لپ‌تاپ گیمینگ پارس‌تک مدل Falcon R7 کارت گرافیک ۸ گیگابایتی', brand:'پارس‌تک', cat:'لپ‌تاپ', price:89000000, off:10, rating:4.8, numReviews:141, stock:3, sales:890, art:'laptop', colors:[{name:'مشکی',hex:'#111827'},{name:'قرمز تیره',hex:'#b91c1c'}], description:'برای گیمرها و تولیدکنندگان محتوا.' },
  { name:'لپ‌تاپ ۱۴ اینچی آریان مدل Slim 14 پردازندهٔ Core i5 رم ۸ گیگابایت', brand:'آریان', cat:'لپ‌تاپ', price:36200000, off:15, rating:4.4, numReviews:503, stock:0, sales:3180, art:'laptop', colors:[{name:'آبی‌خاکستری',hex:'#64748b'},{name:'نقره‌ای',hex:'#cbd5e1'}], description:'لپ‌تاپ دانشجویی و اداری.' },
  { name:'هدفون بی‌سیم نووا مدل Pulse با حذف نویز فعال', brand:'نووا', cat:'صوتی و تصویری', price:6400000, off:18, rating:4.6, numReviews:978, stock:25, sales:5600, art:'headphones', colors:[{name:'مشکی',hex:'#111827'},{name:'سفید',hex:'#e5e7eb'},{name:'آبی',hex:'#3b82f6'}], description:'حذف نویز فعال و صدای متعادل.' },
  { name:'اسپیکر بلوتوثی ضدآب سیمرغ مدل Boom', brand:'سیمرغ', cat:'صوتی و تصویری', price:2850000, off:25, rating:4.4, numReviews:1732, stock:60, sales:8300, art:'speaker', colors:[{name:'قرمز',hex:'#ef4444'},{name:'سبز آبی',hex:'#0d9488'},{name:'مشکی',hex:'#1f2937'}], description:'اسپیکری جمع‌وجود با صدای بلند.' },
  { name:'دوربین دیجیتال بدون آینه آریان مدل M200 همراه با لنز ۱۸-۵۵', brand:'آریان', cat:'صوتی و تصویری', price:42000000, off:7, rating:4.7, numReviews:88, stock:4, sales:420, art:'camera', colors:[{name:'مشکی',hex:'#1f2937'},{name:'نقره‌ای',hex:'#94a3b8'}], description:'دوربینی سبک و همه‌کاره.' },
  { name:'هدفون گیمینگ پارس‌تک مدل Storm با میکروفون', brand:'پارس‌تک', cat:'صوتی و تصویری', price:2300000, off:0, rating:4.2, numReviews:640, stock:18, sales:2700, art:'headphones', colors:[{name:'مشکی',hex:'#111827'},{name:'قرمز',hex:'#dc2626'}], description:'صدای فضایی برای بازی.' },
  { name:'ساعت هوشمند نووا مدل Watch S2 با بند سیلیکونی', brand:'نووا', cat:'ساعت هوشمند', price:7900000, off:14, rating:4.5, numReviews:702, stock:12, sales:4200, art:'watch', colors:[{name:'مشکی',hex:'#111827'},{name:'نارنجی',hex:'#f59e0b'},{name:'سبز',hex:'#10b981'}], description:'پایش سلامت و ورزش.' },
  { name:'ساعت هوشمند آریان مدل Fit Pro', brand:'آریان', cat:'ساعت هوشمند', price:3650000, off:22, rating:4.3, numReviews:1180, stock:27, sales:6100, art:'watch', colors:[{name:'آبی',hex:'#2563eb'},{name:'مشکی',hex:'#111827'}], description:'ساعتی مقرون‌به‌صرفه.' },
  { name:'مچ‌بند هوشمند سیمرغ مدل Band 6', brand:'سیمرغ', cat:'ساعت هوشمند', price:1450000, off:30, rating:4.0, numReviews:3120, stock:90, sales:15400, art:'watch', colors:[{name:'مشکی',hex:'#111827'},{name:'صورتی',hex:'#ec4899'},{name:'آبی',hex:'#0ea5e9'}], description:'ساده، سبک و ارزان.' },
  { name:'کفش ورزشی مردانه کاوه مدل Run 21', brand:'کاوه', cat:'مد و پوشاک', price:3200000, off:15, rating:4.5, numReviews:845, stock:20, sales:3900, art:'sneaker', colors:[{name:'آبی',hex:'#2563eb'},{name:'مشکی',hex:'#111827'},{name:'قرمز',hex:'#ef4444'}], description:'سبک و راحت برای دویدن روزانه.' },
  { name:'کفش کتانی زنانه کاوه مدل Air Lite', brand:'کاوه', cat:'مد و پوشاک', price:2780000, off:10, rating:4.4, numReviews:521, stock:15, sales:2400, art:'sneaker', colors:[{name:'بنفش',hex:'#a78bfa'},{name:'صورتی',hex:'#f472b6'}], description:'کتانی روزمرهٔ زنانه.' },
  { name:'هودی مردانه پنبه‌ای مدل زمستانه با آستر فلیس', brand:'کاوه', cat:'مد و پوشاک', price:1290000, off:20, rating:4.3, numReviews:390, stock:33, sales:2900, art:'hoodie', colors:[{name:'طوسی',hex:'#475569'},{name:'مشکی',hex:'#111827'},{name:'قهوه‌ای',hex:'#b45309'}], description:'گرم و نرم برای روزهای سرد.' },
  { name:'کوله‌پشتی ضدآب مناسب لپ‌تاپ تا ۱۵٫۶ اینچ', brand:'پارس‌تک', cat:'مد و پوشاک', price:1850000, off:12, rating:4.6, numReviews:1044, stock:44, sales:5100, art:'backpack', colors:[{name:'مشکی',hex:'#111827'},{name:'آبی',hex:'#0ea5e9'},{name:'نارنجی',hex:'#ea580c'}], description:'جای مخصوص لپ‌تاپ و پارچهٔ ضدآب.' },
  { name:'کتری برقی استیل ۱٫۷ لیتری سیمرغ', brand:'سیمرغ', cat:'خانه و آشپزخانه', price:1950000, off:16, rating:4.4, numReviews:933, stock:30, sales:3700, art:'kettle', colors:[{name:'استیل',hex:'#94a3b8'},{name:'مشکی',hex:'#111827'},{name:'قرمز',hex:'#dc2626'}], description:'آب را در کمتر از سه دقیقه به جوش می‌آورد.' },
  { name:'چراغ مطالعهٔ رومیزی LED با سه حالت نور', brand:'آریان', cat:'خانه و آشپزخانه', price:890000, off:0, rating:4.5, numReviews:612, stock:50, sales:4400, art:'lamp', colors:[{name:'نارنجی',hex:'#fb923c'},{name:'سبز',hex:'#22c55e'},{name:'بنفش',hex:'#6366f1'}], description:'نور بدون چشمک‌زنی.' },
  { name:'کتاب «هنر شفاف‌نویسی» چاپ تازه', brand:'نشر نمونه', cat:'کتاب', price:320000, off:0, rating:4.7, numReviews:2205, stock:120, sales:6200, art:'book', colors:[{name:'آبی',hex:'#0ea5e9'}], description:'راهنمایی کاربردی برای نوشتن متن‌های روشن.' },
  { name:'رمان «شب‌های کرانه»', brand:'نشر نمونه', cat:'کتاب', price:275000, off:10, rating:4.5, numReviews:1450, stock:75, sales:5800, art:'book', colors:[{name:'بنفش',hex:'#7c3aed'}], description:'داستانی دربارهٔ دو دوست قدیمی.' },
  { name:'کتاب «برنامه‌نویسی با جاوااسکریپت» از مبتدی تا حرفه‌ای', brand:'نشر نمونه', cat:'کتاب', price:410000, off:15, rating:4.8, numReviews:980, stock:60, sales:3300, art:'book', colors:[{name:'زرد',hex:'#eab308'}], description:'آموزش گام‌به‌گام با پروژه‌های واقعی.' }
];

function slugify(s){
  return String(s).trim().toLowerCase().replace(/\s+/g,'-').replace(/[^\w\u0600-\u06FF-]/g,'');
}

(async function run(){
  try{
    await initSchema();
    console.log('\n--- SEED START ---');

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@bazaarche.local').toLowerCase();
    const crypto = require('crypto');
const adminPass = process.env.ADMIN_PASSWORD || ('Adm-' + crypto.randomBytes(6).toString('base64').replace(/[^A-Za-z0-9]/g,'').slice(0,10) + '!');
    const adminName  = process.env.ADMIN_NAME || 'مدیر کل';

    let admin = await qOne('SELECT * FROM users WHERE email = ?', [adminEmail]);
    if(!admin){
      const hash = await bcrypt.hash(adminPass, 10);
      const id = await insert(
        'INSERT INTO users (name, email, phone, password, role) VALUES (?,?,?,?,?)',
        [adminName, adminEmail, '09000000000', hash, 'admin']
      );
      admin = await qOne('SELECT * FROM users WHERE id = ?', [id]);
      console.log('[User] Admin created:', adminEmail, '/', adminPass);
    }else{
      await q('UPDATE users SET role = ? WHERE id = ?', ['admin', admin.id]);
      console.log('[User] Admin exists:', adminEmail);
    }

    const catMap = {};
    for(const c of CATS){
      let cat = await qOne('SELECT * FROM categories WHERE name = ?', [c.name]);
      if(!cat){
        const id = await insert(
          'INSERT INTO categories (name, slug, icon, color, order_num) VALUES (?,?,?,?,?)',
          [c.name, slugify(c.name), c.icon, c.color, c.order]
        );
        cat = await qOne('SELECT * FROM categories WHERE id = ?', [id]);
      }
      catMap[c.name] = cat.id;
    }
    console.log('[Category] ' + Object.keys(catMap).length + ' categories ready');

    let created = 0, skipped = 0;
    for(const p of PRODUCTS){
      const exists = await qOne('SELECT id FROM products WHERE name = ?', [p.name]);
      if(exists){ skipped++; continue; }

      const catId = catMap[p.cat];
      if(!catId) continue;

      const slug = slugify(p.name) + '-' + Date.now().toString(36).slice(-4);
      const prodId = await insert(
        'INSERT INTO products (name, slug, brand, category_id, price, off, rating, num_reviews, stock, sales, art, description, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [p.name, slug, p.brand, catId, p.price, p.off, p.rating, p.numReviews,
         p.stock, p.sales, p.art, p.description, admin.id]
      );

      for(const c of p.colors){
        await insert('INSERT INTO product_colors (product_id, name, hex) VALUES (?,?,?)',
          [prodId, c.name, c.hex]);
      }
      created++;
    }
    console.log('[Product] created: ' + created + ', skipped: ' + skipped);

    console.log('\n--- SEED DONE ---');
    console.log('Admin login:');
    console.log('  email:    ' + adminEmail);
    console.log('  password: ' + adminPass);
    console.log('');
    console.log('  ⚠️  این رمز را الان کپی کنید — دیگر نمایش داده نمی‌شود.');
    console.log('');

    await pool.end();
    process.exit(0);
  }catch(err){
    console.error('[Seed error]', err);
    process.exit(1);
  }
})();