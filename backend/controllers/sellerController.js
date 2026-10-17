'use strict';
const { q, qOne, insert } = require('../db/init');

/* داشبورد فروشنده */
exports.dashboard = async function(req, res, next){
  try{
    const uid = req.user.id;
    const prodCount = await qOne('SELECT COUNT(*) c FROM products WHERE owner_id = ?', [uid]);
    const activeCount = await qOne('SELECT COUNT(*) c FROM products WHERE owner_id = ? AND is_active = 1', [uid]);
    const lowStock = await qOne('SELECT COUNT(*) c FROM products WHERE owner_id = ? AND stock > 0 AND stock <= 5', [uid]);
    const outStock = await qOne('SELECT COUNT(*) c FROM products WHERE owner_id = ? AND stock = 0', [uid]);

    /* سفارش‌های مرتبط با محصولات این فروشنده */
    const ordCount = await qOne(
      'SELECT COUNT(DISTINCT o.id) c FROM orders o ' +
      'JOIN order_items oi ON oi.order_id = o.id ' +
      'JOIN products p ON p.id = oi.product_id ' +
      'WHERE p.owner_id = ?', [uid]
    );

    /* درآمد کل از فروش محصولات فروشنده */
    const revRow = await qOne(
      'SELECT COALESCE(SUM(oi.line_total),0) s FROM order_items oi ' +
      'JOIN orders o ON o.id = oi.order_id ' +
      'JOIN products p ON p.id = oi.product_id ' +
      "WHERE p.owner_id = ? AND o.status IN ('paid','processing','shipped','delivered')",
      [uid]
    );

    /* آخرین سفارش‌ها */
    const latest = await q(
      'SELECT DISTINCT o.id, o.tracking_code, o.status, o.total_price, o.created_at, o.shipping_name ' +
      'FROM orders o ' +
      'JOIN order_items oi ON oi.order_id = o.id ' +
      'JOIN products p ON p.id = oi.product_id ' +
      'WHERE p.owner_id = ? ORDER BY o.created_at DESC LIMIT 5',
      [uid]
    );

    res.json({
      success: true,
      stats: {
        products: prodCount.c,
        activeProducts: activeCount.c,
        lowStock: lowStock.c,
        outOfStock: outStock.c,
        orders: ordCount.c,
        revenue: Number(revRow.s)
      },
      latestOrders: latest.map(function(o){
        return {
          id: o.id, trackingCode: o.tracking_code, status: o.status,
          total: Number(o.total_price), customer: o.shipping_name,
          createdAt: o.created_at
        };
      })
    });
  }catch(err){ next(err); }
};

/* محصولات فروشنده */
exports.myProducts = async function(req, res, next){
  try{
    const uid = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const where = ['p.owner_id = ?'];
    const params = [uid];
    if(req.query.q){
      where.push('(p.name LIKE ? OR p.brand LIKE ? OR p.sku LIKE ?)');
      const like = '%' + req.query.q + '%';
      params.push(like, like, like);
    }
    if(req.query.active === 'true') where.push('p.is_active = 1');
    if(req.query.active === 'false') where.push('p.is_active = 0');

    const whereSql = 'WHERE ' + where.join(' AND ');
    const rows = await q(
      'SELECT p.*, c.name as cat_name, c.color as cat_color FROM products p ' +
      'LEFT JOIN categories c ON c.id = p.category_id ' +
      whereSql + ' ORDER BY p.created_at DESC LIMIT ' + limit + ' OFFSET ' + offset,
      params
    );
    const total = await qOne('SELECT COUNT(*) c FROM products p ' + whereSql, params);

    res.json({
      success: true,
      items: rows.map(function(p){
        const finalPrice = Math.round(p.price * (1 - (p.off || 0) / 100) / 1000) * 1000;
        return {
          id: p.id, name: p.name, brand: p.brand, sku: p.sku,
          price: Number(p.price), finalPrice: finalPrice,
          off: Number(p.off || 0), stock: Number(p.stock),
          sales: Number(p.sales), isActive: !!p.is_active,
          art: p.art || 'book',
          images: (function(v){ try{ return JSON.parse(v || '[]'); }catch(e){ return []; } })(p.images),
          category: p.cat_name ? { name: p.cat_name, color: p.cat_color } : null,
          createdAt: p.created_at
        };
      }),
      pagination: { page: page, limit: limit, total: total.c, pages: Math.ceil(total.c / limit) }
    });
  }catch(err){ next(err); }
};

