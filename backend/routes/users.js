const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

/* کاربر لاگین‌شده — آدرس‌های خودش */
router.post('/me/addresses', protect, ctrl.addAddress);
router.put('/me/addresses/:addrId', protect, ctrl.updateAddress);
router.delete('/me/addresses/:addrId', protect, ctrl.removeAddress);

/* فقط ادمین */
router.get('/',              protect, adminOnly, ctrl.list);
router.get('/:id/detail',    protect, adminOnly, ctrl.getDetail);
router.get('/:id',           protect, adminOnly, ctrl.getOne);
router.put('/:id',           protect, adminOnly, ctrl.update);
router.delete('/:id',        protect, adminOnly, ctrl.remove);
router.patch('/:id/toggle',  protect, adminOnly, ctrl.toggleActive);
router.patch('/:id/role',    protect, adminOnly, ctrl.changeRole);

module.exports = router;
