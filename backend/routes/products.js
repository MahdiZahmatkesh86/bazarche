const express = require('express');
const router = express.Router();

/* __cache_buster__ */
const { del: _cDel } = require('../utils/cache');
router.use(function(req, res, next){
  if(req.method === 'GET') return next();
  res.on('finish', function(){
    if(res.statusCode >= 200 && res.statusCode < 300){
      try{ _cDel('http:/api/products'); }catch(e){}
    }
  });
  next();
});

const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/productController');

router.get('/', optionalAuth, ctrl.list);
router.get('/:id', optionalAuth, ctrl.getOne);

router.get('/admin/stats', protect, adminOnly, ctrl.stats);
router.post('/:id/duplicate',     protect, adminOnly, ctrl.duplicate);
router.get('/admin/generate-sku', protect, adminOnly, ctrl.generateSku);

const rules = [
  body('name').trim().isLength({ min:2 }).withMessage('نام محصول الزامی است.'),
  body('brand').trim().notEmpty().withMessage('برند الزامی است.'),
  body('category').notEmpty().withMessage('دسته‌بندی الزامی است.'),
  body('price').isNumeric().withMessage('قیمت باید عدد باشد.'),
  body('stock').isNumeric().withMessage('موجودی باید عدد باشد.')
];


/* لیست کاربران برای انتخاب مالک محصول */
router.get('/admin/owners', protect, adminOnly, async function(req, res, next){
  try{
    const { q } = require('../db/init');
    const list = await q("SELECT id, name, phone, email, avatar FROM users WHERE is_active = 1 ORDER BY name ASC LIMIT 500");
    res.json({ success:true, owners: list });
  }catch(err){ next(err); }
});
router.post('/',    protect, adminOnly, rules, validate, ctrl.create);
router.put('/:id',  protect, adminOnly, ctrl.update);
router.delete('/:id', protect, adminOnly, ctrl.remove);
router.patch('/:id/toggle', protect, adminOnly, ctrl.toggleActive);

module.exports = router;