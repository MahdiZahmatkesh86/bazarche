const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q, qOne, insert } = require('../db/init');
const { signAccess, signRefresh, setCookies, clearCookies, verifyRefresh } = require('../utils/token');

function payload(u){
  return {
    _id: u.id, id: u.id,
    name: u.name, phone: u.phone,
    role: u.role, avatar: u.avatar
  };
}

function normalizePhone(p){
  if(!p) return '';
  return String(p)
    .replace(/[۰-۹]/g, function(d){ return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
    .replace(/[^0-9]/g, '');
}

function bumpTokenVersion(userId){
  return q('UPDATE users SET token_version = COALESCE(token_version,0) + 1 WHERE id = ?', [userId]);
}

/* ============ ثبت‌نام — فقط شماره ============ */
exports.register = async (req, res, next) => {
  try{
    const { name, phone, password } = req.body;
    const cleanPhone = normalizePhone(phone);

    if(!name || String(name).trim().length < 3){
      return res.status(400).json({ success:false, message:'نام باید حداقل ۳ کاراکتر باشد.' });
    }
    if(!/^09\d{9}$/.test(cleanPhone)){
      return res.status(400).json({ success:false, message:'شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.' });
    }
    if(!password || String(password).length < 8){
      return res.status(400).json({ success:false, message:'رمز عبور حداقل ۸ کاراکتر باشد.' });
    }

    const dup = await qOne('SELECT id FROM users WHERE phone = ? LIMIT 1', [cleanPhone]);
    if(dup){
      return res.status(400).json({ success:false, message:'این شمارهٔ موبایل قبلاً ثبت شده است.' });
    }

    /* ایمیل پلیس‌هولدر یکتا */
    const placeholderEmail = 'u' + cleanPhone + '.' + Date.now().toString(36) + '@phone.local';
    const hash = await bcrypt.hash(password, 10);
    const id = await insert(
      'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
      [String(name).trim(), placeholderEmail, cleanPhone, hash]
    );
    const user = await qOne('SELECT * FROM users WHERE id = ?', [id]);
    const tv = 0;
    setCookies(res, signAccess(user.id, tv), signRefresh(user.id, tv));
    res.status(201).json({ success:true, user: payload(user) });
  }catch(err){ next(err); }
};

/* ============ ورود — فقط شماره ============ */
exports.login = async (req, res, next) => {
  try{
    const { phone, password } = req.body;
    const cleanPhone = normalizePhone(phone);

    if(!cleanPhone || !password){
      return res.status(400).json({ success:false, message:'شماره و رمز عبور الزامی است.' });
    }

    const user = await qOne('SELECT * FROM users WHERE phone = ? LIMIT 1', [cleanPhone]);
    if(!user){
      return res.status(401).json({ success:false, message:'شماره یا رمز عبور اشتباه است.' });
    }
    const okPw = await bcrypt.compare(password, user.password);
    if(!okPw){
      return res.status(401).json({ success:false, message:'شماره یا رمز عبور اشتباه است.' });
    }
    if(!user.is_active){
      return res.status(403).json({ success:false, message:'حساب شما غیرفعال شده است.' });
    }

    await q('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    const tv = user.token_version || 0;
    setCookies(res, signAccess(user.id, tv), signRefresh(user.id, tv));
    res.json({ success:true, user: payload(user) });
  }catch(err){ next(err); }
};

/* ============ OTP — آماده برای آینده ============ */
exports.sendOtp = async (req, res) => {
  return res.status(503).json({ success:false, message:'ورود با کد یکبار مصرف به زودی فعال می‌شود.' });
};
exports.verifyOtp = async (req, res) => {
  return res.status(503).json({ success:false, message:'ورود با کد یکبار مصرف به زودی فعال می‌شود.' });
};

/* ============ بقیه ============ */
exports.logout = function(req, res){
  clearCookies(res);
  res.json({ success:true, message:'از حساب خارج شدید.' });
};

exports.refresh = async (req, res, next) => {
  try{
    const token = req.cookies && req.cookies.refreshToken;
    if(!token) return res.status(401).json({ success:false, message:'توکن موجود نیست.' });
    const decoded = verifyRefresh(token);
    const user = await qOne('SELECT * FROM users WHERE id = ? AND is_active = 1', [decoded.id]);
    if(!user) return res.status(401).json({ success:false, message:'کاربر معتبر نیست.' });
    if(typeof decoded.tv === 'number' && decoded.tv !== (user.token_version || 0)){
      return res.status(401).json({ success:false, message:'نشست باطل شده.' });
    }
    const access = signAccess(user.id, user.token_version || 0);
    res.cookie('accessToken', access, {
      httpOnly:true, sameSite:'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7*24*60*60*1000
    });
    res.json({ success:true });
  }catch(err){
    res.status(401).json({ success:false, message:'توکن نامعتبر.' });
  }
};

exports.me = async (req, res, next) => {
  try{
    const addresses = await q('SELECT * FROM addresses WHERE user_id = ?', [req.user.id]);
    res.json({ success:true, user: { ...req.user, addresses } });
  }catch(err){ next(err); }
};

exports.updateMe = async (req, res, next) => {
  try{
    const fields = [];
    const vals = [];
    if(req.body.name !== undefined){
      const n = String(req.body.name).trim();
      if(n.length < 3 || n.length > 60) return res.status(400).json({ success:false, message:'نام باید بین ۳ تا ۶۰ کاراکتر.' });
      fields.push('name = ?'); vals.push(n);
    }
    if(req.body.avatar !== undefined){
      fields.push('avatar = ?'); vals.push(String(req.body.avatar || '').trim().slice(0, 500));
    }
    if(fields.length){
      vals.push(req.user.id);
      await q('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', vals);
    }
    const user = await qOne('SELECT id, name, phone, role, avatar, is_active FROM users WHERE id = ?', [req.user.id]);
    res.json({ success:true, user });
  }catch(err){ next(err); }
};

exports.changePassword = async (req, res, next) => {
  try{
    const { currentPassword, newPassword } = req.body;
    if(!currentPassword || !newPassword || newPassword.length < 8){
      return res.status(400).json({ success:false, message:'رمز فعلی و جدید (حداقل ۸ کاراکتر) الزامی است.' });
    }
    if(currentPassword === newPassword){
      return res.status(400).json({ success:false, message:'رمز جدید باید متفاوت باشد.' });
    }
    const user = await qOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const okPw = await bcrypt.compare(currentPassword, user.password);
    if(!okPw) return res.status(401).json({ success:false, message:'رمز فعلی اشتباه است.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await q('UPDATE users SET password = ? WHERE id = ?', [hash, user.id]);
    await bumpTokenVersion(user.id);
    clearCookies(res);
    res.json({ success:true, message:'رمز تغییر کرد. دوباره وارد شوید.' });
  }catch(err){ next(err); }
};

exports.forgotPassword = async (req, res) => {
  return res.status(503).json({ success:false, message:'بازیابی رمز به زودی از طریق پیامک فعال می‌شود.' });
};
exports.resetPassword = async (req, res) => {
  return res.status(503).json({ success:false, message:'بازیابی رمز به زودی فعال می‌شود.' });
};