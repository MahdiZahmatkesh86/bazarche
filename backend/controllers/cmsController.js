const { q, qOne, insert } = require('../db/init');

function slugify(s){
  return String(s || '').trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '')
    .slice(0, 110);
}

/* ============ PAGES ============ */
exports.pagesList = async (req, res, next) => {
  try{
    const isAdmin = !!(req.user && req.user.role === 'admin');
    const all = isAdmin && req.query.all === 'true';
    const where = all ? '' : ' WHERE is_published = 1';
    const rows = await q('SELECT * FROM cms_pages' + where + ' ORDER BY sort_order ASC, id ASC');
    res.json({ success:true, pages: rows });
  }catch(err){ next(err); }
};

exports.pagesGet = async (req, res, next) => {
  try{
    const isAdmin = !!(req.user && req.user.role === 'admin');
    const extra = isAdmin ? '' : ' AND is_published = 1';
    const page = await qOne('SELECT * FROM cms_pages WHERE (slug = ? OR id = ?)' + extra + ' LIMIT 1', [req.params.slug, req.params.slug]);
    if(!page) return res.status(404).json({ success:false, message:'صفحه پیدا نشد.' });
    res.json({ success:true, page });
  }catch(err){ next(err); }
};

exports.pagesCreate = async (req, res, next) => {
  try{
    const b = req.body;
    if(!b.title) return res.status(400).json({ success:false, message:'عنوان الزامی است.' });
    const slug = b.slug ? slugify(b.slug) : slugify(b.title);
    const dup = await qOne('SELECT id FROM cms_pages WHERE slug = ?', [slug]);
    if(dup) return res.status(400).json({ success:false, message:'این آدرس قبلاً استفاده شده.' });
    const id = await insert(
      'INSERT INTO cms_pages (slug,title,content,meta_title,meta_description,is_published,show_in_menu,sort_order) VALUES (?,?,?,?,?,?,?,?)',
      [slug, b.title, b.content || '', b.meta_title || '', b.meta_description || '',
       b.is_published === false ? 0 : 1, b.show_in_menu ? 1 : 0, Number(b.sort_order) || 0]
    );
    const page = await qOne('SELECT * FROM cms_pages WHERE id = ?', [id]);
    res.status(201).json({ success:true, page });
  }catch(err){ next(err); }
};

exports.pagesUpdate = async (req, res, next) => {
  try{
    const b = req.body;
    const fields = [];
    const vals = [];
    ['title','content','meta_title','meta_description'].forEach(k => {
      if(b[k] !== undefined){ fields.push(k + ' = ?'); vals.push(b[k]); }
    });
    if(b.slug !== undefined){ fields.push('slug = ?'); vals.push(slugify(b.slug)); }
    if(b.is_published !== undefined){ fields.push('is_published = ?'); vals.push(b.is_published ? 1 : 0); }
    if(b.show_in_menu !== undefined){ fields.push('show_in_menu = ?'); vals.push(b.show_in_menu ? 1 : 0); }
    if(b.sort_order !== undefined){ fields.push('sort_order = ?'); vals.push(Number(b.sort_order) || 0); }
    if(fields.length){ vals.push(req.params.id); await q('UPDATE cms_pages SET ' + fields.join(', ') + ' WHERE id = ?', vals); }
    const page = await qOne('SELECT * FROM cms_pages WHERE id = ?', [req.params.id]);
    if(!page) return res.status(404).json({ success:false, message:'صفحه پیدا نشد.' });
    res.json({ success:true, page });
  }catch(err){ next(err); }
};

exports.pagesDelete = async (req, res, next) => {
  try{
    await q('DELETE FROM cms_pages WHERE id = ?', [req.params.id]);
    res.json({ success:true });
  }catch(err){ next(err); }
};

/* ============ BANNERS ============ */
exports.bannersList = async (req, res, next) => {
  try{
    const isAdmin = !!(req.user && req.user.role === 'admin');
    const all = isAdmin && req.query.all === 'true';
    const where = all ? '' : ' WHERE is_active = 1';
    const rows = await q('SELECT * FROM cms_banners' + where + ' ORDER BY sort_order ASC, id DESC');
    res.json({ success:true, banners: rows });
  }catch(err){ next(err); }
};

