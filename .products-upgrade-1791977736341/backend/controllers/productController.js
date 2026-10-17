const { q, qOne, insert } = require('../db/init');

function slugify(s){
  return String(s).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '').slice(0, 200);
}

function parseJSON(v, fallback){
  if(v === null || v === undefined) return fallback;
  if(typeof v === 'object') return v;
  try{ return JSON.parse(v); }catch(e){ return fallback; }
}

function canSeePurchase(req){
  return req && req.user && req.user.role === 'admin';
}

async function hydrate(product, forAdmin){
  if(!product) return null;
  const colors = await q('SELECT name, hex FROM product_colors WHERE product_id = ?', [product.id]);
  const specs = await q('SELECT spec_key, value FROM product_specs WHERE product_id = ?', [product.id]);
  const finalPrice = Math.round(product.price * (1 - product.off/100) / 1000) * 1000;
  const cat = await qOne('SELECT id, name, slug, color, icon FROM categories WHERE id = ?', [product.category_id]);
  const images = parseJSON(product.images, []);
  const features = parseJSON(product.features, []);
  const sizes = parseJSON(product.sizes, []);
  const base = {
    id: product.id, _id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    price: Number(product.price),
    off: Number(product.off),
    rating: Number(product.rating),
    numReviews: Number(product.num_reviews),
    stock: Number(product.stock),
    minStock: Number(product.min_stock || 3),
    sales: Number(product.sales),
    weight: Number(product.weight || 0),
    isActive: !!product.is_active,
    sku: product.sku || '',
    shortDescription: product.short_description || '',
    videoUrl: product.video_url || '',
    dimensions: product.dimensions || '',
    warranty: product.warranty || '',
    metaTitle: product.meta_title || '',
    metaDescription: product.meta_description || '',
    images: Array.isArray(images) ? images : [],
    features: Array.isArray(features) ? features : [],
    sizes: Array.isArray(sizes) ? sizes : [],
    colors,
    specs: specs.map(s => ({ key: s.spec_key, value: s.value })),
    finalPrice,
    inStock: Number(product.stock) > 0,
    isLowStock: Number(product.stock) > 0 && Number(product.stock) <= Number(product.min_stock || 3),
    category: cat ? { _id: cat.id, id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, icon: cat.icon } : null,
    description: product.description || '',
    art: product.art || 'book'
  };
  if(forAdmin){
    base.purchasePrice = Number(product.purchase_price || 0);
    base.profit = Number(product.price) - Number(product.purchase_price || 0);
  }
  return base;
}

