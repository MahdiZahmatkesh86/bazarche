const { q, qOne, insert } = require('../db/init');

function normF(b){
  return {
    title: String(b.title || '').trim().slice(0, 120),
    subtitle: String(b.subtitle || '').trim().slice(0, 200),
    icon: String(b.icon || 'shield').trim().slice(0, 40),
    color: String(b.color || '#c81e3a').trim().slice(0, 20),
    image_url: String(b.image_url || '').trim().slice(0, 500),
    sort_order: Number(b.sort_order) || 0,
    is_active: b.is_active === false ? 0 : 1
  };
}
function normFe(b){
  return {
    title: String(b.title || '').trim().slice(0, 120),
    subtitle: String(b.subtitle || '').trim().slice(0, 200),
    button_text: String(b.button_text || 'دیدن همه').trim().slice(0, 80),
    link: String(b.link || '').trim().slice(0, 300),
    bg_color: String(b.bg_color || '#7b1e3a').trim().slice(0, 20),
    image_url: String(b.image_url || '').trim().slice(0, 500),
    sort_order: Number(b.sort_order) || 0,
    is_active: b.is_active === false ? 0 : 1,
    ends_at: b.ends_at || null
  };
}

/* ============ FEATURES ============ */
exports.featuresList = async (req, res, next) => {
  try{
    const isAdmin = !!(req.user && req.user.role === 'admin');
    const where = isAdmin && req.query.all === 'true' ? '' : ' WHERE is_active = 1';
    const rows = await q('SELECT * FROM site_features' + where + ' ORDER BY sort_order ASC, id ASC');
    res.json({ success:true, features: rows });
  }catch(err){ next(err); }
};
exports.featuresCreate = async (req, res, next) => {
  try{
    const b = normF(req.body);
    if(!b.title) return res.status(400).json({ success:false, message:'عنوان الزامی است.' });
    const id = await insert(
      'INSERT INTO site_features (title,subtitle,icon,color,image_url,sort_order,is_active) VALUES (?,?,?,?,?,?,?)',
      [b.title, b.subtitle, b.icon, b.color, b.image_url, b.sort_order, b.is_active]
    );
    const row = await qOne('SELECT * FROM site_features WHERE id = ?', [id]);
    res.status(201).json({ success:true, feature: row });
  }catch(err){ next(err); }
};
exports.featuresUpdate = async (req, res, next) => {
  try{
    const b = normF(req.body);
    await q('UPDATE site_features SET title=?, subtitle=?, icon=?, color=?, image_url=?, sort_order=?, is_active=? WHERE id=?',
      [b.title, b.subtitle, b.icon, b.color, b.image_url, b.sort_order, b.is_active, req.params.id]);
    const row = await qOne('SELECT * FROM site_features WHERE id = ?', [req.params.id]);
    res.json({ success:true, feature: row });
  }catch(err){ next(err); }
};
exports.featuresDelete = async (req, res, next) => {
  try{ await q('DELETE FROM site_features WHERE id = ?', [req.params.id]); res.json({ success:true }); }
  catch(err){ next(err); }
};

/* ============ FESTIVALS ============ */
exports.festivalsList = async (req, res, next) => {
  try{
    const isAdmin = !!(req.user && req.user.role === 'admin');
    const where = isAdmin && req.query.all === 'true' ? '' : ' WHERE is_active = 1';
    const rows = await q('SELECT * FROM site_festivals' + where + ' ORDER BY sort_order ASC, id ASC');
    res.json({ success:true, festivals: rows });
  }catch(err){ next(err); }
};
exports.festivalsCreate = async (req, res, next) => {
  try{
    const b = normFe(req.body);
    if(!b.title) return res.status(400).json({ success:false, message:'عنوان الزامی است.' });
    const id = await insert(
      'INSERT INTO site_festivals (title,subtitle,button_text,link,ends_at,bg_color,image_url,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?)',
      [b.title, b.subtitle, b.button_text || 'دیدن همه', b.link || null, b.ends_at, b.bg_color, b.image_url || null, b.sort_order, b.is_active]
    );
    const row = await qOne('SELECT * FROM site_festivals WHERE id = ?', [id]);
    res.status(201).json({ success:true, festival: row });
  }catch(err){ next(err); }
};
exports.festivalsUpdate = async (req, res, next) => {
  try{
    const b = normFe(req.body);
    await q('UPDATE site_festivals SET title=?, subtitle=?, button_text=?, link=?, ends_at=?, bg_color=?, image_url=?, sort_order=?, is_active=? WHERE id=?',
      [b.title, b.subtitle, b.button_text || 'دیدن همه', b.link || null, b.ends_at, b.bg_color, b.image_url || null, b.sort_order, b.is_active, req.params.id]);
    const row = await qOne('SELECT * FROM site_festivals WHERE id = ?', [req.params.id]);
    res.json({ success:true, festival: row });
  }catch(err){ next(err); }
};
exports.festivalsDelete = async (req, res, next) => {
  try{ await q('DELETE FROM site_festivals WHERE id = ?', [req.params.id]); res.json({ success:true }); }
  catch(err){ next(err); }
};
