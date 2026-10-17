/* ==============================================================
   gallery.js — multi-image gallery for product modals
   Works for #pmThumb (site) and .adm-pv-thumb (admin)
   ============================================================== */
(function(){
  'use strict';
  if(window.__GALLERY_LOADED__) return;
  window.__GALLERY_LOADED__ = true;

  function resolve(u){
    if(!u) return '';
    u = String(u);
    if(/^https?:\/\//i.test(u) || /^data:/i.test(u)) return u;
    return window.__ASSET__(u);
  }

  function getImages(product){
    if(!product) return [];
    var arr = product.images || product.imgs || [];
    if(!Array.isArray(arr)) return [];
    return arr.filter(function(x){ return x && typeof x === 'string'; });
  }

  /* ---- build gallery HTML ---- */
  function buildGallery(images, opts){
    opts = opts || {};
    if(!images.length) return null;

    var wrap = document.createElement('div');
    wrap.className = 'gal-wrap';

    var stage = document.createElement('div');
    stage.className = 'gal-stage';

    var img = document.createElement('img');
    img.className = 'gal-main';
    img.src = resolve(images[0]);
    img.alt = opts.alt || '';
    img.setAttribute('data-index', '0');
    stage.appendChild(img);

    /* prev / next */
    if(images.length > 1){
      var prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'gal-nav gal-prev';
      prev.setAttribute('aria-label', 'قبلی');
      prev.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
      stage.appendChild(prev);

      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'gal-nav gal-next';
      next.setAttribute('aria-label', 'بعدی');
      next.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
      stage.appendChild(next);

      var counter = document.createElement('span');
      counter.className = 'gal-counter';
      counter.textContent = '۱ / ' + images.length.toLocaleString('fa-IR');
      stage.appendChild(counter);

      var ci = 0;
      function go(i){
        ci = (i + images.length) % images.length;
        img.src = resolve(images[ci]);
        counter.textContent = (ci + 1).toLocaleString('fa-IR') + ' / ' + images.length.toLocaleString('fa-IR');
        var thumbs = wrap.querySelectorAll('.gal-thumb');
        for(var k = 0; k < thumbs.length; k++){
          thumbs[k].classList.toggle('is-active', k === ci);
        }
      }

      prev.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); go(ci - 1); });
      next.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); go(ci + 1); });

      /* keyboard */
      document.addEventListener('keydown', function(e){
        if(!document.body.contains(wrap)) return;
        if(e.key === 'ArrowLeft')  go(ci + 1);
        if(e.key === 'ArrowRight') go(ci - 1);
      });

      /* swipe for mobile */
      var sx = 0, dx = 0;
      stage.addEventListener('touchstart', function(e){
        sx = e.touches[0].clientX;
      }, { passive: true });
      stage.addEventListener('touchmove', function(e){
        dx = e.touches[0].clientX - sx;
      }, { passive: true });
      stage.addEventListener('touchend', function(){
        if(Math.abs(dx) > 40){ go(dx > 0 ? ci + 1 : ci - 1); }
        dx = 0;
      });

      /* thumbnails */
      var thumbs = document.createElement('div');
      thumbs.className = 'gal-thumbs';
      images.forEach(function(u, i){
        var t = document.createElement('button');
        t.type = 'button';
        t.className = 'gal-thumb' + (i === 0 ? ' is-active' : '');
        t.setAttribute('aria-label', 'تصویر ' + (i + 1));
        var ti = document.createElement('img');
        ti.src = resolve(u);
        ti.alt = '';
        ti.loading = 'lazy';
        t.appendChild(ti);
        t.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          go(i);
        });
        thumbs.appendChild(t);
      });

      wrap.appendChild(stage);
      wrap.appendChild(thumbs);
    } else {
      wrap.appendChild(stage);
    }

    return wrap;
  }

  /* ================================================================
     SITE — inject into #pmThumb when modal opens
     ================================================================ */
  function injectSite(){
    var thumb = document.getElementById('pmThumb');
    if(!thumb) return;
    if(thumb.querySelector('.gal-wrap')) return;

    var p = window.__curPmProduct;
    if(!p){
      /* try to read from any [data-id] in the modal */
      var idAttr = thumb.closest('[data-id]');
      if(idAttr && window.byId) p = window.byId[idAttr.getAttribute('data-id')];
    }
    if(!p) return;

    var imgs = getImages(p);
    if(!imgs.length) return;

    /* clear existing image/svg */
    var existing = thumb.querySelector('.thumb-img');
    if(existing) existing.style.display = 'none';
    var svg = thumb.querySelector('svg');
    if(svg) svg.style.display = 'none';

    /* make thumb a plain container */
    thumb.style.padding = '0';
    thumb.style.background = 'transparent';
    thumb.style.aspectRatio = '1';

    var gal = buildGallery(imgs, { alt: p.n || '' });
    if(gal){
      gal.style.borderRadius = 'inherit';
      thumb.appendChild(gal);
    }
  }

  /* ================================================================
     ADMIN — inject into .adm-pv-thumb in product view modal
     ================================================================ */
  function injectAdmin(){
    var thumb = document.querySelector('.adm-pv-thumb');
    if(!thumb) return;
    if(thumb.querySelector('.gal-wrap')) return;

    var p = window.__curPmAdminProduct;
    if(!p) return;

    var imgs = getImages(p);
    if(!imgs.length) return;

    /* hide any existing img/svg */
    var existing = thumb.querySelector('img');
    if(existing) existing.style.display = 'none';
    var svg = thumb.querySelector('svg');
    if(svg) svg.style.display = 'none';

    thumb.style.padding = '0';
    thumb.style.background = 'transparent';

    var gal = buildGallery(imgs, { alt: p.name || '' });
    if(gal){
      gal.style.borderRadius = 'inherit';
      thumb.appendChild(gal);
    }
  }

  /* ================================================================
     Observer — auto-detect modal open
     ================================================================ */
  function runAll(){
    injectSite();
    injectAdmin();
  }

  var observer = new MutationObserver(function(muts){
    var shouldRun = false;
    for(var i = 0; i < muts.length; i++){
      var m = muts[i];
      if(m.type === 'attributes' && m.target && m.target.id === 'pm'){
        shouldRun = true;
      }
      if(m.type === 'childList'){
        shouldRun = true;
      }
    }
    if(shouldRun){
      setTimeout(runAll, 60);
      setTimeout(runAll, 200);
      setTimeout(runAll, 500);
    }
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      setTimeout(runAll, 500);
    });
  } else {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setTimeout(runAll, 500);
  }

  window.__GALLERY_RUN__ = runAll;
  console.log('[gallery] ready');
})();