/* سفارش‌های فروشنده */
exports.myOrders = async function(req, res, next){
  try{
    const uid = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30));
    const offset = (page - 1) * limit;

    const rows = await q(
      'SELECT DISTINCT o.* FROM orders o ' +
      'JOIN order_items oi ON oi.order_id = o.id ' +
      'JOIN products p ON p.id = oi.product_id ' +
      'WHERE p.owner_id = ? ORDER BY o.created_at DESC LIMIT ' + limit + ' OFFSET ' + offset,
      [uid]
    );
    const totalRow = await qOne(
      'SELECT COUNT(DISTINCT o.id) c FROM orders o ' +
      'JOIN order_items oi ON oi.order_id = o.id ' +
      'JOIN products p ON p.id = oi.product_id ' +
      'WHERE p.owner_id = ?', [uid]
    );

    /* برای هر سفارش، فقط آیتم‌های فروشنده رو بگیر */
    const items = [];
    for(const o of rows){
      const its = await q(
        'SELECT oi.* FROM order_items oi ' +
        'JOIN products p ON p.id = oi.product_id ' +
        'WHERE oi.order_id = ? AND p.owner_id = ?', [o.id, uid]
      );
      const sellerTotal = its.reduce(function(s, i){ return s + Number(i.line_total); }, 0);
      items.push({
        id: o.id, trackingCode: o.tracking_code, status: o.status,
        customer: o.shipping_name, customerPhone: o.shipping_phone,
        totalPrice: Number(o.total_price),
        sellerTotal: sellerTotal,
        itemsCount: its.length,
        createdAt: o.created_at,
        items: its.map(function(i){
          return {
            id: i.id, product: i.product_id, name: i.name, art: i.art,
            price: Number(i.price), qty: Number(i.qty), lineTotal: Number(i.line_total),
            color: i.color_name ? { name: i.color_name, hex: i.color_hex } : null
          };
        })
      });
    }

    res.json({
      success: true,
      orders: items,
      pagination: { page: page, limit: limit, total: totalRow.c, pages: Math.ceil(totalRow.c / limit) }
    });
  }catch(err){ next(err); }
};

/* جزئیات یک سفارش (فقط آیتم‌های خود فروشنده) */
exports.orderDetail = async function(req, res, next){
  try{
    const uid = req.user.id;
    const o = await qOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if(!o) return res.status(404).json({ success:false, message:'سفارش پیدا نشد.' });

    const its = await q(
      'SELECT oi.* FROM order_items oi ' +
      'JOIN products p ON p.id = oi.product_id ' +
      'WHERE oi.order_id = ? AND p.owner_id = ?', [o.id, uid]
    );
    if(!its.length){
      return res.status(403).json({ success:false, message:'این سفارش شامل محصولات شما نیست.' });
    }

    const sellerTotal = its.reduce(function(s, i){ return s + Number(i.line_total); }, 0);
    res.json({
      success: true,
      order: {
        id: o.id, trackingCode: o.tracking_code, status: o.status,
        customer: o.shipping_name, customerPhone: o.shipping_phone,
        shippingAddress: {
          province: o.shipping_province, city: o.shipping_city,
          street: o.shipping_street, postalCode: o.shipping_postal
        },
        sellerTotal: sellerTotal,
        createdAt: o.created_at,
        items: its.map(function(i){
          return {
            id: i.id, product: i.product_id, name: i.name, art: i.art,
            price: Number(i.price), qty: Number(i.qty), lineTotal: Number(i.line_total),
            color: i.color_name ? { name: i.color_name, hex: i.color_hex } : null
          };
        })
      }
    });
  }catch(err){ next(err); }
};


/* ============================================================
   Product CRUD برای فروشنده
   ============================================================ */
