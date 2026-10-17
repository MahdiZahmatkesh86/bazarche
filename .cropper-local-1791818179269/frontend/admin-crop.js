(function(){
  'use strict';
  if(window.__CROP_LOADED__) return;
  window.__CROP_LOADED__ = true;

  var cropper = null;
  var files = [];
  var idx = 0;
  var modalEl = null;
  var imgEl = null;
  var originalUrl = null;

  /* ---------- self-contained uploader ---------- */
  window.__uploadFile = function(file, onProgress){
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
        catch(e){ return reject(new Error('پاسخ نامعتبر از سرور')); }
        if(xhr.status >= 200 && xhr.status < 300 && r.success) resolve(r.url);
        else reject(new Error(r.message || ('HTTP ' + xhr.status)));
      };
      xhr.onerror = function(){ reject(new Error('خطای شبکه')); };
      xhr.send(fd);
    });
  };

  /* ---------- toast helper ---------- */
  function popToast(msg, type){
    if(typeof window.toast === 'function'){
      try{ window.toast(msg, type); return; }catch(e){}
    }
    var box = document.getElementById('toasts');
    if(!box) return;
    var el = document.createElement('div');
    el.className = 'adm-toast ' + (type === 'err' ? 'err' : (type === 'warn' ? 'warn' : 'ok'));
    el.innerHTML = '<div class="adm-toast-msg"></div>';
    el.querySelector('.adm-toast-msg').textContent = String(msg);
    box.appendChild(el);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 3200);
  }

  /* ---------- load Cropper.js from CDN ---------- */
  function loadCropperLib(){
    return new Promise(function(resolve, reject){
      if(window.Cropper) return resolve();
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css';
      css.integrity = 'sha512-9KkIqdfN7ipEW6B6k+Aq20PV31bjODg4AA52W+tYtAE0jE0kMx49bjJ3FgvS56wzmyfMUHbQ4Km2b7l9+Y/+Eg==';css.crossOrigin = 'anonymous';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js';
      s.integrity = 'sha512-RBDVKMHNhFpZK4+7zW5DjLg+7EPbWHB1oKzTzqvZaWF2U0X0mGQfqxo3kNvv8iDzMLCLG8ZcqGJcSMt5gKq3dg==';s.crossOrigin = 'anonymous';
      s.onload = function(){ resolve(); };
      s.onerror = function(){ reject(new Error('CDN')); };
      document.head.appendChild(s);
    });
  }

  function fa(n){
    try{ return Number(n).toLocaleString('fa-IR'); }
    catch(e){ return String(n); }
  }

  /* ---------- build modal ---------- */
  function buildModal(){
    if(modalEl) return modalEl;

    var m = document.createElement('div');
    m.className = 'crop-modal';
    m.id = 'cropModal';
    m.hidden = true;

    var scrim = document.createElement('div');
    scrim.className = 'crop-modal-scrim';

    var box = document.createElement('div');
    box.className = 'crop-modal-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    var head = document.createElement('div');
    head.className = 'crop-modal-head';
    var h3 = document.createElement('h3');
    h3.textContent = 'برش تصویر';
    head.appendChild(h3);
    var counter = document.createElement('span');
    counter.className = 'crop-counter';
    counter.id = 'cropCounter';
    head.appendChild(counter);
    var xBtn = document.createElement('button');
    xBtn.type = 'button';
    xBtn.className = 'crop-modal-x';
    xBtn.textContent = '×';
    xBtn.setAttribute('aria-label', 'بستن');
    xBtn.addEventListener('click', closeModal);
    head.appendChild(xBtn);

    var body = document.createElement('div');
    body.className = 'crop-modal-body';

    var stage = document.createElement('div');
    stage.className = 'crop-stage';
    var im = document.createElement('img');
    im.id = 'cropImage';
    im.alt = '';
    stage.appendChild(im);
    body.appendChild(stage);

    var tools = document.createElement('div');
    tools.className = 'crop-tools';
    [
      ['rotate-90', 'چرخش ۹۰°'],
      ['rotate-180', 'چرخش ۱۸۰°'],
      ['flip-h', 'قرینه افقی'],
      ['flip-v', 'قرینه عمودی'],
      ['reset', 'بازنشانی']
    ].forEach(function(it){
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-crop', it[0]);
      b.textContent = it[1];
      tools.appendChild(b);
    });
    body.appendChild(tools);

    var presets = document.createElement('div');
    presets.className = 'crop-presets';
    var lbl = document.createElement('span');
    lbl.className = 'crop-presets-label';
    lbl.textContent = 'نسبت تصویر:';
    presets.appendChild(lbl);
    [
      ['1', '۱:۱'],
      ['1.3333', '۴:۳'],
      ['1.7778', '۱۶:۹'],
      ['0.8', '۴:۵'],
      ['NaN', 'آزاد']
    ].forEach(function(it){
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-ratio', it[0]);
      b.textContent = it[1];
      if(it[0] === '1') b.classList.add('is-active');
      presets.appendChild(b);
    });
    body.appendChild(presets);

    var foot = document.createElement('div');
    foot.className = 'crop-modal-foot';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'adm-btn outline';
    cancel.textContent = 'انصراف';
    cancel.addEventListener('click', closeModal);
    var ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'adm-btn primary';
    ok.id = 'cropConfirmBtn';
    ok.textContent = 'تأیید و افزودن';
    ok.addEventListener('click', confirmCrop);
    foot.appendChild(cancel);
    foot.appendChild(ok);

    box.appendChild(head);
    box.appendChild(body);
    box.appendChild(foot);

    m.appendChild(scrim);
    m.appendChild(box);
    document.body.appendChild(m);

    modalEl = m;
    imgEl = im;

    scrim.addEventListener('click', closeModal);
    return m;
  }

  function updateCounter(){
    var c = document.getElementById('cropCounter');
    if(!c) return;
    if(files.length <= 1){ c.textContent = ''; return; }
    c.textContent = fa(idx + 1) + ' / ' + fa(files.length);
  }

  function loadCurrent(){
    if(idx >= files.length){ closeModal(); return; }
    var f = files[idx];

    if(f.size > 8 * 1024 * 1024){
      popToast('«' + f.name + '» بیش از ۸ مگابایت است.', 'warn');
      idx++;
      return loadCurrent();
    }

    if(originalUrl){ URL.revokeObjectURL(originalUrl); originalUrl = null; }
    originalUrl = URL.createObjectURL(f);
    imgEl.src = originalUrl;

    imgEl.onload = function(){
      if(cropper){ try{ cropper.destroy(); }catch(e){} cropper = null; }
      cropper = new window.Cropper(imgEl, {
        viewMode: 1,
        autoCropArea: 1,
        background: false,
        responsive: true,
        guides: true,
        movable: true,
        zoomable: true,
        scalable: true,
        rotatable: true,
        aspectRatio: 1
      });
      updateCounter();
    };
    imgEl.onerror = function(){ idx++; loadCurrent(); };
  }

  function closeModal(){
    if(modalEl) modalEl.hidden = true;
    if(cropper){ try{ cropper.destroy(); }catch(e){} cropper = null; }
    if(originalUrl){ URL.revokeObjectURL(originalUrl); originalUrl = null; }
    files = []; idx = 0;
    document.documentElement.style.overflow = '';
  }

  function confirmCrop(){
    if(!cropper) return;
    var okBtn = document.getElementById('cropConfirmBtn');
    if(okBtn){ okBtn.disabled = true; okBtn.textContent = 'در حال پردازش...'; }

    var canvas;
    try{
      canvas = cropper.getCroppedCanvas({
        maxWidth: 1600,
        maxHeight: 1600,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });
    }catch(e){ canvas = null; }

    if(!canvas){
      if(okBtn){ okBtn.disabled = false; okBtn.textContent = 'تأیید و افزودن'; }
      popToast('خطا در پردازش تصویر', 'err');
      return;
    }

    canvas.toBlob(function(blob){
      if(!blob){
        if(okBtn){ okBtn.disabled = false; okBtn.textContent = 'تأیید و افزودن'; }
        popToast('خطا در تبدیل تصویر', 'err');
        return;
      }

      var prog = document.getElementById('uploadProgress');
      var bar = prog ? prog.querySelector('.adm-upload-bar i') : null;
      var lbl = prog ? prog.querySelector('.adm-upload-lbl') : null;
      if(prog) prog.hidden = false;
      if(lbl) lbl.textContent = 'در حال آپلود...';
      if(bar) bar.style.width = '0%';

      var out = new File([blob], 'crop-' + Date.now() + '.jpg', { type:'image/jpeg' });

      window.__uploadFile(out, function(p){
        if(bar) bar.style.width = p + '%';
      }).then(function(url){
        if(window.__activeProductF){
          if(!Array.isArray(window.__activeProductF.images)) window.__activeProductF.images = [];
          window.__activeProductF.images.push(url);
        }
        if(typeof window.__repaintProdImages === 'function') window.__repaintProdImages();
        popToast('تصویر اضافه شد. یادت نره ذخیره کنی.', 'ok');
      }).catch(function(err){
        console.error('[crop] upload error:', err);
        popToast('خطا: ' + (err.message || 'نامشخص'), 'err');
      }).then(function(){
        if(prog) prog.hidden = true;
        if(bar) bar.style.width = '0%';
        idx++;
        if(idx < files.length){
          if(okBtn){ okBtn.disabled = false; okBtn.textContent = 'تأیید و افزودن'; }
          loadCurrent();
        }else{
          closeModal();
        }
      });
    }, 'image/jpeg', 0.9);
  }

  /* ---------- tools + presets ---------- */
  document.addEventListener('click', function(e){
    if(!e.target || !e.target.closest) return;
    var tool = e.target.closest('[data-crop]');
    if(tool && cropper){
      var a = tool.getAttribute('data-crop');
      if(a === 'rotate-90') cropper.rotate(90);
      else if(a === 'rotate-180') cropper.rotate(180);
      else if(a === 'flip-h'){ var d = cropper.getData(); cropper.scaleX(d.scaleX === -1 ? 1 : -1); }
      else if(a === 'flip-v'){ var d2 = cropper.getData(); cropper.scaleY(d2.scaleY === -1 ? 1 : -1); }
      else if(a === 'reset') cropper.reset();
    }
    var rb = e.target.closest('[data-ratio]');
    if(rb && cropper){
      var r = rb.getAttribute('data-ratio');
      try{ cropper.setAspectRatio(r === 'NaN' ? NaN : parseFloat(r)); }catch(ex){}
      var all = document.querySelectorAll('[data-ratio]');
      for(var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
      rb.classList.add('is-active');
    }
  });

  /* ---------- override the file picker ---------- */
  window.__handleProdImagePick = function(inputEl){
    var list = Array.prototype.slice.call(inputEl.files || []);
    inputEl.value = '';
    if(!list.length) return;

    if(!window.__activeProductF){
      popToast('ابتدا فرم محصول را باز کنید.', 'warn');
      return;
    }

    loadCropperLib().then(function(){
      buildModal();
      modalEl.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      files = list;
      idx = 0;
      loadCurrent();
    }).catch(function(){
      popToast('کتابخانه برش بارگذاری نشد — آپلود بدون برش', 'warn');
      /* fallback: direct upload */
      var i = 0;
      function next(){
        if(i >= list.length){
          if(typeof window.__repaintProdImages === 'function') window.__repaintProdImages();
          return;
        }
        var f = list[i++];
        window.__uploadFile(f).then(function(u){
          if(window.__activeProductF){
            if(!Array.isArray(window.__activeProductF.images)) window.__activeProductF.images = [];
            window.__activeProductF.images.push(u);
          }
        }).catch(function(){}).then(next);
      }
      next();
    });
  };

  console.log('[crop] ready');
})();
