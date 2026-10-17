/* ==============================================================
   admin-upload.js — product image upload (standalone)
   ============================================================== */

(function(){
  'use strict';

  if(window.__uploadModLoaded) return;
  window.__uploadModLoaded = true;

  /* ---- absolute URL helper ---- */
  function toAbs(u){ return window.__ASSET__ ? window.__ASSET__(u) : u; }

  /* ---- upload one file ---- */
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
        catch(e){ return reject(new Error('پاسخ سرور نامعتبر است.')); }
        if(xhr.status >= 200 && xhr.status < 300 && r.success) resolve(r.url);
        else reject(new Error(r.message || ('HTTP ' + xhr.status)));
      };
      xhr.onerror = function(){ reject(new Error('خطای شبکه')); };
      xhr.send(fd);
    });
  }

  /* ---- repaint the image list ---- */
  function repaint(){
    var F = window.__activeProductF;
    var list = document.getElementById('imgList');
    if(!F || !list) return;
    list.textContent = '';
    var arr = Array.isArray(F.images) ? F.images : [];

    arr.forEach(function(url, idx){
      var row = document.createElement('div');
      row.className = 'adm-img-item';

      var thumb = document.createElement('div');
      thumb.className = 'adm-img-thumb';
      thumb.style.backgroundImage = 'url(' + JSON.stringify(window.__ASSET__(url)) + ')';

      var txt = document.createElement('div');
      txt.className = 'adm-img-url';
      txt.setAttribute('dir', 'ltr');
      txt.textContent = url;

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'adm-iconbtn-sm danger';
      del.setAttribute('aria-label', 'حذف تصویر');
      del.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      del.addEventListener('click', function(){
        F.images.splice(idx, 1);
        repaint();
      });

      row.appendChild(thumb);
      row.appendChild(txt);
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  window.__repaintProdImages = repaint;

  /* ---- file picker handler ---- */
  window.__handleProdImagePick = async function(inputEl){
    var files = Array.prototype.slice.call(inputEl.files || []);
    inputEl.value = '';
    if(!files.length) return;

    var F = window.__activeProductF;
    if(!F){
      try{ window.toast ? toast('ابتدا فرم محصول را باز کنید.', 'warn') : alert('ابتدا فرم محصول را باز کنید.'); }
      catch(e){}
      return;
    }
    if(!Array.isArray(F.images)) F.images = [];

    var progressEl = document.getElementById('uploadProgress');
    var bar = progressEl ? progressEl.querySelector('.adm-upload-bar i') : null;
    var lbl = progressEl ? progressEl.querySelector('.adm-upload-lbl') : null;
    if(progressEl) progressEl.hidden = false;

    var done = 0, failed = 0;
    var total = files.length;

    for(var i = 0; i < files.length; i++){
      var f = files[i];
      if(f.size > 5 * 1024 * 1024){
        try{ toast('«' + f.name + '» بیش از ۵ مگابایت است.', 'warn'); }catch(e){}
        failed++;
        continue;
      }
      try{
        if(lbl) lbl.textContent = 'در حال آپلود ' + (done + 1) + ' از ' + total + '...';
        var url = await uploadFile(f, function(p){
          if(bar) bar.style.width = p + '%';
        });
        F.images.push(url);
        repaint();
        done++;
      }catch(err){
        console.error('[upload] error:', err);
        try{ toast('خطا در «' + f.name + '»: ' + (err.message || 'نامشخص'), 'err', 5000); }catch(e){}
        failed++;
      }
    }

    if(progressEl) progressEl.hidden = true;
    if(bar) bar.style.width = '0%';
    if(done > 0){
      try{ toast(done + ' تصویر آپلود شد. یادت نره ذخیره کنی.', 'ok', 4500); }catch(e){}
    }
  };

})();
