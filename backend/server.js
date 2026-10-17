require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { initSchema } = require('./db/init');
const errorHandler = require('./middleware/error');
const { cacheMiddleware } = require('./utils/cache');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy:false }));
/* CORS — فقط originهای مجاز */
const ALLOWED_ORIGINS = (() => {
  const raw = process.env.CLIENT_URL || '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) {
    return [
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
    ];
  }
  return list;
})();

console.log('[CORS] allowed origins:', ALLOWED_ORIGINS.join(', '));

app.use(cors({
  origin: function(origin, callback){
    /* درخواست بدون Origin (curl، same-origin) → مجاز */
    if (!origin) return callback(null, true);
    /* origin در لیست مجاز؟ */
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    /* در حالت dev، هر localhost/127.0.0.1 */
    if (process.env.NODE_ENV !== 'production') {
      try {
        const u = new URL(origin);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch (e) {}
    }
    /* غیرمجاز → بدون هدر CORS (مرورگر بلاک می‌کنه) */
    console.warn('[CORS] blocked origin:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  exposedHeaders: ['X-Cache'],
  maxAge: 86400
}));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));
app.use(cookieParser());

if(process.env.NODE_ENV === 'development') app.use(morgan('dev'));
/* Serve uploaded files */
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

const limiter = rateLimit({
  windowMs:15*60*1000, max:300,
  message:{ success:false, message:'تعداد درخواست‌ها زیاد است.' }
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs:15*60*1000, max:20,
  message:{ success:false, message:'تعداد تلاش‌های ورود زیاد است.' }
});

app.get('/', (req,res)=>res.json({ success:true, message:'Bazaarche API', version:'3.0.0' }));
app.get('/api/health', (req,res)=>res.json({ success:true, uptime:process.uptime() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products',   cacheMiddleware(30000), require('./routes/products'));
app.use('/api/upload',      require('./routes/upload'));
app.use('/api/categories', cacheMiddleware(60000), require('./routes/categories'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/reviews',    require('./routes/reviews'));
app.use('/api/site',       require('./routes/site'));
app.use('/api/cms',        cacheMiddleware(60000), require('./routes/cms'));
app.use('/api/seller',      require('./routes/seller'));

const pub = path.join(__dirname, 'public');
if(fs.existsSync(pub)){
  app.use(express.static(pub));
  app.get(/^\/(?!api).*/, (req,res)=>res.sendFile(path.join(pub, 'index.html')));
}

app.use((req,res)=>res.status(404).json({ success:false, message:'مسیر پیدا نشد.' }));
app.use(errorHandler);


/* ================================================================
   Process-level safety nets
   ================================================================ */
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise);
  console.error('[FATAL] Reason:', reason && reason.stack ? reason.stack : reason);
  /* در production بعد از log کردن، پروسه رو با کد خطا ببند تا مدیر پروسه (pm2/systemd) دوباره بالا بیاره */
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => process.exit(1), 100);
  }
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err && err.stack ? err.stack : err);
  /* در production باید پروسه بسته بشه — نمی‌تونیم مطمئن باشیم state سالم می‌مونه */
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => process.exit(1), 100);
  }
});

const PORT = process.env.PORT || 5000;

(async () => {
  try{
    await initSchema();
    try { require('./utils/orderExpiryWorker').start(); }
    catch (e) { console.error('[order-expiry] start failed:', e && e.message); }
    app.listen(PORT, ()=>console.log('[Server] Running on port ' + PORT + ' (' + process.env.NODE_ENV + ')'));
  }catch(err){
    console.error('[FATAL] DB init failed:', err.message);
    process.exit(1);
  }
})();