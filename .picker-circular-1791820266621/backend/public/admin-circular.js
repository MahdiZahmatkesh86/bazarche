/* ================================================================
   admin-circular.js
   ----------------------------------------------------------------
   پچ امن کراپ دایره‌ای و پیش‌نمایش دایره‌ای برای دسته‌بندی‌ها
   این فایل بعد از admin.js بارگذاری می‌شه و رفتار رو override می‌کنه
   ================================================================ */
(function(){
  'use strict';
  if(window.__ADMIN_CIRCULAR_LOADED__) return;
  window.__ADMIN_CIRCULAR_LOADED__ = true;

  /* ----------------------------------------------------------
     ۱) Hook روی کلیک پیکر دسته‌بندی
     ---------------------------------------------------------- */
  function attachCirclePicker(){
    /* اگه فایل ورودی وجود داره، onchange رو override کن */
    var fileInput = document.getElementById('catFile');
    var picker = document.getElementById('catImgPicker');

    if(!fileInput || !picker) return false;

    /* استایل دایره */
    picker.classList.add('cat-circle-picker');

    /* override onchange */
    fileInput.onchange = function(ev){
      ev.preventDefault();
      var list = Array.prototype.slice.call(fileInput.files || []);
      fileInput.value = '';
      if(!list.length) return;

      if(typeof window.__handleProdImagePick !== 'function'){
        console.warn('[circular] __handleProdImagePick نیست');
        return;
      }

      /* استفاده از کراپ دایره‌ای */
      window.__handleProdImagePick(
        { files: list, value: '' },
        {
          mode: 'circle',
          allowWithoutForm: true,
          onUploaded: function(url){
            var f = document.getElementById('catImg');
            if(f) f.value = url;
            var p = document.getElementById('catImgPicker');
            if(p){
              var full = window.__ASSET__ ? window.__ASSET__(url) : url;
              p.style.backgroundImage = 'url(' + JSON.stringify(full) + ')';
              p.innerHTML = '';
            }
          }
        }
      );
    };

    return true;
  }

  /* ----------------------------------------------------------
     ۲) MutationObserver — هر بار که فرم دسته باز شد، picker رو دایره کن
     ---------------------------------------------------------- */
  var mo = new MutationObserver(function(){
    /* چک کن پیکر هست */
    var picker = document.getElementById('catImgPicker');
    if(picker && !picker.classList.contains('cat-circle-picker')){
      picker.classList.add('cat-circle-picker');
      /* اگه خالی هست، آیکون درست بذار */
      if(!picker.style.backgroundImage || picker.style.backgroundImage === 'none'){
        picker.innerHTML =
          '<div class="cat-circle-picker-empty">' +
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
              '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
              '<circle cx="9" cy="9" r="2"/>' +
              '<path d="M3 15l5-5 6 6 3-3 4 4"/>' +
            '</svg>' +
            '<span>برای انتخاب کلیک کن</span>' +
          '</div>';
      }
    }

    /* کارت‌های دسته در گرید */
    var thumbs = document.querySelectorAll('.cat-card-thumb:not(.cat-card-thumb-circle)');
    for(var i = 0; i < thumbs.length; i++){
      var t = thumbs[i];
      /* تبدیل به دایره‌ای */
      t.classList.add('cat-card-thumb-circle');
      /* اضافه کردن wrapper اگه نیست */
      if(!t.parentNode.classList.contains('cat-card-thumb-wrap')){
        var wrap = document.createElement('div');
        wrap.className = 'cat-card-thumb-wrap';
        t.parentNode.insertBefore(wrap, t);
        wrap.appendChild(t);
      }
    }

    /* پشتیبانی از کلاس قدیمی */
    var pickers = document.querySelectorAll('.adm-img-picker:not(.cat-circle-picker)');
    for(var j = 0; j < pickers.length; j++){
      var p = pickers[j];
      if(p.id === 'catImgPicker'){
        p.classList.add('cat-circle-picker');
      }
    }
  });

  function startObserver(){
    mo.observe(document.body, { childList: true, subtree: true });
    /* اجرای اولیه */
    setTimeout(attachCirclePicker, 100);
    setTimeout(attachCirclePicker, 500);
    setTimeout(attachCirclePicker, 1500);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  console.log('[circular] ready');
})();
