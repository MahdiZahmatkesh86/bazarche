/* ================================================================
   admin-crop.js — v5 (unified)
   ----------------------------------------------------------------
   یک دیالوگ واحد برای برش تصویر با دو حالت:
     • مستطیلی (rect)   — نسبت آزاد / ۱:۱ / ۴:۳ / ۱۶:۹ / ۳:۴
     • دایره‌ای (circle) — نسبت قفل روی ۱:۱ + ماسک دایره‌ای
   ابزارها: چرخش ۹۰° چپ/راست، قرینه افقی/عمودی، زوم +/-، بازنشانی
   ================================================================ */
(function(){
  'use strict';
  if(window.__CROP_V5__) return;
  window.__CROP_V5__ = true;

  function loadCropper(cb){
    if(window.Cropper){ cb(null); return; }
    if(!document.querySelector('link[data-cropper-css]')){
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'cropper.min.css';
      css.setAttribute('data-cropper-css', '1');
      document.head.appendChild(css);
    }
    var existing = document.querySelector('script[data-cropper-lib]');
    if(existing){
      var tries = 0;
      var iv = setInterval(function(){
        if(window.Cropper){ clearInterval(iv); cb(null); }
        else if(++tries > 60){ clearInterval(iv); cb(new Error('timeout')); }
      }, 100);
      return;
    }
    var s = document.createElement('script');
    s.src = 'cropper.min.js';
    s.setAttribute('data-cropper-lib', '1');
    s.onload = function(){
      if(window.Cropper){ cb(null); return; }
      setTimeout(function(){ cb(window.Cropper ? null : new Error('no Cropper')); }, 200);
    };
    s.onerror = function(){ cb(new Error('load error')); };
    document.head.appendChild(s);
  }

  function uploadFile(file, onProgress){
    return new Promise(function(resolve, reject){
      var API = window.__API_BASE__ || window.__API_BASE || '/api';
      var fd = new FormData();
      fd.append('image', file);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API + '/upload/product-single', true);
      xhr.withCredentials = true;
      if(onProgress) xhr.upload.onprogress = function(e){
        if(e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = function(){
        var r;
        try{ r = JSON.parse(xhr.responseText || '{}'); }
        catch(e){ return reject(new Error('bad response')); }
        if(xhr.status >= 200 && xhr.status < 300 && r.success) resolve(r.url);
        else reject(new Error(r.message || ('HTTP ' + xhr.status)));
      };
      xhr.onerror = function(){ reject(new Error('network')); };
      xhr.send(fd);
    });
  }

  function msg(text, type){
    if(typeof window.toast === 'function'){ try{ window.toast(text, type); return; }catch(e){} }
    var box = document.getElementById('toasts');
    if(!box) return;
    var el = document.createElement('div');
    el.className = 'adm-toast ' + (type === 'err' ? 'err' : (type === 'warn' ? 'warn' : 'ok'));
    var m = document.createElement('div');
    m.className = 'adm-toast-msg';
    m.textContent = String(text);
    el.appendChild(m);
    box.appendChild(el);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 3200);
  }

  var SVG_CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function buildModal(){
    var m = document.getElementById('__cropV5');
    if(m) return m;
    m = document.createElement('div');
    m.className = 'cropv5-modal';
    m.id = '__cropV5';
    m.hidden = true;
    m.innerHTML = ''
      + '<div class="cropv5-scrim" data-close></div>'
      + '<div class="cropv5-box" role="dialog" aria-modal="true">'
      +   '<div class="cropv5-head">'
      +     '<div class="cropv5-head-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg></div>'
      +     '<div class="cropv5-head-txt">'
      +       '<h3>برش تصویر</h3>'
      +       '<span class="cropv5-sub">کادر را جابه‌جا کنید · با چرخ ماوس زوم کنید</span>'
      +     '</div>'
      +     '<span class="cropv5-counter"></span>'
      +     '<button type="button" class="cropv5-x" data-close aria-label="بستن"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      +   '</div>'
      +   '<div class="cropv5-toolbar">'
      +     '<div class="cropv5-tb-group" role="group" aria-label="شکل">'
      +       '<button type="button" data-mode="rect" class="is-active"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/></svg><span>مستطیل</span></button>'
      +       '<button type="button" data-mode="circle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg><span>دایره</span></button>'
      +     '</div>'
      +     '<span class="cropv5-tb-sep"></span>'
      +     '<div class="cropv5-tb-group" role="group" aria-label="نسبت">'
      +       '<button type="button" data-aspect="1" class="is-active">۱:۱</button>'
      +       '<button type="button" data-aspect="1.3333">۴:۳</button>'
      +       '<button type="button" data-aspect="1.7778">۱۶:۹</button>'
      +       '<button type="button" data-aspect="0.75">۳:۴</button>'
      +       '<button type="button" data-aspect="0">آزاد</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="cropv5-body"><div class="cropv5-stage"><img alt="" class="cropv5-img"></div></div>'
      +   '<div class="cropv5-toolbar2">'
      +     '<button type="button" data-op="rotL" title="چرخش ۹۰° چپ"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></svg></button>'
      +     '<button type="button" data-op="rotR" title="چرخش ۹۰° راست"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/></svg></button>'
      +     '<span class="cropv5-tb-sep"></span>'
      +     '<button type="button" data-op="flipH" title="قرینه افقی"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/></svg></button>'
      +     '<button type="button" data-op="flipV" title="قرینه عمودی"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M8 8l4-4 4 4"/><path d="M8 16l4 4 4-4"/></svg></button>'
      +     '<span class="cropv5-tb-sep"></span>'
      +     '<button type="button" data-op="zoomOut" title="کوچک‌نمایی"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/></svg></button>'
      +     '<button type="button" data-op="zoomIn" title="بزرگ‌نمایی"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6M11 8v6"/></svg></button>'
      +     '<span class="cropv5-tb-sep"></span>'
      +     '<button type="button" data-op="reset" title="بازنشانی"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg><span>بازنشانی</span></button>'
      +   '</div>'
      +   '<div class="cropv5-foot">'
      +     '<button type="button" class="cropv5-btn outline" data-close>انصراف</button>'
      +     '<button type="button" class="cropv5-btn primary" data-confirm>' + SVG_CHECK + '<span>تأیید و افزودن</span></button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(m);
    return m;
  }

  function showCrop(files, opts, onUploaded, onDone){
    opts = opts || {};
    var S = {
      mode: opts.mode === 'circle' ? 'circle' : 'rect',
      aspect: typeof opts.aspect === 'number' ? opts.aspect : 1,
      idx: 0, cropper: null, originalUrl: null
    };

    var modal = buildModal();
    var stage = modal.querySelector('.cropv5-stage');
    var img = modal.querySelector('.cropv5-img');
    var counter = modal.querySelector('.cropv5-counter');
    var confirmBtn = modal.querySelector('[data-confirm]');
    var modeBtns = modal.querySelectorAll('[data-mode]');
    var aspectBtns = modal.querySelectorAll('[data-aspect]');

    function syncUI(){
      stage.classList.toggle('is-circle', S.mode === 'circle');
      modeBtns.forEach(function(b){ b.classList.toggle('is-active', b.dataset.mode === S.mode); });
      if(S.mode === 'circle'){
        S.aspect = 1;
        aspectBtns.forEach(function(b){
          b.classList.toggle('is-active', b.dataset.aspect === '1');
          b.disabled = true;
        });
      } else {
        aspectBtns.forEach(function(b){ b.disabled = false; });
      }
    }
    function applyAspect(){
      if(!S.cropper) return;
      if(S.mode === 'circle'){ S.cropper.setAspectRatio(1); }
      else {
        var a = parseFloat(S.aspect);
        S.cropper.setAspectRatio(isNaN(a) || a === 0 ? NaN : a);
      }
    }

    function showCurrent(){
      if(S.idx >= files.length){ close(); return; }
      var f = files[S.idx];
      if(f.size > 10 * 1024 * 1024){
        msg('«' + f.name + '» بیش از ۱۰ مگابایت', 'warn');
        S.idx++; return showCurrent();
      }
      if(S.originalUrl){ URL.revokeObjectURL(S.originalUrl); S.originalUrl = null; }
      S.originalUrl = URL.createObjectURL(f);
      img.src = S.originalUrl;
      counter.textContent = files.length > 1 ? (S.idx + 1) + ' / ' + files.length : '';
      img.onload = function(){
        if(S.cropper){ try{ S.cropper.destroy(); }catch(e){} S.cropper = null; }
        S.cropper = new window.Cropper(img, {
          viewMode: 1, dragMode: 'move', autoCropArea: 0.85,
          aspectRatio: S.mode === 'circle' ? 1 : S.aspect,
          background: false, responsive: true,
          guides: S.mode !== 'circle', center: S.mode !== 'circle',
          highlight: false, movable: true, zoomable: true, rotatable: true, scalable: true,
          cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false
        });
      };
      img.onerror = function(){ msg('خطای تصویر', 'err'); S.idx++; showCurrent(); };
    }

    function close(){
      modal.hidden = true;
      if(S.cropper){ try{ S.cropper.destroy(); }catch(e){} S.cropper = null; }
      if(S.originalUrl){ URL.revokeObjectURL(S.originalUrl); S.originalUrl = null; }
      S.idx = 0;
      files = [];
      document.documentElement.style.overflow = '';
    }

    function confirm(){
      if(!S.cropper) return;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = 'در حال پردازش...';

      var canvas;
      try{
        canvas = S.cropper.getCroppedCanvas({
          maxWidth: 1600, maxHeight: 1600,
          imageSmoothingEnabled: true, imageSmoothingQuality: 'high'
        });
      }catch(e){ canvas = null; }

      if(!canvas){
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = SVG_CHECK + '<span>تأیید</span>';
        msg('خطا در پردازش', 'err');
        return;
      }

      var out = canvas;
      var isCircle = S.mode === 'circle';
      if(isCircle){
        var size = Math.min(canvas.width, canvas.height);
        var c2 = document.createElement('canvas');
        c2.width = size; c2.height = size;
        var ctx = c2.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(canvas, 0, 0, size, size);
        ctx.restore();
        var grad = ctx.createRadialGradient(size / 2, size / 2, size / 2 - 4, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
        out = c2;
      }

      var mime = isCircle ? 'image/png' : 'image/jpeg';
      var fname = (isCircle ? 'circle-' : 'crop-') + Date.now() + (isCircle ? '.png' : '.jpg');

      out.toBlob(function(blob){
        if(!blob){
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = SVG_CHECK + '<span>تأیید</span>';
          return;
        }
        var file = new File([blob], fname, { type: mime });
        uploadFile(file).then(function(url){
          if(onUploaded) onUploaded(url);
          msg(isCircle ? 'تصویر دایره‌ای اضافه شد.' : 'تصویر اضافه شد.', 'ok');
        }).catch(function(e){
          console.error('[crop] upload error:', e);
          msg('خطا: ' + (e.message || '?'), 'err');
        }).then(function(){
          S.idx++;
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = SVG_CHECK + '<span>تأیید</span>';
          if(S.idx < files.length) showCurrent();
          else { close(); if(onDone) onDone(); }
        });
      }, mime, 0.92);
    }

    modal.querySelectorAll('[data-close]').forEach(function(b){ b.onclick = close; });
    modeBtns.forEach(function(b){
      b.onclick = function(){ S.mode = b.dataset.mode; syncUI(); applyAspect(); };
    });
    aspectBtns.forEach(function(b){
      b.onclick = function(){
        if(S.mode === 'circle') return;
        S.aspect = parseFloat(b.dataset.aspect);
        aspectBtns.forEach(function(x){ x.classList.toggle('is-active', x === b); });
        applyAspect();
      };
    });
    modal.querySelectorAll('[data-op]').forEach(function(b){
      b.onclick = function(){
        if(!S.cropper) return;
        var op = b.dataset.op;
        if(op === 'rotL') S.cropper.rotate(-90);
        else if(op === 'rotR') S.cropper.rotate(90);
        else if(op === 'flipH'){ var d = S.cropper.getData(); S.cropper.scaleX(d.scaleX === -1 ? 1 : -1); }
        else if(op === 'flipV'){ var d2 = S.cropper.getData(); S.cropper.scaleY(d2.scaleY === -1 ? 1 : -1); }
        else if(op === 'zoomIn') S.cropper.zoom(0.1);
        else if(op === 'zoomOut') S.cropper.zoom(-0.1);
        else if(op === 'reset') S.cropper.reset();
      };
    });
    confirmBtn.onclick = confirm;

    confirmBtn.disabled = false;
    confirmBtn.innerHTML = SVG_CHECK + '<span>تأیید</span>';
    S.idx = 0;
    syncUI();
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    showCurrent();
  }

  function startCrop(input, opts, onUploaded, onDone){
    if(window.__CROP_BUSY__) return;
    window.__CROP_BUSY__ = true;
    setTimeout(function(){ window.__CROP_BUSY__ = false; }, 800);

    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if(!files.length) return;

    loadCropper(function(loadErr){
      if(loadErr){
        console.error('[crop] lib fail:', loadErr.message);
        msg('کتابخانه برش لود نشد — بدون برش آپلود می‌شود', 'warn');
        var i = 0;
        (function next(){
          if(i >= files.length){ if(onDone) onDone(); return; }
          var f = files[i++];
          uploadFile(f).then(function(u){ if(onUploaded) onUploaded(u); }).catch(function(){}).then(next);
        })();
        return;
      }
      showCrop(files, opts, onUploaded, onDone);
    });
  }

  window.__openCrop = function(input, opts, onUploaded, onDone){
    startCrop(input, opts || {}, onUploaded, onDone);
  };

  window.__pickAdmImg = function(input, imgFieldId, pickerId){
    var isCircle = (pickerId || '').indexOf('cat') !== -1 || imgFieldId === 'catImg';
    startCrop(input, { mode: isCircle ? 'circle' : 'rect' }, function(url){
      var field = document.getElementById(imgFieldId);
      if(field) field.value = url;
      var picker = document.getElementById(pickerId);
      if(picker){
        var full = (window.__ASSET__ ? window.__ASSET__(url) : url);
        picker.style.backgroundImage = 'url("' + full + '")';
        picker.style.backgroundSize = 'cover';
        picker.style.backgroundPosition = 'center';
        picker.style.backgroundRepeat = 'no-repeat';
        picker.classList.add('has-image', 'cat-circle-picker');
        var empty = picker.querySelector('.adm-img-picker-empty');
        if(empty) empty.remove();
      }
    });
  };

  window.__handleProdImagePick = function(input, opts){
    opts = opts || {};
    if(!opts.mode) opts.mode = 'rect';
    startCrop(input, opts, function(url){
      if(window.__activeProductF){
        if(!Array.isArray(window.__activeProductF.images)) window.__activeProductF.images = [];
        window.__activeProductF.images.push(url);
      }
      if(typeof window.__repaintProdImages === 'function') window.__repaintProdImages();
      else if(typeof window.__activeProductRepaint === 'function') window.__activeProductRepaint();
    });
  };

  console.log('[crop] ready (v5-unified)');
})();
