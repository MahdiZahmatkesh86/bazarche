/* ================================================================
   seller-products-ui.js
   ----------------------------------------------------------------
   رابط کاربری محصولات فروشنده — نسخه ۲
   ================================================================ */
(function(){
  'use strict';
  if(window.__SELLER_PRODUCTS_UI_V2__) return;
  window.__SELLER_PRODUCTS_UI_V2__ = true;

  var API = (window.__API_BASE__ || '/api');
  console.log('[seller-products-ui-v2] loading...');

  /* ============== helpers ============== */
  function $(s, r){ return (r || document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fa(n){ try{ return Number(n || 0).toLocaleString('fa-IR'); } catch(e){ return String(n || 0); } }
  function faT(n){ return fa(Math.round((Number(n)||0)/10)); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  /* حذف هر کاراکتر غیر عددی */
  function toNum(s){ return String(s == null ? '' : s).replace(/[^0-9]/g, ''); }
  /* فرمت سه رقمی با جداکننده فارسی */
  function fmt(n){
    var num = Number(n) || 0;
    if(num === 0) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* تبدیل عدد به حروف فارسی */
  function numToWordsFa(n){
    n = Math.floor(Number(n) || 0);
    if(n === 0) return 'صفر';
    if(n < 0) return 'منفی ' + numToWordsFa(-n);

    var yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
    var dahgan = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
    var dah = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
    var sadgan = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
    var scales = ['', ' هزار', ' میلیون', ' میلیارد', ' بیلیون'];

    function threeDigit(x){
      if(x === 0) return '';
      var out = [];
      var s = Math.floor(x / 100);
      var r = x % 100;
      if(s) out.push(sadgan[s]);
      if(r >= 10 && r < 20){
        out.push(dah[r - 10]);
      } else {
        var d = Math.floor(r / 10);
        var y = r % 10;
        if(d) out.push(dahgan[d]);
        if(y) out.push(yekan[y]);
      }
      return out.join(' و ');
    }

    var groups = [];
    var rem = n;
    var i = 0;
    while(rem > 0){
      var g = rem % 1000;
      if(g > 0){
        var txt = threeDigit(g);
        if(scales[i]) txt = txt + scales[i];
        groups.unshift(txt);
      }
      rem = Math.floor(rem / 1000);
      i++;
      if(i >= scales.length) break;
    }
    return groups.join(' و ');
  }

  async function apiGet(p){ return fetchAPI(p, 'GET'); }
  async function fetchAPI(p, method, body){
    method = method || 'GET';
    var opts = { method: method, credentials: 'include', headers: { 'Content-Type': 'application/json' } };
    if(body) opts.body = JSON.stringify(body);
    var res = await fetch(API + p, opts);
    var data = null;
    try{ data = await res.json(); }catch(e){ data = { success:false, message:'invalid' }; }
    if(!res.ok) throw new Error(data.message || ('HTTP ' + res.status));
    return data;
  }

  function toast(msg, type){
    if(typeof window.toast === 'function'){ try{ window.toast(msg, type); return; }catch(e){} }
    console.log('[toast]', msg);
  }

  /* ============== modal ============== */
  function getModal(){
    var m = $('#modal');
    if(!m){
      m = document.createElement('div');
      m.id = 'modal';
      m.className = 'adm-modal';
      m.hidden = true;
      m.innerHTML = '<div class="adm-modal-scrim" data-close></div><div class="adm-modal-box" id="modalBox"></div>';
      document.body.appendChild(m);
    }
    return m;
  }
  function getModalBox(){
    var b = $('#modalBox');
    if(!b){ getModal(); b = $('#modalBox'); }
    return b;
  }

  var lastFocus = null;
  function openModal(html){
    var m = getModal();
    var box = getModalBox();
    lastFocus = document.activeElement;
    box.innerHTML = html;
    m.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    var fe = box.querySelector('[data-autofocus]');
    if(fe) setTimeout(function(){ fe.focus(); }, 40);
  }
  function closeModal(){
    var m = $('#modal');
    var box = $('#modalBox');
    if(m) m.hidden = true;
    if(box) box.innerHTML = '';
    document.documentElement.style.overflow = '';
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function confirmDialog(opts){
    return new Promise(function(resolve){
      var html = ''
        + '<div class="adm-confirm-in">'
        +   '<div class="adm-confirm-ic">×</div>'
        +   '<h3>' + esc(opts.title || 'حذف') + '</h3>'
        +   '<p>' + esc(opts.message || 'مطمئنید؟') + '</p>'
        + '</div>'
        + '<div class="adm-confirm-foot">'
        +   '<button class="adm-btn outline" data-cancel type="button">انصراف</button>'
        +   '<button class="adm-btn danger" data-ok type="button" data-autofocus>' + esc(opts.confirmText || 'حذف') + '</button>'
        + '</div>';
      openModal(html);
      var box = getModalBox();
      box.querySelector('[data-ok]').onclick = function(){ closeModal(); resolve(true); };
      box.querySelector('[data-cancel]').onclick = function(){ closeModal(); resolve(false); };
    });
  }

  /* ============== product form ============== */
  async function openProductForm(id){
    var p = null;
    if(id){
      try{ var r = await apiGet('/seller/products/' + id); p = r.product; }
      catch(e){ toast('خطا: ' + e.message, 'err'); return; }
    }

    var cats = window.__sellerCats;
    if(!cats){
      try{ var rc = await apiGet('/categories'); cats = rc.categories || []; window.__sellerCats = cats; }
      catch(_){ cats = []; }
    }

    var artOptions = ['phone','laptop','headphones','watch','speaker','camera','sneaker','backpack','hoodie','kettle','lamp','book'];
    var artLabels = {phone:'موبایل',laptop:'لپ‌تاپ',headphones:'هدفون',watch:'ساعت',speaker:'اسپیکر',camera:'دوربین',sneaker:'کفش',backpack:'کوله',hoodie:'هودی',kettle:'کتری',lamp:'چراغ',book:'کتاب'};

    var F = {
      name: p ? p.name : '',
      sku: p ? (p.sku || '') : '',
      brand: p ? p.brand : '',
      category: p && p.category ? (p.category.slug || String(p.category.id)) : '',
      description: p ? (p.description || '') : '',
      shortDescription: p ? (p.shortDescription || '') : '',
      price: p ? p.price : '',
      off: p ? (p.off || 0) : 0,
      stock: p ? p.stock : 0,
      minStock: p ? (p.minStock || 3) : 3,
      weight: p ? (p.weight || 0) : 0,
      dimensions: p ? (p.dimensions || '') : '',
      art: p ? (p.art || 'book') : 'book',
      videoUrl: p ? (p.videoUrl || '') : '',
      warranty: p ? (p.warranty || '') : '',
      isActive: p ? !!p.isActive : true,
      images: Array.isArray(p && p.images) ? p.images.slice() : [],
      features: p && p.features ? p.features.slice() : [],
      sizes: p && p.sizes ? p.sizes.slice() : [],
      colors: p && p.colors ? p.colors : [{ name:'مشکی', hex:'#1f2937' }],
      specs: p && p.specs ? p.specs : []
    };

    var previewCode = p && p.sku ? p.sku : 'به‌طور خودکار ساخته می‌شود';
    var ic = window.ic || function(){ return ''; };

    var headHTML = ''
      + '<div class="adm-modal-head">'
      +   '<div style="display:flex;align-items:center;gap:12px;flex:1">'
      +     '<div class="aps-head-icon">' + ic('box', 22) + '</div>'
      +     '<div>'
      +       '<h3 style="margin:0;font-size:16px;font-weight:800">' + (id ? 'ویرایش محصول' : 'افزودن محصول جدید') + '</h3>'
      +       '<div style="font-size:11.5px;color:var(--adm-muted)">' + (id ? '#' + id : 'New Product') + '</div>'
      +     '</div>'
      +   '</div>'
      +   '<button class="adm-iconbtn-sm" data-close type="button">' + ic('x', 18) + '</button>'
      + '</div>';

    var tabsHTML = ''
      + '<div class="adm-prod-tabs-v2">'
      +   '<button class="aps-tab is-active" data-ptab="general" type="button">' + ic('file', 15) + '<span>اطلاعات اصلی</span></button>'
      +   '<button class="aps-tab" data-ptab="pricing" type="button">' + ic('wallet', 15) + '<span>قیمت و انبار</span></button>'
      +   '<button class="aps-tab" data-ptab="media" type="button">' + ic('image', 15) + '<span>تصاویر</span></button>'
      +   '<button class="aps-tab" data-ptab="variants" type="button">' + ic('layers', 15) + '<span>رنگ و سایز</span></button>'
      +   '<button class="aps-tab" data-ptab="specs" type="button">' + ic('grid', 15) + '<span>مشخصات</span></button>'
      + '</div>';

    var footHTML = ''
      + '<div class="adm-modal-foot">'
      +   (id ? '<button class="adm-btn danger" id="slDelBtn" type="button">' + ic('trash', 15) + ' حذف</button>' : '')
      +   '<button class="adm-btn outline" data-close type="button">انصراف</button>'
      +   '<button class="adm-btn primary" id="slSaveBtn" type="button">' + (id ? 'ذخیره' : 'افزودن محصول') + '</button>'
      + '</div>';

    openModal(headHTML + tabsHTML + '<div class="adm-prod-body-v2" id="slProdBody"></div>' + footHTML);

    var sheet = getModalBox();
    var body = sheet.querySelector('#slProdBody');

    function catOptions(sel){
      var out = '<option value="">— انتخاب کنید —</option>';
      cats.forEach(function(c){
        var val = c.slug || String(c.id);
        var s = val === sel ? ' selected' : '';
        out += '<option value="' + esc(val) + '"' + s + '>' + esc(c.name) + '</option>';
      });
      return out;
    }

    function tabGeneral(){
      return ''
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('file', 16) + '</span><h4>اطلاعات اصلی</h4></div>'
        +   '<div class="aps-grid">'
        +     '<div class="aps-field aps-field-wide"><label>نام محصول <span class="req">*</span></label><input class="adm-input" data-f="name" value="' + esc(F.name) + '" placeholder="مثال: گوشی سامسونگ A54" data-autofocus></div>'
        +     '<div class="aps-field"><label>کد محصول</label><div class="aps-code-preview">' + ic('hash', 14) + '<span>' + esc(previewCode) + '</span></div></div>'
        +     '<div class="aps-field"><label>برند <span class="req">*</span></label><input class="adm-input" data-f="brand" value="' + esc(F.brand) + '"></div>'
        +     '<div class="aps-field"><label>دسته <span class="req">*</span></label><select class="adm-select" data-f="category">' + catOptions(F.category) + '</select></div>'
        +   '</div>'
        +   '<div class="aps-field aps-field-wide" style="margin-top:14px"><label>توضیح کوتاه</label><input class="adm-input" data-f="shortDescription" maxlength="320" value="' + esc(F.shortDescription) + '"></div>'
        +   '<div class="aps-field aps-field-wide" style="margin-top:14px"><label>توضیحات کامل</label><textarea class="adm-textarea" data-f="description" rows="4">' + esc(F.description) + '</textarea></div>'
        +   '<div class="aps-toggle-row"><label class="aps-toggle"><input type="checkbox" data-f="isActive" ' + (F.isActive ? 'checked' : '') + '><span class="aps-toggle-track"></span><span class="aps-toggle-label">' + (F.isActive ? 'منتشر شده' : 'پیش‌نویس') + '</span></label></div>'
        + '</div>';
    }

    function tabPricing(){
      var priceVal = F.price ? fmt(F.price) : '';
      var offVal = F.off || 0;
      var fp = Math.round((Number(F.price) || 0) * (1 - offVal / 100) / 1000) * 1000;
      var fpWords = fp > 0 ? numToWordsFa(fp) : '';
      var fpFormatted = fp > 0 ? fmt(fp) : '0';

      return ''
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('wallet', 16) + '</span><h4>قیمت</h4></div>'
        +   '<div class="aps-grid">'
        +     '<div class="aps-field"><label>قیمت فروش (ریال) <span class="req">*</span></label>'
        +       '<input class="adm-input sl-num" data-f="price" inputmode="numeric" value="' + priceVal + '" placeholder="0" data-autofocus>'
        +       '<div class="sl-price-words" id="slPriceWords">' + (F.price ? numToWordsFa(F.price) + ' ریال' : '') + '</div>'
        +     '</div>'
        +     '<div class="aps-field"><label>درصد تخفیف (٪)</label>'
        +       '<input class="adm-input" data-f="off" inputmode="numeric" value="' + offVal + '" placeholder="0" max="90">'
        +       '<div class="aps-hint">۰ تا ۹۰</div>'
        +     '</div>'
        +   '</div>'
        +   '<div class="sl-final-box">'
        +     '<div class="sl-final-label">قیمت نهایی پس از تخفیف</div>'
        +     '<div class="sl-final-value">'
        +       '<b id="slFinalNum">' + fa(fp) + '</b> <small>ریال</small>'
        +     '</div>'
        +     '<div class="sl-final-words" id="slFinalWords">' + (fpWords ? fpWords + ' ریال' : '') + '</div>'
        +   '</div>'
        + '</div>'
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('box', 16) + '</span><h4>انبار</h4></div>'
        +   '<div class="aps-grid">'
        +     '<div class="aps-field"><label>موجودی <span class="req">*</span></label><input class="adm-input" data-f="stock" inputmode="numeric" value="' + F.stock + '"></div>'
        +     '<div class="aps-field"><label>حداقل موجودی</label><input class="adm-input" data-f="minStock" inputmode="numeric" value="' + F.minStock + '"></div>'
        +     '<div class="aps-field"><label>وزن (گرم)</label><input class="adm-input" data-f="weight" inputmode="numeric" value="' + F.weight + '"></div>'
        +     '<div class="aps-field"><label>ابعاد</label><input class="adm-input" data-f="dimensions" dir="ltr" value="' + esc(F.dimensions) + '"></div>'
        +     '<div class="aps-field aps-field-wide"><label>گارانتی</label><input class="adm-input" data-f="warranty" value="' + esc(F.warranty) + '"></div>'
        +   '</div>'
        + '</div>';
    }

    function tabMedia(){
      return ''
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('image', 16) + '</span><h4>تصاویر</h4><span class="aps-counter" id="slImgCount">' + fa(F.images.length) + '</span></div>'
        +   '<div id="slImgList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px;margin-bottom:12px"></div>'
        +   '<div class="aps-upload-row">'
        +     '<label class="aps-upload-btn" for="slFile" style="cursor:pointer">' + ic('upload', 16) + '<span>آپلود از دستگاه</span></label>'
        +     '<input type="file" id="slFile" accept="image/*" multiple style="display:none">'
        +     '<div class="aps-url-add"><input class="adm-input" id="slNewUrl" dir="ltr" placeholder="https://..."><button class="adm-btn outline" id="slAddUrl" type="button">افزودن با URL</button></div>'
        +   '</div>'
        + '</div>'
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('image', 16) + '</span><h4>ویدئو</h4></div>'
        +   '<div class="aps-field aps-field-wide"><input class="adm-input" data-f="videoUrl" dir="ltr" value="' + esc(F.videoUrl) + '" placeholder="https://..."></div>'
        + '</div>';
    }

    function tabVariants(){
      var colorRows = F.colors.map(function(c, i){
        return '<div style="display:grid;grid-template-columns:52px 1fr 36px;gap:10px;align-items:center;margin-bottom:8px">'
          + '<input type="color" value="' + esc(c.hex || '#94a3b8') + '" data-ch="' + i + '" style="width:52px;height:52px;border-radius:11px;border:1px solid var(--adm-border);cursor:pointer">'
          + '<input class="adm-input" value="' + esc(c.name || '') + '" data-cn="' + i + '" placeholder="نام رنگ">'
          + '<button type="button" data-cd="' + i + '" class="aps-row-del">×</button>'
          + '</div>';
      }).join('');
      var sizeChips = F.sizes.map(function(s, i){
        return '<span class="aps-size-chip"><input value="' + esc(s) + '" data-sz="' + i + '"><button type="button" data-szd="' + i + '">×</button></span>';
      }).join('');
      return ''
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('layers', 16) + '</span><h4>رنگ‌ها</h4></div>'
        +   '<div>' + colorRows + '</div>'
        +   '<button class="aps-add-btn" id="slAddColor" type="button" style="margin-top:8px">+ افزودن رنگ</button>'
        + '</div>'
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('layers', 16) + '</span><h4>سایزها</h4></div>'
        +   '<div class="aps-size-list">' + sizeChips + '</div>'
        +   '<div class="aps-inline-add" style="margin-top:12px"><input class="adm-input" id="slNewSize" placeholder="مثلاً XL"><button class="adm-btn outline" id="slAddSize" type="button">افزودن</button></div>'
        + '</div>';
    }

    function tabSpecs(){
      var specRows = F.specs.map(function(s, i){
        return '<div style="display:grid;grid-template-columns:1fr 1fr 36px;gap:10px;margin-bottom:8px">'
          + '<input class="adm-input" value="' + esc(s.key || '') + '" data-sk="' + i + '" placeholder="کلید">'
          + '<input class="adm-input" value="' + esc(s.value || '') + '" data-sv="' + i + '" placeholder="مقدار">'
          + '<button type="button" data-sd="' + i + '" class="aps-row-del">×</button>'
          + '</div>';
      }).join('');
      var featRows = F.features.map(function(f, i){
        return '<div style="display:grid;grid-template-columns:32px 1fr 36px;gap:10px;align-items:center;margin-bottom:8px">'
          + '<span style="color:var(--adm-ok)">✓</span>'
          + '<input class="adm-input" value="' + esc(f) + '" data-ft="' + i + '">'
          + '<button type="button" data-ftd="' + i + '" class="aps-row-del">×</button>'
          + '</div>';
      }).join('');
      return ''
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('grid', 16) + '</span><h4>مشخصات فنی</h4></div>'
        +   '<div>' + specRows + '</div>'
        +   '<button class="aps-add-btn" id="slAddSpec" type="button" style="margin-top:8px">+ افزودن مشخصه</button>'
        + '</div>'
        + '<div class="aps-section">'
        +   '<div class="aps-section-head"><span class="aps-section-ic">' + ic('check', 16) + '</span><h4>ویژگی‌ها</h4></div>'
        +   '<div>' + featRows + '</div>'
        +   '<div class="aps-inline-add" style="margin-top:12px"><input class="adm-input" id="slNewFeat" placeholder="ویژگی جدید"><button class="adm-btn outline" id="slAddFeat" type="button">افزودن</button></div>'
        + '</div>';
    }

    function bindInputs(){
      body.querySelectorAll('[data-f]').forEach(function(el){
        var k = el.dataset.f;
        if(el.type === 'checkbox'){
          el.onchange = function(){
            F[k] = el.checked;
            if(k === 'isActive'){
              var lbl = el.closest('.aps-toggle');
              if(lbl){ var sp = lbl.querySelector('.aps-toggle-label'); if(sp) sp.textContent = el.checked ? 'منتشر شده' : 'پیش‌نویس'; }
            }
          };
        } else if(el.classList.contains('sl-num')){
          /* فیلد عددی با جداکننده سه‌رقمی */
          el.oninput = function(){
            var raw = toNum(el.value);
            F[k] = raw;
            var pos = el.selectionStart;
            var prevLen = el.value.length;
            el.value = raw ? fmt(Number(raw)) : '';
            var newLen = el.value.length;
            var newPos = pos + (newLen - prevLen);
            if(newPos < 0) newPos = 0;
            if(newPos > newLen) newPos = newLen;
            try{ el.setSelectionRange(newPos, newPos); }catch(e){}
            /* آپدیت باکس قیمت */
            updateFinalBox();
          };
        } else {
          el.oninput = function(){ F[k] = el.value; };
        }
      });
    }

    function updateFinalBox(){
      var priceEl = body.querySelector('[data-f="price"]');
      var offEl = body.querySelector('[data-f="off"]');
      var price = Number(toNum(priceEl ? priceEl.value : '')) || 0;
      var off = Math.min(90, Math.max(0, Number(toNum(offEl ? offEl.value : '')) || 0));
      var fp = Math.round(price * (1 - off / 100) / 1000) * 1000;

      var numEl = body.querySelector('#slFinalNum');
      var wordsEl = body.querySelector('#slFinalWords');
      var priceWordsEl = body.querySelector('#slPriceWords');

      if(numEl) numEl.textContent = faT(fp);
      if(wordsEl) wordsEl.textContent = fp > 0 ? numToWordsFa(fp) + ' ریال' : '';
      if(priceWordsEl) priceWordsEl.textContent = price > 0 ? numToWordsFa(price) + ' ریال' : '';
    }

    function paintTab(name){
      sheet.querySelectorAll('.aps-tab').forEach(function(t){ t.classList.toggle('is-active', t.dataset.ptab === name); });

      if(name === 'general'){
        body.innerHTML = tabGeneral();
        bindInputs();
      } else if(name === 'pricing'){
        body.innerHTML = tabPricing();
        bindInputs();
        /* event listener روی off */
        var offEl = body.querySelector('[data-f="off"]');
        if(offEl){
          offEl.addEventListener('input', updateFinalBox);
        }
        updateFinalBox();
      } else if(name === 'media'){
        body.innerHTML = tabMedia();
        bindInputs();
        renderImages();

        var fileInput = body.querySelector('#slFile');
        if(fileInput){
          fileInput.onchange = function(){
            var files = Array.prototype.slice.call(fileInput.files || []);
            fileInput.value = '';
            if(!files.length) return;
            files.forEach(function(f){
              var fd = new FormData();
              fd.append('image', f);
              var xhr = new XMLHttpRequest();
              xhr.open('POST', (window.__API_BASE__ || '/api') + '/upload/product-single', true);
              xhr.withCredentials = true;
              xhr.onload = function(){
                try{
                  var r = JSON.parse(xhr.responseText || '{}');
                  if(r.success){ F.images.push(r.url); renderImages(); }
                  else toast('خطا: ' + (r.message || 'آپلود ناموفق'), 'err');
                }catch(e){ toast('خطا در آپلود', 'err'); }
              };
              xhr.send(fd);
            });
          };
        }

        body.querySelector('#slAddUrl').onclick = function(){
          var i = body.querySelector('#slNewUrl');
          var u = (i.value || '').trim();
          if(!u){ toast('URL را وارد کنید.', 'warn'); return; }
          F.images.push(u); i.value = ''; renderImages();
        };
      } else if(name === 'variants'){
        body.innerHTML = tabVariants();
        bindInputs();
        bindVariants();
      } else if(name === 'specs'){
        body.innerHTML = tabSpecs();
        bindInputs();
        bindSpecs();
      }
    }

    function renderImages(){
      var list = body.querySelector('#slImgList');
      var cnt = body.querySelector('#slImgCount');
      if(!list) return;
      if(cnt) cnt.textContent = fa(F.images.length);
      if(!F.images.length){
        list.innerHTML = '<div style="padding:20px;grid-column:1/-1;text-align:center;color:var(--adm-muted);font-size:13px">هنوز تصویری اضافه نشده</div>';
        return;
      }
      list.innerHTML = F.images.map(function(u, i){
        var abs = window.__ASSET__ ? window.__ASSET__(u) : u;
        return '<div style="position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;border:1px solid var(--adm-border);background-image:url(' + JSON.stringify(abs) + ');background-size:cover;background-position:center">'
          + '<button type="button" data-di="' + i + '" style="position:absolute;top:6px;inset-inline-end:6px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:0;cursor:pointer">×</button>'
          + '</div>';
      }).join('');
      list.querySelectorAll('[data-di]').forEach(function(b){
        b.onclick = function(){ F.images.splice(+b.dataset.di, 1); renderImages(); };
      });
    }

    function bindVariants(){
      body.querySelectorAll('[data-ch]').forEach(function(el){ el.oninput = function(){ F.colors[+el.dataset.ch].hex = el.value; }; });
      body.querySelectorAll('[data-cn]').forEach(function(el){ el.oninput = function(){ F.colors[+el.dataset.cn].name = el.value; }; });
      body.querySelectorAll('[data-cd]').forEach(function(b){ b.onclick = function(){ F.colors.splice(+b.dataset.cd, 1); paintTab('variants'); }; });
      body.querySelectorAll('[data-sz]').forEach(function(el){ el.oninput = function(){ F.sizes[+el.dataset.sz] = el.value; }; });
      body.querySelectorAll('[data-szd]').forEach(function(b){ b.onclick = function(){ F.sizes.splice(+b.dataset.szd, 1); paintTab('variants'); }; });
      var ac = body.querySelector('#slAddColor');
      if(ac) ac.onclick = function(){ F.colors.push({ name:'', hex:'#94a3b8' }); paintTab('variants'); };
      var as = body.querySelector('#slAddSize');
      if(as) as.onclick = function(){ var v = body.querySelector('#slNewSize').value.trim(); if(!v) return; F.sizes.push(v); paintTab('variants'); };
    }

    function bindSpecs(){
      body.querySelectorAll('[data-sk]').forEach(function(el){ el.oninput = function(){ F.specs[+el.dataset.sk].key = el.value; }; });
      body.querySelectorAll('[data-sv]').forEach(function(el){ el.oninput = function(){ F.specs[+el.dataset.sv].value = el.value; }; });
      body.querySelectorAll('[data-sd]').forEach(function(b){ b.onclick = function(){ F.specs.splice(+b.dataset.sd, 1); paintTab('specs'); }; });
      body.querySelectorAll('[data-ft]').forEach(function(el){ el.oninput = function(){ F.features[+el.dataset.ft] = el.value; }; });
      body.querySelectorAll('[data-ftd]').forEach(function(b){ b.onclick = function(){ F.features.splice(+b.dataset.ftd, 1); paintTab('specs'); }; });
      var as = body.querySelector('#slAddSpec');
      if(as) as.onclick = function(){ F.specs.push({ key:'', value:'' }); paintTab('specs'); };
      var af = body.querySelector('#slAddFeat');
      if(af) af.onclick = function(){ var v = body.querySelector('#slNewFeat').value.trim(); if(!v) return; F.features.push(v); paintTab('specs'); };
    }

    sheet.querySelectorAll('[data-ptab]').forEach(function(t){
      t.onclick = function(){ paintTab(t.dataset.ptab); };
    });

    sheet.querySelectorAll('[data-close]').forEach(function(b){ b.onclick = closeModal; });

    /* delete */
    var delBtn = sheet.querySelector('#slDelBtn');
    if(delBtn && id){
      delBtn.onclick = async function(){
        var yes = await confirmDialog({ title:'حذف محصول', message:'این محصول حذف می‌شود. مطمئنید؟', confirmText:'حذف' });
        if(!yes) return;
        delBtn.disabled = true;
        try{
          await fetchAPI('/seller/products/' + id, 'DELETE');
          toast('محصول حذف شد.', 'ok');
          closeModal();
          if(window.__sellerProductsRefresh) window.__sellerProductsRefresh();
        }catch(e){ toast('خطا: ' + e.message, 'err'); delBtn.disabled = false; }
      };
    }

    /* save */
    var saveBtn = sheet.querySelector('#slSaveBtn');
    saveBtn.onclick = async function(){
      if(saveBtn.disabled) return;
      saveBtn.disabled = true;
      var old = saveBtn.textContent;
      saveBtn.textContent = 'در حال ذخیره...';
      try{
        sheet.querySelectorAll('[data-f]').forEach(function(el){
          var k = el.dataset.f;
          if(el.classList.contains('sl-num')){
            F[k] = toNum(el.value);
          } else {
            F[k] = el.type === 'checkbox' ? el.checked : el.value;
          }
        });
        var payload = {
          name: String(F.name || '').trim(),
          sku: String(F.sku || '').trim() || null,
          brand: String(F.brand || '').trim(),
          category: F.category,
          price: Number(toNum(F.price)) || 0,
          purchasePrice: 0,
          off: Math.min(90, Math.max(0, Number(toNum(F.off)) || 0)),
          stock: Number(toNum(F.stock)) || 0,
          minStock: Number(toNum(F.minStock)) || 0,
          weight: Number(toNum(F.weight)) || 0,
          dimensions: F.dimensions || '',
          art: F.art || 'book',
          description: F.description || '',
          shortDescription: F.shortDescription || '',
          videoUrl: F.videoUrl || '',
          warranty: F.warranty || '',
          metaTitle: F.metaTitle || '',
          metaDescription: F.metaDescription || '',
          images: (F.images || []).filter(function(u){ return u && String(u).trim(); }),
          features: (F.features || []).filter(function(x){ return x && String(x).trim(); }),
          sizes: (F.sizes || []).filter(function(x){ return x && String(x).trim(); }),
          colors: (F.colors || []).filter(function(c){ return c && c.name; }),
          specs: (F.specs || []).filter(function(s){ return s && s.key && s.value; }),
          isActive: !!F.isActive
        };
        if(payload.name.length < 2){ toast('نام محصول را وارد کنید.', 'warn'); throw new Error('v'); }
        if(!payload.brand){ toast('برند را وارد کنید.', 'warn'); throw new Error('v'); }
        if(!payload.category){ toast('دسته را انتخاب کنید.', 'warn'); throw new Error('v'); }
        if(!payload.price){ toast('قیمت را وارد کنید.', 'warn'); throw new Error('v'); }

        if(id){ await fetchAPI('/seller/products/' + id, 'PUT', payload); }
        else   { await fetchAPI('/seller/products', 'POST', payload); }
        toast(id ? 'محصول ذخیره شد.' : 'محصول اضافه شد.', 'ok');
        closeModal();
        if(window.__sellerProductsRefresh) window.__sellerProductsRefresh();
      }catch(e){
        if(e.message !== 'v'){
          console.error('[seller-save]', e);
          toast('خطا: ' + (e.message || 'نامشخص'), 'err');
        }
        saveBtn.disabled = false;
        saveBtn.textContent = old;
      }
    };

    paintTab('general');
  }

  /* ============== inject actions to table ============== */
  function injectActions(){
    var body = document.getElementById('prBody');
    if(!body) return;
    var table = body.closest('table');
    if(!table) return;
    var thead = table.querySelector('thead tr');
    if(!thead) return;

    if(!thead.querySelector('[data-seller-actions]')){
      var th = document.createElement('th');
      th.className = 'col-actions';
      th.setAttribute('data-seller-actions', '1');
      th.textContent = 'عملیات';
      thead.appendChild(th);
    }

    var rows = body.querySelectorAll('tr[data-id]');
    rows.forEach(function(tr){
      if(tr.querySelector('[data-seller-actions-cell]')) return;
      var id = tr.getAttribute('data-id');
      if(!id) return;
      var td = document.createElement('td');
      td.className = 'col-actions';
      td.setAttribute('data-seller-actions-cell', '1');
      td.innerHTML = '<div class="adm-tbl-actions">'
        + '<button class="adm-iconbtn-sm" data-sl-edit="' + id + '" title="ویرایش">✎</button>'
        + '<button class="adm-iconbtn-sm" data-sl-toggle="' + id + '" title="فعال/غیرفعال">⚡</button>'
        + '<button class="adm-iconbtn-sm danger" data-sl-del="' + id + '" title="حذف">🗑</button>'
        + '</div>';
      tr.appendChild(td);
      td.querySelector('[data-sl-edit]').onclick = function(){ openProductForm(+id); };
      td.querySelector('[data-sl-toggle]').onclick = async function(){
        try{ await fetchAPI('/seller/products/' + id + '/toggle', 'PATCH'); toast('وضعیت تغییر کرد.', 'ok'); if(window.__sellerProductsRefresh) window.__sellerProductsRefresh(); }
        catch(e){ toast(e.message, 'err'); }
      };
      td.querySelector('[data-sl-del]').onclick = async function(){
        var yes = await confirmDialog({ title:'حذف محصول', message:'مطمئنید؟', confirmText:'حذف' });
        if(!yes) return;
        try{ var r = await fetchAPI('/seller/products/' + id, 'DELETE'); toast(r.message || 'حذف شد.', 'ok'); if(window.__sellerProductsRefresh) window.__sellerProductsRefresh(); }
        catch(e){ toast(e.message, 'err'); }
      };
    });
  }

  function injectAddButton(){
    var addBtn = document.getElementById('sl-add-product-btn');
    if(addBtn) return;
    var secHead = document.querySelector('.adm-content .adm-sec-head');
    if(!secHead) return;
    var h2 = secHead.querySelector('h2');
    if(!h2 || h2.textContent.indexOf('محصولات من') === -1) return;
    var actions = secHead.querySelector('.adm-sec-actions');
    if(!actions){ actions = document.createElement('div'); actions.className = 'adm-sec-actions'; secHead.appendChild(actions); }
    var btn = document.createElement('button');
    btn.id = 'sl-add-product-btn';
    btn.type = 'button';
    btn.className = 'adm-btn primary';
    btn.innerHTML = '+ افزودن محصول';
    btn.onclick = function(){ openProductForm(null); };
    actions.appendChild(btn);
  }

  var mo = new MutationObserver(function(){
    setTimeout(function(){ injectAddButton(); injectActions(); }, 100);
    setTimeout(function(){ injectAddButton(); injectActions(); }, 400);
  });
  function start(){
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function(){ injectAddButton(); injectActions(); }, 500);
    setTimeout(function(){ injectAddButton(); injectActions(); }, 1500);
    setTimeout(function(){ injectAddButton(); injectActions(); }, 3000);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  console.log('[seller-products-ui-v2] ready');
})();