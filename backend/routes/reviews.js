const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/reviewController');

router.get('/product/:productId', ctrl.byProduct);

router.post('/product/:productId',
  protect,
  [
    body('rating').isInt({ min:1, max:5 }).withMessage('امتیاز بین ۱ تا ۵ باشد.'),
    body('comment').trim().isLength({ min:3, max:1000 }).withMessage('متن نظر الزامی است.')
  ],
  validate, ctrl.create
);

router.delete('/:id', protect, ctrl.remove);

router.get('/',              protect, adminOnly, ctrl.listAll);
router.patch('/:id/approve', protect, adminOnly, ctrl.toggleApprove);

module.exports = router;