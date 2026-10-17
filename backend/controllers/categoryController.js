const { q, qOne, insert } = require('../db/init');

function slugify(s){
  return String(s).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '');
}

exports.list = async (req, res, next) => {
  try{
    const where = req.query.all === 'true' ? '' : 'WHERE is_active = 1';
    const rows = await q('SELECT * FROM categories ' + where + ' ORDER BY order_num ASC, name ASC');
    const withCount = await Promise.all(rows.map(async c => {
      const cnt = await qOne('SELECT COUNT(*) c FROM products WHERE category_id = ? AND is_active = 1', [c.id]);
      return {
        id: c.id, _id: c.id,
        name: c.name, slug: c.slug,
        icon: c.icon, color: c.color,
        image_url: c.image_url || null,
        order: c.order_num,
        isActive: !!c.is_active,
        productCount: cnt.c
      };
    }));
    res.json({ success:true, categories: withCount });
  }catch(err){ next(err); }
};

exports.create = async (req, res, next) => {
  try{
    const { name, icon, color, order, image_url } = req.body;
    if(!name) return res.status(400).json({ success:false, message:'نام الزامی است.' });
    const slug = slugify(name);
    const id = await insert(
      'INSERT INTO categories (name, slug, icon, color, order_num, image_url) VALUES (?,?,?,?,?,?)',
      [name, slug, icon || 'book', color || '#3b82f6', Number(order) || 0, String(image_url || '').slice(0, 500)]
    );
    const cat = await qOne('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json({ success:true, category: cat });
  }catch(err){ next(err); }
};

exports.update = async (req, res, next) => {
  try{
    const b = req.body;
    const fields = [];
    const vals = [];
    if(b.name !== undefined){ fields.push('name = ?', 'slug = ?'); vals.push(b.name, slugify(b.name)); }
    if(b.icon !== undefined){ fields.push('icon = ?'); vals.push(b.icon); }
    if(b.color !== undefined){ fields.push('color = ?'); vals.push(b.color); }
    if(b.order !== undefined){ fields.push('order_num = ?'); vals.push(Number(b.order) || 0); }
    if(b.isActive !== undefined){ fields.push('is_active = ?'); vals.push(b.isActive ? 1 : 0); }
    if(b.image_url !== undefined){ fields.push('image_url = ?'); vals.push(String(b.image_url || '').slice(0, 500)); }
    if(fields.length){
      vals.push(req.params.id);
      await q('UPDATE categories SET ' + fields.join(', ') + ' WHERE id = ?', vals);
    }
    const cat = await qOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if(!cat) return res.status(404).json({ success:false, message:'دسته پیدا نشد.' });
    res.json({ success:true, category: cat });
  }catch(err){ next(err); }
};

exports.remove = async (req, res, next) => {
  try{
    const cnt = await qOne('SELECT COUNT(*) c FROM products WHERE category_id = ?', [req.params.id]);
    if(cnt.c > 0) return res.status(400).json({ success:false, message:'ابتدا ' + cnt.c + ' محصول این دسته را منتقل یا حذف کنید.' });
    await q('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success:true, message:'دسته حذف شد.' });
  }catch(err){ next(err); }
};