exports.list = async (req, res, next) => {
  try{
    const isAdmin = canSeePurchase(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if(!isAdmin){
      where.push('p.is_active = 1');
    } else if(req.query.includeInactive !== 'true'){
      // admin by default sees only active, but can request all
      where.push('p.is_active = 1');
    }
    if(req.query.category){
      const cat = await qOne('SELECT id FROM categories WHERE slug = ?', [req.query.category]);
      if(cat){ where.push('p.category_id = ?'); params.push(cat.id); }
    }
    if(req.query.brand){ where.push('p.brand = ?'); params.push(req.query.brand); }
    if(req.query.q){
      where.push('(p.name LIKE ? OR p.brand LIKE ?)');
      const like = '%' + req.query.q + '%';
      params.push(like, like);
    }
    const minP = Number(req.query.minPrice);
    const maxP = Number(req.query.maxPrice);
    if(Number.isFinite(minP)){ where.push('p.price >= ?'); params.push(minP); }
    if(Number.isFinite(maxP)){ where.push('p.price <= ?'); params.push(maxP); }
    if(req.query.inStock === 'true') where.push('p.stock > 0');
    if(req.query.hasOff === 'true') where.push('p.off > 0');
    const minR = Number(req.query.minRating);
    if(Number.isFinite(minR)){ where.push('p.rating >= ?'); params.push(minR); }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const sortMap = {
      sales: 'p.sales DESC', rate: 'p.rating DESC, p.num_reviews DESC',
      cheap: 'p.price ASC', exp: 'p.price DESC',
      off: 'p.off DESC', newest: 'p.created_at DESC'
    };
    const orderBy = sortMap[req.query.sort] || 'p.sales DESC';

    const sql = 'SELECT p.* FROM products p ' + whereSql + ' ORDER BY ' + orderBy + ' LIMIT ' + limit + ' OFFSET ' + offset;
    const rows = await q(sql, params);
    const totalRow = await qOne('SELECT COUNT(*) c FROM products p ' + whereSql, params);
    const total = totalRow ? totalRow.c : 0;

    const items = await Promise.all(rows.map(r => hydrate(r, isAdmin)));
    res.json({
      success:true, items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  }catch(err){ next(err); }
};

exports.getOne = async (req, res, next) => {
  try{
    const isAdmin = canSeePurchase(req);
    const key = req.params.id;
    const isId = /^\d+$/.test(key);
    const extra = isAdmin ? '' : ' AND is_active = 1';
    const product = await qOne('SELECT * FROM products WHERE ' + (isId ? 'id = ?' : 'slug = ?') + extra + ' LIMIT 1', [key]);
    if(!product){
      return res.status(404).json({ success:false, message:'محصول پیدا نشد.' });
    }
    const full = await hydrate(product, isAdmin);
    res.json({ success:true, product: full });
  }catch(err){ next(err); }
};

async function resolveCategoryId(catOrSlug){
  if(!catOrSlug) return null;
  if(/^\d+$/.test(String(catOrSlug))) return Number(catOrSlug);
  const row = await qOne('SELECT id FROM categories WHERE slug = ?', [catOrSlug]);
  return row ? row.id : null;
}

function validateProduct(body){
  const e = {};
  if(body.price !== undefined){
    const p = Number(body.price);
    if(!Number.isFinite(p) || p < 0) e.price = 'قیمت باید عدد غیرمنفی باشد.';
  }
  if(body.purchasePrice !== undefined){
    const p = Number(body.purchasePrice);
    if(!Number.isFinite(p) || p < 0) e.purchasePrice = 'قیمت خرید نامعتبر است.';
  }
  if(body.stock !== undefined){
    const s = Number(body.stock);
    if(!Number.isFinite(s) || s < 0) e.stock = 'موجودی نامعتبر است.';
  }
  if(body.off !== undefined){
    const o = Number(body.off);
    if(!Number.isFinite(o) || o < 0 || o > 90) e.off = 'تخفیف باید بین ۰ تا ۹۰ باشد.';
  }
  return e;
}

async function saveRelated(pid, body){
  if(Array.isArray(body.colors)){
    await q('DELETE FROM product_colors WHERE product_id = ?', [pid]);
    for(const c of body.colors){
      if(c && c.name && c.hex) await insert('INSERT INTO product_colors (product_id, name, hex) VALUES (?,?,?)', [pid, c.name, c.hex]);
    }
  }
  if(Array.isArray(body.specs)){
    await q('DELETE FROM product_specs WHERE product_id = ?', [pid]);
    for(const s of body.specs){
      const k = s && (s.key || s.spec_key || (Array.isArray(s) ? s[0] : null));
      const v = s && (s.value || (Array.isArray(s) ? s[1] : null));
      if(k && v) await insert('INSERT INTO product_specs (product_id, spec_key, value) VALUES (?,?,?)', [pid, k, v]);
    }
  }
}

exports.create = async (req, res, next) => {
  try{
    const b = req.body;
    const errors = validateProduct(b);
    if(Object.keys(errors).length) return res.status(400).json({ success:false, message: Object.values(errors)[0], errors });
    const categoryId = await resolveCategoryId(b.category);
    /* چک یکتا بودن SKU */
    if(b.sku){
      const skuDup = await qOne('SELECT id FROM products WHERE sku = ? LIMIT 1', [b.sku]);
      if(skuDup) return res.status(400).json({ success:false, message:'این SKU قبلاً استفاده شده است.' });
    }
    if(!categoryId) return res.status(400).json({ success:false, message:'دسته‌بندی پیدا نشد.' });
    const slug = slugify(b.name) + '-' + Date.now().toString(36).slice(-4);
    const sku = b.sku || ('SKU-' + Date.now().toString(36).toUpperCase());
    const id = await insert(
      'INSERT INTO products (name, slug, sku, brand, category_id, price, purchase_price, off, stock, min_stock, weight, dimensions, art, description, short_description, images, video_url, features, sizes, warranty, meta_title, meta_description, is_active, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [b.name, slug, sku, b.brand, categoryId, Number(b.price)||0, Number(b.purchasePrice)||0, Number(b.off)||0, Number(b.stock)||0, Number(b.minStock)||3, Number(b.weight)||0, b.dimensions||'', b.art || 'book', b.description || '', b.shortDescription || '', JSON.stringify(b.images||[]), b.videoUrl||'', JSON.stringify(b.features||[]), JSON.stringify(b.sizes||[]), b.warranty||'', b.metaTitle||'', b.metaDescription||'', b.isActive === false ? 0 : 1, req.user.id]
    );
    await saveRelated(id, b);
    const product = await qOne('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json({ success:true, product: await hydrate(product, true) });
  }catch(err){ next(err); }
};

exports.update = async (req, res, next) => {
  try{
    const b = req.body;
    const errors = validateProduct(b);
    if(Object.keys(errors).length) return res.status(400).json({ success:false, message: Object.values(errors)[0], errors });
    const existing = await qOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if(!existing) return res.status(404).json({ success:false, message:'محصول پیدا نشد.' });
    /* چک یکتا بودن SKU (به‌جز خودش) */
    if(b.sku && b.sku !== existing.sku){
      const skuDupInUpdate = await qOne('SELECT id FROM products WHERE sku = ? AND id <> ? LIMIT 1', [b.sku, req.params.id]);
      if(skuDupInUpdate) return res.status(400).json({ success:false, message:'این SKU برای محصول دیگری استفاده شده است.' });
    }
    const fields = []; const vals = [];
    /* اگه name عوض شد، slug رو دوباره بساز */
    if(b.name !== undefined && String(b.name).trim() !== existing.name){
      fields.push('slug = ?');
      vals.push(slugify(b.name) + '-' + Date.now().toString(36).slice(-4));
    }
    const map = { name:'name', sku:'sku', brand:'brand', price:'price', purchasePrice:'purchase_price', off:'off', minStock:'min_stock', weight:'weight', dimensions:'dimensions', art:'art', description:'description', shortDescription:'short_description', videoUrl:'video_url', warranty:'warranty', metaTitle:'meta_title', metaDescription:'meta_description' };
    Object.keys(map).forEach(function(k){ if(b[k] !== undefined && k !== 'name'){ fields.push(map[k] + ' = ?'); vals.push(b[k]); } });
    /* stock: فقط از طریق stockDelta (تا فروش‌های همزمان پاک نشن) */
    if(b.stockDelta !== undefined){
      const delta = Number(b.stockDelta);
      if(Number.isFinite(delta) && delta !== 0){
        fields.push('stock = GREATEST(0, stock + ?)');
        vals.push(delta);
      }
    } else if(b.stock !== undefined && existing.stock === 0){
      /* فقط اگه محصول قبلاً ۰ بود، مقدار مستقیم قبول کن (برای محصول جدید) */
      fields.push('stock = ?');
      vals.push(Number(b.stock) || 0);
    }
    if(b.isActive !== undefined){ fields.push('is_active = ?'); vals.push(b.isActive ? 1 : 0); }
    if(Array.isArray(b.images)){ fields.push('images = ?'); vals.push(JSON.stringify(b.images)); }
    if(Array.isArray(b.features)){ fields.push('features = ?'); vals.push(JSON.stringify(b.features)); }
    if(Array.isArray(b.sizes)){ fields.push('sizes = ?'); vals.push(JSON.stringify(b.sizes)); }
    if(b.category){ const cid = await resolveCategoryId(b.category); if(cid){ fields.push('category_id = ?'); vals.push(cid); } }
    if(fields.length){ vals.push(req.params.id); await q('UPDATE products SET ' + fields.join(', ') + ' WHERE id = ?', vals); }
    await saveRelated(req.params.id, b);
    const product = await qOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json({ success:true, product: await hydrate(product, true) });
  }catch(err){ next(err); }
};

exports.remove = async (req, res, next) => {
  try{
    await q('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success:true, message:'محصول حذف شد.' });
  }catch(err){ next(err); }
};

exports.toggleActive = async (req, res, next) => {
  try{
    await q('UPDATE products SET is_active = 1 - is_active WHERE id = ?', [req.params.id]);
    const product = await qOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if(!product) return res.status(404).json({ success:false, message:'محصول پیدا نشد.' });
    res.json({ success:true, product: await hydrate(product, true) });
  }catch(err){ next(err); }
};

exports.stats = async (req, res, next) => {
  try{
    const total = await qOne('SELECT COUNT(*) c FROM products');
    const oos = await qOne('SELECT COUNT(*) c FROM products WHERE stock = 0');
    const low = await qOne('SELECT COUNT(*) c FROM products WHERE stock > 0 AND stock <= 5');
    const disc = await qOne('SELECT COUNT(*) c FROM products WHERE off > 0');
    res.json({ success:true, stats: { total: total.c, outOfStock: oos.c, lowStock: low.c, discounts: disc.c } });
  }catch(err){ next(err); }
};

exports.generateSku = async (req, res, next) => {
  try{
    const prefix = (req.query.brand || 'P').toString().slice(0,3).toUpperCase();
    const sku = prefix + '-' + Date.now().toString(36).toUpperCase();
    res.json({ success:true, sku });
  }catch(err){ next(err); }
};

exports.duplicate = async (req, res, next) => {
  try{
    const src = await qOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if(!src) return res.status(404).json({ success:false, message:'محصول پیدا نشد.' });
    const slug = slugify(src.name) + '-copy-' + Date.now().toString(36).slice(-4);
    const sku = 'SKU-' + Date.now().toString(36).toUpperCase();
    const id = await insert(
      'INSERT INTO products (name, slug, sku, brand, category_id, price, purchase_price, off, stock, min_stock, weight, dimensions, art, description, short_description, images, video_url, features, sizes, warranty, meta_title, meta_description, is_active, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [src.name + ' (کپی)', slug, sku, src.brand, src.category_id, src.price, src.purchase_price, src.off, 0, src.min_stock, src.weight, src.dimensions, src.art, src.description, src.short_description, src.images, src.video_url, src.features, src.sizes, src.warranty, src.meta_title, src.meta_description, 0, req.user.id]
    );
    const colors = await q('SELECT name, hex FROM product_colors WHERE product_id = ?', [src.id]);
    for(const c of colors){ await insert('INSERT INTO product_colors (product_id, name, hex) VALUES (?,?,?)', [id, c.name, c.hex]); }
    const specs = await q('SELECT spec_key, value FROM product_specs WHERE product_id = ?', [src.id]);
    for(const s of specs){ await insert('INSERT INTO product_specs (product_id, spec_key, value) VALUES (?,?,?)', [id, s.spec_key, s.value]); }
    const product = await qOne('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json({ success:true, product: await hydrate(product, true) });
  }catch(err){ next(err); }
};
