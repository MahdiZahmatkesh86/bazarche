function errorHandler(err, req, res, next){
  console.error('[Error]', err.message);
  const isProd = process.env.NODE_ENV === 'production';
  if(err.code === 'ER_DUP_ENTRY'){
    return res.status(400).json({ success:false, message:'این مقدار قبلاً استفاده شده است.' });
  }
  if(err.name === 'JsonWebTokenError'){
    return res.status(401).json({ success:false, message:'توکن نامعتبر است.' });
  }
  if(err.name === 'TokenExpiredError'){
    return res.status(401).json({ success:false, message:'توکن منقضی شده است.' });
  }
  if(err.code === 'ER_NO_REFERENCED_ROW_2'){
    return res.status(400).json({ success:false, message:'ارجاع نامعتبر — ابتدا وابستگی‌ها را حذف کنید.' });
  }
  if(err.code === 'ER_ROW_IS_REFERENCED_2'){
    return res.status(400).json({ success:false, message:'این آیتم در جای دیگر استفاده می‌شود.' });
  }
  const status = err.statusCode || 500;
  const message = isProd && status === 500 ? 'خطای داخلی سرور' : (err.message || 'خطای داخلی سرور');
  res.status(status).json({
    success:false,
    message,
    ...(!isProd && { stack: err.stack })
  });
}
module.exports = errorHandler;
