const { q, qOne, insert } = require('../db/init');

function safeUser(u){
  if(!u) return null;
  return {
    id: u.id, _id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    avatar: u.avatar || null,
    isActive: !!u.is_active,
    lastLogin: u.last_login,
    createdAt: u.created_at
  };
}

exports.list = async (req, res, next) => {
  try{
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    const params = [];
    if(req.query.q){
      where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const like = '%' + req.query.q + '%';
      params.push(like, like, like);
    }
    if(req.query.role){ where.push('role = ?'); params.push(req.query.role); }
    if(req.query.active === 'true'){ where.push('is_active = 1'); }
    if(req.query.active === 'false'){ where.push('is_active = 0'); }

    const whereSql = 'WHERE ' + where.join(' AND ');
    const rows = await q(
      'SELECT id, name, email, phone, role, avatar, is_active, last_login, created_at FROM users ' + whereSql + ' ORDER BY created_at DESC LIMIT ' + limit + ' OFFSET ' + offset,
      params
    );
    const totalRow = await qOne('SELECT COUNT(*) c FROM users ' + whereSql, params);
    const total = totalRow ? totalRow.c : 0;

    const items = rows.map(safeUser);
    res.json({ success:true, items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  }catch(err){ next(err); }
};

/* ============ جزئیات کامل کاربر ============ */
exports.getDetail = async (req, res, next) => {
  try{
    const user = await qOne(
      'SELECT id, name, email, phone, role, avatar, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if(!user){
      return res.status(404).json({ success:false, message:'کاربر پیدا نشد.' });
    }

    /* آمار سفارش‌ها */
    const stats = await qOne(
      "SELECT COUNT(*) total, " +
      "COALESCE(SUM(CASE WHEN status IN ('paid','processing','shipped','delivered') THEN total_price ELSE 0 END),0) spent, " +
      "COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END),0) cancelled, " +
      "COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) pending " +
      'FROM orders WHERE user_id = ?',
      [user.id]
    );

    /* آدرس‌ها */
    const addresses = await q('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [user.id]);

    /* ۱۰ سفارش آخر */
    const orders = await q(
      'SELECT id, tracking_code, total_price, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [user.id]
    );

    /* تعداد نظرات */
    const reviewsCount = await qOne('SELECT COUNT(*) c FROM reviews WHERE user_id = ?', [user.id]);

    res.json({
      success: true,
      user: safeUser(user),
      stats: {
        ordersTotal: Number(stats.total) || 0,
        ordersPending: Number(stats.pending) || 0,
        ordersCancelled: Number(stats.cancelled) || 0,
        totalSpent: Number(stats.spent) || 0,
        reviews: Number(reviewsCount.c) || 0,
        addresses: addresses.length
      },
      addresses: addresses.map(a => ({
        id: a.id, title: a.title, province: a.province, city: a.city,
        street: a.street, postalCode: a.postal_code, phone: a.phone,
        isDefault: !!a.is_default
      })),
      orders: orders.map(o => ({
        id: o.id, trackingCode: o.tracking_code,
        total: Number(o.total_price), status: o.status, createdAt: o.created_at
      }))
    });
  }catch(err){ next(err); }
};

exports.update = async (req, res, next) => {
  try{
    const b = req.body;
    const fields = [];
    const vals = [];
    ['name','avatar'].forEach(k => {
      if(b[k] !== undefined){ fields.push(k + ' = ?'); vals.push(String(b[k]).trim()); }
    });
    if(b.phone !== undefined){
      const p = String(b.phone).replace(/[^0-9]/g, '');
      if(!/^09\d{9}$/.test(p)) return res.status(400).json({ success:false, message:'شمارهٔ موبایل نامعتبر است.' });
      fields.push('phone = ?'); vals.push(p);
    }
    if(b.isActive !== undefined){ fields.push('is_active = ?'); vals.push(b.isActive ? 1 : 0); }
    if(fields.length){
      vals.push(req.params.id);
      await q('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', vals);
    }
    const user = await qOne('SELECT id, name, email, phone, role, avatar, is_active FROM users WHERE id = ?', [req.params.id]);
    if(!user) return res.status(404).json({ success:false, message:'کاربر پیدا نشد.' });
    res.json({ success:true, user: safeUser(user) });
  }catch(err){ next(err); }
};

exports.remove = async (req, res, next) => {
  try{
    if(String(req.params.id) === String(req.user.id)){
      return res.status(400).json({ success:false, message:'نمی‌توانید حساب خود را حذف کنید.' });
    }
    /* چک اگه آخرین ادمین هست */
    const target = await qOne('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if(target && target.role === 'admin'){
      const adminsCount = await qOne("SELECT COUNT(*) c FROM users WHERE role='admin' AND is_active=1");
      if(adminsCount.c <= 1){
        return res.status(400).json({ success:false, message:'نمی‌توانید آخرین ادمین را حذف کنید.' });
      }
    }
    /* چک اگه سفارش داره → نمی‌تونیم حذف کنیم، فقط غیرفعال */
    const ordersCount = await qOne('SELECT COUNT(*) c FROM orders WHERE user_id = ?', [req.params.id]);
    if(ordersCount.c > 0){
      await q('UPDATE users SET is_active = 0, token_version = COALESCE(token_version,0) + 1 WHERE id = ?', [req.params.id]);
      return res.json({ success:true, message:'کاربر به دلیل داشتن سفارش غیرفعال شد (حذف نمی‌شود).' });
    }
    await q('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success:true, message:'کاربر حذف شد.' });
  }catch(err){ next(err); }
};

exports.toggleActive = async (req, res, next) => {
  try{
    if(String(req.params.id) === String(req.user.id)){
      return res.status(400).json({ success:false, message:'نمی‌توانید حساب خود را غیرفعال کنید.' });
    }
    const target = await qOne('SELECT role, is_active FROM users WHERE id = ?', [req.params.id]);
    if(!target) return res.status(404).json({ success:false, message:'کاربر پیدا نشد.' });
    if(target.role === 'admin' && target.is_active){
      const adminsCount = await qOne("SELECT COUNT(*) c FROM users WHERE role='admin' AND is_active=1");
      if(adminsCount.c <= 1){
        return res.status(400).json({ success:false, message:'نمی‌توانید آخرین ادمین فعال را غیرفعال کنید.' });
      }
    }
    /* با غیرفعال کردن، توکن‌ها باطل می‌شن */
    await q('UPDATE users SET is_active = 1 - is_active, token_version = COALESCE(token_version,0) + 1 WHERE id = ?', [req.params.id]);
    const user = await qOne('SELECT id, is_active FROM users WHERE id = ?', [req.params.id]);
    res.json({ success:true, user: { ...user, isActive: !!user.is_active } });
  }catch(err){ next(err); }
};

exports.changeRole = async (req, res, next) => {
  try{
    const { role } = req.body;
    if(!['user','admin'].includes(role)){
      return res.status(400).json({ success:false, message:'نقش نامعتبر است.' });
    }
    /* چک: نمی‌تونه نقش خودش رو عوض کنه */
    if(String(req.params.id) === String(req.user.id)){
      return res.status(400).json({ success:false, message:'نمی‌توانید نقش خودتان را تغییر دهید.' });
    }
    const target = await qOne('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if(!target) return res.status(404).json({ success:false, message:'کاربر پیدا نشد.' });
    /* اگه داره ادمین رو کاربر می‌کنه */
    if(target.role === 'admin' && role === 'user'){
      const adminsCount = await qOne("SELECT COUNT(*) c FROM users WHERE role='admin' AND is_active=1");
      if(adminsCount.c <= 1){
        return res.status(400).json({ success:false, message:'نمی‌توانید آخرین ادمین را به کاربر تبدیل کنید.' });
      }
    }
    await q('UPDATE users SET role = ?, token_version = COALESCE(token_version,0) + 1 WHERE id = ?', [role, req.params.id]);
    const user = await qOne('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    res.json({ success:true, user });
  }catch(err){ next(err); }
};

/* ============ Addresses ============ */
exports.addAddress = async (req, res, next) => {
  try{
    const b = req.body;
    if(b.isDefault) await q('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    await insert(
      'INSERT INTO addresses (user_id, title, province, city, street, postal_code, phone, is_default) VALUES (?,?,?,?,?,?,?,?)',
      [req.user.id, b.title, b.province || null, b.city, b.street, b.postalCode || null, b.phone || null, b.isDefault ? 1 : 0]
    );
    const addresses = await q('SELECT * FROM addresses WHERE user_id = ?', [req.user.id]);
    res.status(201).json({ success:true, addresses });
  }catch(err){ next(err); }
};

exports.updateAddress = async (req, res, next) => {
  try{
    const b = req.body;
    const existing = await qOne('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [req.params.addrId, req.user.id]);
    if(!existing) return res.status(404).json({ success:false, message:'نشانی پیدا نشد.' });
    if(b.isDefault) await q('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    const fields = []; const vals = [];
    const map = { title:'title', province:'province', city:'city', street:'street', postalCode:'postal_code', phone:'phone' };
    Object.keys(map).forEach(k => { if(b[k] !== undefined){ fields.push(map[k] + ' = ?'); vals.push(b[k]); } });
    if(b.isDefault !== undefined){ fields.push('is_default = ?'); vals.push(b.isDefault ? 1 : 0); }
    if(fields.length){
      vals.push(req.params.addrId);
      await q('UPDATE addresses SET ' + fields.join(', ') + ' WHERE id = ?', vals);
    }
    const addresses = await q('SELECT * FROM addresses WHERE user_id = ?', [req.user.id]);
    res.json({ success:true, addresses });
  }catch(err){ next(err); }
};

exports.removeAddress = async (req, res, next) => {
  try{
    await q('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.addrId, req.user.id]);
    const addresses = await q('SELECT * FROM addresses WHERE user_id = ?', [req.user.id]);
    res.json({ success:true, addresses });
  }catch(err){ next(err); }
};

/* سازگاری با کد قدیمی */
exports.getOne = async (req, res, next) => {
  return exports.getDetail(req, res, next);
};