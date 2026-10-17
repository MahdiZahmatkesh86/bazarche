/* ================================================================
   admin-circular.js — override کامل برای کراپ دایره‌ای
   ================================================================ */
(function(){
  'use strict';
  if(window.__ADMIN_CIRCULAR_V2__) return;
  window.__ADMIN_CIRCULAR_V2__ = true;

  console.log('[circular-v2] loading...');

  /* ============================================================
     ۱) override __pickAdmImg
     ============================================================ */
  window.__pickAdmImg = function(input, imgFieldId, pickerId){
    var list = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if(!list.length) return;

    /* اطمینان از لود library */
    ensureCropperLib(function(err){
      if(err){
        console.error('[circular] cropper load failed:', err);
        if(typeof toast === 'function') toast('کتابخانه برش بارگذاری نشد.', 'err');
        return;
      }
      openCircularCropper(list, imgFieldId, pickerId);
    });
  };

  /* ============================================================
     ۲) بارگذاری Cropper library
     ============================================================ */
  function ensureCropperLib(cb){
    if(window.Cropper){ cb(null); return; }

    /* CSS */
    if(!document.querySelector('link[data-cropper-css]')){
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'cropper.min.css';
      css.setAttribute('data-cropper-css', '1');
      document.head.appendChild(css);
    }

    /* JS */
    var existing = document.querySelector('script[data-cropper-local]');
    if(existing){
      var cnt = 0;
      var iv = setInterval(function(){
        if(window.Cropper){ clearInterval(iv); cb(null); }
        else if(++cnt > 40){ clearInterval(iv); cb(new Error('timeout')); }
      }, 100);
      return;
    }

    var s = document.createElement('script');
    s.src = 'cropper.min.js';
    s.setAttribute('data-cropper-local', '1');
    s.onload = function(){ cb(null); };
    s.onerror = function(){ cb(new Error('load error')); };
    document.head.appendChild(s);
  }

  /* ============================================================
     ۳) مودال کراپ دایره‌ای
     ============================================================ */
  function openCircularCropper(files, imgFieldId, pickerId){
    var idx = 0;
    var cropper = null;
    var modal = document.getElementById('__circularCropModal');

    if(!modal){
      modal = buildModal();
    }

    var img = document.getElementById('__circularCropImage');
    var counter = document.getElementById('__circularCropCounter');
    var stage = document.getElementById('__circularCropStage');
    var confirmBtn = document.getElementById('__circularCropConfirm');
    var cancelBtn = document.getElementById('__circularCropCancel');
    var xBtn = document.getElementById('__circularCropX');
    var originalUrl = null;

    function showCurrent(){
      if(idx >= files.length){
        closeModal();
        return;
      }
      var f = files[idx];
      if(f.size > 10 * 1024 * 1024){
        if(typeof toast === 'function') toast('«' + f.name + '» بیش از ۱۰ مگابایت است.', 'warn');
        idx++;
        return showCurrent();
      }
      if(originalUrl){ URL.revokeObjectURL(originalUrl); originalUrl = null; }
      originalUrl = URL.createObjectURL(f);
      img.src = originalUrl;

      if(counter){
        counter.textContent = files.length > 1
          ? (idx + 1) + ' / ' + files.length
          : '';
      }

      img.onload = function(){
        if(cropper){ try{ cropper.destroy(); }catch(e){} cropper = null; }
        cropper = new window.Cropper(img, {
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.85,
          aspectRatio: 1,
          background: false,
          responsive: true,
          guides: false,
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
            stage.classList.add('is-circle');
          },
        });
      };
    }

    function closeModal(){
      modal.hidden = true;
      if(cropper){ try{ cropper.destroy(); }catch(e){} cropper = null; }
      if(originalUrl){ URL.revokeObjectURL(originalUrl); originalUrl = null; }
      idx = 0;
      document.documentElement.style.overflow = '';
    }

    function confirm(){
      if(!cropper) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'در حال پردازش...';

      var canvas;
      try{
        canvas = cropper.getCroppedCanvas({
          width: 800,
          height: 800,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        });
      }catch(e){ canvas = null; }

      if(!canvas){
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'تأیید و افزودن';
        if(typeof toast === 'function') toast('خطا در پردازش تصویر', 'err');
        return;
      }

      /* ماسک دایره‌ای سفید */
      var size = 800;
      var c2 = document.createElement('canvas');
      c2.width = size;
      c2.height = size;
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

      /* لبه نرم */
      var grad = ctx.createRadialGradient(size / 2, size / 2, size / 2 - 4, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      c2.toBlob(function(blob){
        if(!blob){
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'تأیید و افزودن';
          return;
        }

        var file = new File([blob], 'circle-' + Date.now() + '.png', { type: 'image/png' });

        uploadFile(file, function(percent){
          var bar = document.querySelector('.adm-upload-bar i');
          if(bar) bar.style.width = percent + '%';
        }).then(function(url){
          /* تنظیم field */
          var field = document.getElementById(imgFieldId);
          if(field) field.value = url;

          /* نمایش پیش‌نمایش روی picker */
          var picker = document.getElementById(pickerId);
          if(picker){
            var fullUrl = (window.__ASSET__ ? window.__ASSET__(url) : url);
            picker.style.backgroundImage = 'url("' + fullUrl + '")';
            picker.style.backgroundSize = 'cover';
            picker.style.backgroundPosition = 'center';
            picker.innerHTML = '';
            picker.classList.add('has-image');
          }

          if(typeof toast === 'function') toast('تصویر با موفقیت اضافه شد.', 'ok');

          /* فیلدهای مخفی دیگه (اگه لازم) */
          var hidden = document.getElementById('catImg');
          if(hidden && imgFieldId !== 'catImg') hidden.value = url;

        }).catch(function(e){
          console.error('[circular] upload error:', e);
          if(typeof toast === 'function') toast('خطا: ' + (e.message || 'نامشخص'), 'err');
        }).then(function(){
          idx++;
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'تأیید و افزودن';
          if(idx < files.length){
            showCurrent();
          } else {
            closeModal();
          }
        });
      }, 'image/png');
    }

    /* bind events */
    confirmBtn.onclick = confirm;
    cancelBtn.onclick = closeModal;
    xBtn.onclick = closeModal;
    modal.querySelector('.circular-crop-scrim').onclick = closeModal;

    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';

    /* اجرای اول */
    showCurrent();
  }

  /* ============================================================
     ۴) ساخت مودال
     ============================================================ */
  function buildModal(){
    var m = document.createElement('div');
    m.className = 'circular-crop-modal';
    m.id = '__circularCropModal';
    m.hidden = true;

    m.innerHTML = ''
      + '<div class="circular-crop-scrim"></div>'
      + '<div class="circular-crop-box" role="dialog" aria-modal="true" aria-label="برش تصویر">'
      +   '<div class="circular-crop-head">'
      +     '<h3>برش تصویر دایره‌ای</h3>'
      +     '<span class="circular-crop-counter" id="__circularCropCounter"></span>'
      +     '<button type="button" class="circular-crop-x" id="__circularCropX" aria-label="بستن">×</button>'
      +   '</div>'
      +   '<div class="circular-crop-body">'
      +     '<div class="circular-crop-hint">کادر را بکشید · با چرخ ماوس زوم کنید · فقط بخش داخل دایره ذخیره می‌شود</div>'
      +     '<div class="circular-crop-stage" id="__circularCropStage">'
      +       '<img id="__circularCropImage" alt="">'
      +     '</div>'
      +     '<div class="circular-crop-tools">'
      +       '<button type="button" data-cir-act="rotate-90">چرخش ۹۰°</button>'
      +       '<button type="button" data-cir-act="rotate-180">چرخش ۱۸۰°</button>'
      +       '<button type="button" data-cir-act="flip-h">قرینه افقی</button>'
      +       '<button type="button" data-cir-act="flip-v">قرینه عمودی</button>'
      +       '<button type="button" data-cir-act="reset">بازنشانی</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="circular-crop-foot">'
      +     '<button type="button" class="adm-btn outline" id="__circularCropCancel">انصراف</button>'
      +     '<button type="button" class="adm-btn primary" id="__circularCropConfirm">تأیید و افزودن</button>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(m);

    /* bind tools */
    m.querySelectorAll('[data-cir-act]').forEach(function(b){
      b.addEventListener('click', function(){
        /* پیدا کردن cropper فعال */
        var stage = document.getElementById('__circularCropStage');
        var img = document.getElementById('__circularCropImage');
        if(!window.Cropper || !img) return;
        var c = null;
        try{
          /* از روی instance قبلی */
          c = window.__activeCropper;
        }catch(e){}
        /* بهتر: از img استفاده کن */
        var act = b.getAttribute('data-cir-act');
        try{
          /* Cropper.js instance رو روی img ذخیره می‌کنیم */
          if(img.__cropper){
            c = img.__cropper;
          }
        }catch(e){}
        if(!c) return;
        if(act === 'rotate-90') c.rotate(90);
        else if(act === 'rotate-180') c.rotate(180);
        else if(act === 'flip-h'){ var d = c.getData(); c.scaleX(d.scaleX === -1 ? 1 : -1); }
        else if(act === 'flip-v'){ var d2 = c.getData(); c.scaleY(d2.scaleY === -1 ? 1 : -1); }
        else if(act === 'reset') c.reset();
      });
    });

    return m;
  }

  /* ذخیره instance cropper روی img */
  var _origCropper = window.Cropper;
  /* نمیتونیم مستقیماً override کنیم چون ممکنه بعداً لود بشه، پس از prototype استفاده می‌کنیم */
  function hookCropperInstance(){
    if(!window.Cropper || window.Cropper.__hooked) return;
    window.Cropper.__hooked = true;
    var Orig = window.Cropper;
    window.Cropper = function(el, opts){
      var inst = new Orig(el, opts);
      try{ el.__cropper = inst; }catch(e){}
      return inst;
    };
    window.Cropper.prototype = Orig.prototype;
  }
  setTimeout(hookCropperInstance, 500);
  setTimeout(hookCropperInstance, 2000);

  /* ============================================================
     ۵) uploadFile
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
     ۶) پشتیبانی از input type=file در فرم‌ها (فقط برای catImg)
     ============================================================ */
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if(!t || t.tagName !== 'INPUT' || t.type !== 'file') return;
    if(t.id !== 'catFile') return;
    ev.stopPropagation();
    ev.preventDefault();
    /* با onchange داخلی کاری نداریم، __pickAdmImg خودش صدا زده میشه */
  }, true);

  console.log('[circular-v2] ready');
})();
