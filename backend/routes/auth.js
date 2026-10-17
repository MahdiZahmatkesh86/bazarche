const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/authController');

/* محدودکننده تلاش ورود */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success:false, message:'تعداد تلاش‌های ورود زیاد است. ۱۵ دقیقه صبر کنید.' }
});

/* ============ ثبت‌نام — فقط شماره ============ */
router.post('/register',
  loginLimiter,
  [
    body('name').trim().isLength({ min:3, max:60 }).withMessage('نام باید بین ۳ تا ۶۰ کاراکتر باشد.'),
    body('phone').trim().matches(/^09\d{9}$/).withMessage('شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.'),
    body('password').isLength({ min:8 }).withMessage('رمز عبور حداقل ۸ کاراکتر باشد.')
  ],
  validate, ctrl.register
);

/* ============ ورود — فقط شماره ============ */
router.post('/login',
  loginLimiter,
  [
    body('phone').trim().matches(/^09\d{9}$/).withMessage('شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.'),
    body('password').notEmpty().withMessage('رمز عبور الزامی است.')
  ],
  validate, ctrl.login
);

/* ============ OTP — به زودی ============ */
router.post('/otp/send', ctrl.sendOtp);
router.post('/otp/verify', ctrl.verifyOtp);

/* ============ بقیه ============ */
router.post('/logout', ctrl.logout);
router.post('/refresh', ctrl.refresh);
router.get('/me', protect, ctrl.me);
router.put('/me', protect, ctrl.updateMe);
router.put('/change-password', protect, ctrl.changePassword);

/* ============ Google (غیرفعال اگه کلید نباشه) ============ */
if(process.env.GOOGLE_CLIENT_ID){
  const passport = require('passport');
  require('../config/passport');
  router.get('/google', ctrl.googleStart);
  router.get('/google/callback',
    ctrl.googleVerifyState,
    function(req, res, next){
      const base = (process.env.CLIENT_URL || '').split(',')[0].trim() || 'http://localhost:8080';
      passport.authenticate('google', { session: false, failureRedirect: base + '/login.html?error=oauth' })(req, res, next);
    },
    ctrl.googleCallback
  );
}

module.exports = router;
