/* ================================================================
   admin-crop.js — v4 (بدون اجرای دوگانه، پیش‌نمایش قطعی)
   ================================================================ */
(function(){
  'use strict';
  if(window.__CROP_V4__) return;
  window.__CROP_V4__ = true;

  /* ============================================================
     بارگذاری Cropper
     ============================================================ */
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
    s.src = 'cropper.min.js?v=' + Date.now();
    s.setAttribute('data-cropper-lib', '1');
    s.async = false;
    s.onload = function(){
      if(window.Cropper){ cb(null); return; }
      setTimeout(function(){
        cb(window.Cropper ? null : new Error('Cropper تعریف نشد'));
      }, 200);
    };
    s.onerror = function(){ cb(new Error('load error')); };
    document.head.appendChild(s);
  }

  /* ============================================================
     upload
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
    var m = document.getElementById('__cropV4');
    if(m) return m;

    m = document.createElement('div');
    m.className = 'crv4-modal';
    m.id = '__cropV4';
    m.hidden = true;
    m.innerHTML = ''
      + '<div class="crv4-scrim"></div>'
      + '<div class="crv4-box">'
      +   '<div class="crv4-head">'
      +     '<h3 class="crv4-title">برش تصویر</h3>'
      +     '<span class="crv4-counter"></span>'
      +     '<button type="button" class="crv4-x">×</button>'
      +   '</div>'
      +   '<div class="crv4-body">'
      +     '<div class="crv4-hint"></div>'
      +     '<div class="crv4-stage"><img class="crv4-img" alt=""></div>'
      +     '<div class="crv4-tools">'
      +       '<button type="button" data-v4="rot-90">چرخش ۹۰°</button>'
      +       '<button type="button" data-v4="rot-180">چرخش ۱۸۰°</button>'
      +       '<button type="button" data-v4="flip-h">قرینه افقی</button>'
      +       '<button type="button" data-v4="flip-v">قرینه عمودی</button>'
      +       '<button type="button" data-v4="reset">بازنشانی</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="crv4-foot">'
      +     '<button type="button" class="crv4-btn crv4-btn-outline" data-v4-cancel>انصراف</button>'
      +     '<button type="button" class="crv4-btn crv4-btn-primary" data-v4-confirm>تأیید و افزودن</button>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(m);
    return m;
  }

  /* ============================================================
     نمایش مودال کراپ
     ============================================================ */
  function showCrop(files, opts, onUploaded, onDone){
    opts = opts || {};
    var isCircle = opts.mode === 'circle';

    var modal = buildModal();
    var scrim = modal.querySelector('.crv4-scrim');
    var title = modal.querySelector('.crv4-title');
    var counter = modal.querySelector('.crv4-counter');
    var xBtn = modal.querySelector('.crv4-x');
    var hint = modal.querySelector('.crv4-hint');
    var stage = modal.querySelector('.crv4-stage');
    var img = modal.querySelector('.crv4-img');
    var confirmBtn = modal.querySelector('[data-v4-confirm]');
    var cancelBtn = modal.querySelector('[data-v4-cancel]');

    var idx = 0;
    var cropper = null;
    var originalUrl = null;

    /* ظاهر */
    if(isCircle){
      title.textContent = 'برش تصویر دایره‌ای';
      hint.textContent = 'کادر دایره‌ای را بکشید · با چرخ ماوس زوم کنید';
    } else {
      title.textContent = 'برش تصویر (۱:۱)';
      hint.textContent = 'کادر را بکشید · با چرخ ماوس زوم کنید';
    }
    stage.classList.toggle('is-circle', isCircle);

    function showCurrent(){
      if(idx >= files.length){ close(); return; }
      var f = files[idx];
      if(f.size > 10 * 1024 * 1024){
        msg('«' + f.name + '» بیش از ۱۰ مگابایت', 'warn');
        idx++;
        return showCurrent();
      }
      if(originalUrl){ URL.revokeObjectURL(originalUrl); originalUrl = null; }
      originalUrl = URL.createObjectURL(f);
      img.src = originalUrl;
      if(counter) counter.textContent = files.length > 1 ? (idx+1)+' / '+files.length : '';

      img.onload = function(){
        if(cropper){ try{ cropper.destroy(); }catch(e){} cropper = null; }
        cropper = new window.Cropper(img, {
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.9,
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
          toggleDragModeOnDblclick: false
        });
      };
      img.onerror = function(){ msg('خطای تصویر', 'err'); idx++; showCurrent(); };
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
          imageSmoothingQuality: 'high'
        });
      }catch(e){ canvas = null; }

      if(!canvas){
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'تأیید و افزودن';
        msg('خطا در پردازش', 'err');
        return;
      }

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

        uploadFile(file).then(function(url){
          /* callback اصلی */
          if(onUploaded) onUploaded(url);
          msg(isCircle ? 'تصویر دایره‌ای اضافه شد.' : 'تصویر اضافه شد.', 'ok');
        }).catch(function(e){
          console.error('[crop-v4] upload error:', e);
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

    confirmBtn.onclick = confirm;
    cancelBtn.onclick = close;
    xBtn.onclick = close;
    scrim.onclick = close;

    modal.querySelectorAll('[data-v4]').forEach(function(b){
      b.onclick = function(){
        if(!cropper) return;
        var a = b.getAttribute('data-v4');
        if(a === 'rot-90') cropper.rotate(90);
        else if(a === 'rot-180') cropper.rotate(180);
        else if(a === 'flip-h'){ var d = cropper.getData(); cropper.scaleX(d.scaleX === -1 ? 1 : -1); }
        else if(a === 'flip-v'){ var d2 = cropper.getData(); cropper.scaleY(d2.scaleY === -1 ? 1 : -1); }
        else if(a === 'reset') cropper.reset();
      };
    });

    confirmBtn.disabled = false;
    confirmBtn.textContent = 'تأیید و افزودن';
    idx = 0;
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    showCurrent();
  }

  /* ============================================================
     تابع عمومی
     ============================================================ */
  function startCrop(input, opts, onUploaded, onDone){
    /* جلوگیری از اجرای دوگانه */
    if(window.__CROP_V4_BUSY__) return;
    window.__CROP_V4_BUSY__ = true;
    setTimeout(function(){ window.__CROP_V4_BUSY__ = false; }, 800);

    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if(!files.length) return;

    console.log('[crop-v4] start, files=' + files.length + ', mode=' + (opts.mode || 'square'));

    loadCropper(function(loadErr){
      if(loadErr){
        console.error('[crop-v4] lib fail:', loadErr.message);
        msg('کتابخانه برش لود نشد — بدون برش آپلود میشه', 'warn');
        var i = 0;
        function next(){
          if(i >= files.length){ if(onDone) onDone(); return; }
          var f = files[i++];
          uploadFile(f).then(function(u){ if(onUploaded) onUploaded(u); }).catch(function(){}).then(next);
        }
        next();
        return;
      }
      showCrop(files, opts, onUploaded, onDone);
    });
  }

  /* ============================================================
     override دو تابع
     ============================================================ */

  /* برای picker دسته‌بندی (catImgPicker) */
  window.__pickAdmImg = function(input, imgFieldId, pickerId){
    var isCircle = (pickerId || '').indexOf('cat') !== -1 || imgFieldId === 'catImg';
    startCrop(input, { mode: isCircle ? 'circle' : 'square' },
      function(url){
        /* ذخیره در hidden input */
        var field = document.getElementById(imgFieldId);
        if(field) field.value = url;

        /* اعمال پیش‌نمایش روی picker */
        var picker = document.getElementById(pickerId);
        if(picker){
          var full = (window.__ASSET__ ? window.__ASSET__(url) : url);
          picker.style.backgroundImage = 'url("' + full + '")';
          picker.style.backgroundSize = 'cover';
          picker.style.backgroundPosition = 'center';
          picker.style.backgroundRepeat = 'no-repeat';
          picker.classList.add('has-image', 'cat-circle-picker');
          /* محتوای داخلی (empty state) رو پاک کن */
          var empty = picker.querySelector('.adm-img-picker-empty');
          if(empty) empty.remove();
          /* اگه innerHTML هنوز چیز دیگه داره، پاک کن */
          if(picker.innerHTML.indexOf('adm-img-picker-empty') === -1){
            picker.innerHTML = '';
          }
          console.log('[crop-v4] preview set on picker:', pickerId);
        } else {
          console.warn('[crop-v4] picker not found:', pickerId);
        }
      }
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
      }
    );
  };

  /* ============================================================
     فقط یک بار — picker click
     ============================================================ */
  /* picker interception removed — handled in renderCategories */

  console.log('[crop-v4] ready');
})();
