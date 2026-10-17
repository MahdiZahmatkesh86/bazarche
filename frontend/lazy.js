(function(){
  'use strict';
  if(!('IntersectionObserver' in window)) return;

  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      var img = e.target;
      if(img.dataset && img.dataset.src){
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
      obs.unobserve(img);
    });
  }, { rootMargin: '200px' });

  function bind(){
    var list = document.querySelectorAll('img[data-src]');
    for(var i = 0; i < list.length; i++) obs.observe(list[i]);
  }

  window.__lazyBind = bind;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  /* MutationObserver فقط روی #grid و #offers با debounce */
  var debounceTimer = null;
  function scheduleBind(){
    if(debounceTimer) return;
    debounceTimer = setTimeout(function(){
      debounceTimer = null;
      bind();
    }, 300);
  }

  var mo = new MutationObserver(scheduleBind);
  var observed = new WeakSet();

  function observeTargets(){
    ['grid', 'offers', 'pmPanel', 'catTiles'].forEach(function(id){
      var el = document.getElementById(id);
      if(el && !observed.has(el)){
        observed.add(el);
        mo.observe(el, { childList: true, subtree: true });
      }
    });
  }

  /* تلاش اولیه + یک بار بعد از تأخیر کوتاه (برای زمانی که JS محتوا رو می‌سازه) */
  setTimeout(observeTargets, 500);
  setTimeout(observeTargets, 3000);
})();
