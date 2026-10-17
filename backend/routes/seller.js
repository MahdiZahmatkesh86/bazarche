'use strict';
const express = require('express');
const router = express.Router();
const { protect, sellerOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sellerController');

router.use(protect, sellerOrAdmin);

router.get('/dashboard', ctrl.dashboard);

/* محصولات — read, create, update, delete */
router.get('/products', ctrl.myProducts);
router.get('/products/:id', ctrl.getProduct);
router.post('/products', ctrl.createProduct);
router.put('/products/:id', ctrl.updateProduct);
router.delete('/products/:id', ctrl.deleteProduct);
router.patch('/products/:id/toggle', ctrl.toggleProduct);

/* سفارش‌ها */
router.get('/orders', ctrl.myOrders);
router.get('/orders/:id', ctrl.orderDetail);

module.exports = router;
