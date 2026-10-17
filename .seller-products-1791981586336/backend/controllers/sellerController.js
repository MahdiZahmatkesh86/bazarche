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