const { q: _q, qOne: _qOne, insert: _insert } = require('../db/init');

function slugify(s){
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '').slice(0, 200);
}
function parseJSON(v, fallback){
  if(v === null || v === undefined) return fallback;
  if(typeof v === 'object') return v;
  try { return JSON.parse(v); } catch(e) { return fallback; }
}
async function resolveCategoryId(catOrSlug){
  if(!catOrSlug) return null;
  if(/^\d+$/.test(String(catOrSlug))) return Number(catOrSlug);
  const row = await _qOne('SELECT id FROM categories WHERE slug = ? OR name = ? LIMIT 1', [catOrSlug, catOrSlug]);
  return row ? row.id : null;
}

function validateSellerProductNumbers(b, requireAll){
  const errors = [];

  if(requireAll || b.price !== undefined){
    const p = Number(b.price);
    if(!Number.isFinite(p) || p <= 0) errors.push('قیمت باید عدد مثبت باشد.');
  }

  if(b.off !== undefined){
    const o = Number(b.off);
    if(!Number.isInteger(o) || o < 0 || o > 90) {
      errors.push('تخفیف باید عدد صحیح بین ۰ تا ۹۰ باشد.');
    }
  }

  if(requireAll || b.stock !== undefined){
    const s = Number(b.stock);
    if(!Number.isInteger(s) || s < 0 || s > 100000) {
      errors.push('موجودی باید عدد صحیح بین ۰ تا ۱۰۰,۰۰۰ باشد.');
    }
  }

  if(b.purchasePrice !== undefined){
    const p = Number(b.purchasePrice);
    if(!Number.isFinite(p) || p < 0) errors.push('قیمت خرید نامعتبر است.');
  }

  if(b.minStock !== undefined){
    const m = Number(b.minStock);
    if(!Number.isInteger(m) || m < 0) errors.push('حداقل موجودی نامعتبر است.');
  }

  if(b.weight !== undefined){
    const w = Number(b.weight);
    if(!Number.isFinite(w) || w < 0) errors.push('وزن نامعتبر است.');
  }

  return errors;
}

/* ساخت یک محصول — مالک همیشه خود فروشنده است */
exports.createProduct = async function(req, res, next){
  try{
    const b = req.body;
    if(!b.name || String(b.name).trim().length < 2){
      return res.status(400).json({ success:false, message:'نام محصول الزامی است.' });
    }
    if(!b.brand || !String(b.brand).trim()){
      return res.status(400).json({ success:false, message:'برند الزامی است.' });
    }
    const categoryId = await resolveCategoryId(b.category);
    if(!categoryId){
      return res.status(400).json({ success:false, message:'دسته‌بندی پیدا نشد.' });
    }
    const numErrors = validateSellerProductNumbers(b, true);
    if(numErrors.length){
      return res.status(400).json({ success:false, message: numErrors[0], errors: numErrors });
    }
    const price = Number(b.price);
    const stock = Math.floor(Number(b.stock) || 0);
    const slug = slugify(b.name) + '-' + Date.now().toString(36).slice(-4);
    const sku = b.sku || ('PRD-' + Date.now().toString(36).toUpperCase());

    const id = await _insert(
      'INSERT INTO products (name, slug, sku, brand, category_id, price, purchase_price, off, stock, min_stock, weight, dimensions, art, description, short_description, images, video_url, features, sizes, warranty, meta_title, meta_description, is_active, created_by, owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        String(b.name).trim(), slug, sku, String(b.brand).trim(),
        categoryId, price, Number(b.purchasePrice) || 0,
        Math.min(90, Math.max(0, Number(b.off) || 0)),
        stock, Number(b.minStock) || 3, Number(b.weight) || 0,
        b.dimensions || '', b.art || 'book',
        b.description || '', b.shortDescription || '',
        JSON.stringify(Array.isArray(b.images) ? b.images : []),
        b.videoUrl || '',
        JSON.stringify(Array.isArray(b.features) ? b.features : []),
        JSON.stringify(Array.isArray(b.sizes) ? b.sizes : []),
        b.warranty || '', b.metaTitle || '', b.metaDescription || '',
        0, /* forced: seller-created products need admin approval before going live */
        req.user.id,      /* created_by */
        req.user.id       /* owner_id — مالک خود فروشنده */
      ]
    );

    /* رنگ‌ها */
    if(Array.isArray(b.colors)){
      for(const c of b.colors){
        if(c && c.name && c.hex){
          await _insert('INSERT INTO product_colors (product_id, name, hex) VALUES (?,?,?)', [id, c.name, c.hex]);
        }
      }
    }
    /* مشخصات */
    if(Array.isArray(b.specs)){
      for(const s of b.specs){
        if(s && s.key && s.value){
          await _insert('INSERT INTO product_specs (product_id, spec_key, value) VALUES (?,?,?)', [id, s.key, s.value]);
        }
      }
    }

    const product = await _qOne('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json({ success:true, product: product });
  }catch(err){ next(err); }
};