exports.bannersCreate = async (req, res, next) => {
  try{
    const b = req.body;
    if(!b.image_url) return res.status(400).json({ success:false, message:'تصویر الزامی است.' });
    const id = await insert(
      'INSERT INTO cms_banners (title,image_url,link,position,is_active,sort_order,start_at,end_at) VALUES (?,?,?,?,?,?,?,?)',
      [b.title || '', b.image_url, b.link || null, b.position || 'top',
       b.is_active === false ? 0 : 1, Number(b.sort_order) || 0,
       b.start_at || null, b.end_at || null]
    );
    const banner = await qOne('SELECT * FROM cms_banners WHERE id = ?', [id]);
    res.status(201).json({ success:true, banner });
  }catch(err){ next(err); }
};

exports.bannersUpdate = async (req, res, next) => {
  try{
    const b = req.body;
    const fields = [];
    const vals = [];
    ['title','image_url','link','position'].forEach(k => {
      if(b[k] !== undefined){ fields.push(k + ' = ?'); vals.push(b[k]); }
    });
    if(b.is_active !== undefined){ fields.push('is_active = ?'); vals.push(b.is_active ? 1 : 0); }
    if(b.sort_order !== undefined){ fields.push('sort_order = ?'); vals.push(Number(b.sort_order) || 0); }
    if(b.start_at !== undefined){ fields.push('start_at = ?'); vals.push(b.start_at || null); }
    if(b.end_at !== undefined){ fields.push('end_at = ?'); vals.push(b.end_at || null); }
    if(fields.length){ vals.push(req.params.id); await q('UPDATE cms_banners SET ' + fields.join(', ') + ' WHERE id = ?', vals); }
    const banner = await qOne('SELECT * FROM cms_banners WHERE id = ?', [req.params.id]);
    if(!banner) return res.status(404).json({ success:false, message:'بنر پیدا نشد.' });
    res.json({ success:true, banner });
  }catch(err){ next(err); }
};

exports.bannersDelete = async (req, res, next) => {
  try{
    await q('DELETE FROM cms_banners WHERE id = ?', [req.params.id]);
    res.json({ success:true });
  }catch(err){ next(err); }
};

/* ============ SLIDERS ============ */
exports.slidersList = async (req, res, next) => {
  try{
    const isAdmin = !!(req.user && req.user.role === 'admin');
    const all = isAdmin && req.query.all === 'true';
    const where = all ? '' : ' WHERE is_active = 1';
    const rows = await q('SELECT * FROM cms_sliders' + where + ' ORDER BY sort_order ASC, id DESC');
    res.json({ success:true, sliders: rows });
  }catch(err){ next(err); }
};

exports.slidersCreate = async (req, res, next) => {
  try{
    const b = req.body;
    if(!b.image_url) return res.status(400).json({ success:false, message:'تصویر الزامی است.' });
    const id = await insert(
      'INSERT INTO cms_sliders (title,subtitle,image_url,link,button_text,bg_color,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?)',
      [b.title || '', b.subtitle || '', b.image_url, b.link || null,
       b.button_text || 'مشاهده', b.bg_color || '#0f172a',
       b.is_active === false ? 0 : 1, Number(b.sort_order) || 0]
    );
    const slider = await qOne('SELECT * FROM cms_sliders WHERE id = ?', [id]);
    res.status(201).json({ success:true, slider });
  }catch(err){ next(err); }
};

exports.slidersUpdate = async (req, res, next) => {
  try{
    const b = req.body;
    const fields = [];
    const vals = [];
    ['title','subtitle','image_url','link','button_text','bg_color'].forEach(k => {
      if(b[k] !== undefined){ fields.push(k + ' = ?'); vals.push(b[k]); }
    });
    if(b.is_active !== undefined){ fields.push('is_active = ?'); vals.push(b.is_active ? 1 : 0); }
    if(b.sort_order !== undefined){ fields.push('sort_order = ?'); vals.push(Number(b.sort_order) || 0); }
    if(fields.length){ vals.push(req.params.id); await q('UPDATE cms_sliders SET ' + fields.join(', ') + ' WHERE id = ?', vals); }
    const slider = await qOne('SELECT * FROM cms_sliders WHERE id = ?', [req.params.id]);
    if(!slider) return res.status(404).json({ success:false, message:'اسلاید پیدا نشد.' });
    res.json({ success:true, slider });
  }catch(err){ next(err); }
};

exports.slidersDelete = async (req, res, next) => {
  try{
    await q('DELETE FROM cms_sliders WHERE id = ?', [req.params.id]);
    res.json({ success:true });
  }catch(err){ next(err); }
};
