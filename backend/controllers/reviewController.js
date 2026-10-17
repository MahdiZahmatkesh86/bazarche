const { q, qOne, insert } = require('../db/init');

async function calcAverage(productId){
  const row = await qOne(
    'SELECT AVG(rating) avg, COUNT(*) cnt FROM reviews WHERE product_id = ? AND is_approved = 1',
    [productId]
  );
  const avg = row.avg ? Math.round(Number(row.avg) * 10) / 10 : 0;
  const cnt = row.cnt || 0;
  await q('UPDATE products SET rating = ?, num_reviews = ? WHERE id = ?', [avg, cnt, productId]);
}

exports.byProduct = async (req, res, next) => {
  try{
    const rows = await q(
      'SELECT r.*, u.name as user_name, u.avatar as user_avatar FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? AND r.is_approved = 1 ORDER BY r.created_at DESC',
      [req.params.productId]
    );
    const reviews = rows.map(r => ({
      _id:r.id, id:r.id,
      rating:r.rating, comment:r.comment,
      user: { name:r.user_name, avatar:r.user_avatar },
      createdAt:r.created_at
    }));
    res.json({ success:true, reviews });
  }catch(err){ next(err); }
};

exports.create = async (req, res, next) => {
  try{
    const { rating, comment } = req.body;
    const productId = req.params.productId;

    const product = await qOne('SELECT id FROM products WHERE id = ?', [productId]);
    if(!product){
      return res.status(404).json({ success:false, message:'محصول پیدا نشد.' });
    }

    /* چک: کاربر باید این محصول رو خریده باشه */
    const purchased = await qOne(
      "SELECT oi.order_id FROM order_items oi " +
      "JOIN orders o ON o.id = oi.order_id " +
      "WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ('paid','processing','shipped','delivered') " +
      "LIMIT 1",
      [req.user.id, productId]
    );
    if(!purchased){
      return res.status(403).json({
        success:false,
        message:'فقط خریداران این محصول می‌توانند نظر ثبت کنند.'
      });
    }

    const existing = await qOne(
      'SELECT id FROM reviews WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );
    if(existing){
      return res.status(400).json({ success:false, message:'قبلاً برای این محصول نظر داده‌اید.' });
    }

    /* نظرات نیاز به تأیید ادمین دارن */
    const id = await insert(
      'INSERT INTO reviews (user_id, product_id, rating, comment, is_approved) VALUES (?,?,?,?,0)',
      [req.user.id, productId, Number(rating), comment]
    );
    /* rating محصول رو آپدیت نکن تا تأیید بشه */
    const review = await qOne('SELECT * FROM reviews WHERE id = ?', [id]);
    res.status(201).json({
      success:true,
      review,
      message:'نظر شما ثبت شد و پس از تأیید مدیر نمایش داده می‌شود.'
    });
  }catch(err){ next(err); }
};;

exports.remove = async (req, res, next) => {
  try{
    const review = await qOne('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    if(!review) return res.status(404).json({ success:false, message:'نظر پیدا نشد.' });
    if(review.user_id !== req.user.id && req.user.role !== 'admin'){
      return res.status(403).json({ success:false, message:'دسترسی ندارید.' });
    }
    await q('DELETE FROM reviews WHERE id = ?', [review.id]);
    await calcAverage(review.product_id);
    res.json({ success:true, message:'نظر حذف شد.' });
  }catch(err){ next(err); }
};

exports.listAll = async (req, res, next) => {
  try{
    let where = ['1=1'];
    const params = [];
    if(req.query.approved === 'false') where.push('r.is_approved = 0');
    if(req.query.approved === 'true')  where.push('r.is_approved = 1');
    const rows = await q(
      'SELECT r.*, u.name user_name, u.email user_email, p.name product_name, p.slug product_slug FROM reviews r JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id WHERE ' +
      where.join(' AND ') + ' ORDER BY r.created_at DESC LIMIT 200',
      params
    );
    const reviews = rows.map(r => ({
      _id:r.id, rating:r.rating, comment:r.comment,
      isApproved:!!r.is_approved, createdAt:r.created_at,
      user:{ name:r.user_name, email:r.user_email },
      product:{ name:r.product_name, slug:r.product_slug }
    }));
    res.json({ success:true, reviews });
  }catch(err){ next(err); }
};

exports.toggleApprove = async (req, res, next) => {
  try{
    const r = await qOne('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    if(!r) return res.status(404).json({ success:false, message:'نظر پیدا نشد.' });
    await q('UPDATE reviews SET is_approved = 1 - is_approved WHERE id = ?', [r.id]);
    await calcAverage(r.product_id);
    const updated = await qOne('SELECT * FROM reviews WHERE id = ?', [r.id]);
    res.json({ success:true, review: updated });
  }catch(err){ next(err); }
};