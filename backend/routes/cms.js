const express = require('express');
const router = express.Router();

/* __cache_buster__ */
const { del: _cDel } = require('../utils/cache');
router.use(function(req, res, next){
  if(req.method === 'GET') return next();
  res.on('finish', function(){
    if(res.statusCode >= 200 && res.statusCode < 300){
      try{ _cDel('http:/api/cms'); }catch(e){}
    }
  });
  next();
});

const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/cmsController');

/* Pages — public reads, admin writes */
router.get('/pages', optionalAuth, ctrl.pagesList);
router.get('/pages/:slug', optionalAuth, ctrl.pagesGet);
router.post('/pages', protect, adminOnly, ctrl.pagesCreate);
router.put('/pages/:id', protect, adminOnly, ctrl.pagesUpdate);
router.delete('/pages/:id', protect, adminOnly, ctrl.pagesDelete);

/* Banners */
router.get('/banners', optionalAuth, ctrl.bannersList);
router.post('/banners', protect, adminOnly, ctrl.bannersCreate);
router.put('/banners/:id', protect, adminOnly, ctrl.bannersUpdate);
router.delete('/banners/:id', protect, adminOnly, ctrl.bannersDelete);

/* Sliders */
router.get('/sliders', optionalAuth, ctrl.slidersList);
router.post('/sliders', protect, adminOnly, ctrl.slidersCreate);
router.put('/sliders/:id', protect, adminOnly, ctrl.slidersUpdate);
router.delete('/sliders/:id', protect, adminOnly, ctrl.slidersDelete);

module.exports = router;
