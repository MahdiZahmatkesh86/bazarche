const express = require('express');
const router = express.Router();
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/siteController');

/* Features */
router.get('/features', optionalAuth, ctrl.featuresList);
router.post('/features', protect, adminOnly, ctrl.featuresCreate);
router.put('/features/:id', protect, adminOnly, ctrl.featuresUpdate);
router.delete('/features/:id', protect, adminOnly, ctrl.featuresDelete);

/* Festivals */
router.get('/festivals', optionalAuth, ctrl.festivalsList);
router.post('/festivals', protect, adminOnly, ctrl.festivalsCreate);
router.put('/festivals/:id', protect, adminOnly, ctrl.festivalsUpdate);
router.delete('/festivals/:id', protect, adminOnly, ctrl.festivalsDelete);

module.exports = router;
