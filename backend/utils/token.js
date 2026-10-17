const jwt = require('jsonwebtoken');

function signAccess(id, tv){
  return jwt.sign({ id: id, tv: tv || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
}
function signRefresh(id, tv){
  return jwt.sign({ id: id, tv: tv || 0 }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' });
}
function verifyAccess(t){ return jwt.verify(t, process.env.JWT_SECRET); }
function verifyRefresh(t){ return jwt.verify(t, process.env.JWT_REFRESH_SECRET); }

function setCookies(res, access, refresh){
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', access, {
    httpOnly: true, sameSite: 'lax', secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.cookie('refreshToken', refresh, {
    httpOnly: true, sameSite: 'lax', secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}
function clearCookies(res){
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
}
module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, setCookies, clearCookies };
