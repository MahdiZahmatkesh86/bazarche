const express = require('express');
const router = express.Router();

/* __cache_buster__ */
const { del: _cDel } = require('../utils/cache');
router.use(function(req, res, next){
  if(req.method === 'GET') return next();
  res.on('finish', function(){
    if(res.statusCode >= 200 && res.statusCode < 300){
      try{ _cDel('http:/api/categories'); }catch(e){}
    }
  });
  next();
});

const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/categoryController');

router.get('/', ctrl.list);

router.post('/',
  protect, adminOnly,
  [body('name').trim().notEmpty().withMessage('نام دسته‌بندی الزامی است.')],
  validate, ctrl.create
);
router.put('/:id',    protect, adminOnly, ctrl.update);
router.delete('/:id', protect, adminOnly, ctrl.remove);

module.exports = router;