const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

router.post('/',           protect, ctrl.create);
router.post('/:id/confirm-payment', protect, ctrl.confirmPayment);
router.get('/my',          protect, ctrl.myOrders);
router.get('/:id',         protect, ctrl.getOne);
router.patch('/:id/cancel', protect, ctrl.cancel);

router.get('/',            protect, adminOnly, ctrl.listAll);
router.get('/admin/dashboard', protect, adminOnly, ctrl.dashboard);
router.get('/admin/full-dashboard', protect, adminOnly, ctrl.fullDashboard);
router.post('/admin/expire-pending', protect, adminOnly, ctrl.expirePendingNow);
router.patch('/:id/status', protect, adminOnly, ctrl.updateStatus);
router.post('/:id/return',      protect, adminOnly, ctrl.markReturned);
router.post('/:id/refund',      protect, adminOnly, ctrl.refund);
router.patch('/:id/notes',      protect, adminOnly, ctrl.updateNotes);
router.patch('/:id/financial',  protect, adminOnly, ctrl.updateFinancial);
router.patch('/:id/shipment',   protect, adminOnly, ctrl.updateShipment);

module.exports = router;