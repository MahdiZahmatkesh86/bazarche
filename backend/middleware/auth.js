const { qOne } = require('../db/init');
const { verifyAccess } = require('../utils/token');

function extractToken(req){
  if(req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  const h = req.headers.authorization;
  if(h && h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

async function protect(req, res, next){
  try{
    const token = extractToken(req);
    if(!token) return res.status(401).json({ success:false, message:'برای دسترسی باید وارد شوید.' });
    const decoded = verifyAccess(token);
    const user = await qOne('SELECT id, name, email, phone, role, avatar, is_active, token_version FROM users WHERE id = ?', [decoded.id]);
    if(!user || !user.is_active){
      return res.status(401).json({ success:false, message:'حساب یافت نشد یا غیرفعال است.' });
    }
    // token_version check
    if(typeof decoded.tv === 'number' && decoded.tv !== (user.token_version || 0)){
      return res.status(401).json({ success:false, message:'نشست شما باطل شده است. دوباره وارد شوید.' });
    }
    req.user = user;
    next();
  }catch(err){
    return res.status(401).json({ success:false, message:'توکن نامعتبر است.' });
  }
}

function adminOnly(req, res, next){
  if(!req.user || req.user.role !== 'admin'){
    return res.status(403).json({ success:false, message:'دسترسی فقط برای مدیران.' });
  }
  next();
}

async function optionalAuth(req, res, next){
  try{
    const token = extractToken(req);
    if(token){
      const decoded = verifyAccess(token);
      /* Must include is_active so a deactivated admin cannot sneak
         past admin-only checks (e.g. purchasePrice, owner PII). */
      const user = await qOne(
        'SELECT id, name, email, role, is_active, token_version FROM users WHERE id = ?',
        [decoded.id]
      );
      const tvOk = (typeof decoded.tv !== 'number') || decoded.tv === (user && user.token_version || 0);
      if(user && user.is_active && tvOk){
        req.user = user;
      }
    }
  }catch(e){ /* ignore */ }
  next();
}

function sellerOrAdmin(req, res, next){
  if(!req.user){
    return res.status(401).json({ success:false, message:'وارد شوید.' });
  }
  if(req.user.role !== 'seller' && req.user.role !== 'admin'){
    return res.status(403).json({ success:false, message:'فقط فروشندگان.' });
  }
  next();
}
module.exports = { protect, adminOnly, optionalAuth, sellerOrAdmin };