/* ویرایش محصول — فقط اگه مالکش خودش باشه */
exports.updateProduct = async function(req, res, next){
  try{
    const pid = req.params.id;
    const existing = await _qOne('SELECT * FROM products WHERE id = ? AND owner_id = ?', [pid, req.user.id]);
    if(!existing){
      return res.status(404).json({ success:false, message:'محصول پیدا نشد یا مالک شما نیست.' });
    }
    const b = req.body;
    const numErrors = validateSellerProductNumbers(b, false);
    if(numErrors.length){
      return res.status(400).json({ success:false, message: numErrors[0], errors: numErrors });
    }
    const fields = []; const vals = [];
    const map = {
      name:'name', sku:'sku', brand:'brand',
      price:'price', purchasePrice:'purchase_price', off:'off',
      stock:'stock', minStock:'min_stock', weight:'weight',
      dimensions:'dimensions', art:'art',
      description:'description', shortDescription:'short_description',
      videoUrl:'video_url', warranty:'warranty',
      metaTitle:'meta_title', metaDescription:'meta_description'
    };
    Object.keys(map).forEach(function(k){
      if(b[k] !== undefined){ fields.push(map[k] + ' = ?'); vals.push(b[k]); }
    });
    if(b.isActive === true){
      if(!existing.is_active){
        return res.status(403).json({
          success: false,
          message: 'فعال‌سازی محصول نیازمند تأیید مدیر است. با پشتیبانی تماس بگیرید.'
        });
      }
    } else if(b.isActive === false){
      fields.push('is_active = ?'); vals.push(0);
    }
    if(Array.isArray(b.images)){ fields.push('images = ?'); vals.push(JSON.stringify(b.images)); }
    if(Array.isArray(b.features)){ fields.push('features = ?'); vals.push(JSON.stringify(b.features)); }
    if(Array.isArray(b.sizes)){ fields.push('sizes = ?'); vals.push(JSON.stringify(b.sizes)); }
    if(b.category){
      const cid = await resolveCategoryId(b.category);
      if(cid){ fields.push('category_id = ?'); vals.push(cid); }
    }
    if(b.name !== undefined && String(b.name).trim() !== existing.name){
      fields.push('slug = ?');
      vals.push(slugify(b.name) + '-' + Date.now().toString(36).slice(-4));
    }
    if(fields.length){
      vals.push(pid);
      await _q('UPDATE products SET ' + fields.join(', ') + ' WHERE id = ? AND owner_id = ?', vals.concat([req.user.id]));
    }

    /* رنگ‌ها و مشخصات — بازنویسی */
    if(Array.isArray(b.colors)){
      await _q('DELETE FROM product_colors WHERE product_id = ?', [pid]);
      for(const c of b.colors){
        if(c && c.name && c.hex) await _insert('INSERT INTO product_colors (product_id, name, hex) VALUES (?,?,?)', [pid, c.name, c.hex]);
      }
    }
    if(Array.isArray(b.specs)){
      await _q('DELETE FROM product_specs WHERE product_id = ?', [pid]);
      for(const s of b.specs){
        if(s && s.key && s.value) await _insert('INSERT INTO product_specs (product_id, spec_key, value) VALUES (?,?,?)', [pid, s.key, s.value]);
      }
    }

    const product = await _qOne('SELECT * FROM products WHERE id = ?', [pid]);
    res.json({ success:true, product: product });
  }catch(err){ next(err); }
};

