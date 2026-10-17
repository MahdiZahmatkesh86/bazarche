/* ================================================================
   admin-crop.js — نسخه ۳ (مستقل، پشتیبانی مربع + دایره)
   ================================================================ */
(function(){
  'use strict';
  if(window.__CROP_V3__) return;
  window.__CROP_V3__ = true;

  var CROP_LIB_URL = 'cropper.min.js';
  var CROP_CSS_URL = 'cropper.min.css';

  /* ============================================================
     بارگذاری Cropper با retry قوی
     ============================================================ */
  function loadCropperLib(cb){
    if(window.Cropper){ cb(null); return; }

    /* CSS */
    if(!document.querySelector('link[data-cropper-css]')){
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = CROP_CSS_URL;
      css.setAttribute('data-cropper-css', '1');
      document.head.appendChild(css);
    }

    /* چک اسکریپت قبلی */
    var existing = document.querySelector('script[data-cropper-lib]');
    if(existing){
      var tries = 0;
      var iv = setInterval(function(){
        if(window.Cropper){ clearInterval(iv); cb(null); }
        else if(++tries > 60){ clearInterval(iv); cb(new Error('Cropper بعد از ۶ ثانیه لود نشد')); }
      }, 100);
      return;
    }

    /* ساخت اسکریپت جدید */
    var s = document.createElement('script');
    s.src = CROP_LIB_URL + '?v=' + Date.now();
    s.setAttribute('data-cropper-lib', '1');
    s.async = false;
    s.onload = function(){
      if(window.Cropper){ cb(null); }
      else {
        /* یه بار دیگه چک کن */
        setTimeout(function(){
          if(window.Cropper) cb(null);
          else cb(new Error('Cropper تعریف نشد'));
        }, 200);
      }
    };
    s.onerror = function(){
      cb(new Error('دانلود ' + CROP_LIB_URL + ' شکست خورد'));
    };
    document.head.appendChild(s);
  }

  /* ============================================================
     upload فایل
     ============================================================ */
  function uploadFile(file, onProgress){
    return new Promise(function(resolve, reject){
      var API = window.__API_BASE__ || window.__API_BASE || '/api';
      var fd = new FormData();
      fd.append('image', file);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API + '/upload/product-single', true);
      xhr.withCredentials = true;
      if(onProgress){
        xhr.upload.onprogress = function(e){
          if(e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
        };
      }
      xhr.onload = function(){
        var r;
        try{ r = JSON.parse(xhr.responseText || '{}'); }
        catch(e){ return reject(new Error('پاسخ نامعتبر')); }
        if(xhr.status >= 200 && xhr.status < 300 && r.success) resolve(r.url);
        else reject(new Error(r.message || ('HTTP ' + xhr.status)));
      };
      xhr.onerror = function(){ reject(new Error('خطای شبکه')); };
      xhr.send(fd);
    });
  }

  /* ============================================================
     toast
     ============================================================ */
  function msg(text, type){
    if(typeof window.toast === 'function'){
      try{ window.toast(text, type); return; }catch(e){}
    }
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

  /* ============================================================
     ساخت مودال
     ============================================================ */
  function buildModal(){
    var m = document.getElementById('__cropModalV3');
    if(m) return m;

    m = document.createElement('div');
    m.className = 'crv3-modal';
    m.id = '__cropModalV3';
    m.hidden = true;
    m.innerHTML = ''
      + '<div class="crv3-scrim"></div>'
      + '<div class="crv3-box" role="dialog" aria-modal="true">'
      +   '<div class="crv3-head">'
      +     '<h3 class="crv3-title">برش تصویر</h3>'
      +     '<span class="crv3-counter"></span>'
      +     '<button type="button" class="crv3-x" aria-label="بستن">×</button>'
      +   '</div>'
      +   '<div class="crv3-body">'
      +     '<div class="crv3-hint"></div>'
      +     '<div class="crv3-stage"><img class="crv3-img" alt=""></div>'
      +     '<div class="crv3-tools">'
      +       '<button type="button" data-crv3="rot-90">چرخش ۹۰°</button>'
      +       '<button type="button" data-crv3="rot-180">چرخش ۱۸۰°</button>'
      +       '<button type="button" data-crv3="flip-h">قرینه افقی</button>'
      +       '<button type="button" data-crv3="flip-v">قرینه عمودی</button>'
      +       '<button type="button" data-crv3="reset">بازنشانی</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="crv3-foot">'
      +     '<button type="button" class="crv3-btn crv3-btn-outline" data-crv3-cancel>انصراف</button>'
      +     '<button type="button" class="crv3-btn crv3-btn-primary" data-crv3-confirm>تأیید و افزودن</button>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(m);
    return m;
  }

  /* ============================================================
     نمایش مودال کراپ
     ============================================================ */
  function showCropModal(files, opts, onUploaded, onDone){
    opts = opts || {};
    var isCircle = opts.mode === 'circle';

    var modal = buildModal();
    var scrim = modal.querySelector('.crv3-scrim');
    var title = modal.querySelector('.crv3-title');
    var counter = modal.querySelector('.crv3-counter');
    var xBtn = modal.querySelector('.crv3-x');
    var hint = modal.querySelector('.crv3-hint');
    var stage = modal.querySelector('.crv3-stage');
    var img = modal.querySelector('.crv3-img');
    var confirmBtn = modal.querySelector('[data-crv3-confirm]');
    var cancelBtn = modal.querySelector('[data-crv3-cancel]');
    var toolBtns = modal.querySelectorAll('[data-crv3]');

    var idx = 0;
    var cropper = null;
    var originalUrl = null;

    /* تنظیم ظاهر */
    if(isCircle){
      title.textContent = 'برش تصویر دایره‌ای';
      hint.textContent = 'کادر گرد را بکشید · با چرخ ماوس زوم کنید · فقط داخل دایره ذخیره می‌شود';
      stage.classList.add('is-circle');
    } else {
      title.textContent = 'برش تصویر (۱:۱)';
      hint.textContent = 'کادر را بکشید · با چرخ ماوس زوم کنید';
      stage.classList.remove('is-circle');
    }

    function showCurrent(){
      if(idx >= files.length){ close(); return; }
      var f = files[idx];

      if(f.size > 10 * 1024 * 1024){
        msg('«' + f.name + '» بیش از ۱۰ مگابایت است.', 'warn');
        idx++;
        return showCurrent();
      }

      if(originalUrl){ URL.revokeObjectURL(originalUrl); originalUrl = null; }
      originalUrl = URL.createObjectURL(f);
      img.src = originalUrl;

      if(counter) counter.textContent = files.length > 1 ? (idx + 1) + ' / ' + files.length : '';

      img.onload = function(){
        if(cropper){ try{ cropper.destroy(); }catch(e){} cropper = null; }
        cropper = new window.Cropper(img, {
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: isCircle ? 0.9 : 0.9,
          aspectRatio: 1,
          background: false,
          responsive: true,
          guides: !isCircle,
          center: true,
          highlight: false,
          movable: true,
          zoomable: true,
          rotatable: true,
          scalable: true,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
          ready: function(){
            if(isCircle) stage.classList.add('is-circle');
            else stage.classList.remove('is-circle');
          },
        });
      };
      img.onerror = function(){
        msg('خطا در بارگذاری تصویر', 'err');
        idx++;
        showCurrent();
      };
    }

    function close(){
      modal.hidden = true;
      if(cropper){ try{ cropper.destroy(); }catch(e){} cropper = null; }
      if(originalUrl){ URL.revokeObjectURL(originalUrl); originalUrl = null; }
      idx = 0;
      files = [];
      document.documentElement.style.overflow = '';
    }

    function confirm(){
      if(!cropper) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'در حال پردازش...';

      var size = 800;
      var canvas;
      try{
        canvas = cropper.getCroppedCanvas({
          width: size, height: size,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        });
      }catch(e){ canvas = null; }

      if(!canvas){
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'تأیید و افزودن';
        msg('خطا در پردازش تصویر', 'err');
        return;
      }

      /* ماسک دایره‌ای */
      var out = canvas;
      if(isCircle){
        var c2 = document.createElement('canvas');
        c2.width = size; c2.height = size;
        var ctx = c2.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(canvas, 0, 0, size, size);
        ctx.restore();
        /* لبه نرم */
        var grad = ctx.createRadialGradient(size/2, size/2, size/2 - 4, size/2, size/2, size/2);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
        ctx.fill();
        out = c2;
      }

      out.toBlob(function(blob){
        if(!blob){
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'تأیید و افزودن';
          return;
        }
        var fname = (isCircle ? 'circle-' : 'crop-') + Date.now() + (isCircle ? '.png' : '.jpg');
        var ftype = isCircle ? 'image/png' : 'image/jpeg';
        var file = new File([blob], fname, { type: ftype });

        uploadFile(file, function(p){
          if(opts.onProgress) opts.onProgress(p);
        }).then(function(url){
          if(onUploaded) onUploaded(url);
          msg(isCircle ? 'تصویر دایره‌ای اضافه شد.' : 'تصویر اضافه شد.', 'ok');
        }).catch(function(e){
          console.error('[crop-v3] upload error:', e);
          msg('خطا: ' + (e.message || 'نامشخص'), 'err');
        }).then(function(){
          idx++;
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'تأیید و افزودن';
          if(idx < files.length) showCurrent();
          else { close(); if(onDone) onDone(); }
        });
      }, isCircle ? 'image/png' : 'image/jpeg', 0.92);
    }

    /* bind */
    confirmBtn.onclick = confirm;
    cancelBtn.onclick = close;
    xBtn.onclick = close;
    scrim.onclick = close;

    toolBtns.forEach(function(b){
      b.onclick = function(){
        if(!cropper) return;
        var a = b.getAttribute('data-crv3');
        if(a === 'rot-90') cropper.rotate(90);
        else if(a === 'rot-180') cropper.rotate(180);
        else if(a === 'flip-h'){ var d = cropper.getData(); cropper.scaleX(d.scaleX === -1 ? 1 : -1); }
        else if(a === 'flip-v'){ var d2 = cropper.getData(); cropper.scaleY(d2.scaleY === -1 ? 1 : -1); }
        else if(a === 'reset') cropper.reset();
      };
    });

    /* نشان بده */
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'تأیید و افزودن';
    idx = 0;
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    showCurrent();
  }

  /* ============================================================
     entry point اصلی
     ============================================================ */
  function startCrop(input, opts, onUploaded, onDone){
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if(!files.length) return;

    console.log('[crop-v3] starting for', files.length, 'file(s), mode:', opts.mode);

    loadCropperLib(function(err){
      if(err){
        console.error('[crop-v3] cropper load failed:', err.message);
        msg('کتابخانه برش لود نشد — آپلود بدون برش', 'warn');
        /* fallback: آپلود مستقیم */
        var i = 0;
        function next(){
          if(i >= files.length){
            if(onDone) onDone();
            return;
          }
          var f = files[i++];
          uploadFile(f).then(function(u){
            if(onUploaded) onUploaded(u);
          }).catch(function(e){ console.error(e); }).then(next);
        }
        next();
        return;
      }
      console.log('[crop-v3] cropper ready, opening modal');
      showCropModal(files, opts, onUploaded, onDone);
    });
  }

  /* ============================================================
     override دو تابع اصلی
     ============================================================ */

  /* برای فرم دسته‌بندی */
  window.__pickAdmImg = function(input, imgFieldId, pickerId){
    var isCircle = (pickerId || '').indexOf('cat') !== -1 || imgFieldId === 'catImg';
    startCrop(input, { mode: isCircle ? 'circle' : 'square' },
      function(url){
        var field = document.getElementById(imgFieldId);
        if(field) field.value = url;

        var picker = document.getElementById(pickerId);
        if(picker){
          var full = (window.__ASSET__ ? window.__ASSET__(url) : url);
          picker.style.backgroundImage = 'url("' + full + '")';
          picker.style.backgroundSize = 'cover';
          picker.style.backgroundPosition = 'center';
          picker.innerHTML = '';
          picker.classList.add('has-image');
        }
        /* hidden input اگه هست */
        var hidden = document.getElementById('catImg');
        if(hidden && imgFieldId !== 'catImg') hidden.value = url;
      },
      function(){}
    );
  };

  /* برای فرم محصول */
  window.__handleProdImagePick = function(input, opts){
    opts = opts || { mode: 'square' };
    startCrop(input, opts,
      function(url){
        if(window.__activeProductF){
          if(!Array.isArray(window.__activeProductF.images)) window.__activeProductF.images = [];
          window.__activeProductF.images.push(url);
        }
        if(typeof window.__repaintProdImages === 'function') window.__repaintProdImages();
        msg('تصویر اضافه شد. یادت نره ذخیره کنی.', 'ok');
      },
      function(){}
    );
  };

  /* ============================================================
     backup: intercept picker click
     ============================================================ */
  document.addEventListener('click', function(e){
    if(!e.target || !e.target.closest) return;
    var picker = e.target.closest('#catImgPicker');
    if(!picker) return;

    /* چک کن onchange روی input هست */
    var input = document.getElementById('catFile');
    if(!input) return;

    /* مطمئن شو onchange به تابع ما اشاره می‌کنه */
    input.setAttribute('onchange', "window.__pickAdmImg(this, 'catImg', 'catImgPicker')");

    e.preventDefault();
    input.click();
  }, true);

  console.log('[crop-v3] ready (square + circle)');
})();
