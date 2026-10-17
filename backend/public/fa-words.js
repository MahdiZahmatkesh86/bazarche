/* ============================================================
   fa-words.js — Persian number utilities
   - تبدیل عدد به حروف فارسی
   - جداکنندهٔ سه‌رقمی
   - تقویت خودکار فیلدهای قیمت (بدون نیاز به تغییر HTML)
   ============================================================ */
(function(){
  'use strict';
  if(window.__FA_WORDS__) return;
  window.__FA_WORDS__ = true;

  var YEKAN  = ['','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه'];
  var DAHGAN = ['','','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود'];
  var DAH    = ['ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده'];
  var SADGAN = ['','صد','دویست','سیصد','چهارصد','پانصد','ششصد','هفتصد','هشتصد','نهصد'];
  var SCALES = ['','هزار','میلیون','میلیارد','تریلیون','کوادریلیون'];

  function threeDigit(n){
    var parts = [];
    var s = Math.floor(n / 100);
    var remain = n % 100;
    if(s > 0) parts.push(SADGAN[s]);
    if(remain >= 10 && remain < 20){
      parts.push(DAH[remain - 10]);
    } else {
      var d = Math.floor(remain / 10);
      var y = remain % 10;
      if(d > 0) parts.push(DAHGAN[d]);
      if(y > 0) parts.push(YEKAN[y]);
    }
    return parts.join(' و ');
  }

  function numberToPersianWords(num){
    num = Math.floor(Math.abs(Number(num) || 0));
    if(num === 0) return 'صفر';
    var groups = [];
    var n = num;
    var scaleIdx = 0;
    while(n > 0){
      var chunk = n % 1000;
      if(chunk > 0){
        if(chunk === 1 && scaleIdx > 0){
          groups.unshift(SCALES[scaleIdx]);
        } else {
          var cw = threeDigit(chunk);
          groups.unshift(cw + (SCALES[scaleIdx] ? ' ' + SCALES[scaleIdx] : ''));
        }
      }
      n = Math.floor(n / 1000);
      scaleIdx++;
    }
    return groups.join(' و ');
  }

  function formatNum(n){
    var s = String(Math.floor(Math.abs(Number(n) || 0)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function parseNum(s){
    return Number(String(s || '').replace(/[^\d]/g, '')) || 0;
  }

  window.__faWords = numberToPersianWords;
  window.__faNum   = formatNum;
  window.__faParse = parseNum;

  /* ---------- تقویت خودکار فیلدهای قیمت ---------- */
  var SELECTORS = [
    'input[data-f="price"]',
    'input[data-f="purchasePrice"]',
    'input#refAmount',
    'input#ordShip',
    'input#ordTax',
    'input#ordDisc'
  ];

  function enhanceInput(input){
    if(!input || input.__priceEnhanced) return;
    var t = (input.type || '').toLowerCase();
    if(t === 'checkbox' || t === 'radio' || t === 'file' || t === 'range') return;
    input.__priceEnhanced = true;

    /* عنصر حروف */
    var words = document.createElement('div');
    words.className = '__price-words';
    words.style.cssText = 'margin-top:6px;font-size:11.5px;font-weight:600;color:#64748b;line-height:1.6;direction:rtl;text-align:right;';

    input.insertAdjacentElement('afterend', words);

    function updateWords(){
      var n = parseNum(input.value);
      words.textContent = n > 0 ? numberToPersianWords(n) + ' ریال' : '';
    }

    function onInput(){
      var raw = input.value.replace(/[^\d]/g, '');
      var formatted = raw ? formatNum(raw) : '';
      if(input.value !== formatted){
        var pos = input.selectionStart || 0;
        var oldLen = input.value.length;
        input.value = formatted;
        var delta = formatted.length - oldLen;
        var newPos = Math.max(0, Math.min(formatted.length, pos + delta));
        try { input.setSelectionRange(newPos, newPos); } catch(e){}
      }
      updateWords();
    }

    input.addEventListener('input', onInput);
    input.addEventListener('blur', updateWords);
    updateWords();
  }

  function enhanceAll(){
    for(var i = 0; i < SELECTORS.length; i++){
      var nodes = document.querySelectorAll(SELECTORS[i]);
      for(var j = 0; j < nodes.length; j++){
        try { enhanceInput(nodes[j]); } catch(e){ /* ignore */ }
      }
    }
  }

  /* run on load */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', enhanceAll);
  } else {
    enhanceAll();
  }

  /* observer برای فیلدهای پویا (مودالها) */
  function startObserver(){
    if(!document.body) return;
    var observer = new MutationObserver(function(){
      setTimeout(enhanceAll, 30);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if(document.body){
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }

  window.__enhancePriceInputs = enhanceAll;
})();