/* حذف محصول */
exports.deleteProduct = async function(req, res, next){
  try{
    const pid = req.params.id;
    const existing = await _qOne('SELECT id FROM products WHERE id = ? AND owner_id = ?', [pid, req.user.id]);
    if(!existing){
      return res.status(404).json({ success:false, message:'محصول پیدا نشد یا مالک شما نیست.' });
    }
    /* چک: اگه توی سفارش استفاده شده، غیرفعال کن بجای حذف */
    const usedInOrder = await _qOne('SELECT COUNT(*) c FROM order_items WHERE product_id = ?', [pid]);
    if(usedInOrder && usedInOrder.c > 0){
      await _q('UPDATE products SET is_active = 0 WHERE id = ?', [pid]);
      return res.json({ success:true, message:'این محصول در سفارش‌ها استفاده شده — غیرفعال شد بجای حذف.' });
    }
    await _q('DELETE FROM products WHERE id = ? AND owner_id = ?', [pid, req.user.id]);
    res.json({ success:true, message:'محصول حذف شد.' });
  }catch(err){ next(err); }
};

/* toggle فعال/غیرفعال */
exports.toggleProduct = async function(req, res, next){
  try{
    const pid = req.params.id;
    const existing = await _qOne('SELECT id, is_active FROM products WHERE id = ? AND owner_id = ?', [pid, req.user.id]);
    if(!existing){
      return res.status(404).json({ success:false, message:'محصول پیدا نشد.' });
    }
    await _q('UPDATE products SET is_active = 1 - is_active WHERE id = ?', [pid]);
    const p = await _qOne('SELECT id, is_active FROM products WHERE id = ?', [pid]);
    res.json({ success:true, product: { id: p.id, isActive: !!p.is_active } });
  }catch(err){ next(err); }
};

/* جزئیات یک محصول برای ویرایش */
exports.getProduct = async function(req, res, next){
  try{
    const pid = req.params.id;
    const p = await _qOne('SELECT * FROM products WHERE id = ? AND owner_id = ?', [pid, req.user.id]);
    if(!p) return res.status(404).json({ success:false, message:'محصول پیدا نشد.' });
    const colors = await _q('SELECT name, hex FROM product_colors WHERE product_id = ?', [pid]);
    const specs = await _q('SELECT spec_key, value FROM product_specs WHERE product_id = ?', [pid]);
    const cat = await _qOne('SELECT id, name, slug, color, icon FROM categories WHERE id = ?', [p.category_id]);
    const images = parseJSON(p.images, []);
    const features = parseJSON(p.features, []);
    const sizes = parseJSON(p.sizes, []);
    const finalPrice = Math.round(p.price * (1 - (p.off || 0) / 100) / 1000) * 1000;
    res.json({
      success: true,
      product: {
        id: p.id, name: p.name, slug: p.slug, sku: p.sku, brand: p.brand,
        price: Number(p.price), purchasePrice: Number(p.purchase_price || 0),
        off: Number(p.off || 0), stock: Number(p.stock),
        minStock: Number(p.min_stock || 3), weight: Number(p.weight || 0),
        dimensions: p.dimensions || '', art: p.art || 'book',
        description: p.description || '', shortDescription: p.short_description || '',
        videoUrl: p.video_url || '', warranty: p.warranty || '',
        metaTitle: p.meta_title || '', metaDescription: p.meta_description || '',
        isActive: !!p.is_active,
        images: Array.isArray(images) ? images : [],
        features: Array.isArray(features) ? features : [],
        sizes: Array.isArray(sizes) ? sizes : [],
        colors: colors,
        specs: specs.map(function(s){ return { key: s.spec_key, value: s.value }; }),
        finalPrice: finalPrice,
        category: cat ? { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, icon: cat.icon } : null
      }
    });
  }catch(err){ next(err); }
};
