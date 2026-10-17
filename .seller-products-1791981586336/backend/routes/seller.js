'use strict';
const express = require('express');
const router = express.Router();
const { protect, sellerOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sellerController');

router.use(protect, sellerOrAdmin);

router.get('/dashboard', ctrl.dashboard);
router.get('/products', ctrl.myProducts);
router.get('/orders', ctrl.myOrders);
router.get('/orders/:id', ctrl.orderDetail);

module.exports = router;
