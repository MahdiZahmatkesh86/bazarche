const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { protect, adminOnly } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if(!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive:true });

/* Declared mimetypes we accept at the fileFilter stage.
   This is only a first gate — the real gate is magic-byte detection
   below, because mimetype is client-controlled. */
const ALLOWED = ['image/jpeg','image/png','image/webp','image/gif','image/avif'];
const MAX_SIZE = 5 * 1024 * 1024; /* 5MB */

/* Extension is derived strictly from the magic-detected type,
   never from originalname or declared mimetype. */
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
  'image/avif': '.avif',
};

/* Sniff the image type from the file's first bytes.
   Returns a mimetype string or null if not a whitelisted image. */
function detectImageType(buf){
  if(!buf || buf.length < 12) return null;

  /* JPEG: FF D8 FF */
  if(buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';

  /* PNG: 89 50 4E 47 0D 0A 1A 0A */
  if(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
     buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) return 'image/png';

  /* GIF: "GIF87a" or "GIF89a" */
  if(buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
     (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) return 'image/gif';

  /* WebP: "RIFF" .... "WEBP" */
  if(buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
     buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';

  /* AVIF: bytes 4..11 = "ftypavif" */
  if(buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70 &&
     buf[8] === 0x61 && buf[9] === 0x76 && buf[10] === 0x69 && buf[11] === 0x66) return 'image/avif';

  return null;
}

/* Validate + persist a buffer. Never trusts originalname or declared mimetype. */
function saveValidatedImage(buffer, declaredMime){
  if(!Buffer.isBuffer(buffer) || buffer.length === 0){
    return { ok:false, status:400, message:'فایلی ارسال نشد.' };
  }
  const detected = detectImageType(buffer);
  if(!detected){
    return {
      ok:false, status:400,
      message:'محتوای فایل تصویر معتبر نیست (magic bytes mismatch).'
    };
  }
  if(detected !== declaredMime){
    return {
      ok:false, status:400,
      message:'نوع اعلام‌شده با محتوای واقعی فایل هم‌خوانی ندارد.'
    };
  }
  const ext = MIME_EXT[detected];
  if(!ext){
    return { ok:false, status:400, message:'فرمت تصویر پشتیبانی نمی‌شود.' };
  }
  const filename = 'prod-' + Date.now() + '-' + crypto.randomBytes(12).toString('hex') + ext;
  const full = path.join(UPLOAD_DIR, filename);
  try{
    fs.writeFileSync(full, buffer);
  }catch(e){
    return { ok:false, status:500, message:'ذخیرهٔ فایل ناموفق بود.' };
  }
  return { ok:true, url:'/uploads/' + filename, filename: filename, size: buffer.length };
}

/* memoryStorage: file lands in req.file.buffer / req.files[].buffer
   only AFTER multer has validated size and declared-mimetype. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if(ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error('فرمت تصویر پشتیبانی نمی‌شود.'));
  }
});

function handleMulterErr(err, res){
  if(err instanceof multer.MulterError){
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'حجم تصویر بیشتر از ۵ مگابایت است.'
      : err.message;
    return res.status(400).json({ success:false, message: msg });
  }
  if(err) return res.status(400).json({ success:false, message: err.message });
  return null;
}

/* POST /api/upload/product — multiple */
router.post('/product',
  protect, adminOnly,
  (req, res, next) => {
    upload.array('images', 10)(req, res, (err) => {
      const r = handleMulterErr(err, res); if(r) return; next();
    });
  },
  (req, res) => {
    if(!req.files || !req.files.length){
      return res.status(400).json({ success:false, message:'هیچ فایلی ارسال نشد.' });
    }
    const urls = [];
    const files = [];
    for(const f of req.files){
      const saved = saveValidatedImage(f.buffer, f.mimetype);
      if(!saved.ok){
        /* best-effort cleanup of files already written this request */
        for(const u of urls){
          try{ fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(u))); }catch(_){}
        }
        return res.status(saved.status).json({ success:false, message: saved.message });
      }
      urls.push(saved.url);
      files.push({ name: saved.filename, size: saved.size });
    }
    res.json({ success:true, urls, files });
  }
);

/* POST /api/upload/product-single — one */
router.post('/product-single',
  protect, adminOnly,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      const r = handleMulterErr(err, res); if(r) return; next();
    });
  },
  (req, res) => {
    if(!req.file){
      return res.status(400).json({ success:false, message:'فایلی ارسال نشد.' });
    }
    const saved = saveValidatedImage(req.file.buffer, req.file.mimetype);
    if(!saved.ok){
      return res.status(saved.status).json({ success:false, message: saved.message });
    }
    res.json({ success:true, url: saved.url });
  }
);

/* DELETE /api/upload/delete — remove an uploaded file */
router.delete('/delete',
  protect, adminOnly,
  (req, res) => {
    try{
      const { url } = req.body || {};
      if(!url || !url.startsWith('/uploads/')) return res.status(400).json({ success:false });
      const filename = path.basename(url);
      const full = path.join(UPLOAD_DIR, filename);
      if(!full.startsWith(UPLOAD_DIR)) return res.status(400).json({ success:false, message:'مسیر نامعتبر' });
      if(fs.existsSync(full)) fs.unlinkSync(full);
      res.json({ success:true });
    }catch(e){
      res.status(500).json({ success:false, message:e.message });
    }
  }
);

module.exports = router;
