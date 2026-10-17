(()=>{
'use strict';

const API = window.__API_BASE__ || '/api';

/* __UPLOAD_HELPERS__ */
const API_ORIGIN = API.replace('/api','');
function toAbsUrl(u){ return window.__ASSET__ ? window.__ASSET__(u) : u; }
async function uploadProductImage(file, onProgress){
  const fd = new FormData();
  fd.append('image', file);
  return new Promise(function(resolve, reject){
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/upload/product-single', true);
    xhr.withCredentials = true;
    if(onProgress) xhr.upload.onprogress = function(e){
      if(e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = function(){
      try{
        const r = JSON.parse(xhr.responseText || '{}');
        if(xhr.status >= 200 && xhr.status < 300 && r.success) resolve(r.url);
        else reject(new Error(r.message || ('HTTP ' + xhr.status)));
      }catch(e){ reject(e); }
    };
    xhr.onerror = function(){ reject(new Error('خطای شبکه')); };
    xhr.send(fd);
  });
}

/* __GLOBAL_UPLOAD_HANDLER__ */
(function setupGlobalUpload(){
  'use strict';

  /* single hidden input created once */
  let picker = document.getElementById('__globalImgPicker');
  if(!picker){
    picker = document.createElement('input');
    picker.type = 'file';
    picker.id = '__globalImgPicker';
    picker.accept = 'image/*';
    picker.multiple = true;
    picker.style.position = 'fixed';
    picker.style.left = '-9999px';
    picker.style.top = '-9999px';
    picker.style.opacity = '0';
    document.body.appendChild(picker);
  }

  let currentTarget = null;    /* element that opened the picker */
  let currentFRef = null;      /* the F object of the open form */
  let currentRepaint = null;   /* repaint function to call */
  let currentToastArea = null;

  /* listen for clicks anywhere */
  document.addEventListener('click', function(e){
    const btn = e.target.closest && e.target.closest('#uploadImgBtn');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    currentTarget = btn;

    /* find the F object + repaint function from the modal */
    currentFRef = window.__activeProductF || null;
    currentRepaint = window.__activeProductRepaint || null;

    if(!currentFRef){
      console.warn('[upload] no active product F reference');
    }

    picker.value = '';
    picker.click();
  }, true /* capture */);

  /* file selection */
  picker.addEventListener('change', async function(){
    const files = Array.from(picker.files || []);
    if(!files.length) return;

    if(!currentFRef){
      try{ toast('ابتدا فرم محصول را باز کنید.', 'warn'); }catch(_){}
      picker.value = '';
      return;
    }

    /* progress UI */
    let progressEl = document.getElementById('uploadProgress');
    let bar = progressEl && progressEl.querySelector('.adm-upload-bar i');
    let lbl = progressEl && progressEl.querySelector('.adm-upload-lbl');
    if(progressEl) progressEl.hidden = false;

    let done = 0;
    const total = files.length;

    for(let i = 0; i < files.length; i++){
      const f = files[i];
      if(f.size > 5 * 1024 * 1024){
        try{ toast('«' + f.name + '» بیش از ۵ مگابایت است.', 'warn'); }catch(_){}
        done++;
        continue;
      }
      try{
        if(lbl) lbl.textContent = 'در حال آپلود ' + (done+1) + ' از ' + total + '...';
        const url = await uploadProductImage(f, function(p){
          if(bar) bar.style.width = p + '%';
        });
        if(!Array.isArray(currentFRef.images)) currentFRef.images = [];
        currentFRef.images.push(url);
        if(typeof window.__activeProductRepaint === 'function') window.__activeProductRepaint();
        done++;
      }catch(err){
        console.error('[upload] error:', err);
        try{ toast('خطا در «' + f.name + '»: ' + (err.message || 'نامشخص'), 'err', 5000); }catch(_){}
        done++;
      }
    }

    if(progressEl) progressEl.hidden = true;
    if(bar) bar.style.width = '0%';
    if(done > 0){
      try{ toast(done + ' تصویر آپلود شد. یادت نره ذخیره کنی.', 'ok', 4500); }catch(_){}
    }
    picker.value = '';
    currentFRef = null;
    currentRepaint = null;
  });
})();




/* ---------- helpers ---------- */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const fa = n => Number(n||0).toLocaleString('fa-IR');
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toEn = s => String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const getStore = (k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const setStore = (k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};

/* ---------- icons ---------- */
const ICONS = {
  dashboard:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  box:'<path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3.1-6 7-6s7 2.5 7 6"/><path d="M17 4a3.5 3.5 0 0 1 0 7M22 21c0-3-2-5.3-5-5.9"/>',
  star:'<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun:'<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7M21 4v6h-6"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  external:'<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  chevdown:'<path d="M6 9l6 6 6-6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  eye:'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  toggleOn:'<rect x="2" y="6" width="20" height="12" rx="6" fill="currentColor"/><circle cx="17" cy="12" r="4" fill="#fff"/>',
  toggleOff:'<rect x="2" y="6" width="20" height="12" rx="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="12" r="3" fill="currentColor"/>',
  wallet:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 14h.01"/>',
  sparkles:'<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sliders:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="9" cy="18" r="2" fill="currentColor"/>',
  festival:'<path d="M12 2l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16l-5.4 2.8 1-6.1L3.2 8.4l6.1-.9z"/>',
  file:'<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M3 15l5-5 6 6 3-3 4 4"/>',
  layers:'<path d="M12 2L2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  
  trend:'<path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/>'
};
const ic=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||''}</svg>`;

const hydrateIcons = (root=document)=>{
  $$('[data-ic]',root).forEach(e=>{
    const name=e.dataset.ic;
    if(ICONS[name]) e.innerHTML = ic(name, e.dataset.s||20).replace('<svg class="ic"','<svg');
  });
};

/* ---------- API client ---------- */
let currentUser = null;
async function api(path,opts={}){
  const res = await fetch(API+path,{
    credentials:'include',
    headers:{'Content-Type':'application/json',...(opts.headers||{})},
    ...opts
  });
  let data = null;
  try{ data = await res.json(); }catch(e){ data = { success:false, message:'پاسخ نامعتبر' }; }

  if(res.status === 401){
    currentUser = null;
    showBoot('نشست شما منقضی شده است. در حال انتقال به صفحه‌ی اصلی...');
    setTimeout(()=>{ location.href = 'index.html'; }, 1200);
    throw new Error('unauthenticated');
  }
  if(res.status === 403){
    toast('شما دسترسی ادمین ندارید.', 'err');
    throw new Error(data.message || 'forbidden');
  }
  if(!res.ok) throw new Error(data.message || ('HTTP ' + res.status));
  return data;
}
const apiGet   = p      => api(p);
const apiPost  = (p,b)  => api(p,{method:'POST',body:JSON.stringify(b||{})});
const apiPut   = (p,b)  => api(p,{method:'PUT',body:JSON.stringify(b||{})});
const apiPatch = (p,b)  => api(p,{method:'PATCH',body:JSON.stringify(b||{})});
const apiDel   = p      => api(p,{method:'DELETE'});

/* ---------- state ---------- */
const state = {
  page:'dashboard',
  categories:[],
  refresh:null,
  theme: getStore('bz.adm.theme','light')
};
document.documentElement.dataset.admTheme = state.theme;

/* ---------- toast ---------- */
function toast(msg,type='info',dur=3200){
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'adm-toast ' + (type==='ok'?'ok':type==='err'?'err':type==='warn'?'warn':'');
  const iconName = type==='ok'?'check':type==='err'?'x':type==='warn'?'x':'check';
  el.innerHTML = `
    <div class="adm-toast-ic">${ic(iconName,18)}</div>
    <div class="adm-toast-msg">${esc(msg)}</div>
    <button class="adm-toast-x" type="button" aria-label="بستن">${ic('x',16)}</button>
  `;
  const remove = ()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),200); };
  el.querySelector('.adm-toast-x').addEventListener('click',remove);
  box.appendChild(el);
  setTimeout(remove,dur);
}

/* ---------- modal ---------- */
let modalLastFocus = null;
function openModal(html){
  const m = $('#modal');
  modalLastFocus = document.activeElement;
  $('#modalBox').innerHTML = html;
  m.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  const focusEl = $('#modalBox').querySelector('[data-autofocus]');
  if(focusEl) setTimeout(()=>focusEl.focus(),40);
}
function closeModal(){
  /* __CLEAR_ACTIVE_F_ON_CLOSE__ */
  try{ window.__activeProductF = null; window.__activeProductRepaint = null; }catch(e){}
  $('#modal').hidden = true;
  $('#modalBox').innerHTML = '';
  document.documentElement.style.overflow = '';
  if(modalLastFocus && modalLastFocus.focus) modalLastFocus.focus();
}
$('#modal').addEventListener('click', e=>{
  if(e.target.dataset.close !== undefined) closeModal();
});

/* ---------- confirm ---------- */
function confirmDialog({title, message, confirmText='حذف', danger=true}){
  return new Promise(resolve=>{
    const c = $('#confirmModal');
    $('#confirmBox').innerHTML = `
      <div class="adm-confirm-in">
        <div class="adm-confirm-ic">${ic('trash',28)}</div>
        <h3>${esc(title)}</h3>
        <p>${esc(message)}</p>
      </div>
      <div class="adm-confirm-foot">
        <button class="adm-btn outline" data-confirm-cancel>انصراف</button>
        <button class="adm-btn ${danger?'danger':'primary'}" data-confirm-ok data-autofocus>${esc(confirmText)}</button>
      </div>
    `;
    c.hidden = false;
    const close = ok=>{ c.hidden = true; resolve(ok); };
    $('#confirmBox').querySelector('[data-confirm-ok]').onclick = ()=>close(true);
    $('#confirmBox').querySelector('[data-confirm-cancel]').onclick = ()=>close(false);
    c.querySelector('[data-confirm-close]').onclick = ()=>close(false);
  });
}

/* ---------- nav ---------- */
const PAGES = [
  { id:'dashboard',      group:'shop',     label:'داشبورد',           icon:'dashboard' },
  { id:'products',       group:'shop',     label:'محصولات',           icon:'box' },
  { id:'categories',     group:'shop',     label:'دسته‌بندی‌ها',         icon:'grid' },
  { id:'orders',         group:'shop',     label:'سفارش‌ها',          icon:'cart' },
  { id:'users',          group:'users',    label:'کاربران',           icon:'users' },
  { id:'reviews',        group:'users',    label:'نظرات',             icon:'star' },
  { id:'site_features',  group:'content',  label:'آیتم‌های فروشگاه',   icon:'sparkles' },{ id:'site_festivals', group:'content',  label:'جشنواره‌ها',         icon:'festival' },
  { id:'cms_banners',    group:'content',  label:'بنرها',              icon:'image' },
  { id:'cms_sliders',    group:'content',  label:'اسلایدر',            icon:'layers' },
  { id:'account',        group:'settings', label:'حساب من',           icon:'user' }
];

const GROUPS = [
  { id:'shop',     label:'فروشگاه',      icon:'bag' },
  { id:'users',    label:'کاربران',      icon:'users' },
  { id:'content',  label:'محتوا و ظاهر', icon:'layers' },
];
function renderNav(){
  const nav = $('#nav');
  let openGroups;
  try{ openGroups = JSON.parse(localStorage.getItem('bz.adm.groups') || 'null') || {}; }
  catch(e){ openGroups = {}; }

  const html = GROUPS.map(function(g){
    const items = PAGES.filter(function(p){ return p.group === g.id; });
    if(!items.length) return '';
    const isOpen = openGroups[g.id] !== false;
    return '<div class="adm-nav-group' + (isOpen ? ' is-open' : '') + '" data-group="' + g.id + '">' +
      '<button class="adm-nav-group-head" type="button" data-action="toggle-group" data-group="' + g.id + '">' +
        '<span class="adm-nav-ic" data-ic="' + g.icon + '"></span>' +
        '<span class="adm-nav-group-lbl">' + g.label + '</span>' +
        '<span class="adm-nav-group-arrow" data-ic="chevdown" data-s="14"></span>' +
      '</button>' +
      '<div class="adm-nav-group-items">' +
        items.map(function(p){
          return '<a class="adm-nav-it' + (state.page === p.id ? ' active' : '') + '" data-page="' + p.id + '" tabindex="0">' +
            '<span class="adm-nav-ic" data-ic="' + p.icon + '"></span>' +
            '<span>' + p.label + '</span>' +
          '</a>';
        }).join('') +
      '</div>' +
    '</div>';
  }).join('');

  nav.innerHTML = html;
  hydrateIcons(nav);

  nav.querySelectorAll('.adm-nav-it').forEach(function(el){
    el.onclick = function(){ go(el.dataset.page); };
    el.onkeydown = function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(el.dataset.page); } };
  });

  nav.querySelectorAll('[data-action="toggle-group"]').forEach(function(b){
    b.onclick = function(){
      var id = b.dataset.group;
      var group = nav.querySelector('[data-group="' + id + '"]');
      var isOpen = group.classList.toggle('is-open');
      try{
        var o = JSON.parse(localStorage.getItem('bz.adm.groups') || '{}');
        o[id] = isOpen;
        localStorage.setItem('bz.adm.groups', JSON.stringify(o));
      }catch(e){}
    };
  });
}

function go(page){
  state.page = page;
  $$('.adm-nav-it').forEach(el=>el.classList.toggle('active', el.dataset.page===page));
  closeSidebar();
  const P = PAGES.find(p=>p.id===page);
  $('#pageTitle').textContent = P ? P.label : '';
  $('#pageSub').textContent = '';
  const c = $('#content');
  c.innerHTML = '';
  if(page==='dashboard')  renderDashboard(c);
  else if(page==='products')   renderProducts(c);
  else if(page==='categories') renderCategories(c);
  else if(page==='orders')     renderOrders(c);
  else if(page==='users')      renderUsers(c);
  else if(page==='reviews')    renderReviews(c);
  else if(page==='site_features') renderSiteFeatures(c);
  else if(page==='site_festivals') renderSiteFestivals(c);
  else if(page==='cms_banners') renderCmsBanners(c);
  else if(page==='cms_sliders') renderCmsSliders(c);
  else if(page==='account')    renderAccount(c);
}

/* ---------- sidebar (mobile) ---------- */
function openSidebar(){ $('#sidebar').classList.add('open'); $('#sideScrim').hidden = false; }
function closeSidebar(){ $('#sidebar').classList.remove('open'); $('#sideScrim').hidden = true; }
$('#menuBtn').onclick = openSidebar;
$('#sideScrim').onclick = closeSidebar;

/* ---------- theme ---------- */
$('#themeBtn').onclick = ()=>{
  state.theme = state.theme==='dark' ? 'light' : 'dark';
  document.documentElement.dataset.admTheme = state.theme;
  setStore('bz.adm.theme', state.theme);
};

/* ---------- refresh ---------- */
$('#refreshBtn').onclick = ()=>{ if(state.refresh) state.refresh(); };

/* ---------- user menu ---------- */
const chip = $('#userChip');
chip.addEventListener('click', e=>{
  if(e.target.closest('[data-user-menu]')) return;
  const m = $('#userMenu');
  m.hidden = !m.hidden;
  chip.classList.toggle('open', !m.hidden);
});
chip.addEventListener('keydown', e=>{
  if(e.key==='Enter' || e.key===' '){ e.preventDefault(); chip.click(); }
});
document.addEventListener('click', e=>{
  if(!e.target.closest('#userChip')){ $('#userMenu').hidden = true; chip.classList.remove('open'); }
});
$('#userMenu').addEventListener('click', async e=>{
  const btn = e.target.closest('[data-user-menu]');
  if(!btn) return;
  const a = btn.dataset.userMenu;
  $('#userMenu').hidden = true; chip.classList.remove('open');
  if(a==='account') go('account');
  else if(a==='site') window.open('index.html','_blank');
  else if(a==='logout'){
    const ok = await confirmDialog({title:'خروج از حساب', message:'مطمئنید می‌خواهید خارج شوید؟', confirmText:'خروج'});
    if(!ok) return;
    try{ await apiPost('/auth/logout'); }catch(_){}
    location.href = 'index.html';
  }
});

/* ---------- boot ---------- */
function showBoot(msg){
  const b = $('#bootLoader');
  b.hidden = false;
  $('#app').hidden = true;
  if(msg) $('#bootMsg').textContent = msg;
}

/* ================================================================
   PAGE: Dashboard
   ================================================================ */
async function renderDashboard(root){
  root.innerHTML = `
    <div class="adm-dash-loading">
      <div class="adm-sk" style="height:120px;border-radius:18px;margin-bottom:14px"></div>
      <div class="adm-sk" style="height:80px;border-radius:16px;margin-bottom:14px"></div>
      <div class="adm-sk" style="height:260px;border-radius:18px"></div>
    </div>
  `;

  let d = null;
  try{
    d = await apiGet('/orders/admin/full-dashboard');
  }catch(e){
    root.innerHTML = '<div class="adm-empty" style="padding:60px 20px">'
      + '<div class="adm-empty-ic">'
      + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
      + '</div>'
      + '<h3>خطا در بارگذاری داشبورد</h3>'
      + '<p>' + esc(e.message || 'نامشخص') + '</p>'
      + '<button class="adm-btn primary" onclick="location.reload()">تلاش دوباره</button>'
      + '</div>';
    return;
  }

  const num = function(n){ return fa(Math.round(Number(n)||0)); };
  const money = function(n){ return fa(Math.round(Number(n)||0)) + ' <small>تومان</small>'; };

  const STATUS_LABELS = {
    pending:'در انتظار پرداخت', paid:'پرداخت‌شده', processing:'در حال پردازش',
    shipped:'ارسال‌شده', delivered:'تحویل‌شده',
    cancelled:'لغو‌شده', refunded:'مرجوعی'
  };
  const STATUS_CLS = {
    pending:'warn', paid:'info', processing:'info', shipped:'brand',
    delivered:'ok', cancelled:'danger', refunded:'danger'
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('fa-IR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const hour = now.getHours();
  const greet = hour < 12 ? 'صبح بخیر' : hour < 17 ? 'وقت بخیر' : 'شب بخیر';

  /* ---------- Hero ---------- */
  const greetHTML = `
    <div class="adm-dash-hero">
      <div class="adm-dash-hero-bg"></div>
      <div class="adm-dash-hero-body">
        <div class="adm-dash-hero-txt">
          <span class="adm-dash-eyebrow">داشبورد مدیریت</span>
          <h2>${greet}، ${esc((currentUser && currentUser.name) ? currentUser.name : 'مدیر')} 👋</h2>
          <p class="adm-dash-hero-date">${esc(dateStr)}</p>
        </div>
        <div class="adm-dash-hero-quick">
          <a class="adm-quick-action" href="index.html" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            مشاهده سایت
          </a>
          <button class="adm-quick-action" data-dash-tab="products" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            افزودن محصول
          </button>
        </div>
      </div>
    </div>
  `;

  /* ---------- Alerts ---------- */
  let alertsHTML = '';
  if(d.alerts && d.alerts.length){
    const alertsInner = d.alerts.map(function(a){
      return '<div class="adm-dash-alert is-' + esc(a.type) + '">'
        + '<span class="adm-dash-alert-ic">' + ic(a.icon||'x',16) + '</span>'
        + '<span>' + esc(a.text) + '</span>'
        + '</div>';
    }).join('');
    alertsHTML = '<div class="adm-dash-alerts">' + alertsInner + '</div>';
  }

  /* ---------- KPI 1: Sales ---------- */
  const salesKPI = `
    <div class="adm-dash-section">
      <div class="adm-dash-sec-head">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/></svg>
          فروش
        </h3>
      </div>
      <div class="adm-kpi-grid is-4">
        <div class="adm-kpi is-sales">
          <div class="adm-kpi-top">
            <span class="adm-kpi-lbl">امروز</span>
            <span class="adm-kpi-chip">${num(d.today.orders)} سفارش</span>
          </div>
          <div class="adm-kpi-val">${money(d.today.revenue)}</div>
        </div>
        <div class="adm-kpi is-sales">
          <div class="adm-kpi-top">
            <span class="adm-kpi-lbl">۷ روز اخیر</span>
            <span class="adm-kpi-chip">${num(d.week.orders)} سفارش</span>
          </div>
          <div class="adm-kpi-val">${money(d.week.revenue)}</div>
        </div>
        <div class="adm-kpi is-sales">
          <div class="adm-kpi-top">
            <span class="adm-kpi-lbl">۳۰ روز اخیر</span>
            <span class="adm-kpi-chip">${num(d.month.orders)} سفارش</span>
          </div>
          <div class="adm-kpi-val">${money(d.month.revenue)}</div>
        </div>
        <div class="adm-kpi is-sales">
          <div class="adm-kpi-top">
            <span class="adm-kpi-lbl">امسال</span>
            <span class="adm-kpi-chip">${num(d.year.orders)} سفارش</span>
          </div>
          <div class="adm-kpi-val">${money(d.year.revenue)}</div>
        </div>
      </div>
    </div>
  `;

  /* ---------- KPI 2: Order statuses ---------- */
  const orderStatuses = ['pending','paid','processing','shipped','delivered','cancelled'];
  const ordersKPI = `
    <div class="adm-dash-section">
      <div class="adm-dash-sec-head">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/></svg>
          وضعیت سفارش‌ها
        </h3>
        <button class="adm-btn ghost sm" data-dash-tab="orders" type="button">مشاهده همه</button>
      </div>
      <div class="adm-kpi-grid is-6">
        ${orderStatuses.map(function(st){
          return '<div class="adm-kpi is-status" data-dash-tab="orders" role="button" tabindex="0">'
            + '<span class="adm-status-dot is-' + (STATUS_CLS[st]||'') + '"></span>'
            + '<div class="adm-kpi-lbl">' + STATUS_LABELS[st] + '</div>'
            + '<div class="adm-kpi-val-lg">' + num(d.statusCounts[st]||0) + '</div>'
            + '</div>';
        }).join('')}
      </div>
    </div>
  `;

  /* ---------- KPI 3: Finance + inventory ---------- */
  const finKPI = `
    <div class="adm-dash-section">
      <div class="adm-dash-sec-head">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>
          موجودی و مالی
        </h3>
      </div>
      <div class="adm-kpi-grid is-3">
        <div class="adm-kpi is-wallet">
          <div class="adm-kpi-head">
            <span class="adm-kpi-icon is-ok">${ic('wallet',18)}</span>
            <span class="adm-kpi-lbl">درآمد کل</span>
          </div>
          <div class="adm-kpi-val">${money(d.revenue)}</div>
          <div class="adm-kpi-sub">از سفارش‌های موفق</div>
        </div>
        <div class="adm-kpi is-wallet">
          <div class="adm-kpi-head">
            <span class="adm-kpi-icon is-warn">${ic('cart',18)}</span>
            <span class="adm-kpi-lbl">طلب از مشتریان</span>
          </div>
          <div class="adm-kpi-val">${money(d.pendingAmount)}</div>
          <div class="adm-kpi-sub">سفارش‌های در انتظار پرداخت</div>
        </div>
        <div class="adm-kpi is-wallet">
          <div class="adm-kpi-head">
            <span class="adm-kpi-icon is-info">${ic('users',18)}</span>
            <span class="adm-kpi-lbl">تعداد مشتریان</span>
          </div>
          <div class="adm-kpi-val-lg">${num(d.users)}</div>
          <div class="adm-kpi-sub">کاربران ثبت‌نام‌شده</div>
        </div>
      </div>

      <div class="adm-kpi-grid is-3" style="margin-top:14px">
        <div class="adm-kpi is-inv">
          <div class="adm-kpi-head">
            <span class="adm-kpi-icon is-brand">${ic('box',18)}</span>
            <span class="adm-kpi-lbl">کل محصولات</span>
          </div>
          <div class="adm-kpi-val-lg">${num(d.products.total)}</div>
        </div>
        <div class="adm-kpi is-inv">
          <div class="adm-kpi-head">
            <span class="adm-kpi-icon is-warn">${ic('trend',18)}</span>
            <span class="adm-kpi-lbl">موجودی کم</span>
          </div>
          <div class="adm-kpi-val-lg">${num(d.products.lowStock)}</div>
          <div class="adm-kpi-sub">کمتر از ۵ عدد</div>
        </div>
        <div class="adm-kpi is-inv">
          <div class="adm-kpi-head">
            <span class="adm-kpi-icon is-danger">${ic('x',18)}</span>
            <span class="adm-kpi-lbl">ناموجود</span>
          </div>
          <div class="adm-kpi-val-lg">${num(d.products.outOfStock)}</div>
          <div class="adm-kpi-sub">نیاز به تأمین</div>
        </div>
      </div>
    </div>
  `;

  /* ---------- Daily line chart ---------- */
  const dailyArr = d.chartDaily || [];
  let dailyMax = 1;
  dailyArr.forEach(function(it){ if(it.revenue > dailyMax) dailyMax = it.revenue; });

  const CW = 640, CH = 200, CP = 34;
  const steps = Math.max(1, dailyArr.length - 1);
  const stepX = (CW - CP*2) / steps;

  const dailyPoints = dailyArr.map(function(item, i){
    const px = CP + i * stepX;
    const py = CH - CP - (item.revenue / dailyMax) * (CH - CP*2 - 16);
    return { px: px, py: py, revenue: item.revenue, date: item.date };
  });

  let linePath = '';
  dailyPoints.forEach(function(p, i){
    linePath += (i===0 ? 'M' : 'L') + p.px + ' ' + p.py + ' ';
  });
  let areaPath = linePath;
  if(dailyPoints.length){
    areaPath += 'L ' + dailyPoints[dailyPoints.length-1].px + ' ' + (CH - CP) + ' ';
    areaPath += 'L ' + dailyPoints[0].px + ' ' + (CH - CP) + ' Z';
  }

  const shortDay = function(iso){
    const dt = new Date(iso);
    return ['ی','د','س','چ','پ','ج','ش'][dt.getDay()] || '?';
  };

  let dailyCircles = '';
  dailyPoints.forEach(function(p){
    dailyCircles += '<g>'
      + '<circle cx="' + p.px + '" cy="' + p.py + '" r="4.5" fill="var(--adm-surface)" stroke="var(--adm-brand)" stroke-width="2.5"/>'
      + '<text x="' + p.px + '" y="' + (CH - 12) + '" text-anchor="middle" font-size="11" fill="var(--adm-muted)" font-family="Vazirmatn" direction="rtl">' + esc(shortDay(p.date)) + '</text>'
      + '</g>';
  });

  let dailyTotal = 0;
  dailyArr.forEach(function(it){ dailyTotal += it.revenue; });

  const salesChartHTML = '<div class="adm-chart-card">'
    + '<div class="adm-chart-head">'
    + '<h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></svg> نمودار فروش ۷ روز اخیر</h3>'
    + '<span class="adm-chart-meta">مجموع: ' + money(dailyTotal) + '</span>'
    + '</div>'
    + '<div class="adm-chart-body">'
    + '<svg viewBox="0 0 640 200" class="adm-line-chart" preserveAspectRatio="none">'
    + '<defs><linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="var(--adm-brand)" stop-opacity="0.28"/>'
    + '<stop offset="1" stop-color="var(--adm-brand)" stop-opacity="0"/>'
    + '</linearGradient></defs>'
    + '<path d="' + areaPath + '" fill="url(#lineGrad)"/>'
    + '<path d="' + linePath + '" fill="none" stroke="var(--adm-brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
    + dailyCircles
    + '</svg></div></div>';

  /* ---------- Monthly bar chart ---------- */
  const monthlyArr = d.chartMonthly || [];
  let monthMax = 1;
  monthlyArr.forEach(function(it){ if(it.revenue > monthMax) monthMax = it.revenue; });

  const barW = 60, gap = 32, padX = 40, padY = 30;
  const monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

  let monthlyBarsHTML = '';
  monthlyArr.forEach(function(item, i){
    const bh = (item.revenue / monthMax) * (CH - padY*2);
    const bx = padX + i * (barW + gap);
    const by = CH - padY - bh;
    const mn = parseInt(item.month.split('-')[1], 10) - 1;
    const label = (monthNames[mn] || '?').slice(0, 4);
    monthlyBarsHTML += '<g>'
      + '<rect x="' + bx + '" y="' + by + '" width="' + barW + '" height="' + Math.max(2, bh) + '" rx="8" fill="url(#barGrad)"/>'
      + '<text x="' + (bx + barW/2) + '" y="' + (CH - 10) + '" text-anchor="middle" font-size="11" fill="var(--adm-muted)" font-family="Vazirmatn" direction="rtl">' + esc(label) + '</text>'
      + '</g>';
  });

  let monthTotal = 0;
  monthlyArr.forEach(function(it){ monthTotal += it.revenue; });

  const monthlyChartHTML = '<div class="adm-chart-card">'
    + '<div class="adm-chart-head">'
    + '<h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="8" width="7" height="13" rx="1"/></svg> نمودار فروش ۶ ماه اخیر</h3>'
    + '<span class="adm-chart-meta">مجموع: ' + money(monthTotal) + '</span>'
    + '</div>'
    + '<div class="adm-chart-body">'
    + '<svg viewBox="0 0 640 200" class="adm-bar-chart" preserveAspectRatio="none">'
    + '<defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="var(--adm-brand)"/>'
    + '<stop offset="1" stop-color="var(--adm-brand)" stop-opacity="0.55"/>'
    + '</linearGradient></defs>'
    + monthlyBarsHTML
    + '</svg></div></div>';

  /* ---------- Best sellers ---------- */
  let bestInner = '';
  if(d.bestSellers && d.bestSellers.length){
    bestInner = d.bestSellers.map(function(p, i){
      const rankCls = i < 3 ? ' is-top' : '';
      return '<div class="adm-best-item">'
        + '<span class="adm-best-rank' + rankCls + '">' + fa(i+1) + '</span>'
        + '<div class="adm-best-thumb">' + ic(p.art||'box',20) + '</div>'
        + '<div class="adm-best-info">'
        + '<b>' + esc(p.name) + '</b>'
        + '<span>' + esc(p.brand||'') + '</span>'
        + '</div>'
        + '<div class="adm-best-meta">'
        + '<div class="adm-best-sales">' + num(p.sales) + ' فروش</div>'
        + '<div class="adm-best-rev">' + money(p.revenue) + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
  }else{
    bestInner = '<div class="adm-empty" style="padding:40px 16px"><h3>محصولی موجود نیست</h3></div>';
  }

  const bestHTML = '<div class="adm-dash-panel">'
    + '<div class="adm-dash-panel-head">'
    + '<h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9z"/></svg> پرفروش‌ترین محصولات</h3>'
    + '<button class="adm-btn ghost sm" data-dash-tab="products" type="button">مشاهده محصولات</button>'
    + '</div>'
    + '<div class="adm-best-list">' + bestInner + '</div>'
    + '</div>';

  /* ---------- Latest orders ---------- */
  let latestInner = '';
  if(d.latestOrders && d.latestOrders.length){
    latestInner = d.latestOrders.map(function(o){
      const stLabel = STATUS_LABELS[o.status] || o.status;
      const stCls = STATUS_CLS[o.status] || '';
      return '<div class="adm-latest-item" data-dash-order="' + o.id + '">'
        + '<div class="adm-latest-ic">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/></svg>'
        + '</div>'
        + '<div class="adm-latest-info">'
        + '<b dir="ltr">' + esc(o.trackingCode) + '</b>'
        + '<span>' + esc(o.customer||'—') + '</span>'
        + '</div>'
        + '<div class="adm-latest-meta">'
        + '<div class="adm-latest-amt">' + money(o.total) + '</div>'
        + '<span class="adm-bdg ' + stCls + '">' + esc(stLabel) + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
  }else{
    latestInner = '<div class="adm-empty" style="padding:40px 16px"><h3>هنوز سفارشی ثبت نشده</h3></div>';
  }

  const latestHTML = '<div class="adm-dash-panel">'
    + '<div class="adm-dash-panel-head">'
    + '<h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> آخرین سفارش‌ها</h3>'
    + '<button class="adm-btn ghost sm" data-dash-tab="orders" type="button">همه سفارش‌ها</button>'
    + '</div>'
    + '<div class="adm-latest-list">' + latestInner + '</div>'
    + '</div>';

  /* ---------- Final render ---------- */
  root.innerHTML = greetHTML
    + alertsHTML
    + salesKPI
    + ordersKPI
    + finKPI
    + '<div class="adm-chart-grid">' + salesChartHTML + monthlyChartHTML + '</div>'
    + '<div class="adm-dash-cols">' + bestHTML + latestHTML + '</div>';

  /* ---------- Click handlers ---------- */
  root.querySelectorAll('[data-dash-tab]').forEach(function(b){
    b.addEventListener('click', function(){ go(b.dataset.dashTab); });
  });
  root.querySelectorAll('[data-dash-order]').forEach(function(b){
    b.addEventListener('click', function(){ go('orders'); });
  });
}

/* ================================================================
   PAGE: Products
   ================================================================ */
async function renderProducts(root){
  root.innerHTML = `
    <div class="adm-sec-head">
      <h2>محصولات</h2>
      <span class="adm-sec-sub" id="prodCount"></span>
      <div class="adm-sec-actions">
        <button class="adm-btn outline sm" id="prodRefresh" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v6h-6"/></svg>
          بروزرسانی
        </button>
        <button class="adm-btn primary" id="btnNewProd" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          افزودن محصول
        </button>
      </div>
    </div>

    <div class="adm-card">
      <div class="adm-toolbar adm-prod-toolbar">
        <div class="adm-search">
          <span class="adm-search-ic">${ic('search',18)}</span>
          <input id="prodQ" placeholder="جستجوی نام، SKU، برند..." autocomplete="off">
        </div>
        <select class="adm-select" id="prodCatFilter" style="max-width:180px">
          <option value="">همه دسته‌ها</option>
        </select>
        <select class="adm-select" id="prodStockFilter" style="max-width:180px">
          <option value="">همه موجودی‌ها</option>
          <option value="instock">موجود</option>
          <option value="low">موجودی کم</option>
          <option value="out">ناموجود</option>
        </select>
        <select class="adm-select" id="prodStatusFilter" style="max-width:170px">
          <option value="">همه وضعیت‌ها</option>
          <option value="1">فعال</option>
          <option value="0">غیرفعال</option>
        </select>
      </div>

      <div class="adm-tbl-wrap">
        <table class="adm-tbl adm-prod-tbl">
          <thead>
            <tr>
              <th>محصول</th>
              <th>SKU</th>
              <th>دسته</th>
              <th>قیمت فروش</th>
              <th>سود</th>
              <th>موجودی</th>
              <th>وضعیت</th>
              <th class="col-actions">عملیات</th>
            </tr>
          </thead>
          <tbody id="prodBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const body = root.querySelector('#prodBody');
  const cntEl = root.querySelector('#prodCount');
  let all = [];

  function paint(){
    const q = root.querySelector('#prodQ').value.trim().toLowerCase();
    const catF = root.querySelector('#prodCatFilter').value;
    const stF = root.querySelector('#prodStockFilter').value;
    const pubF = root.querySelector('#prodStatusFilter').value;

    const list = all.filter(function(p){
      if(q){
        const h = (p.name + ' ' + (p.sku||'') + ' ' + (p.brand||'')).toLowerCase();
        if(!h.includes(q)) return false;
      }
      if(catF && (p.category && (p.category.slug || String(p.category.id))) !== catF) return false;
      if(pubF !== '' && String(p.isActive ? 1 : 0) !== pubF) return false;
      if(stF === 'instock' && p.stock <= 0) return false;
      if(stF === 'low' && !(p.stock > 0 && p.stock <= (p.minStock||3))) return false;
      if(stF === 'out' && p.stock > 0) return false;
      return true;
    });

    cntEl.textContent = fa(list.length) + ' محصول';

    if(!list.length){
      body.innerHTML = '<tr><td colspan="8"><div class="adm-empty" style="padding:52px 16px">'
        + '<div class="adm-empty-ic">'
        + '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/></svg>'
        + '</div><h3>محصولی پیدا نشد</h3><p>فیلترها را تغییر دهید یا محصول جدیدی اضافه کنید.</p>'
        + '</div></td></tr>';
      return;
    }

    body.innerHTML = list.map(function(p){
      const mainColor = (p.colors && p.colors[0]) ? p.colors[0].hex : '#94a3b8';
      const finalPrice = p.finalPrice || Math.round(p.price*(1-(p.off||0)/100)/1000)*1000;
      const profit = (p.purchasePrice > 0) ? (p.price - p.purchasePrice) : null;
      const profitPct = profit !== null && p.purchasePrice > 0 ? Math.round((profit / p.purchasePrice) * 100) : null;

      let stockBadge;
      if(p.stock <= 0) stockBadge = '<span class="adm-bdg danger">ناموجود</span>';
      else if(p.stock <= (p.minStock||3)) stockBadge = '<span class="adm-bdg warn">' + fa(p.stock) + ' عدد (کم)</span>';
      else stockBadge = '<span class="adm-bdg ok">' + fa(p.stock) + ' عدد</span>';

      const pubBadge = p.isActive
        ? '<span class="adm-bdg ok">منتشرشده</span>'
        : '<span class="adm-bdg">پیش‌نویس</span>';

      const catName = p.category ? p.category.name : '—';
      const catColor = p.category ? (p.category.color || '#94a3b8') : '#94a3b8';

      const imgCount = (p.images && p.images.length) || 0;

      return '<tr data-prod-row="' + p.id + '">'
        + '<td><div class="adm-prod-row">'
        + '<div class="adm-prod-thumb" style="--tint:' + mainColor + ';position:relative;overflow:hidden">'
          + (window.__resolveCardImg(p) ? '<img src="' + window.__resolveCardImg(p) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">' : '')
          + '<span style="position:relative;z-index:0;display:grid;place-items:center;width:100%;height:100%">' + ic(p.art || 'box', 22) + '</span>'
        + '</div>'
        + '<div class="adm-prod-info">'
        + '<b>' + esc(p.name) + '</b>'
        + '<span>' + esc(p.brand || '') + (imgCount ? ' · ' + fa(imgCount) + ' تصویر' : '') + '</span>'
        + (imgCount ? '<div class="adm-prod-thumbs-row">' + (p.images || []).slice(0,4).map(function(u){ var abs = (window.__ASSET__ ? window.__ASSET__(u) : u); return '<span class="adm-mini-thumb"><img src="' + abs + '" alt=""></span>'; }).join('') + ((p.images && p.images.length > 4) ? '<span class="adm-more">+' + fa(p.images.length - 4) + '</span>' : '') + '</div>' : '')
        + '</div>'
        + '</div></td>'
        + '<td><code class="adm-sku">' + esc(p.sku || '—') + '</code></td>'
        + '<td><span class="adm-bdg" style="--c:' + catColor + '">'
        + '<i style="background:' + catColor + '"></i>' + esc(catName) + '</span></td>'
        + '<td><div class="adm-price-cell">'
        + (p.off > 0 ? '<s>' + fa(p.price) + '</s>' : '')
        + '<b>' + fa(finalPrice) + '</b>'
        + (p.off > 0 ? '<span class="adm-off-pct">-' + fa(p.off) + '٪</span>' : '')
        + '</div></td>'
        + '<td>'
        + (profit !== null
            ? '<div class="adm-profit"><b style="color:' + (profit > 0 ? 'var(--adm-ok)' : 'var(--adm-danger)') + '">' + fa(profit) + '</b>'
              + '<span>' + (profitPct !== null ? fa(profitPct) + '٪' : '') + '</span></div>'
            : '<span class="adm-hint">—</span>')
        + '</td>'
        + '<td>' + stockBadge + '</td>'
        + '<td>' + pubBadge + '</td>'
        + '<td class="col-actions"><div class="adm-tbl-actions">'
        + '<button class="adm-iconbtn-sm" data-view="' + p.id + '" title="مشاهده">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
        + '</button>'
        + '<button class="adm-iconbtn-sm" data-edit="' + p.id + '" title="ویرایش">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>'
        + '</button>'
        + '<button class="adm-iconbtn-sm" data-dup="' + p.id + '" title="کپی">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
        + '</button>'
        + '<button class="adm-iconbtn-sm" data-toggle="' + p.id + '" title="' + (p.isActive ? 'غیرفعال' : 'فعال') + '">'
        + (p.isActive
            ? '<svg width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="6" fill="currentColor"/><circle cx="17" cy="12" r="4" fill="#fff"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="7" cy="12" r="3" fill="currentColor"/></svg>')
        + '</button>'
        + '<button class="adm-iconbtn-sm danger" data-del="' + p.id + '" title="حذف">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
        + '</button>'
        + '</div></td>'
        + '</tr>';
    }).join('');

    body.querySelectorAll('[data-edit]').forEach(function(b){ b.onclick = function(){ openProductForm(+b.dataset.edit); }; });
    body.querySelectorAll('[data-view]').forEach(function(b){ b.onclick = function(){ openProductView(+b.dataset.view); }; });
    body.querySelectorAll('[data-dup]').forEach(function(b){ b.onclick = function(){ duplicateProd(+b.dataset.dup); }; });
    body.querySelectorAll('[data-toggle]').forEach(function(b){ b.onclick = function(){ toggleProd(+b.dataset.toggle); }; });
    body.querySelectorAll('[data-del]').forEach(function(b){ b.onclick = function(){ deleteProd(+b.dataset.del); }; });
  }

  async function load(){
    body.innerHTML = '<tr><td colspan="8"><div style="padding:32px;text-align:center;color:var(--adm-muted)">در حال بارگذاری...</div></td></tr>';
    try{
      const [prodRes, catRes] = await Promise.all([
        apiGet('/products?limit=1000&includeInactive=true'),
        apiGet('/categories')
      ]);
      all = prodRes.items || [];
      const cats = catRes.categories || [];
      state.categories = cats;
      const catSel = root.querySelector('#prodCatFilter');
      catSel.innerHTML = '<option value="">همه دسته‌ها</option>'
        + cats.map(function(c){ return '<option value="' + esc(c.slug || c.id) + '">' + esc(c.name) + '</option>'; }).join('');
      paint();
    }catch(e){
      body.innerHTML = '<tr><td colspan="8" style="padding:32px;text-align:center;color:var(--adm-danger)">' + esc(e.message) + '</td></tr>';
    }
  }

  let timer;
  ['prodQ'].forEach(function(id){
    root.querySelector('#' + id).addEventListener('input', function(){
      clearTimeout(timer); timer = setTimeout(paint, 250);
    });
  });
  ['prodCatFilter','prodStockFilter','prodStatusFilter'].forEach(function(id){
    root.querySelector('#' + id).addEventListener('change', paint);
  });
  root.querySelector('#prodRefresh').addEventListener('click', load);
  root.querySelector('#btnNewProd').addEventListener('click', function(){ openProductForm(null); });

  state.refresh = load;
  load();
}


/* ================================================================
   Product View Modal
   ================================================================ */
async function openProductView(id){
  let p = null;
  try{
    const r = await apiGet('/products/' + id);
    p = r.product;
    try{ window.__curPmAdminProduct = p; }catch(e){}
  }catch(e){ toast('خطا: ' + e.message, 'err'); return; }

  const money = n => fa(Math.round(Number(n)||0)) + ' تومان';
  const finalPrice = p.finalPrice || Math.round(p.price*(1-(p.off||0)/100)/1000)*1000;
  const profit = (p.purchasePrice > 0) ? (p.price - p.purchasePrice) : null;
  const profitPct = profit !== null && p.purchasePrice > 0 ? Math.round((profit / p.purchasePrice) * 100) : null;
  const marginPct = p.price > 0 && p.purchasePrice > 0 ? Math.round((profit / p.price) * 100) : null;

  const artLabels = {phone:'موبایل',laptop:'لپ‌تاپ',headphones:'هدفون',watch:'ساعت',speaker:'اسپیکر',camera:'دوربین',sneaker:'کفش',backpack:'کوله',hoodie:'هودی',kettle:'کتری',lamp:'چراغ',book:'کتاب'};
  const mainColor = (p.colors && p.colors[0]) ? p.colors[0].hex : '#94a3b8';

  const images = p.images || [];
  const features = p.features || [];
  const sizes = p.sizes || [];
  const colors = p.colors || [];
  const specs = p.specs || [];

  /* stock badge */
  let stockBadge, stockText;
  if(p.stock <= 0){ stockBadge = 'danger'; stockText = 'ناموجود'; }
  else if(p.stock <= (p.minStock||3)){ stockBadge = 'warn'; stockText = 'موجودی کم'; }
  else { stockBadge = 'ok'; stockText = 'موجود'; }

  const modalEl = document.querySelector('#modal');
  const sheet = document.querySelector('#modalBox');
  if(!modalEl || !sheet){ toast('خطا: مودال پیدا نشد.', 'err'); return; }
  modalLastFocus = document.activeElement;
  sheet.className = 'adm-modal-box adm-prod-view-sheet';
  modalEl.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  sheet.scrollTop = 0;

  sheet.innerHTML = `
    <div class="adm-modal-head">
      <h3>مشاهده محصول</h3>
      <button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="adm-pv-hero">
      <div class="adm-pv-thumb" style="--tint:${mainColor}">
        ${window.__resolveCardImg(p) ? '<img src="'+window.__resolveCardImg(p)+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.style.display=\'none\'">' : ''}
        ${ic(p.art || 'book', 60)}
        ${p.off > 0 ? '<span class="adm-pv-off">-' + fa(p.off) + '٪</span>' : ''}
      </div>
      <div class="adm-pv-hero-info">
        <div class="adm-pv-badges">
          <span class="adm-bdg ${stockBadge}">${stockText}</span>
          <span class="adm-bdg ${p.isActive ? 'ok' : ''}">${p.isActive ? 'منتشرشده' : 'پیش‌نویس'}</span>
          ${p.category ? '<span class="adm-bdg" style="--c:' + (p.category.color||'#94a3b8') + '"><i style="background:' + (p.category.color||'#94a3b8') + '"></i>' + esc(p.category.name) + '</span>' : ''}
        </div>
        <h2>${esc(p.name)}</h2>
        <div class="adm-pv-sub">
          <span>${esc(p.brand || '—')}</span>
          ${p.sku ? '<span class="adm-pv-sep"></span><code>' + esc(p.sku) + '</code>' : ''}
        </div>
        ${p.shortDescription ? '<p class="adm-pv-short">' + esc(p.shortDescription) + '</p>' : ''}
      </div>
    </div>

    <div class="adm-pv-body">

      <div class="adm-pv-section">
        <h4 class="adm-pv-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>
          قیمت و سود
        </h4>
        <div class="adm-pv-price-grid">
          <div class="adm-pv-price-box">
            <label>قیمت فروش</label>
            <div class="adm-pv-price-main">${money(p.price)}</div>
            ${p.off > 0 ? '<div class="adm-pv-price-final">نهایی: ' + money(finalPrice) + '</div>' : ''}
          </div>
          ${p.purchasePrice > 0 ? `
            <div class="adm-pv-price-box">
              <label>قیمت خرید</label>
              <div class="adm-pv-price-sub">${money(p.purchasePrice)}</div>
            </div>
          ` : ''}
          ${profit !== null ? `
            <div class="adm-pv-price-box">
              <label>سود هر فروش</label>
              <div class="adm-pv-price-profit" style="color:${profit > 0 ? 'var(--adm-ok)' : 'var(--adm-danger)'}">${money(profit)}</div>
              ${profitPct !== null ? '<div class="adm-pv-price-final">' + fa(profitPct) + '٪' + (marginPct !== null ? ' · حاشیه ' + fa(marginPct) + '٪' : '') + '</div>' : ''}
            </div>
          ` : ''}
          ${p.off > 0 ? `
            <div class="adm-pv-price-box">
              <label>تخفیف</label>
              <div class="adm-pv-price-off">${fa(p.off)}٪</div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="adm-pv-section">
        <h4 class="adm-pv-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/></svg>
          انبار
        </h4>
        <div class="adm-pv-grid">
          <div class="adm-pv-item">
            <label>موجودی فعلی</label>
            <b>${fa(p.stock)} عدد</b>
          </div>
          <div class="adm-pv-item">
            <label>حداقل موجودی</label>
            <b>${fa(p.minStock || 3)} عدد</b>
          </div>
          ${p.weight > 0 ? '<div class="adm-pv-item"><label>وزن</label><b>' + fa(p.weight) + ' گرم</b></div>' : ''}
          ${p.dimensions ? '<div class="adm-pv-item"><label>ابعاد</label><b dir="ltr">' + esc(p.dimensions) + '</b></div>' : ''}
          ${p.warranty ? '<div class="adm-pv-item"><label>گارانتی</label><b>' + esc(p.warranty) + '</b></div>' : ''}
          <div class="adm-pv-item">
            <label>فروش کل</label>
            <b>${fa(p.sales || 0)} عدد</b>
          </div>
        </div>
      </div>

      ${colors.length ? `
        <div class="adm-pv-section">
          <h4 class="adm-pv-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="14.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="15.5" r="2.5"/></svg>
            رنگ‌ها (${fa(colors.length)})
          </h4>
          <div class="adm-pv-colors">
            ${colors.map(function(c){
              return '<div class="adm-pv-color-chip">'
                + '<span style="background:' + esc(c.hex) + '"></span>'
                + '<b>' + esc(c.name) + '</b>'
                + '</div>';
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${sizes.length ? `
        <div class="adm-pv-section">
          <h4 class="adm-pv-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 9l4-4 14 14-4 4z"/><path d="M9 5l1 3M13 9l1 3M17 13l1 3"/></svg>
            سایزها (${fa(sizes.length)})
          </h4>
          <div class="adm-pv-sizes">
            ${sizes.map(function(s){ return '<span class="adm-pv-size">' + esc(s) + '</span>'; }).join('')}
          </div>
        </div>
      ` : ''}

      ${images.length ? `
        <div class="adm-pv-section">
          <h4 class="adm-pv-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M3 15l5-5 6 6 3-3 4 4"/></svg>
            تصاویر (${fa(images.length)})
          </h4>
          <div class="adm-pv-gallery">
            ${images.map(function(url){
              return '<a class="adm-pv-img" href="' + esc(window.__ASSET__(url)) + '" target="_blank" rel="noopener" style="background-image:url(\'' + esc(window.__ASSET__(url)) + '\')"></a>';
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${p.videoUrl ? `
        <div class="adm-pv-section">
          <h4 class="adm-pv-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/></svg>
            ویدئو
          </h4>
          <div class="adm-pv-video">
            <a href="${esc(p.videoUrl)}" target="_blank" rel="noopener" dir="ltr">${esc(p.videoUrl)}</a>
          </div>
        </div>
      ` : ''}

      ${specs.length ? `
        <div class="adm-pv-section">
          <h4 class="adm-pv-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            مشخصات فنی (${fa(specs.length)})
          </h4>
          <table class="adm-pv-spec-table">
            <tbody>
              ${specs.map(function(s){
                return '<tr><th>' + esc(s.key) + '</th><td>' + esc(s.value) + '</td></tr>';
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${features.length ? `
        <div class="adm-pv-section">
          <h4 class="adm-pv-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
            ویژگی‌ها
          </h4>
          <ul class="adm-pv-features">
            ${features.map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('')}
          </ul>
        </div>
      ` : ''}

      ${(p.description || p.shortDescription) ? `
        <div class="adm-pv-section">
          <h4 class="adm-pv-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            توضیحات
          </h4>
          <div class="adm-pv-desc">${esc(p.description || p.shortDescription || '').replace(/\n/g, '<br>')}</div>
        </div>
      ` : ''}

      ${(p.metaTitle || p.metaDescription) ? `
        <div class="adm-pv-section">
          <h4 class="adm-pv-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            سئو
          </h4>
          ${p.metaTitle ? '<div class="adm-pv-item"><label>عنوان متا</label><b>' + esc(p.metaTitle) + '</b></div>' : ''}
          ${p.metaDescription ? '<div class="adm-pv-item" style="margin-top:8px"><label>توضیح متا</label><b>' + esc(p.metaDescription) + '</b></div>' : ''}
        </div>
      ` : ''}

      ${(p.created_at || p.updated_at) ? `
        <div class="adm-pv-section adm-pv-meta">
          ${p.created_at ? '<div><label>تاریخ ایجاد</label><b>' + new Date(p.created_at).toLocaleString('fa-IR') + '</b></div>' : ''}
          ${p.updated_at ? '<div><label>آخرین ویرایش</label><b>' + new Date(p.updated_at).toLocaleString('fa-IR') + '</b></div>' : ''}
        </div>
      ` : ''}
    </div>

    <div class="adm-modal-foot">
      <button class="adm-btn outline" data-close type="button">بستن</button>
      <button class="adm-btn primary" id="pvEditBtn" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
        ویرایش محصول
      </button>
    </div>
  `;

  sheet.querySelector('#pvEditBtn').onclick = function(){
    closeModal();
    setTimeout(function(){ openProductForm(id); }, 200);
  };
}

async function duplicateProd(id){
  const ok = await confirmDialog({
    title:'کپی محصول',
    message:'یک نسخه‌ی کپی از این محصول ساخته می‌شود. ادامه؟',
    confirmText:'کپی کن',
    danger:false
  });
  if(!ok) return;
  try{
    await apiPost('/products/' + id + '/duplicate');
    toast('محصول کپی شد.', 'ok');
    if(state.refresh) state.refresh();
  }catch(e){ toast('خطا: ' + e.message, 'err'); }
}

async function toggleProd(id){
  try{
    await apiPatch('/products/' + id + '/toggle');
    toast('وضعیت تغییر کرد.', 'ok');
    if(state.refresh) state.refresh();
  }catch(e){ toast('خطا: ' + e.message, 'err'); }
}

async function deleteProd(id){
  const ok = await confirmDialog({
    title:'حذف محصول',
    message:'این محصول برای همیشه حذف می‌شود. مطمئنید؟',
    confirmText:'حذف کن'
  });
  if(!ok) return;
  try{
    await apiDel('/products/' + id);
    toast('محصول حذف شد.', 'ok');
    if(state.refresh) state.refresh();
  }catch(e){ toast('خطا: ' + e.message, 'err'); }
}

async function openProductForm(id){
  let p = null;
  if(id){
    try{ const r = await apiGet('/products/' + id); p = r.product; }catch(e){ toast('خطا: ' + e.message, 'err'); return; }
  }

  let cats = state.categories && state.categories.length ? state.categories : null;
  if(!cats){
    try{ const r = await apiGet('/categories'); cats = r.categories || []; state.categories = cats; }
    catch(_){ cats = []; }
  }

  const artOptions = ['phone','laptop','headphones','watch','speaker','camera','sneaker','backpack','hoodie','kettle','lamp','book'];
  const artLabels = {phone:'موبایل',laptop:'لپ‌تاپ',headphones:'هدفون',watch:'ساعت',speaker:'اسپیکر',camera:'دوربین',sneaker:'کفش',backpack:'کوله',hoodie:'هودی',kettle:'کتری',lamp:'چراغ',book:'کتاب'};

  const colors = p && p.colors ? p.colors : [{name:'مشکی', hex:'#1f2937'}];
  const specs  = p && p.specs ? p.specs : [];
  const features = p && p.features ? p.features.slice() : [];
  const sizes = p && p.sizes ? p.sizes.slice() : [];
  const images = p && p.images ? p.images.slice() : [];

  const modalEl = document.querySelector('#modal');
  const sheet = document.querySelector('#modalBox');
  if(!modalEl || !sheet){ toast('خطا: مودال پیدا نشد.', 'err'); return; }
  modalLastFocus = document.activeElement;
  sheet.className = 'adm-modal-box adm-prod-sheet';
  modalEl.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  sheet.scrollTop = 0;

  sheet.innerHTML = `
    <div class="adm-modal-head">
      <h3>${id ? 'ویرایش محصول' : 'افزودن محصول جدید'}</h3>
      <button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="adm-prod-tabs" role="tablist">
      <button class="adm-prod-tab is-active" data-ptab="basic" type="button">پایه</button>
      <button class="adm-prod-tab" data-ptab="pricing" type="button">قیمت‌گذاری</button>
      <button class="adm-prod-tab" data-ptab="inventory" type="button">انبار</button>
      <button class="adm-prod-tab" data-ptab="media" type="button">تصاویر و ویدئو</button>
      <button class="adm-prod-tab" data-ptab="variants" type="button">تنوع‌ها</button>
      <button class="adm-prod-tab" data-ptab="specs" type="button">مشخصات و ویژگی‌ها</button>
      <button class="adm-prod-tab" data-ptab="seo" type="button">سئو</button>
    </div>

    <div class="adm-prod-body" id="prodTabBody"></div>

    <div class="adm-modal-foot">
      <button class="adm-btn danger" id="prodDeleteBtn" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
        حذف محصول
      </button>
      <button class="adm-btn outline" data-close type="button">انصراف</button>
      <button class="adm-btn primary" id="prodSaveBtn" type="button">${id ? 'ذخیره تغییرات' : 'افزودن محصول'}</button>
    </div>
  `;

  const body = sheet.querySelector('#prodTabBody');
  let currentTab = 'basic';

  /* ---- form field registry ---- */
  const F = {
    name: p ? p.name : '',
    sku: p ? (p.sku || '') : '',
    brand: p ? p.brand : '',
    category: p && p.category ? (p.category.slug || String(p.category.id)) : '',
    description: p ? (p.description || '') : '',
    shortDescription: p ? (p.shortDescription || '') : '',
    price: p ? p.price : '',
    purchasePrice: p ? (p.purchasePrice || 0) : 0,
    off: p ? (p.off || 0) : 0,
    stock: p ? p.stock : 0,
    minStock: p ? (p.minStock || 3) : 3,
    weight: p ? (p.weight || 0) : 0,
    dimensions: p ? (p.dimensions || '') : '',
    art: p ? (p.art || 'book') : 'book',
    videoUrl: p ? (p.videoUrl || '') : '',
    warranty: p ? (p.warranty || '') : '',
    metaTitle: p ? (p.metaTitle || '') : '',
    metaDescription: p ? (p.metaDescription || '') : '',
    isActive: p ? !!p.isActive : true,
    images: Array.isArray(p && p.images) ? p.images.slice() : [],
    features: features,
    sizes: sizes,
    colors: colors,
    specs: specs
  };

  /* expose F + repaint utilities globally for the upload handler */
  window.__activeProductF = F;
  window.__originalStock = p ? Number(p.stock) || 0 : 0;

  /* sync F from the current modal state (called before save) */
  window.__syncActiveF = function(){
    var Fref = window.__activeProductF;
    if(!Fref) return null;
    /* re-read any plain <input data-f> fields that may have changed */
    var s = document.querySelector('#modalBox');
    if(!s) return Fref;
    s.querySelectorAll('[data-f]').forEach(function(el){
      var k = el.dataset.f;
      if(el.type === 'checkbox') Fref[k] = el.checked;
      else Fref[k] = el.value;
    });
    /* make sure images is always a clean array of non-empty strings */
    if(!Array.isArray(Fref.images)) Fref.images = [];
    Fref.images = Fref.images.filter(function(u){
      return u && typeof u === 'string' && u.trim();
    });
    return Fref;
  };
  window.__activeProductRepaint = function(){
    var list = document.querySelector('#imgList');
    if(!list) return;
    list.innerHTML = F.images.map(function(url, idx){
      return '<div class="adm-img-item" data-i="' + idx + '">'
        + '<div class="adm-img-thumb" style="background-image:url(\'' + esc(window.__ASSET__(url)) + '\')"></div>'
        + '<div class="adm-img-url" dir="ltr">' + esc(window.__ASSET__(url)) + '</div>'
        + '<button class="adm-iconbtn-sm danger" data-img-del="' + idx + '" type="button">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
        + '</button>'
        + '</div>';
    }).join('');
    list.querySelectorAll('[data-img-del]').forEach(function(b){
      b.onclick = function(){
        F.images.splice(+b.dataset.imgDel, 1);
        window.__activeProductRepaint();
      };
    });
  };

  /* also clear on modal close */
  var _closeBtn = document.querySelector('#modal [data-close]');


  function catOptions(selected){
    return '<option value="">انتخاب کنید</option>'
      + cats.map(function(c){
          const val = c.slug || String(c.id);
          const sel = val === selected ? ' selected' : '';
          return '<option value="' + esc(val) + '"' + sel + '>' + esc(c.name) + '</option>';
        }).join('');
  }

  function paintTab(name){
    sheet.querySelectorAll('.adm-prod-tab').forEach(function(t){
      t.classList.toggle('is-active', t.dataset.ptab === name);
    });

    if(name === 'basic'){
      body.innerHTML = `
        <div class="adm-prod-form">
          <div class="adm-grid-2">
            <div class="adm-fld">
              <label>نام محصول <span class="req">*</span></label>
              <input class="adm-input" data-f="name" value="${esc(F.name)}" data-autofocus>
            </div>
            <div class="adm-fld">
              <label>SKU (کد کالا)</label>
              <div style="display:flex;gap:8px">
                <input class="adm-input" data-f="sku" dir="ltr" value="${esc(F.sku)}" placeholder="SKU-XXXX">
                <button class="adm-btn outline" type="button" id="genSku">تولید</button>
              </div>
            </div>
          </div>
          <div class="adm-grid-2">
            <div class="adm-fld">
              <label>برند <span class="req">*</span></label>
              <input class="adm-input" data-f="brand" value="${esc(F.brand)}">
            </div>
            <div class="adm-fld">
              <label>دسته‌بندی <span class="req">*</span></label>
              <select class="adm-select" data-f="category">${catOptions(F.category)}</select>
            </div>
          </div>
          <div class="adm-fld">
            <label>توضیح کوتاه</label>
            <input class="adm-input" data-f="shortDescription" maxlength="320" value="${esc(F.shortDescription)}" placeholder="یک جمله جذاب دربارهٔ محصول">
          </div>
          <div class="adm-fld">
            <label>توضیحات کامل</label>
            <textarea class="adm-textarea" data-f="description" rows="6">${esc(F.description)}</textarea>
          </div>
          <div class="adm-grid-2">
            <div class="adm-fld">
              <label>تصویر پیش‌فرض</label>
              <select class="adm-select" data-f="art">
                ${artOptions.map(function(a){
                  return '<option value="' + a + '"' + (F.art === a ? ' selected' : '') + '>' + artLabels[a] + '</option>';
                }).join('')}
              </select>
            </div>
            <div class="adm-fld">
              <label>وضعیت انتشار</label>
              <div class="adm-prod-switch">
                <label class="adm-pub-toggle">
                  <input type="checkbox" data-f="isActive" ${F.isActive ? 'checked' : ''}>
                  <span class="adm-pub-slider"></span>
                  <span class="adm-pub-label">${F.isActive ? 'منتشرشده' : 'پیش‌نویس'}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      `;

      const genBtn = body.querySelector('#genSku');
      if(genBtn) genBtn.onclick = async function(){
        genBtn.disabled = true;
        try{
          const r = await apiGet('/products/admin/generate-sku?brand=' + encodeURIComponent(F.brand || 'P'));
          if(r.sku){
            F.sku = r.sku;
            body.querySelector('[data-f="sku"]').value = r.sku;
          }
        }catch(_){}
        finally{ genBtn.disabled = false; }
      };
    }

    else if(name === 'pricing'){
      const finalPrice = Math.round((Number(F.price)||0) * (1 - (Number(F.off)||0)/100) / 1000) * 1000;
      const profit = (Number(F.price)||0) - (Number(F.purchasePrice)||0);
      const profitPct = F.purchasePrice > 0 ? Math.round((profit / F.purchasePrice) * 100) : 0;
      const marginPct = F.price > 0 ? Math.round(((Number(F.price)||0) - (Number(F.purchasePrice)||0)) / (Number(F.price)||1) * 100) : 0;

      body.innerHTML = `
        <div class="adm-prod-form">
          <div class="adm-grid-2">
            <div class="adm-fld">
              <label>قیمت خرید (تومان)</label>
              <input class="adm-input" data-f="purchasePrice" inputmode="numeric" value="${Number(F.purchasePrice)||0}">
              <div class="adm-hint">قیمت تأمین از تأمین‌کننده</div>
            </div>
            <div class="adm-fld">
              <label>قیمت فروش (تومان) <span class="req">*</span></label>
              <input class="adm-input" data-f="price" inputmode="numeric" value="${F.price}" data-autofocus>
            </div>
          </div>
          <div class="adm-grid-2">
            <div class="adm-fld">
              <label>درصد تخفیف (٪)</label>
              <input class="adm-input" data-f="off" inputmode="numeric" value="${F.off}">
              <div class="adm-hint">بین ۰ تا ۹۰</div>
            </div>
            <div class="adm-fld">
              <label>قیمت نهایی پس از تخفیف</label>
              <div class="adm-calc-box" id="calcFinal">${fa(finalPrice)} تومان</div>
            </div>
          </div>

          <div class="adm-price-insights">
            <div class="adm-insight">
              <span>سود هر فروش</span>
              <b style="color:${profit > 0 ? 'var(--adm-ok)' : 'var(--adm-danger)'}">${fa(profit)} تومان</b>
            </div>
            <div class="adm-insight">
              <span>درصد سود نسبت به خرید</span>
              <b style="color:${profit > 0 ? 'var(--adm-ok)' : 'var(--adm-danger)'}">${fa(profitPct)}٪</b>
            </div>
            <div class="adm-insight">
              <span>حاشیه سود</span>
              <b>${fa(marginPct)}٪</b>
            </div>
          </div>
        </div>
      `;

      function recalc(){
        const price = Number(body.querySelector('[data-f="price"]').value) || 0;
        const pp = Number(body.querySelector('[data-f="purchasePrice"]').value) || 0;
        const off = Number(body.querySelector('[data-f="off"]').value) || 0;
        const fp = Math.round(price * (1 - off/100) / 1000) * 1000;
        const pf = price - pp;
        const pct = pp > 0 ? Math.round(pf / pp * 100) : 0;
        const margin = price > 0 ? Math.round((price - pp) / price * 100) : 0;
        body.querySelector('#calcFinal').textContent = fa(fp) + ' تومان';
        const insights = body.querySelectorAll('.adm-insight b');
        if(insights[0]) insights[0].textContent = fa(pf) + ' تومان';
        if(insights[1]) insights[1].textContent = fa(pct) + '٪';
        if(insights[2]) insights[2].textContent = fa(margin) + '٪';
      }
      ['price','purchasePrice','off'].forEach(function(k){
        body.querySelector('[data-f="' + k + '"]').addEventListener('input', recalc);
      });
    }

    else if(name === 'inventory'){
      body.innerHTML = `
        <div class="adm-prod-form">
          <div class="adm-grid-2">
            <div class="adm-fld">
              <label>موجودی فعلی <span class="req">*</span></label>
              <input class="adm-input" data-f="stock" inputmode="numeric" value="${F.stock}" data-autofocus>
            </div>
            <div class="adm-fld">
              <label>حداقل موجودی (هشدار)</label>
              <input class="adm-input" data-f="minStock" inputmode="numeric" value="${F.minStock}">
              <div class="adm-hint">وقتی موجودی به این عدد رسید، هشدار داده می‌شود</div>
            </div>
          </div>
          <div class="adm-grid-3">
            <div class="adm-fld">
              <label>وزن (گرم)</label>
              <input class="adm-input" data-f="weight" inputmode="numeric" value="${F.weight}">
            </div>
            <div class="adm-fld">
              <label>ابعاد (س.ع.ا)</label>
              <input class="adm-input" data-f="dimensions" dir="ltr" value="${esc(F.dimensions)}" placeholder="30x20x10">
            </div>
            <div class="adm-fld">
              <label>گارانتی</label>
              <input class="adm-input" data-f="warranty" value="${esc(F.warranty)}" placeholder="۱۸ ماه گارانتی">
            </div>
          </div>
        </div>
      `;
    }

    else if(name === 'media'){
      body.innerHTML = `
        <div class="adm-prod-form">
          <div class="adm-fld">
            <label>تصاویر محصول</label>
            <div class="adm-hint" style="margin-top:0;margin-bottom:10px">آدرس تصویر را وارد کنید یا از اینترنت کپی کنید.</div>

            <div class="adm-img-list" id="imgList">
              ${F.images.map(function(url, i){
                return '<div class="adm-img-item" data-i="' + i + '">'
                  + '<div class="adm-img-thumb" style="background-image:url(\'' + esc(window.__ASSET__(url)) + '\')"></div>'
                  + '<div class="adm-img-url" dir="ltr">' + esc(window.__ASSET__(url)) + '</div>'
                  + '<button class="adm-iconbtn-sm danger" data-img-del="' + i + '" type="button">'
                  + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
                  + '</button>'
                  + '</div>';
              }).join('')}
            </div>

            <div class="adm-img-add">
              <input class="adm-input" id="newImgUrl" dir="ltr" placeholder="https://example.com/image.jpg">
              <button class="adm-btn primary" id="addImgBtn" type="button">افزودن با آدرس</button>
              <label class="adm-btn outline adm-upload-label" for="prodImgPicker" style="cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>آپلود از دستگاه</label><input type="file" id="prodImgPicker" accept="image/*" multiple style="display:none" onchange="window.__handleProdImagePick && window.__handleProdImagePick(this)">
              <input type="file" id="imgFileInput" accept="image/*" multiple style="display:none">
            </div>
            <div class="adm-upload-progress" id="uploadProgress" hidden>
              <div class="adm-upload-bar"><i></i></div>
              <span class="adm-upload-lbl">در حال آپلود...</span>
            </div>
          </div>

          <div class="adm-fld" style="margin-top:20px">
            <label>ویدئوی محصول (آدرس)</label>
            <input class="adm-input" data-f="videoUrl" dir="ltr" value="${esc(F.videoUrl)}" placeholder="https://youtube.com/watch?v=... یا آدرس فایل ویدئو">
          </div>
        </div>
      `;

      function repaintImages(){
        body.querySelector('#imgList').innerHTML = F.images.map(function(url, i){
          return '<div class="adm-img-item" data-i="' + i + '">'
            + '<div class="adm-img-thumb" style="background-image:url(\'' + esc(window.__ASSET__(url)) + '\')"></div>'
            + '<div class="adm-img-url" dir="ltr">' + esc(window.__ASSET__(url)) + '</div>'
            + '<button class="adm-iconbtn-sm danger" data-img-del="' + i + '" type="button">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
            + '</button>'
            + '</div>';
        }).join('');
        body.querySelectorAll('[data-img-del]').forEach(function(b){
          b.onclick = function(){
            F.images.splice(+b.dataset.imgDel, 1);
            repaintImages();

                                  };
        });
      }
      repaintImages();
      body.querySelectorAll('[data-img-del]').forEach(function(b){
        b.onclick = function(){
          F.images.splice(+b.dataset.imgDel, 1);
          repaintImages();
        };
      });
      body.querySelector('#addImgBtn').onclick = function(){
        const inp = body.querySelector('#newImgUrl');
        const url = inp.value.trim();
        if(!url){ toast('آدرس تصویر را وارد کنید.', 'warn'); return; }
        F.images.push(url);
        inp.value = '';
        repaintImages();
      };
    }

    else if(name === 'variants'){
      body.innerHTML = `
        <div class="adm-prod-form">
          <div class="adm-fld">
            <label>رنگ‌ها</label>
            <div class="adm-color-list" id="colorList">
              ${F.colors.map(function(c, i){
                return '<div class="adm-color-row" data-i="' + i + '">'
                  + '<input type="color" class="adm-color-pick" value="' + esc(c.hex || '#94a3b8') + '" data-color-hex="' + i + '">'
                  + '<input class="adm-input" value="' + esc(c.name || '') + '" data-color-name="' + i + '" placeholder="نام رنگ">'
                  + '<button class="adm-iconbtn-sm danger" data-color-del="' + i + '" type="button">'
                  + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
                  + '</button>'
                  + '</div>';
              }).join('')}
            </div>
            <button class="adm-btn outline sm" id="addColorBtn" type="button" style="margin-top:10px">افزودن رنگ</button>
          </div>

          <div class="adm-fld" style="margin-top:20px">
            <label>سایزها / اندازه‌ها</label>
            <div class="adm-size-list" id="sizeList">
              ${F.sizes.map(function(s, i){
                return '<span class="adm-size-chip">'
                  + '<input value="' + esc(s) + '" data-size="' + i + '" style="border:0;background:transparent;width:60px;outline:0;text-align:center;font-size:13px">'
                  + '<button type="button" data-size-del="' + i + '">×</button>'
                  + '</span>';
              }).join('')}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <input class="adm-input" id="newSize" placeholder="مثلاً XL یا ۴۲" style="max-width:200px">
              <button class="adm-btn outline" id="addSizeBtn" type="button">افزودن سایز</button>
            </div>
          </div>
        </div>
      `;

      function rebindColors(){
        body.querySelectorAll('[data-color-hex]').forEach(function(el){
          el.oninput = function(){ F.colors[+el.dataset.colorHex].hex = el.value; };
        });
        body.querySelectorAll('[data-color-name]').forEach(function(el){
          el.oninput = function(){ F.colors[+el.dataset.colorName].name = el.value; };
        });
        body.querySelectorAll('[data-color-del]').forEach(function(b){
          b.onclick = function(){
            F.colors.splice(+b.dataset.colorDel, 1);
            paintTab('variants');
          };
        });
      }
      rebindColors();

      body.querySelector('#addColorBtn').onclick = function(){
        F.colors.push({name:'', hex:'#94a3b8'});
        paintTab('variants');
      };

      body.querySelectorAll('[data-size]').forEach(function(el){
        el.oninput = function(){ F.sizes[+el.dataset.size] = el.value; };
      });
      body.querySelectorAll('[data-size-del]').forEach(function(b){
        b.onclick = function(){
          F.sizes.splice(+b.dataset.sizeDel, 1);
          paintTab('variants');
        };
      });
      body.querySelector('#addSizeBtn').onclick = function(){
        const v = body.querySelector('#newSize').value.trim();
        if(!v) return;
        F.sizes.push(v);
        paintTab('variants');
      };
    }

    else if(name === 'specs'){
      body.innerHTML = `
        <div class="adm-prod-form">
          <div class="adm-fld">
            <label>مشخصات فنی</label>
            <div class="adm-spec-list" id="specList">
              ${F.specs.map(function(s, i){
                return '<div class="adm-spec-row">'
                  + '<input class="adm-input" value="' + esc(s.key || '') + '" data-spec-key="' + i + '" placeholder="مثلاً: جنس">'
                  + '<input class="adm-input" value="' + esc(s.value || '') + '" data-spec-val="' + i + '" placeholder="مثلاً: پنبه">'
                  + '<button class="adm-iconbtn-sm danger" data-spec-del="' + i + '" type="button">'
                  + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
                  + '</button>'
                  + '</div>';
              }).join('')}
            </div>
            <button class="adm-btn outline sm" id="addSpecBtn" type="button" style="margin-top:10px">افزودن مشخصه</button>
          </div>

          <div class="adm-fld" style="margin-top:20px">
            <label>ویژگی‌ها</label>
            <div class="adm-feature-list">
              ${F.features.map(function(f, i){
                return '<div class="adm-feature-row">'
                  + '<span class="adm-feature-bullet">•</span>'
                  + '<input class="adm-input" value="' + esc(f) + '" data-feat="' + i + '" placeholder="مثلاً: ضدآب">'
                  + '<button class="adm-iconbtn-sm danger" data-feat-del="' + i + '" type="button">'
                  + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
                  + '</button>'
                  + '</div>';
              }).join('')}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <input class="adm-input" id="newFeature" placeholder="ویژگی جدید">
              <button class="adm-btn outline" id="addFeatureBtn" type="button">افزودن</button>
            </div>
          </div>
        </div>
      `;

      function rebindSpecs(){
        body.querySelectorAll('[data-spec-key]').forEach(function(el){
          el.oninput = function(){ F.specs[+el.dataset.specKey].key = el.value; };
        });
        body.querySelectorAll('[data-spec-val]').forEach(function(el){
          el.oninput = function(){ F.specs[+el.dataset.specVal].value = el.value; };
        });
        body.querySelectorAll('[data-spec-del]').forEach(function(b){
          b.onclick = function(){
            F.specs.splice(+b.dataset.specDel, 1);
            paintTab('specs');
          };
        });
      }
      rebindSpecs();
      body.querySelector('#addSpecBtn').onclick = function(){
        F.specs.push({key:'', value:''});
        paintTab('specs');
      };

      function rebindFeatures(){
        body.querySelectorAll('[data-feat]').forEach(function(el){
          el.oninput = function(){ F.features[+el.dataset.feat] = el.value; };
        });
        body.querySelectorAll('[data-feat-del]').forEach(function(b){
          b.onclick = function(){
            F.features.splice(+b.dataset.featDel, 1);
            paintTab('specs');
          };
        });
      }
      rebindFeatures();
      body.querySelector('#addFeatureBtn').onclick = function(){
        const v = body.querySelector('#newFeature').value.trim();
        if(!v) return;
        F.features.push(v);
        paintTab('specs');
      };
    }

    else if(name === 'seo'){
      body.innerHTML = `
        <div class="adm-prod-form">
          <div class="adm-fld">
            <label>عنوان سئو (Title)</label>
            <input class="adm-input" data-f="metaTitle" value="${esc(F.metaTitle)}" maxlength="200" placeholder="عنوانی که در گوگل نمایش داده می‌شود">
            <div class="adm-hint">اگر خالی باشد، نام محصول استفاده می‌شود.</div>
          </div>
          <div class="adm-fld">
            <label>توضیح متا (Meta Description)</label>
            <textarea class="adm-textarea" data-f="metaDescription" rows="3" maxlength="320" placeholder="توضیح کوتاه برای موتورهای جستجو">${esc(F.metaDescription)}</textarea>
          </div>
        </div>
      `;
    }

    /* bind text inputs that should reflect into F */
    body.querySelectorAll('[data-f]').forEach(function(el){
      const key = el.dataset.f;
      if(el.type === 'checkbox'){
        el.onchange = function(){ F[key] = el.checked; };
      }else{
        el.oninput = function(){ F[key] = el.value; };
      }
    });
  }

  sheet.querySelectorAll('[data-ptab]').forEach(function(t){
    t.onclick = function(){ currentTab = t.dataset.ptab; paintTab(currentTab); };
  });

  paintTab('basic');

  /* ---- Delete (only when editing) ---- */
  const delBtn = sheet.querySelector('#prodDeleteBtn');
  if(delBtn){
    if(!id){ delBtn.style.display = 'none'; }
    else{
      delBtn.onclick = async function(){
        const ok = await confirmDialog({
          title:'حذف محصول',
          message:'این محصول برای همیشه حذف می‌شود. مطمئنید؟',
          confirmText:'حذف کن'
        });
        if(!ok) return;
        delBtn.disabled = true;
        const oldHtml = delBtn.innerHTML;
        delBtn.innerHTML = 'در حال حذف...';
        try{
          await apiDel('/products/' + id);
          toast('محصول حذف شد.', 'ok');
          closeModal();
          if(state.refresh) state.refresh();
        }catch(e){
          toast('خطا: ' + e.message, 'err');
          delBtn.disabled = false;
          delBtn.innerHTML = oldHtml;
        }
      };
    }
  }

  /* ---- Save ---- */
  const saveBtn = sheet.querySelector('#prodSaveBtn');
  saveBtn.onclick = async function(){
  if(saveBtn.disabled) return;
  saveBtn.disabled = true;
  var oldTxt = saveBtn.textContent;
  saveBtn.textContent = 'در حال ذخیره...';

  try{
    if(typeof window.__syncActiveF === 'function'){ window.__syncActiveF(); }
    var Fcur = window.__activeProductF || F;

    var imgs = Array.isArray(Fcur.images) ? Fcur.images.filter(function(u){ return u && String(u).trim(); }) : [];
    var feats = Array.isArray(Fcur.features) ? Fcur.features.filter(function(x){ return x && String(x).trim(); }) : [];
    var szs = Array.isArray(Fcur.sizes) ? Fcur.sizes.filter(function(x){ return x && String(x).trim(); }) : [];
    var cols = Array.isArray(Fcur.colors) ? Fcur.colors.filter(function(c){ return c && c.name; }) : [];
    var spcs = Array.isArray(Fcur.specs) ? Fcur.specs.filter(function(s){ return s && s.key && s.value; }) : [];

    var payload = {
      name: String(Fcur.name || '').trim(),
      sku: String(Fcur.sku || '').trim() || null,
      brand: String(Fcur.brand || '').trim(),
      category: Fcur.category,
      price: Number(String(Fcur.price || 0).replace(/[^0-9]/g, '')) || 0,
      purchasePrice: Number(String(Fcur.purchasePrice || 0).replace(/[^0-9]/g, '')) || 0,
      off: Math.min(90, Math.max(0, Number(Fcur.off) || 0)),
      stock: Number(String(Fcur.stock || 0).replace(/[^0-9]/g, '')) || 0,
      stockDelta: (function(){ var cur = Number(String(Fcur.stock || 0).replace(/[^0-9]/g, '')) || 0; var orig = window.__originalStock || 0; return cur - orig; })(),
      minStock: Number(String(Fcur.minStock || 0).replace(/[^0-9]/g, '')) || 0,
      weight: Number(String(Fcur.weight || 0).replace(/[^0-9]/g, '')) || 0,
      dimensions: Fcur.dimensions || '',
      art: Fcur.art || 'book',
      description: Fcur.description || '',
      shortDescription: Fcur.shortDescription || '',
      videoUrl: Fcur.videoUrl || '',
      warranty: Fcur.warranty || '',
      metaTitle: Fcur.metaTitle || '',
      metaDescription: Fcur.metaDescription || '',
      images: imgs,
      features: feats,
      sizes: szs,
      colors: cols,
      specs: spcs,
      isActive: !!Fcur.isActive
    };

    console.log('===== SAVE PAYLOAD =====');
    console.log('images:', payload.images);
    console.log('images count:', payload.images.length);
    console.log('=======================');

    if(payload.name.length < 2){ toast('نام محصول را وارد کنید.', 'warn'); throw new Error('validation'); }
    if(!payload.brand){ toast('برند را وارد کنید.', 'warn'); throw new Error('validation'); }
    if(!payload.category){ toast('دسته‌بندی را انتخاب کنید.', 'warn'); throw new Error('validation'); }
    if(!payload.price){ toast('قیمت را وارد کنید.', 'warn'); throw new Error('validation'); }

    var res;
    if(id){
      res = await apiPut('/products/' + id, payload);
    }else{
      res = await apiPost('/products', payload);
    }

    console.log('===== SERVER RESPONSE =====');
    console.log('res.product.images:', res && res.product && res.product.images);
    console.log('===========================');

    toast(id ? 'محصول با موفقیت ذخیره شد.' : 'محصول اضافه شد.', 'ok');
    closeModal();
    if(state.refresh) state.refresh();
  }catch(err){
    if(err.message !== 'validation'){
      console.error('[save-final] error:', err);
      toast('خطا: ' + (err.message || 'نامشخص'), 'err');
    }
    saveBtn.disabled = false;
    saveBtn.textContent = oldTxt;
  }
};
}

/* ================================================================
   PAGE: Categories
   ================================================================ */
async function renderCategories(root){
  root.innerHTML = ''
    + '<div class="adm-sec-head">'
    +   '<h2>دسته‌بندی‌ها</h2>'
    +   '<span class="adm-sec-sub" id="catCount">—</span>'
    +   '<div class="adm-sec-actions">'
    +     '<button class="adm-btn primary" id="catNew" type="button">' + ic('plus',15) + ' دسته جدید</button>'
    +   '</div>'
    + '</div>'
    + '<div class="adm-card" style="padding:16px">'
    +   '<div class="adm-hint" style="margin:0 0 12px">برای هر دسته می‌توانید عکس دایره‌ای بگذارید.</div>'
    +   '<div id="catGrid" class="cat-grid-admin"></div>'
    + '</div>';

  var grid = root.querySelector('#catGrid');
  var cnt = root.querySelector('#catCount');
  var cats = [];

  async function load(){
    grid.innerHTML = '<div class="adm-sk" style="height:180px;border-radius:14px"></div>'.repeat(4);
    try{
      var r = await apiGet('/categories?all=true');
      cats = r.categories || [];
      cnt.textContent = fa(cats.length) + ' دسته';
      paint();
    }catch(e){ grid.innerHTML = '<div style="padding:20px;color:var(--adm-danger)">' + esc(e.message) + '</div>'; }
  }

  function paint(){
    if(!cats.length){
      grid.innerHTML = '<div class="adm-empty" style="padding:32px;grid-column:1/-1"><h3>دسته‌ای نیست</h3></div>';
      return;
    }

    var html = '';
    cats.forEach(function(c){
      var hasImg = !!(c.image_url && String(c.image_url).trim());
      var color = c.color || '#3b82f6';
      var thumbStyle = hasImg ? '' : 'background:color-mix(in srgb,' + color + ' 16%, #fafbfc);color:' + color + ';';
      var thumbIcon = hasImg ? '' : ic(c.icon || 'grid', 36);
      var dataImgAttr = hasImg ? ' data-img="' + esc(String(c.image_url)) + '"' : '';

      html += '<div class="cat-card-admin" data-id="' + c.id + '">'
        + '<div class="cat-card-thumb"' + dataImgAttr + ' style="' + thumbStyle + '">'
        +   thumbIcon
        + '</div>'
        + '<div class="cat-card-info">'
        +   '<b>' + esc(c.name) + '</b>'
        +   '<span>' + fa(c.productCount || 0) + ' محصول</span>'
        + '</div>'
        + '<div class="cat-card-actions">'
        +   '<button class="adm-iconbtn-sm" data-edit="' + c.id + '" title="ویرایش">' + ic('edit', 16) + '</button>'
        +   '<button class="adm-iconbtn-sm danger" data-del="' + c.id + '" title="حذف">' + ic('trash', 16) + '</button>'
        + '</div>'
        + '</div>';
    });
    grid.innerHTML = html;

    /* اعمال عکس‌ها با JS — بدون quote issue */
    var thumbs = grid.querySelectorAll('.cat-card-thumb[data-img]');
    for(var i = 0; i < thumbs.length; i++){
      var el = thumbs[i];
      var raw = el.getAttribute('data-img');
      if(!raw) continue;
      var full = window.__ASSET__ ? window.__ASSET__(raw) : raw;
      el.style.backgroundImage = 'url(' + JSON.stringify(full) + ')';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundColor = '#ffffff';
    }

    /* bind دکمه‌ها */
    var editBtns = grid.querySelectorAll('[data-edit]');
    for(var j = 0; j < editBtns.length; j++){
      (function(b){
        b.onclick = function(){ openCatForm(cats.find(function(x){ return x.id === +b.dataset.edit; })); };
      })(editBtns[j]);
    }
    var delBtns = grid.querySelectorAll('[data-del]');
    for(var k = 0; k < delBtns.length; k++){
      (function(b){
        b.onclick = async function(){
          var yes = await confirmDialog({ title:'حذف', message:'مطمئنید؟', confirmText:'حذف' });
          if(!yes) return;
          try{ await apiDel('/categories/' + b.dataset.del); load(); toast('حذف شد.', 'ok'); }
          catch(e){ toast(e.message, 'err'); }
        };
      })(delBtns[k]);
    }
  }

  function openCatForm(c){
    var isEdit = !!c;
    var imgUrl = c ? (c.image_url || '') : '';
    var icons = ['grid','phone','laptop','headphones','watch','sneaker','kettle','book','home','bag'];

    openModal(
      '<div class="adm-modal-head"><h3>' + (isEdit ? 'ویرایش دسته' : 'دسته جدید') + '</h3>' +
        '<button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">' + ic('x', 18) + '</button></div>' +
      '<div class="adm-modal-body">' +
        '<div class="adm-fld"><label>نام <span class="req">*</span></label>' +
          '<input class="adm-input" id="catName" value="' + esc(c ? c.name : '') + '" data-autofocus></div>' +
        '<div class="adm-fld"><label>عکس دایره‌ای (اختیاری)</label>' +
          '<div class="adm-img-picker" id="catImgPicker" style="width:180px;height:180px;border-radius:50%;margin:12px auto;background-size:cover;background-position:center;border:3px dashed var(--adm-border-strong);display:grid;place-items:center;cursor:pointer;background-color:#fafbfc">' +
            (imgUrl ? '' : '<div class="adm-img-picker-empty" style="color:#64748b;font-size:12px;font-weight:600;text-align:center;padding:12px">برای انتخاب عکس کلیک کن</div>') +
          '</div>' +
          '<input type="hidden" id="catImg" value="' + esc(String(imgUrl)) + '">' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;justify-content:center">' +
            '<label class="adm-btn outline sm" for="catFile" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>' +
              'آپلود از دستگاه' +
            '</label>' +
            '<input type="file" id="catFile" accept="image/*" style="display:none">' +
          '</div>' +
        '</div>' +
        '<div class="adm-grid-2">' +
          '<div class="adm-fld"><label>آیکون (اگر عکس نبود)</label>' +
            '<select class="adm-select" id="catIcon">' +
              icons.map(function(i){ return '<option value="' + i + '"' + ((c && c.icon === i) || (!c && i === 'grid') ? 'selected' : '') + '>' + i + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="adm-fld"><label>رنگ</label>' +
            '<input class="adm-input" id="catColor" dir="ltr" value="' + esc(c ? c.color : '#3b82f6') + '"></div>' +
        '</div>' +
        '<div class="adm-fld"><label>ترتیب</label>' +
          '<input class="adm-input" id="catOrder" type="number" value="' + ((c && c.order) || 0) + '"></div>' +
      '</div>' +
      '<div class="adm-modal-foot">' +
        '<button class="adm-btn outline" data-close type="button">انصراف</button>' +
        '<button class="adm-btn primary" id="catSave" type="button">' + (isEdit ? 'ذخیره' : 'افزودن') + '</button>' +
      '</div>'
    );

    var picker = document.getElementById('catImgPicker');
    var fileInput = document.getElementById('catFile');
    var hiddenInput = document.getElementById('catImg');

    /* نمایش عکس فعلی */
    if(picker && imgUrl){
      var full = window.__ASSET__ ? window.__ASSET__(imgUrl) : imgUrl;
      picker.style.setProperty('background-image', 'url(' + JSON.stringify(full) + ')', 'important');
      picker.style.setProperty('background-size', 'cover', 'important');
      picker.style.setProperty('background-position', 'center', 'important');
      picker.style.setProperty('background-repeat', 'no-repeat', 'important');
      picker.style.setProperty('background-color', '#ffffff', 'important');
      picker.style.borderStyle = 'solid';
      picker.style.borderColor = '#d92a3f';
    }

    /* picker click → file input */
    if(picker && fileInput){
      picker.onclick = function(e){
        e.preventDefault();
        e.stopPropagation();
        fileInput.value = '';
        fileInput.click();
      };
    }

    /* file change → crop */
    if(fileInput){
      fileInput.onchange = function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var files = Array.prototype.slice.call(fileInput.files || []);
        fileInput.value = '';
        if(!files.length) return;
        if(typeof window.__pickAdmImg === 'function'){
          window.__pickAdmImg({ files: files, value: '' }, 'catImg', 'catImgPicker');
        } else {
          /* fallback بدون crop */
          var f = files[0];
          var fd = new FormData();
          fd.append('image', f);
          var xhr = new XMLHttpRequest();
          xhr.open('POST', (window.__API_BASE__ || '/api') + '/upload/product-single', true);
          xhr.withCredentials = true;
          xhr.onload = function(){
            try{
              var r = JSON.parse(xhr.responseText || '{}');
              if(r.success){
                hiddenInput.value = r.url;
                var full2 = window.__ASSET__ ? window.__ASSET__(r.url) : r.url;
                picker.style.setProperty('background-image', 'url(' + JSON.stringify(full2) + ')', 'important');
                picker.style.setProperty('background-size', 'cover', 'important');
                picker.style.setProperty('background-position', 'center', 'important');
                picker.style.backgroundImage = 'url(' + JSON.stringify(full2) + ')';
                picker.style.borderStyle = 'solid';
                picker.style.borderColor = '#d92a3f';
                picker.innerHTML = '';
              }
            }catch(e){}
          };
          xhr.send(fd);
        }
      };
    }

    document.getElementById('catSave').onclick = async function(){
      var p = {
        name: document.getElementById('catName').value.trim(),
        icon: document.getElementById('catIcon').value,
        color: document.getElementById('catColor').value.trim(),
        image_url: document.getElementById('catImg').value,
        order: Number(document.getElementById('catOrder').value) || 0
      };
      if(!p.name){ toast('نام لازم است.', 'warn'); return; }
      try{
        if(isEdit) await apiPut('/categories/' + c.id, p);
        else await apiPost('/categories', p);
        closeModal(); load(); toast('ذخیره شد.', 'ok');
      }catch(e){ toast(e.message, 'err'); }
    };
  }

  root.querySelector('#catNew').onclick = function(){ openCatForm(null); };
  load();
}

function openCatForm(cat){
  openModal(`
    <div class="adm-modal-head">
      <h3>${cat?'ویرایش دسته':'دسته‌ی جدید'}</h3>
      <button class="adm-iconbtn-sm" data-close type="button">${ic('x',18)}</button>
    </div>
    <form id="catForm" class="adm-modal-body" novalidate>
      <div class="adm-fld">
        <label>نام <span class="req">*</span></label>
        <input class="adm-input" name="name" value="${esc(cat?cat.name:'')}" data-autofocus>
      </div>
      <div class="adm-grid-2">
        <div class="adm-fld">
          <label>آیکون</label>
          <input class="adm-input" name="icon" value="${esc(cat?cat.icon||'box':'box')}" placeholder="box, phone, book...">
        </div>
        <div class="adm-fld">
          <label>رنگ</label>
          <input class="adm-input" name="color" value="${esc(cat?cat.color||'#3b82f6':'#3b82f6')}" placeholder="#3b82f6">
        </div>
      </div>
      <div class="adm-fld">
        <label>ترتیب نمایش</label>
        <input class="adm-input" name="order" inputmode="numeric" value="${cat?cat.order||0:0}">
      </div>
    </form>
    <div class="adm-modal-foot">
      <button class="adm-btn outline" data-close type="button">انصراف</button>
      <button class="adm-btn primary" id="catSaveBtn" type="button">${cat?'ذخیره':'افزودن'}</button>
    </div>
  `);

  $('#catSaveBtn').onclick = async ()=>{
    const f = $('#catForm');
    const v = n => f.elements[n].value.trim();
    const btn = $('#catSaveBtn');
    btn.disabled = true; const old = btn.textContent; btn.textContent='...';
    const payload = { name:v('name'), icon:v('icon')||'box', color:v('color')||'#3b82f6', order:Number(toEn(v('order')))||0 };
    if(!payload.name){ toast('نام دسته را وارد کنید.','warn'); btn.disabled=false; btn.textContent=old; return; }
    try{
      if(cat) await apiPut('/categories/'+cat.id, payload);
      else    await apiPost('/categories', payload);
      toast(cat?'دسته ویرایش شد.':'دسته اضافه شد.','ok');
      closeModal();
      if(state.refresh) state.refresh();
    }catch(e){ toast('خطا: '+e.message,'err'); }
    finally{ btn.disabled=false; btn.textContent=old; }
  };
}

async function deleteCat(id){
  const ok = await confirmDialog({ title:'حذف دسته', message:'اگر محصولی در این دسته باشد، حذف نمی‌شود.' });
  if(!ok) return;
  try{
    await apiDel('/categories/'+id);
    toast('دسته حذف شد.','ok');
    if(state.refresh) state.refresh();
  }catch(e){ toast('خطا: '+e.message,'err'); }
}

/* ================================================================
   PAGE: Orders
   ================================================================ */
const STATUS_MAP = {
  pending:'در انتظار پرداخت',
  paid:'پرداخت‌شده',
  processing:'در حال پردازش',
  shipped:'ارسال شده',
  delivered:'تحویل شده',
  cancelled:'لغو شده',
  refunded:'بازگشت داده شده'
};
const STATUS_CLS = {
  pending:'warn', paid:'info', processing:'info', shipped:'brand',
  delivered:'ok', cancelled:'danger', refunded:'danger'
};

async function renderOrders(root){
  root.innerHTML = `
    <div class="adm-sec-head">
      <h2>سفارش‌ها</h2>
      <span class="adm-sec-sub" id="ordCount"></span>
      <div class="adm-sec-actions">
        <button class="adm-btn outline sm" id="ordRefresh" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v6h-6"/></svg>
          بروزرسانی
        </button>
      </div>
    </div>

    <div class="adm-card">
      <div class="adm-toolbar adm-orders-toolbar">
        <div class="adm-search">
          <span class="adm-search-ic">${ic('search',18)}</span>
          <input id="ordQ" placeholder="کد سفارش یا کد پیگیری..." autocomplete="off">
        </div>
        <div class="adm-search">
          <span class="adm-search-ic">${ic('user',18)}</span>
          <input id="ordCustomer" placeholder="نام یا موبایل مشتری..." autocomplete="off">
        </div>
        <select class="adm-select" id="ordStatus" style="max-width:170px">
          <option value="">همه وضعیت‌ها</option>
          <option value="pending">در انتظار پرداخت</option>
          <option value="paid">پرداخت‌شده</option>
          <option value="processing">در حال پردازش</option>
          <option value="shipped">ارسال‌شده</option>
          <option value="delivered">تحویل‌شده</option>
          <option value="cancelled">لغو‌شده</option>
          <option value="refunded">مرجوعی</option>
        </select>
        <input class="adm-input adm-date" id="ordFrom" type="date" title="از تاریخ">
        <input class="adm-input adm-date" id="ordTo" type="date" title="تا تاریخ">
        <button class="adm-btn outline sm" id="ordReset" type="button">پاک کردن فیلترها</button>
      </div>

      <div class="adm-tbl-wrap">
        <table class="adm-tbl adm-orders-tbl">
          <thead>
            <tr>
              <th>کد سفارش</th>
              <th>مشتری</th>
              <th>تاریخ</th>
              <th>اقلام</th>
              <th>مبلغ کل</th>
              <th>وضعیت</th>
              <th class="col-actions">عملیات</th>
            </tr>
          </thead>
          <tbody id="ordBody"></tbody>
        </table>
      </div>

      <div class="adm-orders-footer" id="ordFooter"></div>
    </div>
  `;

  const STATUS_LABELS = {
    pending:'در انتظار پرداخت', paid:'پرداخت‌شده', processing:'در حال پردازش',
    shipped:'ارسال‌شده', delivered:'تحویل‌شده',
    cancelled:'لغو‌شده', refunded:'مرجوعی'
  };
  const STATUS_CLS = {
    pending:'warn', paid:'info', processing:'info', shipped:'brand',
    delivered:'ok', cancelled:'danger', refunded:'danger'
  };

  const body = root.querySelector('#ordBody');
  const footer = root.querySelector('#ordFooter');
  const cntEl = root.querySelector('#ordCount');

  let page = 1;
  let totalPages = 1;
  let allItems = [];

  async function load(){
    body.innerHTML = '<tr><td colspan="7"><div style="padding:32px;text-align:center;color:var(--adm-muted)">در حال بارگذاری...</div></td></tr>';
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 20);
    const q = root.querySelector('#ordQ').value.trim();
    const c = root.querySelector('#ordCustomer').value.trim();
    const st = root.querySelector('#ordStatus').value;
    const from = root.querySelector('#ordFrom').value;
    const to = root.querySelector('#ordTo').value;
    if(q) params.set('q', q);
    if(c) params.set('customer', c);
    if(st) params.set('status', st);
    if(from) params.set('from', from);
    if(to) params.set('to', to);

    try{
      const res = await apiGet('/orders?' + params.toString());
      allItems = res.items || [];
      totalPages = res.pagination ? res.pagination.pages : 1;
      cntEl.textContent = fa(res.pagination ? res.pagination.total : 0) + ' سفارش';
      paint();
      paintFooter(res.pagination);
    }catch(e){
      body.innerHTML = '<tr><td colspan="7" style="padding:32px;text-align:center;color:var(--adm-danger)">' + esc(e.message) + '</td></tr>';
    }
  }

  function paint(){
    if(!allItems.length){
      body.innerHTML = '<tr><td colspan="7">'
        + '<div class="adm-empty" style="padding:52px 16px">'
        + '<div class="adm-empty-ic">'
        + '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/></svg>'
        + '</div>'
        + '<h3>سفارشی پیدا نشد</h3>'
        + '<p>فیلترها را تغییر دهید یا عبارت دیگری را جستجو کنید.</p>'
        + '</div>'
        + '</td></tr>';
      return;
    }

    body.innerHTML = allItems.map(function(o){
      const code = o.trackingCode || '—';
      const customer = o.shippingAddress && o.shippingAddress.name || '—';
      const phone = o.shippingAddress && o.shippingAddress.phone || '';
      const date = (o.createdAt || o.created_at)
        ? new Date(o.createdAt || o.created_at).toLocaleDateString('fa-IR')
        : '—';
      const itemCount = (o.items || []).length;
      const amount = o.totalPrice || o.total_price || 0;
      const stLabel = STATUS_LABELS[o.status] || o.status;
      const stCls = STATUS_CLS[o.status] || '';
      const hasNote = o.internalNote || o.customerNote;
      const hasShipment = o.shipmentTracking;

      return '<tr data-order-row="' + o.id + '">'
        + '<td><div class="adm-order-code">'
        + '<b dir="ltr">' + esc(code) + '</b>'
        + (hasShipment ? '<span class="adm-order-sub" dir="ltr" title="کد رهگیری مرسوله">' + esc(hasShipment) + '</span>' : '')
        + (hasNote ? '<span class="adm-order-note-dot" title="یادداشت دارد"></span>' : '')
        + '</div></td>'
        + '<td><div class="adm-order-cust">'
        + '<b>' + esc(customer) + '</b>'
        + (phone ? '<span dir="ltr">' + esc(phone) + '</span>' : '')
        + '</div></td>'
        + '<td>' + esc(date) + '</td>'
        + '<td><span class="adm-bdg">' + fa(itemCount) + ' قلم</span></td>'
        + '<td><b>' + fa(amount) + '</b> <small style="color:var(--adm-muted)">تومان</small></td>'
        + '<td><span class="adm-bdg ' + stCls + '">' + esc(stLabel) + '</span></td>'
        + '<td class="col-actions"><div class="adm-tbl-actions">'
        + '<button class="adm-iconbtn-sm" data-view="' + o.id + '" title="مشاهده جزئیات">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
        + '</button>'
        + '<button class="adm-iconbtn-sm" data-invoice="' + o.id + '" title="فاکتور">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>'
        + '</button>'
        + '</div></td>'
        + '</tr>';
    }).join('');

    body.querySelectorAll('[data-view]').forEach(function(b){
      b.onclick = function(){ viewOrder(+b.dataset.view); };
    });
    body.querySelectorAll('[data-invoice]').forEach(function(b){
      b.onclick = function(){ openInvoice(+b.dataset.invoice); };
    });
  }

  function paintFooter(p){
    if(!p || p.pages <= 1){ footer.innerHTML = ''; return; }
    let html = '<div class="adm-orders-pager">';
    html += '<button class="adm-btn ghost sm" ' + (p.page <= 1 ? 'disabled' : '') + ' data-page="prev">قبلی</button>';
    html += '<span class="adm-orders-pageinfo">صفحه ' + fa(p.page) + ' از ' + fa(p.pages) + '</span>';
    html += '<button class="adm-btn ghost sm" ' + (p.page >= p.pages ? 'disabled' : '') + ' data-page="next">بعدی</button>';
    html += '</div>';
    footer.innerHTML = html;
    footer.querySelectorAll('[data-page]').forEach(function(b){
      b.onclick = function(){
        if(b.dataset.page === 'prev' && page > 1) page--;
        if(b.dataset.page === 'next' && page < totalPages) page++;
        load();
      };
    });
  }

  /* filter events */
  let timer;
  root.querySelector('#ordQ').addEventListener('input', function(){ clearTimeout(timer); timer = setTimeout(function(){ page = 1; load(); }, 400); });
  root.querySelector('#ordCustomer').addEventListener('input', function(){ clearTimeout(timer); timer = setTimeout(function(){ page = 1; load(); }, 400); });
  root.querySelector('#ordStatus').addEventListener('change', function(){ page = 1; load(); });
  root.querySelector('#ordFrom').addEventListener('change', function(){ page = 1; load(); });
  root.querySelector('#ordTo').addEventListener('change', function(){ page = 1; load(); });
  root.querySelector('#ordReset').addEventListener('click', function(){
    root.querySelector('#ordQ').value = '';
    root.querySelector('#ordCustomer').value = '';
    root.querySelector('#ordStatus').value = '';
    root.querySelector('#ordFrom').value = '';
    root.querySelector('#ordTo').value = '';
    page = 1; load();
  });
  root.querySelector('#ordRefresh').addEventListener('click', load);

  state.refresh = load;
  load();
}

async function viewOrder(id){
  let o;
  try{
    const res = await apiGet('/orders/' + id);
    o = res.order;
  }catch(e){ toast('خطا: ' + e.message, 'err'); return; }

  const STATUS_LABELS = {
    pending:'در انتظار پرداخت', paid:'پرداخت‌شده', processing:'در حال پردازش',
    shipped:'ارسال‌شده', delivered:'تحویل‌شده',
    cancelled:'لغو‌شده', refunded:'مرجوعی'
  };
  const STATUS_CLS = {
    pending:'warn', paid:'info', processing:'info', shipped:'brand',
    delivered:'ok', cancelled:'danger', refunded:'danger'
  };

  const fmtDate = d => d ? new Date(d).toLocaleString('fa-IR') : '—';
  const money = n => fa(Math.round(Number(n)||0)) + ' تومان';

  function render(o){
    const stLabel = STATUS_LABELS[o.status] || o.status;
    const stCls = STATUS_CLS[o.status] || '';
    const sa = o.shippingAddress || {};

    return `
      <div class="adm-modal-head">
        <h3>سفارش <b dir="ltr">${esc(o.trackingCode)}</b></h3>
        <span class="adm-bdg ${stCls}">${esc(stLabel)}</span>
        <button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div class="adm-order-tabs" role="tablist">
        <button class="adm-order-tab is-active" data-otab="summary" type="button">خلاصه</button>
        <button class="adm-order-tab" data-otab="items" type="button">اقلام</button>
        <button class="adm-order-tab" data-otab="shipment" type="button">ارسال</button>
        <button class="adm-order-tab" data-otab="financial" type="button">مالی</button>
        <button class="adm-order-tab" data-otab="notes" type="button">یادداشت‌ها</button>
      </div>

      <div class="adm-order-body" id="ordTabBody"></div>

      <div class="adm-order-actions-bar">
        <div class="adm-order-actions-left">
          <button class="adm-btn outline sm" data-action="invoice" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>
            فاکتور
          </button>
        </div>
        <div class="adm-order-actions-right">
          ${!['delivered','cancelled','refunded'].includes(o.status) ? `
            <button class="adm-btn outline sm" data-action="cancel" type="button">لغو سفارش</button>
          ` : ''}
          ${!['refunded','cancelled'].includes(o.status) ? `
            <button class="adm-btn outline sm is-danger" data-action="return" type="button">مرجوع کردن</button>
            <button class="adm-btn danger sm" data-action="refund" type="button">بازپرداخت</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  const sheet = document.querySelector('#modalBox');
  modalLastFocus = document.activeElement;
  sheet.className = 'adm-modal-box adm-order-sheet';
  const modalEl = document.querySelector('#modal');
  if(modalEl){ modalEl.hidden = false; document.documentElement.style.overflow = 'hidden'; }
  sheet.scrollTop = 0;
  sheet.innerHTML = render(o);

  const bodyEl = sheet.querySelector('#ordTabBody');

  function paintTab(name){
    sheet.querySelectorAll('.adm-order-tab').forEach(function(t){
      t.classList.toggle('is-active', t.dataset.otab === name);
    });

    const sa = o.shippingAddress || {};

    if(name === 'summary'){
      bodyEl.innerHTML = `
        <div class="adm-order-summary">
          <div class="adm-order-summary-grid">
            <div class="adm-order-field">
              <label>مشتری</label>
              <div>${esc(sa.name || '—')}</div>
            </div>
            <div class="adm-order-field">
              <label>موبایل</label>
              <div dir="ltr">${esc(sa.phone || '—')}</div>
            </div>
            <div class="adm-order-field">
              <label>تاریخ ثبت</label>
              <div>${esc(fmtDate(o.createdAt))}</div>
            </div>
            <div class="adm-order-field">
              <label>روش پرداخت</label>
              <div>${o.paymentMethod === 'cod' ? 'پرداخت در محل' : 'پرداخت آنلاین'}</div>
            </div>
            <div class="adm-order-field adm-field-wide">
              <label>نشانی</label>
              <div>${esc([sa.province, sa.city, sa.street].filter(Boolean).join('، ')) || '—'}</div>
            </div>
            ${sa.postalCode ? '<div class="adm-order-field"><label>کد پستی</label><div dir="ltr">' + esc(sa.postalCode) + '</div></div>' : ''}
          </div>

          <div class="adm-order-status-changer">
            <label>تغییر وضعیت سفارش</label>
            <div class="adm-status-btns">
              ${['pending','paid','processing','shipped','delivered','cancelled'].map(function(st){
                const active = o.status === st;
                return '<button class="adm-status-btn ' + (active ? 'is-active ' : '') + (STATUS_CLS[st]||'') + '" data-set-status="' + st + '" type="button">' + STATUS_LABELS[st] + '</button>';
              }).join('')}
            </div>
          </div>
        </div>
      `;

      bodyEl.querySelectorAll('[data-set-status]').forEach(function(b){
        b.onclick = function(){ updateStatus(o.id, b.dataset.setStatus, reload); };
      });
    }

    else if(name === 'items'){
      if(!o.items || !o.items.length){
        bodyEl.innerHTML = '<div class="adm-empty" style="padding:40px 16px"><h3>قلمی یافت نشد</h3></div>';
        return;
      }
      bodyEl.innerHTML = `
        <div class="adm-order-items">
          ${o.items.map(function(it){
            const colorChip = it.color
              ? '<span class="adm-item-color"><i style="background:' + esc(it.color.hex) + '"></i>' + esc(it.color.name) + '</span>'
              : '';
            return '<div class="adm-order-item">'
              + '<div class="adm-order-item-thumb">' + ic(it.art || 'box', 22) + '</div>'
              + '<div class="adm-order-item-info">'
              + '<b>' + esc(it.name) + '</b>'
              + colorChip
              + '</div>'
              + '<div class="adm-order-item-qty">' + fa(it.qty) + ' × ' + fa(it.price) + '</div>'
              + '<div class="adm-order-item-total">' + money(it.lineTotal) + '</div>'
              + '</div>';
          }).join('')}
        </div>
      `;
    }

    else if(name === 'shipment'){
      const carriers = ['پست پیشتاز','پست سفارشی','تیپاکس','چاپار','آرامکس','باربری','پیک موتوری','سایر'];
      bodyEl.innerHTML = `
        <div class="adm-order-form">
          <div class="adm-grid-2">
            <div class="adm-fld">
              <label>شرکت حمل و نقل</label>
              <select class="adm-select" id="ordCarrier">
                <option value="">انتخاب کنید</option>
                ${carriers.map(function(c){
                  return '<option ' + (o.shipmentCarrier === c ? 'selected' : '') + '>' + c + '</option>';
                }).join('')}
              </select>
            </div>
            <div class="adm-fld">
              <label>کد رهگیری مرسوله</label>
              <input class="adm-input" id="ordTrack" dir="ltr" placeholder="مثال: 1234567890123" value="${esc(o.shipmentTracking || '')}">
            </div>
          </div>
          <div class="adm-fld">
            <button class="adm-btn primary" id="ordSaveShip" type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
              ذخیره اطلاعات ارسال
            </button>
            <div class="adm-hint" style="margin-top:10px">با ثبت کد رهگیری، وضعیت سفارش به «ارسال‌شده» تغییر می‌کند.</div>
          </div>
        </div>
      `;

      bodyEl.querySelector('#ordSaveShip').onclick = async function(){
        const tracking = bodyEl.querySelector('#ordTrack').value.trim();
        const carrier = bodyEl.querySelector('#ordCarrier').value;
        try{
          await apiPatch('/orders/' + o.id + '/shipment', { shipmentTracking: tracking, shipmentCarrier: carrier });
          toast('اطلاعات ارسال ذخیره شد.', 'ok');
          reload();
        }catch(e){ toast('خطا: ' + e.message, 'err'); }
      };
    }

    else if(name === 'financial'){
      bodyEl.innerHTML = `
        <div class="adm-order-form">
          <div class="adm-grid-3">
            <div class="adm-fld">
              <label>هزینه ارسال (تومان)</label>
              <input class="adm-input" id="ordShip" inputmode="numeric" value="${Number(o.shippingPrice)||0}">
            </div>
            <div class="adm-fld">
              <label>مالیات (تومان)</label>
              <input class="adm-input" id="ordTax" inputmode="numeric" value="${Number(o.tax)||0}">
            </div>
            <div class="adm-fld">
              <label>تخفیف (تومان)</label>
              <input class="adm-input" id="ordDisc" inputmode="numeric" value="${Number(o.discountAmount)||0}">
            </div>
          </div>

          <div class="adm-order-price-box">
            <div class="adm-price-row"><span>جمع کالاها</span><b>${money(o.itemsPrice)}</b></div>
            <div class="adm-price-row"><span>هزینه ارسال</span><b id="prevShip">${money(o.shippingPrice)}</b></div>
            <div class="adm-price-row"><span>مالیات</span><b id="prevTax">${money(o.tax)}</b></div>
            <div class="adm-price-row is-disc"><span>تخفیف</span><b id="prevDisc">- ${money(o.discountAmount)}</b></div>
            <div class="adm-price-row is-total"><span>مبلغ قابل پرداخت</span><b id="prevTotal">${money(o.totalPrice)}</b></div>
          </div>

          <div class="adm-fld">
            <button class="adm-btn primary" id="ordSaveFin" type="button">ذخیره اطلاعات مالی</button>
          </div>
        </div>
      `;

      function recalc(){
        const ship = Number(bodyEl.querySelector('#ordShip').value) || 0;
        const tax  = Number(bodyEl.querySelector('#ordTax').value) || 0;
        const disc = Number(bodyEl.querySelector('#ordDisc').value) || 0;
        const total = Math.max(0, Number(o.itemsPrice||0) + ship + tax - disc);
        bodyEl.querySelector('#prevShip').textContent = money(ship);
        bodyEl.querySelector('#prevTax').textContent = money(tax);
        bodyEl.querySelector('#prevDisc').textContent = '- ' + money(disc);
        bodyEl.querySelector('#prevTotal').textContent = money(total);
      }
      ['ordShip','ordTax','ordDisc'].forEach(function(id){
        bodyEl.querySelector('#' + id).addEventListener('input', recalc);
      });

      bodyEl.querySelector('#ordSaveFin').onclick = async function(){
        const ship = Number(bodyEl.querySelector('#ordShip').value) || 0;
        const tax  = Number(bodyEl.querySelector('#ordTax').value) || 0;
        const disc = Number(bodyEl.querySelector('#ordDisc').value) || 0;
        try{
          await apiPatch('/orders/' + o.id + '/financial', { shippingCost: ship, tax: tax, discount: disc });
          toast('اطلاعات مالی ذخیره شد.', 'ok');
          reload();
        }catch(e){ toast('خطا: ' + e.message, 'err'); }
      };
    }

    else if(name === 'notes'){
      bodyEl.innerHTML = `
        <div class="adm-order-form">
          <div class="adm-fld">
            <label>یادداشت داخلی <span class="adm-hint" style="font-weight:400">(فقط برای ادمین‌ها)</span></label>
            <textarea class="adm-textarea" id="ordInternal" placeholder="مثلاً: مشتری درخواست تماس قبل از ارسال داشت.">${esc(o.internalNote || '')}</textarea>
          </div>
          <div class="adm-fld">
            <label>یادداشت برای مشتری</label>
            <textarea class="adm-textarea" id="ordCustomer" placeholder="این یادداشت به مشتری نشان داده می‌شود.">${esc(o.customerNote || '')}</textarea>
          </div>
          <div class="adm-fld">
            <button class="adm-btn primary" id="ordSaveNotes" type="button">ذخیره یادداشت‌ها</button>
          </div>

          ${o.returnReason ? `
            <div class="adm-order-alert is-warn">
              <b>دلیل مرجوعی:</b>
              <p>${esc(o.returnReason)}</p>
            </div>
          ` : ''}
          ${o.refundNote ? `
            <div class="adm-order-alert is-danger">
              <b>یادداشت بازپرداخت:</b>
              <p>${esc(o.refundNote)}</p>
              <div class="adm-hint" style="margin-top:6px">مبلغ بازپرداخت: ${money(o.refundedAmount)}</div>
            </div>
          ` : ''}
        </div>
      `;

      bodyEl.querySelector('#ordSaveNotes').onclick = async function(){
        try{
          await apiPatch('/orders/' + o.id + '/notes', {
            internalNote: bodyEl.querySelector('#ordInternal').value,
            customerNote: bodyEl.querySelector('#ordCustomer').value
          });
          toast('یادداشت‌ها ذخیره شد.', 'ok');
          reload();
        }catch(e){ toast('خطا: ' + e.message, 'err'); }
      };
    }
  }

  async function reload(){
    try{
      const res = await apiGet('/orders/' + o.id);
      o = res.order;
      sheet.innerHTML = render(o);
      sheet.classList.add('adm-order-sheet');
      bind();
      paintTab(currentTab);
    }catch(e){ toast('خطا: ' + e.message, 'err'); }
  }

  let currentTab = 'summary';

  function bind(){
    const sh = sheet;
    sh.querySelector('[data-close]').onclick = closeModal;
    sh.querySelectorAll('[data-otab]').forEach(function(t){
      t.onclick = function(){ currentTab = t.dataset.otab; paintTab(currentTab); };
    });
    sh.querySelector('[data-action="invoice"]').onclick = function(){ openInvoice(o.id); };
    const cancelBtn = sh.querySelector('[data-action="cancel"]');
    if(cancelBtn) cancelBtn.onclick = function(){
      confirmDialog({ title:'لغو سفارش', message:'این سفارش لغو می‌شود. مطمئنید؟', confirmText:'لغو سفارش' })
        .then(function(ok){ if(ok) cancelOrder(o.id, reload); });
    };
    const retBtn = sh.querySelector('[data-action="return"]');
    if(retBtn) retBtn.onclick = function(){ openReturnDialog(o, reload); };
    const refBtn = sh.querySelector('[data-action="refund"]');
    if(refBtn) refBtn.onclick = function(){ openRefundDialog(o, reload); };
  }

  bind();
  paintTab('summary');
}

async function updateStatus(id, status, onDone){
  try{
    await apiPatch('/orders/' + id + '/status', { status: status });
    toast('وضعیت تغییر کرد.', 'ok');
    if(onDone) onDone();
  }catch(e){ toast('خطا: ' + e.message, 'err'); }
}

async function cancelOrder(id, onDone){
  try{
    await apiPatch('/orders/' + id + '/cancel');
    toast('سفارش لغو شد.', 'ok');
    if(onDone) onDone();
  }catch(e){ toast('خطا: ' + e.message, 'err'); }
}

function openReturnDialog(o, onDone){
  openModal(`
    <div class="adm-modal-head">
      <h3>مرجوع کردن سفارش</h3>
      <button class="adm-iconbtn-sm" data-close type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="adm-modal-body">
      <p class="adm-hint" style="margin-top:0">با تأیید این عملیات، موجودی کالاها به انبار بازمی‌گردد و وضعیت سفارش «مرجوعی» می‌شود.</p>
      <div class="adm-fld">
        <label>دلیل مرجوعی <span class="req">*</span></label>
        <textarea class="adm-textarea" id="retReason" data-autofocus placeholder="مثلاً: کالا با توضیحات مطابقت نداشت"></textarea>
      </div>
    </div>
    <div class="adm-modal-foot">
      <button class="adm-btn outline" data-close type="button">انصراف</button>
      <button class="adm-btn danger" id="retConfirm" type="button">ثبت مرجوعی</button>
    </div>
  `);

  document.querySelector('#retConfirm').onclick = async function(){
    const reason = document.querySelector('#retReason').value.trim();
    if(reason.length < 3){ toast('دلیل مرجوعی را وارد کنید.', 'warn'); return; }
    try{
      await apiPost('/orders/' + o.id + '/return', { reason: reason });
      toast('سفارش مرجوع شد.', 'ok');
      closeModal();
      if(onDone) onDone();
    }catch(e){ toast('خطا: ' + e.message, 'err'); }
  };
}

function openRefundDialog(o, onDone){
  const total = o.totalPrice || o.total_price || 0;
  openModal(`
    <div class="adm-modal-head">
      <h3>بازپرداخت وجه</h3>
      <button class="adm-iconbtn-sm" data-close type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="adm-modal-body">
      <div class="adm-fld">
        <label>مبلغ بازپرداخت (تومان) <span class="req">*</span></label>
        <input class="adm-input" id="refAmount" inputmode="numeric" value="${total}" data-autofocus>
      </div>
      <div class="adm-fld">
        <label>یادداشت بازپرداخت</label>
        <textarea class="adm-textarea" id="refNote" placeholder="مثلاً: بازپرداخت به حساب بانکی مشتری"></textarea>
      </div>
      <div class="adm-hint">مبلغ کل سفارش: ${fa(total)} تومان</div>
    </div>
    <div class="adm-modal-foot">
      <button class="adm-btn outline" data-close type="button">انصراف</button>
      <button class="adm-btn danger" id="refConfirm" type="button">تأیید بازپرداخت</button>
    </div>
  `);

  document.querySelector('#refConfirm').onclick = async function(){
    const amount = Number(String(document.querySelector('#refAmount').value).replace(/[^\d]/g, '')) || 0;
    const note = document.querySelector('#refNote').value.trim();
    if(amount <= 0){ toast('مبلغ بازپرداخت را وارد کنید.', 'warn'); return; }
    try{
      await apiPost('/orders/' + o.id + '/refund', { amount: amount, note: note });
      toast('بازپرداخت ثبت شد.', 'ok');
      closeModal();
      if(onDone) onDone();
    }catch(e){ toast('خطا: ' + e.message, 'err'); }
  };
}

/* ================================================================
   Invoice — print + PDF
   ================================================================ */
async function openInvoice(id){
  let o;
  try{
    const res = await apiGet('/orders/' + id);
    o = res.order;
  }catch(e){ toast('خطا: ' + e.message, 'err'); return; }

  const money = n => fa(Math.round(Number(n)||0)) + ' تومان';
  const fmtDate = d => d ? new Date(d).toLocaleString('fa-IR') : '—';
  const sa = o.shippingAddress || {};

  const STATUS_LABELS = {
    pending:'در انتظار پرداخت', paid:'پرداخت‌شده', processing:'در حال پردازش',
    shipped:'ارسال‌شده', delivered:'تحویل‌شده',
    cancelled:'لغو‌شده', refunded:'مرجوعی'
  };

  const itemsHTML = (o.items || []).map(function(it){
    const colorInfo = it.color ? ' (' + it.color.name + ')' : '';
    return '<tr>'
      + '<td>' + fa(it.qty) + '</td>'
      + '<td>' + esc(it.name) + esc(colorInfo) + '</td>'
      + '<td>' + fa(it.price) + '</td>'
      + '<td>' + fa(it.lineTotal) + '</td>'
      + '</tr>';
  }).join('');

  const invoiceHTML = `
    <div class="inv" id="invoicePrint">
      <div class="inv-head">
        <div class="inv-brand">
          <div class="inv-brand-mark">
            <svg width="42" height="42" viewBox="0 0 64 64">
              <defs><linearGradient id="invWine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9B2447"/><stop offset="1" stop-color="#4A0F20"/></linearGradient></defs>
              <rect x="3" y="3" width="58" height="58" rx="18" fill="url(#invWine)"/>
              <path d="M20 27 L44 27 L41.5 47 L22.5 47 Z" fill="none" stroke="#E2C88C" stroke-width="2.4" stroke-linejoin="round"/>
              <path d="M24.5 27 C24.5 18.8 39.5 18.8 39.5 27" fill="none" stroke="#E2C88C" stroke-width="2.4" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="inv-brand-name">زحمتکش مارکت</div>
            <div class="inv-brand-sub">فروشگاه اینترنتی</div>
          </div>
        </div>
        <div class="inv-meta">
          <h2>فاکتور فروش</h2>
          <div class="inv-meta-line"><span>کد سفارش:</span><b dir="ltr">${esc(o.trackingCode)}</b></div>
          <div class="inv-meta-line"><span>تاریخ:</span><b>${esc(fmtDate(o.createdAt))}</b></div>
          <div class="inv-meta-line"><span>وضعیت:</span><b>${esc(STATUS_LABELS[o.status] || o.status)}</b></div>
        </div>
      </div>

      <div class="inv-customers">
        <div class="inv-cust-block">
          <div class="inv-cust-title">اطلاعات مشتری</div>
          <div class="inv-cust-row"><span>نام:</span><b>${esc(sa.name || '—')}</b></div>
          <div class="inv-cust-row"><span>موبایل:</span><b dir="ltr">${esc(sa.phone || '—')}</b></div>
          <div class="inv-cust-row"><span>نشانی:</span><b>${esc([sa.province, sa.city, sa.street].filter(Boolean).join('، ')) || '—'}</b></div>
          ${sa.postalCode ? '<div class="inv-cust-row"><span>کد پستی:</span><b dir="ltr">' + esc(sa.postalCode) + '</b></div>' : ''}
        </div>
        ${o.shipmentTracking ? `
          <div class="inv-cust-block">
            <div class="inv-cust-title">اطلاعات ارسال</div>
            ${o.shipmentCarrier ? '<div class="inv-cust-row"><span>شرکت حمل:</span><b>' + esc(o.shipmentCarrier) + '</b></div>' : ''}
            <div class="inv-cust-row"><span>کد رهگیری:</span><b dir="ltr">${esc(o.shipmentTracking)}</b></div>
          </div>
        ` : ''}
      </div>

      <table class="inv-table">
        <thead>
          <tr>
            <th style="width:60px">تعداد</th>
            <th>شرح کالا</th>
            <th style="width:120px">قیمت واحد (تومان)</th>
            <th style="width:130px">جمع (تومان)</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>

      <div class="inv-totals">
        <div class="inv-total-row"><span>جمع کالاها:</span><b>${money(o.itemsPrice)}</b></div>
        <div class="inv-total-row"><span>هزینه ارسال:</span><b>${money(o.shippingPrice)}</b></div>
        ${Number(o.tax) > 0 ? '<div class="inv-total-row"><span>مالیات:</span><b>' + money(o.tax) + '</b></div>' : ''}
        ${Number(o.discountAmount) > 0 ? '<div class="inv-total-row is-disc"><span>تخفیف:</span><b>- ' + money(o.discountAmount) + '</b></div>' : ''}
        <div class="inv-total-row is-grand"><span>مبلغ قابل پرداخت:</span><b>${money(o.totalPrice)}</b></div>
      </div>

      <div class="inv-foot">
        <div>با تشکر از خرید شما 🌹</div>
        <div>zahmatkesh-market.ir</div>
      </div>
    </div>
  `;

  openModal(`
    <div class="adm-modal-head">
      <h3>فاکتور سفارش <b dir="ltr">${esc(o.trackingCode)}</b></h3>
      <button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="adm-modal-body" style="padding:0">
      ${invoiceHTML}
    </div>
    <div class="adm-modal-foot">
      <button class="adm-btn outline" data-close type="button">بستن</button>
      <button class="adm-btn outline" id="invPrint" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
        چاپ
      </button>
      <button class="adm-btn primary" id="invPdf" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        دانلود PDF
      </button>
    </div>
  `, 'wide');

  document.querySelector('#invPrint').onclick = function(){
    const node = document.querySelector('#invoicePrint');
    if(!node) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>فاکتور ' + esc(o.trackingCode) + '</title></head><body style="margin:0;background:#fff">' + node.outerHTML + '</body></html>');
    w.document.close();
    /* wait for fonts */
    setTimeout(function(){ w.focus(); w.print(); w.close(); }, 400);
  };

  document.querySelector('#invPdf').onclick = async function(){
    const btn = this;
    btn.disabled = true; const old = btn.innerHTML;
    btn.innerHTML = 'در حال آماده‌سازی...';
    try{
      if(!window.html2pdf){
        await new Promise(function(resolve, reject){
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        s.integrity = 'sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==';
        s.crossOrigin = 'anonymous';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const node = document.querySelector('#invoicePrint');
      await window.html2pdf().set({
        margin: 10,
        filename: 'invoice-' + o.trackingCode + '.pdf',
        image: { type:'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
      }).from(node).save();
      toast('فاکتور دانلود شد.', 'ok');
    }catch(e){
      toast('خطا: ' + e.message, 'err');
    }finally{
      btn.disabled = false; btn.innerHTML = old;
    }
  };
}

/* ================================================================
   PAGE: Users
   ================================================================ */
async function renderUsers(root){
  root.innerHTML = [
    '<div class="adm-sec-head">',
      '<h2>کاربران</h2>',
      '<span class="adm-sec-sub" id="usrCount"></span>',
      '<div class="adm-sec-actions">',
        '<button class="adm-btn outline sm" id="usrRefresh" type="button">',
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v6h-6"/></svg>',
          'بروزرسانی',
        '</button>',
      '</div>',
    '</div>',
    '<div class="adm-card">',
      '<div class="adm-toolbar">',
        '<div class="adm-search">',
          '<span class="adm-search-ic">' + ic('search',18) + '</span>',
          '<input id="usrQ" placeholder="جستجوی نام، ایمیل یا شماره..." autocomplete="off">',
        '</div>',
        '<select class="adm-select" id="usrRoleFilter" style="max-width:160px">',
          '<option value="">همه نقش‌ها</option>',
          '<option value="user">کاربر</option>',
          '<option value="admin">ادمین</option>',
        '</select>',
        '<select class="adm-select" id="usrActiveFilter" style="max-width:160px">',
          '<option value="">همه وضعیت‌ها</option>',
          '<option value="true">فعال</option>',
          '<option value="false">غیرفعال</option>',
        '</select>',
      '</div>',
      '<div class="adm-tbl-wrap"><table class="adm-tbl">',
        '<thead><tr>',
          '<th>کاربر</th>',
          '<th>شماره موبایل</th>',
          '<th>نقش</th>',
          '<th>وضعیت</th>',
          '<th>تاریخ عضویت</th>',
          '<th class="col-actions">عملیات</th>',
        '</tr></thead>',
        '<tbody id="usrBody"></tbody>',
      '</table></div>',
    '</div>'
  ].join('');

  const body = root.querySelector('#usrBody');
  const countEl = root.querySelector('#usrCount');
  let allUsers = [];

  async function load(){
    body.innerHTML = '<tr><td colspan="6"><div class="adm-sk adm-sk-row"></div></td></tr>';
    const params = new URLSearchParams();
    const q = root.querySelector('#usrQ').value.trim();
    const role = root.querySelector('#usrRoleFilter').value;
    const active = root.querySelector('#usrActiveFilter').value;
    if(q) params.set('q', q);
    if(role) params.set('role', role);
    if(active) params.set('active', active);
    params.set('limit', '100');

    try{
      const res = await apiGet('/users?' + params.toString());
      allUsers = res.items || [];
      countEl.textContent = fa(res.pagination ? res.pagination.total : allUsers.length) + ' کاربر';
      paint();
    }catch(e){
      body.innerHTML = '<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--adm-danger)">' + esc(e.message) + '</td></tr>';
    }
  }

  function paint(){
    if(!allUsers.length){
      body.innerHTML = '<tr><td colspan="6"><div class="adm-empty" style="padding:48px 16px">' +
        '<div class="adm-empty-ic"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>' +
        '<h3>کاربری پیدا نشد</h3><p>فیلترها را تغییر دهید.</p></div></td></tr>';
      return;
    }
    body.innerHTML = allUsers.map(function(u){
      const initial = (u.name || 'ک').trim().charAt(0);
      const roleBadge = u.role === 'admin'
        ? '<span class="adm-bdg brand">ادمین</span>'
        : '<span class="adm-bdg">کاربر</span>';
      const activeBadge = u.isActive
        ? '<span class="adm-bdg ok">فعال</span>'
        : '<span class="adm-bdg danger">غیرفعال</span>';
      const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fa-IR') : '—';
      return '<tr data-user-row="' + u.id + '" class="adm-row-clickable">' +
        '<td><div class="adm-user-cell">' +
          '<div class="adm-user-avatar">' + esc(initial) + '</div>' +
          '<div class="adm-user-cell-info">' +
            '<b>' + esc(u.name || 'بی‌نام') + '</b>' +
            '<span dir="ltr">' + esc(u.email || '') + '</span>' +
          '</div>' +
        '</div></td>' +
        '<td><span dir="ltr">' + esc(u.phone || '—') + '</span></td>' +
        '<td>' + roleBadge + '</td>' +
        '<td>' + activeBadge + '</td>' +
        '<td>' + esc(created) + '</td>' +
        '<td class="col-actions"><div class="adm-tbl-actions">' +
          '<button class="adm-iconbtn-sm" data-view-user="' + u.id + '" title="مشاهده جزئیات">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    /* کلیک روی ردیف */
    body.querySelectorAll('[data-user-row]').forEach(function(tr){
      tr.addEventListener('click', function(e){
        if(e.target.closest('button')) return;
        openUserDetail(Number(tr.dataset.userRow));
      });
    });
    /* کلیک روی دکمه مشاهده */
    body.querySelectorAll('[data-view-user]').forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        openUserDetail(Number(b.dataset.viewUser));
      });
    });
  }

  let timer;
  root.querySelector('#usrQ').addEventListener('input', function(){
    clearTimeout(timer); timer = setTimeout(load, 300);
  });
  root.querySelector('#usrRoleFilter').addEventListener('change', load);
  root.querySelector('#usrActiveFilter').addEventListener('change', load);
  root.querySelector('#usrRefresh').addEventListener('click', load);

  state.refresh = load;
  load();
}

/* ================================================================
   User Detail Modal
   ================================================================ */
async function openUserDetail(userId){
  let data;
  try{
    data = await apiGet('/users/' + userId + '/detail');
  }catch(e){ toast('خطا: ' + e.message, 'err'); return; }

  const u = data.user;
  const s = data.stats;
  const initial = (u.name || 'ک').trim().charAt(0);

  function paint(){
    return [
      '<div class="adm-modal-head">',
        '<h3>جزئیات کاربر</h3>',
        '<button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">',
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        '</button>',
      '</div>',

      '<div class="adm-user-hero">',
        '<div class="adm-user-hero-avatar">' + esc(initial) + '</div>',
        '<div class="adm-user-hero-info">',
          '<h2>' + esc(u.name || 'بی‌نام') + '</h2>',
          '<div class="adm-user-hero-meta">',
            '<span class="adm-user-badge ' + (u.role === 'admin' ? 'is-admin' : '') + '">' + (u.role === 'admin' ? 'ادمین' : 'کاربر') + '</span>',
            '<span class="adm-user-badge ' + (u.isActive ? 'is-active' : 'is-inactive') + '">' + (u.isActive ? 'فعال' : 'غیرفعال') + '</span>',
          '</div>',
        '</div>',
      '</div>',

      '<div class="adm-user-body">',

        '<div class="adm-user-stats-grid">',
          '<div class="adm-user-stat">',
            '<div class="adm-user-stat-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/></svg></div>',
            '<div class="adm-user-stat-val">' + fa(s.ordersTotal) + '</div>',
            '<div class="adm-user-stat-lbl">کل سفارش‌ها</div>',
          '</div>',
          '<div class="adm-user-stat is-ok">',
            '<div class="adm-user-stat-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg></div>',
            '<div class="adm-user-stat-val">' + fa(s.totalSpent) + '</div>',
            '<div class="adm-user-stat-lbl">مجموع خرید (تومان)</div>',
          '</div>',
          '<div class="adm-user-stat is-warn">',
            '<div class="adm-user-stat-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>',
            '<div class="adm-user-stat-val">' + fa(s.ordersPending) + '</div>',
            '<div class="adm-user-stat-lbl">در انتظار پرداخت</div>',
          '</div>',
          '<div class="adm-user-stat is-brand">',
            '<div class="adm-user-stat-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg></div>',
            '<div class="adm-user-stat-val">' + fa(s.addresses) + '</div>',
            '<div class="adm-user-stat-lbl">تعداد آدرس‌ها</div>',
          '</div>',
        '</div>',

        '<div class="adm-user-section">',
          '<h4 class="adm-user-sec-title">اطلاعات تماس</h4>',
          '<div class="adm-user-info-grid">',
            '<div class="adm-user-info-item"><label>نام</label><b>' + esc(u.name || '—') + '</b></div>',
            '<div class="adm-user-info-item"><label>شماره موبایل</label><b dir="ltr">' + esc(u.phone || '—') + '</b></div>',
            '<div class="adm-user-info-item"><label>ایمیل</label><b dir="ltr">' + esc(u.email || '—') + '</b></div>',
            '<div class="adm-user-info-item"><label>تاریخ عضویت</label><b>' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString('fa-IR') : '—') + '</b></div>',
            '<div class="adm-user-info-item"><label>آخرین ورود</label><b>' + (u.lastLogin ? new Date(u.lastLogin).toLocaleString('fa-IR') : 'هنوز وارد نشده') + '</b></div>',
          '</div>',
        '</div>',

        (data.addresses && data.addresses.length ? [
          '<div class="adm-user-section">',
            '<h4 class="adm-user-sec-title">آدرس‌ها (' + fa(data.addresses.length) + ')</h4>',
            '<div class="adm-user-addr-list">',
              data.addresses.map(function(a){
                return '<div class="adm-user-addr">' +
                  (a.isDefault ? '<span class="adm-user-addr-default">پیش‌فرض</span>' : '') +
                  '<b>' + esc(a.title || 'آدرس') + '</b>' +
                  '<div>' + esc([a.province, a.city].filter(Boolean).join('، ')) + '</div>' +
                  '<div>' + esc(a.street || '') + '</div>' +
                '</div>';
              }).join(''),
            '</div>',
          '</div>'
        ].join('') : ''),

        (data.orders && data.orders.length ? [
          '<div class="adm-user-section">',
            '<h4 class="adm-user-sec-title">آخرین سفارش‌ها</h4>',
            '<div class="adm-user-orders">',
              data.orders.map(function(o){
                const statusMap = { pending:'در انتظار', paid:'پرداخت‌شده', processing:'در حال پردازش', shipped:'ارسال‌شده', delivered:'تحویل‌شده', cancelled:'لغو‌شده', refunded:'مرجوعی' };
                const statusCls = { pending:'warn', paid:'info', processing:'info', shipped:'brand', delivered:'ok', cancelled:'danger', refunded:'danger' };
                return '<div class="adm-user-order">' +
                  '<div><b dir="ltr">' + esc(o.trackingCode) + '</b></div>' +
                  '<div>' + fa(o.total) + ' تومان</div>' +
                  '<div><span class="adm-bdg ' + (statusCls[o.status] || '') + '">' + (statusMap[o.status] || o.status) + '</span></div>' +
                '</div>';
              }).join(''),
            '</div>',
          '</div>'
        ].join('') : ''),

        '<div class="adm-user-section adm-user-actions-sec">',
          '<h4 class="adm-user-sec-title">عملیات</h4>',
          '<div class="adm-user-actions">',
            (u.role === 'admin'
              ? '<button class="adm-btn outline" data-act="role" data-role="user" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>تبدیل به کاربر</button>'
              : '<button class="adm-btn outline" data-act="role" data-role="admin" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>ارتقا به ادمین</button>'),
            '<button class="adm-btn outline" data-act="toggle" type="button">' + (u.isActive ? 'غیرفعال کردن' : 'فعال کردن') + '</button>',
            '<button class="adm-btn danger-out" data-act="delete" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>حذف کاربر</button>',
          '</div>',
        '</div>',

      '</div>',

      '<div class="adm-modal-foot">',
        '<button class="adm-btn outline" data-close type="button">بستن</button>',
      '</div>'
    ].join('');
  }

  openModal(paint(), 'wide');

  const sheet = document.querySelector('#modalBox');

  async function reload(){
    try{
      data = await apiGet('/users/' + userId + '/detail');
      Object.assign(u, data.user);
      Object.assign(s, data.stats);
      sheet.innerHTML = paint();
      bind();
    }catch(e){ toast('خطا: ' + e.message, 'err'); }
  }

  function bind(){
    sheet.querySelectorAll('[data-close]').forEach(function(b){ b.onclick = closeModal; });

    sheet.querySelectorAll('[data-act]').forEach(function(b){
      b.onclick = async function(){
        const act = b.dataset.act;

        if(act === 'role'){
          const role = b.dataset.role;
          const label = role === 'admin' ? 'ارتقا به ادمین' : 'تبدیل به کاربر';
          const ok = await confirmDialog({ title: label, message: 'آیا مطمئنید؟', confirmText: 'تأیید', danger: false });
          if(!ok) return;
          try{
            await apiPatch('/users/' + userId + '/role', { role: role });
            toast('نقش کاربر تغییر کرد.', 'ok');
            reload();
            if(state.refresh) state.refresh();
          }catch(e){ toast('خطا: ' + e.message, 'err'); }
        }

        if(act === 'toggle'){
          try{
            await apiPatch('/users/' + userId + '/toggle');
            toast(u.isActive ? 'کاربر غیرفعال شد.' : 'کاربر فعال شد.', 'ok');
            reload();
            if(state.refresh) state.refresh();
          }catch(e){ toast('خطا: ' + e.message, 'err'); }
        }

        if(act === 'delete'){
          const ok = await confirmDialog({ title: 'حذف کاربر', message: 'این کاربر برای همیشه حذف می‌شود. مطمئنید؟', confirmText: 'حذف کن' });
          if(!ok) return;
          try{
            const res = await apiDel('/users/' + userId);
            toast(res.message || 'کاربر حذف شد.', 'ok');
            closeModal();
            if(state.refresh) state.refresh();
          }catch(e){ toast('خطا: ' + e.message, 'err'); }
        }
      };
    });
  }

  bind();
}
async function renderReviews(root){
  root.innerHTML = `
    <div class="adm-sec-head"><h2>نظرات</h2></div>
    <div class="adm-card"><div class="adm-tbl-wrap"><table class="adm-tbl">
      <thead><tr><th>کاربر</th><th>محصول</th><th>امتیاز</th><th>متن</th><th>وضعیت</th><th class="col-actions">عملیات</th></tr></thead>
      <tbody id="revTbody"></tbody>
    </table></div></div>
  `;

  const tbody = $('#revTbody');
  const load = async ()=>{
    tbody.innerHTML = '<tr><td colspan="6"><div class="adm-sk adm-sk-row"></div></td></tr>';
    try{
      const res = await apiGet('/reviews');
      const list = res.reviews || [];
      if(!list.length){
        tbody.innerHTML = '<tr><td colspan="6"><div class="adm-empty"><h3>نظری وجود ندارد</h3></div></td></tr>';
        return;
      }
      tbody.innerHTML = list.map(r=>`
        <tr>
          <td><b>${esc(r.user?.name||'-')}</b><div class="adm-stat-lbl" dir="ltr">${esc(r.user?.email||'')}</div></td>
          <td>${esc(r.product?.name||'-')}</td>
          <td>${fa(r.rating)} ★</td>
          <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.comment)}</td>
          <td>${r.isApproved?'<span class="adm-bdg ok">تأیید</span>':'<span class="adm-bdg warn">در انتظار</span>'}</td>
          <td class="col-actions"><div class="adm-tbl-actions">
            <button class="adm-iconbtn-sm" data-approve="${r._id}" title="تأیید/لغو">${ic('check',16)}</button>
            <button class="adm-iconbtn-sm danger" data-del="${r._id}" title="حذف">${ic('trash',16)}</button>
          </div></td>
        </tr>
      `).join('');
      tbody.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>toggleRev(b.dataset.approve));
      tbody.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>deleteRev(b.dataset.del));
    }catch(e){ toast('خطا: '+e.message,'err'); }
  };

  async function toggleRev(id){
    try{ await apiPatch('/reviews/'+id+'/approve'); toast('وضعیت نظر تغییر کرد.','ok'); if(state.refresh) state.refresh(); }
    catch(e){ toast('خطا: '+e.message,'err'); }
  }
  async function deleteRev(id){
    const ok = await confirmDialog({ title:'حذف نظر', message:'این نظر حذف می‌شود.' });
    if(!ok) return;
    try{ await apiDel('/reviews/'+id); toast('نظر حذف شد.','ok'); if(state.refresh) state.refresh(); }
    catch(e){ toast('خطا: '+e.message,'err'); }
  }

  state.refresh = load;
  load();
}

/* ================================================================
   PAGE: Account
   ================================================================ */
async function renderAccount(root){
  const u = currentUser || {};
  root.innerHTML = `
    <div class="adm-sec-head"><h2>حساب من</h2></div>
    <div class="adm-card adm-card-pad" style="max-width:560px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div class="adm-avatar" style="width:56px;height:56px;font-size:22px">${esc((u.name||'م')[0])}</div>
        <div><div style="font-weight:800;font-size:16px">${esc(u.name||'-')}</div><div class="adm-stat-lbl" dir="ltr">${esc(u.email||'-')}</div></div>
      </div>
      <div class="adm-fld"><label>شماره موبایل</label><div dir="ltr">${esc(u.phone||'-')}</div></div>
      <div class="adm-fld"><label>نقش</label><div>${u.role==='admin'?'<span class="adm-bdg brand">ادمین</span>':'<span class="adm-bdg">کاربر</span>'}</div></div>
    </div>

    <div class="adm-card adm-card-pad" style="max-width:560px">
      <h3 style="margin:0 0 14px;font-size:15px">تغییر رمز عبور</h3>
      <form id="pwdForm">
        <div class="adm-fld"><label>رمز فعلی</label><input class="adm-input" type="password" name="current" dir="ltr"></div>
        <div class="adm-fld"><label>رمز جدید (حداقل ۶ کاراکتر)</label><input class="adm-input" type="password" name="next" dir="ltr"></div>
        <button class="adm-btn primary" type="submit" id="pwdBtn">${ic('check',18)} تغییر رمز</button>
      </form>
    </div>
  `;

  $('#pwdForm').onsubmit = async e=>{
    e.preventDefault();
    const f = e.target;
    const cur = f.elements.current.value;
    const nxt = f.elements.next.value;
    if(!cur || nxt.length<6){ toast('رمز جدید حداقل ۶ کاراکتر باشد.','warn'); return; }
    const btn = $('#pwdBtn');
    btn.disabled = true;
    try{
      await apiPut('/auth/change-password',{ currentPassword:cur, newPassword:nxt });
      toast('رمز عبور تغییر کرد.','ok');
      f.reset();
    }catch(err){ toast('خطا: '+err.message,'err'); }
    finally{ btn.disabled = false; }
  };
}


/* ================================================================
   PAGE: CMS Pages
   ================================================================ */

/* ================================================================
   PAGE: CMS Pages — Visual Editor
   ================================================================ */
async function renderCmsPages(root){
  root.innerHTML = `
    <div class="adm-sec-head">
      <h2>صفحات سایت</h2>
      <span class="adm-sec-sub" id="cmsPageCount">—</span>
      <div class="adm-sec-actions">
        <button class="adm-btn primary" id="cmsNewPage" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          صفحه جدید
        </button>
      </div>
    </div>

    <div class="adm-card" style="padding:14px 20px">
      <div class="adm-search" style="max-width:100%">
        <span class="adm-search-ic">${ic('search',18)}</span>
        <input id="cmsPageQ" placeholder="جستجوی عنوان یا آدرس..." autocomplete="off">
      </div>
    </div>

    <div class="cms-page-grid" id="cmsPageGrid"></div>
  `;

  const grid = root.querySelector('#cmsPageGrid');
  const countEl = root.querySelector('#cmsPageCount');
  let allPages = [];

  async function load(){
    grid.innerHTML = '<div class="adm-sk" style="height:190px;border-radius:16px"></div>'.repeat(4);
    try{
      const res = await apiGet('/cms/pages?all=true');
      allPages = res.pages || [];
      countEl.textContent = fa(allPages.length) + ' صفحه';
      paint();
    }catch(e){
      grid.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--adm-danger)">' + esc(e.message) + '</div>';
    }
  }

  function paint(){
    const q = root.querySelector('#cmsPageQ').value.trim().toLowerCase();
    const list = q
      ? allPages.filter(function(p){
          return (p.title || '').toLowerCase().indexOf(q) > -1 ||
                 (p.slug || '').toLowerCase().indexOf(q) > -1;
        })
      : allPages;

    if(!list.length){
      grid.innerHTML = '<div class="adm-empty" style="grid-column:1/-1;padding:56px 16px">' +
        '<div class="adm-empty-ic">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg>' +
        '</div>' +
        '<h3>' + (q ? 'صفحه‌ای پیدا نشد' : 'هنوز صفحه‌ای نساخته‌اید') + '</h3>' +
        '<p>' + (q ? 'عبارت دیگری را امتحان کنید.' : 'برای ساخت اولین صفحه روی «صفحه جدید» بزنید.') + '</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = list.map(function(p){
      var published = p.is_published
        ? '<span class="cms-page-badge is-pub">منتشرشده</span>'
        : '<span class="cms-page-badge is-draft">پیش‌نویس</span>';
      var menuBadge = p.show_in_menu
        ? '<span class="cms-page-badge is-menu">در منو</span>'
        : '';
      var excerpt = (p.content || '').replace(/<[^>]+>/g, '').trim().slice(0, 100);

      return '<div class="cms-page-card" data-page-id="' + p.id + '">' +
        '<div class="cms-page-card-top">' +
          '<div class="cms-page-card-icon">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>' +
          '</div>' +
          '<div class="cms-page-card-badges">' + published + menuBadge + '</div>' +
        '</div>' +
        '<h3 class="cms-page-card-title">' + esc(p.title || 'بدون عنوان') + '</h3>' +
        '<div class="cms-page-card-slug" dir="ltr">/' + esc(p.slug) + '</div>' +
        '<div class="cms-page-card-excerpt">' + (excerpt ? esc(excerpt) + '...' : 'بدون محتوا') + '</div>' +
        '<div class="cms-page-card-foot">' +
          '<button class="cms-page-btn is-view" data-act="view" data-id="' + p.id + '" title="پیش‌نمایش">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '<span>پیش‌نمایش</span>' +
          '</button>' +
          '<button class="cms-page-btn is-edit" data-act="edit" data-id="' + p.id + '" title="ویرایش">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>' +
            '<span>ویرایش</span>' +
          '</button>' +
          '<button class="cms-page-btn is-del" data-act="del" data-id="' + p.id + '" title="حذف">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('[data-act="edit"]').forEach(function(b){
      b.onclick = function(e){
        e.stopPropagation();
        var p = allPages.find(function(x){ return x.id === +b.dataset.id; });
        openPageEditor(p);
      };
    });
    grid.querySelectorAll('[data-act="view"]').forEach(function(b){
      b.onclick = function(e){
        e.stopPropagation();
        var p = allPages.find(function(x){ return x.id === +b.dataset.id; });
        openPagePreview(p);
      };
    });
    grid.querySelectorAll('[data-act="del"]').forEach(function(b){
      b.onclick = async function(e){
        e.stopPropagation();
        var p = allPages.find(function(x){ return x.id === +b.dataset.id; });
        var yes = await confirmDialog({
          title: 'حذف صفحه',
          message: 'صفحهٔ «' + p.title + '» حذف می‌شود. مطمئنید؟',
          confirmText: 'حذف کن'
        });
        if(!yes) return;
        try{
          await apiDel('/cms/pages/' + p.id);
          toast('صفحه حذف شد.', 'ok');
          load();
        }catch(err){ toast('خطا: ' + err.message, 'err'); }
      };
    });
    grid.querySelectorAll('.cms-page-card').forEach(function(c){
      c.onclick = function(){
        var p = allPages.find(function(x){ return x.id === +c.dataset.pageId; });
        openPageEditor(p);
      };
    });
  }

  root.querySelector('#cmsNewPage').onclick = function(){ openPageEditor(null); };
  var timer;
  root.querySelector('#cmsPageQ').addEventListener('input', function(){
    clearTimeout(timer); timer = setTimeout(paint, 250);
  });

  load();
}

/* ================================================================
   ادیتور تمام‌صفحه با پیش‌نمایش زنده
   ================================================================ */
function openPageEditor(page){
  var isEdit = !!page;
  var initial = {
    title: isEdit ? (page.title || '') : '',
    slug: isEdit ? (page.slug || '') : '',
    content: isEdit ? (page.content || '') : '<p>محتوای اینجا نوشته می‌شود...</p>',
    sort_order: isEdit ? (page.sort_order || 0) : 0,
    is_published: isEdit ? !!page.is_published : true,
    show_in_menu: isEdit ? !!page.show_in_menu : false,
    meta_title: isEdit ? (page.meta_title || '') : '',
    meta_description: isEdit ? (page.meta_description || '') : ''
  };

  openModal(
    '<div class="cms-editor-head">' +
      '<div class="cms-editor-head-l">' +
        '<div class="cms-editor-head-icon">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg>' +
        '</div>' +
        '<div>' +
          '<h3 class="cms-editor-head-title">' + (isEdit ? 'ویرایش صفحه' : 'صفحه جدید') + '</h3>' +
          '<span class="cms-editor-head-sub">' + (isEdit ? esc(page.slug) : 'صفحه‌ای تازه بسازید') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="cms-editor-head-r">' +
        (isEdit ? '<button class="cms-editor-btn" data-act="view-site" type="button" title="مشاهده در سایت"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg> در سایت</button>' : '') +
        '<button class="cms-editor-btn is-primary" id="cmsSaveBtn" type="button">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
          '<span>' + (isEdit ? 'ذخیره' : 'ساخت صفحه') + '</span>' +
        '</button>' +
        '<button class="cms-editor-btn is-ghost" data-act="close" type="button" aria-label="بستن">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>' +

    '<div class="cms-editor-meta">' +
      '<div class="cms-editor-field">' +
        '<label>عنوان</label>' +
        '<input id="cmsTitle" type="text" value="' + esc(initial.title) + '" placeholder="مثلاً: درباره ما">' +
      '</div>' +
      '<div class="cms-editor-field">' +
        '<label>آدرس (slug)</label>' +
        '<input id="cmsSlug" type="text" dir="ltr" value="' + esc(initial.slug) + '" placeholder="about-us">' +
      '</div>' +
      '<div class="cms-editor-field is-small">' +
        '<label>ترتیب</label>' +
        '<input id="cmsSort" type="number" value="' + initial.sort_order + '">' +
      '</div>' +
      '<div class="cms-editor-toggles">' +
        '<label class="cms-editor-toggle' + (initial.is_published ? ' is-on' : '') + '" id="togglePub">' +
          '<input type="checkbox" ' + (initial.is_published ? 'checked' : '') + '>' +
          '<span class="cms-editor-toggle-slider"></span>' +
          '<span class="cms-editor-toggle-lbl">منتشرشده</span>' +
        '</label>' +
        '<label class="cms-editor-toggle' + (initial.show_in_menu ? ' is-on' : '') + '" id="toggleMenu">' +
          '<input type="checkbox" ' + (initial.show_in_menu ? 'checked' : '') + '>' +
          '<span class="cms-editor-toggle-slider"></span>' +
          '<span class="cms-editor-toggle-lbl">نمایش در منو</span>' +
        '</label>' +
      '</div>' +
    '</div>' +

    '<div class="cms-editor-body">' +
      '<div class="cms-editor-pane is-editor">' +
        '<div class="cms-editor-toolbar">' +
          '<button type="button" data-insert="<strong>متن</strong>" title="ضخیم"><b>B</b></button>' +
          '<button type="button" data-insert="<em>متن</em>" title="کج"><i>I</i></button>' +
          '<button type="button" data-insert="<u>متن</u>" title="زیرخط"><u>U</u></button>' +
          '<span class="cms-editor-toolbar-sep"></span>' +
          '<button type="button" data-insert="<h2>عنوان بخش</h2>" title="عنوان ۲">H2</button>' +
          '<button type="button" data-insert="<h3>زیرعنوان</h3>" title="عنوان ۳">H3</button>' +
          '<span class="cms-editor-toolbar-sep"></span>' +
          '<button type="button" data-insert="<ul>\n  <li>مورد اول</li>\n  <li>مورد دوم</li>\n</ul>" title="لیست">≡</button>' +
          '<button type="button" data-insert="<p>پاراگراف جدید</p>" title="پاراگراف">¶</button>' +
          '<button type="button" data-insert="<a href=&quot;https://&quot;>لینک</a>" title="لینک">🔗</button>' +
          '<button type="button" data-insert="<img src=&quot;URL&quot; alt=&quot;&quot;>" title="تصویر">📷</button>' +
          '<span class="cms-editor-toolbar-sep"></span>' +
          '<button type="button" data-insert="<hr>" title="خط">―</button>' +
        '</div>' +
        '<textarea id="cmsContent" class="cms-editor-textarea" spellcheck="false" dir="ltr">' + esc(initial.content) + '</textarea>' +
      '</div>' +
      '<div class="cms-editor-pane is-preview">' +
        '<div class="cms-editor-preview-head">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '<span>پیش‌نمایش زنده</span>' +
        '</div>' +
        '<div class="cms-editor-preview-body" id="cmsPreview"></div>' +
      '</div>' +
    '</div>' +
    '<div class="cms-editor-foot">' +
      '<span class="cms-editor-hint">می‌توانید از HTML ساده استفاده کنید. تغییرات هم‌زمان در پیش‌نمایش دیده می‌شود.</span>' +
    '</div>',
    'cms-editor-modal'
  );

  var sheet = document.querySelector('#modalBox');
  var titleInput = sheet.querySelector('#cmsTitle');
  var slugInput = sheet.querySelector('#cmsSlug');
  var sortInput = sheet.querySelector('#cmsSort');
  var contentInput = sheet.querySelector('#cmsContent');
  var previewBox = sheet.querySelector('#cmsPreview');
  var pubToggle = sheet.querySelector('#togglePub');
  var menuToggle = sheet.querySelector('#toggleMenu');
  var saveBtn = sheet.querySelector('#cmsSaveBtn');

  /* پیش‌نمایش امن */
  function sanitize(html){

    /* __editor_sanitize_delegate__ */ if(typeof window.__sanitize === 'function') return window.__sanitize(html);
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript\s*:/gi, '');
  }

  function updatePreview(){
    previewBox.innerHTML = sanitize(contentInput.value);
    /* آپدیت عنوان */
    var h = previewBox.querySelector('.cms-preview-title');
    if(!h){
      h = document.createElement('h2');
      h.className = 'cms-preview-title';
      previewBox.insertBefore(h, previewBox.firstChild);
    }
    h.textContent = titleInput.value || 'بدون عنوان';
  }

  function autoSlug(){
    if(isEdit) return;
    var t = titleInput.value.trim();
    if(!t) return;
    slugInput.value = t.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]/g, '');
  }

  contentInput.addEventListener('input', updatePreview);
  titleInput.addEventListener('input', function(){
    updatePreview();
    if(!isEdit) autoSlug();
  });

  /* toggles */
  pubToggle.querySelector('input').addEventListener('change', function(e){
    pubToggle.classList.toggle('is-on', e.target.checked);
  });
  menuToggle.querySelector('input').addEventListener('change', function(e){
    menuToggle.classList.toggle('is-on', e.target.checked);
  });

  /* toolbar */
  sheet.querySelectorAll('[data-insert]').forEach(function(b){
    b.onclick = function(){
      var text = b.dataset.insert;
      var start = contentInput.selectionStart;
      var end = contentInput.selectionEnd;
      var before = contentInput.value.substring(0, start);
      var after = contentInput.value.substring(end);
      contentInput.value = before + text + after;
      contentInput.selectionStart = contentInput.selectionEnd = start + text.length;
      contentInput.focus();
      updatePreview();
    };
  });

  /* view in site */
  var viewBtn = sheet.querySelector('[data-act="view-site"]');
  if(viewBtn){
    viewBtn.onclick = function(){
      window.open('index.html?preview-page=' + encodeURIComponent(slugInput.value), '_blank');
    };
  }

  /* close */
  sheet.querySelectorAll('[data-act="close"]').forEach(function(b){
    b.onclick = closeModal;
  });

  /* save */
  saveBtn.onclick = async function(){
    var title = titleInput.value.trim();
    var slug = slugInput.value.trim();
    var content = contentInput.value;
    var sort = Number(sortInput.value) || 0;
    var isPub = pubToggle.querySelector('input').checked;
    var inMenu = menuToggle.querySelector('input').checked;

    if(title.length < 2){ toast('عنوان را وارد کنید.', 'warn'); titleInput.focus(); return; }
    if(!slug){ autoSlug(); slug = slugInput.value; }
    if(!slug){ toast('آدرس (slug) الزامی است.', 'warn'); slugInput.focus(); return; }

    var payload = {
      title: title,
      slug: slug,
      content: content,
      sort_order: sort,
      is_published: isPub,
      show_in_menu: inMenu,
      meta_title: initial.meta_title,
      meta_description: initial.meta_description
    };

    saveBtn.disabled = true;
    var oldHtml = saveBtn.innerHTML;
    saveBtn.innerHTML = 'در حال ذخیره...';

    try{
      if(isEdit) await apiPut('/cms/pages/' + page.id, payload);
      else await apiPost('/cms/pages', payload);
      toast(isEdit ? 'صفحه ذخیره شد.' : 'صفحه ساخته شد.', 'ok');
      closeModal();
      if(state.refresh) state.refresh();
    }catch(e){
      toast('خطا: ' + e.message, 'err');
      saveBtn.disabled = false;
      saveBtn.innerHTML = oldHtml;
    }
  };

  /* اول پیش‌نمایش */
  setTimeout(function(){ updatePreview(); titleInput.focus(); }, 60);
}

/* ================================================================
   پیش‌نمایش کامل صفحه
   ================================================================ */
function openPagePreview(page){
  var content = (window.__sanitize ? window.__sanitize(page.content || '') : String(page.content || ''));

  openModal(
    '<div class="cms-editor-head">' +
      '<div class="cms-editor-head-l">' +
        '<div class="cms-editor-head-icon">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
        '</div>' +
        '<div>' +
          '<h3 class="cms-editor-head-title">پیش‌نمایش صفحه</h3>' +
          '<span class="cms-editor-head-sub">' + esc(page.title) + ' — /' + esc(page.slug) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="cms-editor-head-r">' +
        '<button class="cms-editor-btn is-primary" data-act="close" type="button">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
          'بستن' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="cms-preview-full">' +
      '<div class="cms-preview-full-inner">' +
        '<h1 class="cms-preview-full-title">' + esc(page.title) + '</h1>' +
        '<div class="cms-page-content">' + content + '</div>' +
      '</div>' +
    '</div>',
    'cms-editor-modal'
  );
  var sheet = document.querySelector('#modalBox');
  sheet.querySelectorAll('[data-act="close"]').forEach(function(b){ b.onclick = closeModal; });
}



async function renderCmsBanners(root){
  root.innerHTML = `
    <div class="adm-sec-head">
      <h2>بنرها</h2>
      <span class="adm-sec-sub" id="cmsBanCount">—</span>
      <div class="adm-sec-actions"><button class="adm-btn primary" id="cmsNewBan" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> بنر جدید</button></div>
    </div>
    <div class="adm-cms-grid" id="cmsBanGrid"></div>
  `;

  const grid = root.querySelector('#cmsBanGrid');

  async function load(){
    grid.innerHTML = '<div class="adm-sk" style="height:220px;border-radius:14px"></div>'.repeat(3);
    try{
      const res = await apiGet('/cms/banners?all=true');
      const list = res.banners || [];
      root.querySelector('#cmsBanCount').textContent = fa(list.length) + ' بنر';
      if(!list.length){
        grid.innerHTML = '<div class="adm-empty" style="grid-column:1/-1;padding:56px 16px"><h3>بنری ثبت نشده</h3></div>';
        return;
      }
      grid.innerHTML = list.map(function(b){
        var active = b.is_active ? '<span class="adm-bdg ok">فعال</span>' : '<span class="adm-bdg">غیرفعال</span>';
        var img = window.__ASSET__ ? window.__ASSET__(b.image_url) : b.image_url;
        return '<div class="adm-cms-card">'
          + '<div class="adm-cms-img" style="background-image:url(' + JSON.stringify(img) + ')"><div class="adm-cms-img-overlay">' + active + '</div></div>'
          + '<div class="adm-cms-info"><b>' + esc(b.title || '(بدون عنوان)') + '</b><div class="adm-cms-meta"><span>' + esc(b.position || 'top') + '</span><span>ترتیب: ' + fa(b.sort_order || 0) + '</span></div></div>'
          + '<div class="adm-cms-actions">'
          + '<button class="adm-iconbtn-sm" data-edit="' + b.id + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/></svg></button>'
          + '<button class="adm-iconbtn-sm" data-toggle="' + b.id + '">' + (b.is_active ? '<svg width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="6" fill="currentColor"/><circle cx="17" cy="12" r="4" fill="#fff"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="7" cy="12" r="3" fill="currentColor"/></svg>') + '</button>'
          + '<button class="adm-iconbtn-sm danger" data-del="' + b.id + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>'
          + '</div></div>';
      }).join('');
      grid.querySelectorAll('[data-edit]').forEach(function(el){ el.onclick = function(){ openBannerForm(list.find(function(x){ return x.id === +el.dataset.edit; })); }; });
      grid.querySelectorAll('[data-toggle]').forEach(function(el){
        el.onclick = function(){
          var item = list.find(function(x){ return x.id === +el.dataset.toggle; });
          apiPut('/cms/banners/' + item.id, { is_active: !item.is_active }).then(load).catch(function(e){ toast('خطا: ' + e.message, 'err'); });
        };
      });
      grid.querySelectorAll('[data-del]').forEach(function(el){
        el.onclick = async function(){
          var ok = await confirmDialog({ title:'حذف', message:'مطمئنید؟', confirmText:'حذف' });
          if(!ok) return;
          try{ await apiDel('/cms/banners/' + el.dataset.del); toast('حذف شد.', 'ok'); load(); }catch(e){ toast('خطا: ' + e.message, 'err'); }
        };
      });
    }catch(e){
      grid.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--adm-danger)">' + esc(e.message) + '</div>';
    }
  }

  function openBannerForm(b){
    var isEdit = !!b;
    var currentUrl = b ? b.image_url : '';
    openModal(
      '<div class="adm-modal-head"><h3>' + (isEdit ? 'ویرایش بنر' : 'بنر جدید') + '</h3><button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'
      + '<div class="adm-modal-body">'
      + '<div class="adm-fld"><label>عنوان</label><input class="adm-input" id="cbTitle" value="' + esc(b ? b.title || '' : '') + '"></div>'
      + '<div class="adm-fld"><label>تصویر <span class="req">*</span></label>'
      + '<div class="adm-cms-img-picker" id="cbImgPicker" style="background-image:url(' + JSON.stringify(currentUrl ? (window.__ASSET__ ? window.__ASSET__(currentUrl) : currentUrl) : '') + ')"><div class="adm-cms-img-picker-empty">برای انتخاب کلیک کنید</div></div>'
      + '<input type="hidden" id="cbImg" value="' + esc(currentUrl) + '">'
      + '<label class="adm-btn outline sm" for="cbFile" style="margin-top:8px;display:inline-flex;cursor:pointer">آپلود از دستگاه</label>'
      + '<input type="file" id="cbFile" accept="image/*" style="display:none" onchange="window.__cmsBannerPick && window.__cmsBannerPick(this)">'
      + '</div>'
      + '<div class="adm-fld"><label>لینک (اختیاری)</label><input class="adm-input" id="cbLink" dir="ltr" value="' + esc(b ? b.link || '' : '') + '"></div>'
      + '<div class="adm-grid-2"><div class="adm-fld"><label>موقعیت</label><select class="adm-select" id="cbPos">'
      + ['top','middle','sidebar','footer'].map(function(v){ return '<option value="' + v + '" ' + ((b && b.position === v) || (!b && v === 'top') ? 'selected' : '') + '>' + v + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="adm-fld"><label>ترتیب</label><input class="adm-input" id="cbSort" inputmode="numeric" value="' + ((b && b.sort_order) || 0) + '"></div></div>'
      + '<div class="adm-fld"><label style="display:flex;gap:8px"><input type="checkbox" id="cbActive" ' + ((!b || b.is_active) ? 'checked' : '') + '> فعال</label></div>'
      + '</div>'
      + '<div class="adm-modal-foot"><button class="adm-btn outline" data-close type="button">انصراف</button><button class="adm-btn primary" id="cbSave" type="button">' + (isEdit ? 'ذخیره' : 'افزودن') + '</button></div>'
    );
    var picker = document.querySelector('#cbImgPicker');
    if(picker) picker.onclick = function(){ document.querySelector('#cbFile').click(); };
    window.__cmsBannerPick = function(input){
      var f = input.files && input.files[0];
      input.value = '';
      if(!f) return;
      if(f.size > 5 * 1024 * 1024){ toast('حجم بیش از ۵ مگابایت.', 'warn'); return; }
      picker.innerHTML = '<div class="adm-cms-img-picker-loading">در حال آپلود...</div>';
      var API = window.__API_BASE || (typeof API !== 'undefined' ? API : '');
      var fd = new FormData();
      fd.append('image', f);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API + '/upload/product-single', true);
      xhr.withCredentials = true;
      xhr.onload = function(){
        try{
          var r = JSON.parse(xhr.responseText || '{}');
          if(xhr.status >= 200 && xhr.status < 300 && r.success){
            document.querySelector('#cbImg').value = r.url;
            picker.style.backgroundImage = 'url(' + JSON.stringify(window.__ASSET__ ? window.__ASSET__(r.url) : r.url) + ')';
            picker.innerHTML = '<div class="adm-cms-img-picker-empty"></div>';
            toast('آپلود شد.', 'ok');
          }else{
            picker.innerHTML = '<div class="adm-cms-img-picker-empty">کلیک کنید</div>';
            toast('خطا: ' + (r.message || '?'), 'err');
          }
        }catch(e){ picker.innerHTML = '<div class="adm-cms-img-picker-empty">کلیک کنید</div>'; toast('خطای پاسخ', 'err'); }
      };
      xhr.onerror = function(){ picker.innerHTML = '<div class="adm-cms-img-picker-empty">کلیک کنید</div>'; toast('خطای شبکه', 'err'); };
      xhr.send(fd);
    };
    document.querySelector('#cbSave').onclick = async function(){
      var payload = {
        title: document.querySelector('#cbTitle').value.trim(),
        image_url: document.querySelector('#cbImg').value,
        link: document.querySelector('#cbLink').value.trim(),
        position: document.querySelector('#cbPos').value,
        sort_order: Number(document.querySelector('#cbSort').value) || 0,
        is_active: document.querySelector('#cbActive').checked
      };
      if(!payload.image_url){ toast('تصویر الزامی است.', 'warn'); return; }
      try{
        if(isEdit) await apiPut('/cms/banners/' + b.id, payload);
        else       await apiPost('/cms/banners', payload);
        toast(isEdit ? 'ویرایش شد.' : 'افزوده شد.', 'ok');
        closeModal(); load();
      }catch(e){ toast('خطا: ' + e.message, 'err'); }
    };
  }

  root.querySelector('#cmsNewBan').onclick = function(){ openBannerForm(null); };
  load();
}

/* ================================================================
   PAGE: CMS Sliders
   ================================================================ */
async function renderCmsSliders(root){
  root.innerHTML = `
    <div class="adm-sec-head">
      <h2>اسلایدر</h2>
      <span class="adm-sec-sub" id="cmsSlCount">—</span>
      <div class="adm-sec-actions"><button class="adm-btn primary" id="cmsNewSl" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> اسلاید جدید</button></div>
    </div>
    <div class="adm-cms-grid" id="cmsSlGrid"></div>
  `;

  const grid = root.querySelector('#cmsSlGrid');

  async function load(){
    grid.innerHTML = '<div class="adm-sk" style="height:220px;border-radius:14px"></div>'.repeat(3);
    try{
      const res = await apiGet('/cms/sliders?all=true');
      const list = res.sliders || [];
      root.querySelector('#cmsSlCount').textContent = fa(list.length) + ' اسلاید';
      if(!list.length){
        grid.innerHTML = '<div class="adm-empty" style="grid-column:1/-1;padding:56px 16px"><h3>اسلایدی ثبت نشده</h3></div>';
        return;
      }
      grid.innerHTML = list.map(function(s){
        var active = s.is_active ? '<span class="adm-bdg ok">فعال</span>' : '<span class="adm-bdg">غیرفعال</span>';
        var img = window.__ASSET__ ? window.__ASSET__(s.image_url) : s.image_url;
        return '<div class="adm-cms-card">'
          + '<div class="adm-cms-img" style="background-image:url(' + JSON.stringify(img) + ')"><div class="adm-cms-img-overlay">' + active + '</div></div>'
          + '<div class="adm-cms-info"><b>' + esc(s.title || '(بدون عنوان)') + '</b><div class="adm-cms-meta"><span>' + esc(s.subtitle || '') + '</span><span>ترتیب: ' + fa(s.sort_order || 0) + '</span></div></div>'
          + '<div class="adm-cms-actions">'
          + '<button class="adm-iconbtn-sm" data-edit="' + s.id + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/></svg></button>'
          + '<button class="adm-iconbtn-sm" data-toggle="' + s.id + '">' + (s.is_active ? '<svg width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="6" fill="currentColor"/><circle cx="17" cy="12" r="4" fill="#fff"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="7" cy="12" r="3" fill="currentColor"/></svg>') + '</button>'
          + '<button class="adm-iconbtn-sm danger" data-del="' + s.id + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>'
          + '</div></div>';
      }).join('');
      grid.querySelectorAll('[data-edit]').forEach(function(el){ el.onclick = function(){ openSliderForm(list.find(function(x){ return x.id === +el.dataset.edit; })); }; });
      grid.querySelectorAll('[data-toggle]').forEach(function(el){
        el.onclick = function(){
          var item = list.find(function(x){ return x.id === +el.dataset.toggle; });
          apiPut('/cms/sliders/' + item.id, { is_active: !item.is_active }).then(load).catch(function(e){ toast('خطا: ' + e.message, 'err'); });
        };
      });
      grid.querySelectorAll('[data-del]').forEach(function(el){
        el.onclick = async function(){
          var ok = await confirmDialog({ title:'حذف', message:'مطمئنید؟', confirmText:'حذف' });
          if(!ok) return;
          try{ await apiDel('/cms/sliders/' + el.dataset.del); toast('حذف شد.', 'ok'); load(); }catch(e){ toast('خطا: ' + e.message, 'err'); }
        };
      });
    }catch(e){
      grid.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--adm-danger)">' + esc(e.message) + '</div>';
    }
  }

  function openSliderForm(s){
    var isEdit = !!s;
    var currentUrl = s ? s.image_url : '';
    openModal(
      '<div class="adm-modal-head"><h3>' + (isEdit ? 'ویرایش اسلاید' : 'اسلاید جدید') + '</h3><button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'
      + '<div class="adm-modal-body">'
      + '<div class="adm-grid-2"><div class="adm-fld"><label>عنوان</label><input class="adm-input" id="csTitle" value="' + esc(s ? s.title || '' : '') + '"></div>'
      + '<div class="adm-fld"><label>زیرعنوان</label><input class="adm-input" id="csSubtitle" value="' + esc(s ? s.subtitle || '' : '') + '"></div></div>'
      + '<div class="adm-fld"><label>تصویر <span class="req">*</span></label>'
      + '<div class="adm-cms-img-picker" id="csImgPicker" style="background-image:url(' + JSON.stringify(currentUrl ? (window.__ASSET__ ? window.__ASSET__(currentUrl) : currentUrl) : '') + ')"><div class="adm-cms-img-picker-empty">برای انتخاب کلیک کنید</div></div>'
      + '<input type="hidden" id="csImg" value="' + esc(currentUrl) + '">'
      + '<label class="adm-btn outline sm" for="csFile" style="margin-top:8px;display:inline-flex;cursor:pointer">آپلود از دستگاه</label>'
      + '<input type="file" id="csFile" accept="image/*" style="display:none" onchange="window.__cmsSliderPick && window.__cmsSliderPick(this)">'
      + '</div>'
      + '<div class="adm-grid-2"><div class="adm-fld"><label>لینک</label><input class="adm-input" id="csLink" dir="ltr" value="' + esc(s ? s.link || '' : '') + '"></div>'
      + '<div class="adm-fld"><label>متن دکمه</label><input class="adm-input" id="csBtn" value="' + esc(s ? s.button_text || 'مشاهده' : 'مشاهده') + '"></div></div>'
      + '<div class="adm-grid-2"><div class="adm-fld"><label>رنگ پس‌زمینه</label><input class="adm-input" id="csBg" dir="ltr" value="' + esc(s ? s.bg_color || '#0f172a' : '#0f172a') + '"></div>'
      + '<div class="adm-fld"><label>ترتیب</label><input class="adm-input" id="csSort" inputmode="numeric" value="' + ((s && s.sort_order) || 0) + '"></div></div>'
      + '<div class="adm-fld"><label style="display:flex;gap:8px"><input type="checkbox" id="csActive" ' + ((!s || s.is_active) ? 'checked' : '') + '> فعال</label></div>'
      + '</div>'
      + '<div class="adm-modal-foot"><button class="adm-btn outline" data-close type="button">انصراف</button><button class="adm-btn primary" id="csSave" type="button">' + (isEdit ? 'ذخیره' : 'افزودن') + '</button></div>'
    );
    var picker = document.querySelector('#csImgPicker');
    if(picker) picker.onclick = function(){ document.querySelector('#csFile').click(); };
    window.__cmsSliderPick = function(input){
      var f = input.files && input.files[0];
      input.value = '';
      if(!f) return;
      if(f.size > 5 * 1024 * 1024){ toast('حجم بیش از ۵ مگابایت.', 'warn'); return; }
      picker.innerHTML = '<div class="adm-cms-img-picker-loading">در حال آپلود...</div>';
      var API = window.__API_BASE || (typeof API !== 'undefined' ? API : '');
      var fd = new FormData();
      fd.append('image', f);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API + '/upload/product-single', true);
      xhr.withCredentials = true;
      xhr.onload = function(){
        try{
          var r = JSON.parse(xhr.responseText || '{}');
          if(xhr.status >= 200 && xhr.status < 300 && r.success){
            document.querySelector('#csImg').value = r.url;
            picker.style.backgroundImage = 'url(' + JSON.stringify(window.__ASSET__ ? window.__ASSET__(r.url) : r.url) + ')';
            picker.innerHTML = '<div class="adm-cms-img-picker-empty"></div>';
            toast('آپلود شد.', 'ok');
          }else{
            picker.innerHTML = '<div class="adm-cms-img-picker-empty">کلیک کنید</div>';
            toast('خطا: ' + (r.message || '?'), 'err');
          }
        }catch(e){ picker.innerHTML = '<div class="adm-cms-img-picker-empty">کلیک کنید</div>'; toast('خطای پاسخ', 'err'); }
      };
      xhr.onerror = function(){ picker.innerHTML = '<div class="adm-cms-img-picker-empty">کلیک کنید</div>'; toast('خطای شبکه', 'err'); };
      xhr.send(fd);
    };
    document.querySelector('#csSave').onclick = async function(){
      var payload = {
        title: document.querySelector('#csTitle').value.trim(),
        subtitle: document.querySelector('#csSubtitle').value.trim(),
        image_url: document.querySelector('#csImg').value,
        link: document.querySelector('#csLink').value.trim(),
        button_text: document.querySelector('#csBtn').value.trim(),
        bg_color: document.querySelector('#csBg').value.trim(),
        sort_order: Number(document.querySelector('#csSort').value) || 0,
        is_active: document.querySelector('#csActive').checked
      };
      if(!payload.image_url){ toast('تصویر الزامی است.', 'warn'); return; }
      try{
        if(isEdit) await apiPut('/cms/sliders/' + s.id, payload);
        else       await apiPost('/cms/sliders', payload);
        toast(isEdit ? 'ویرایش شد.' : 'افزوده شد.', 'ok');
        closeModal(); load();
      }catch(e){ toast('خطا: ' + e.message, 'err'); }
    };
  }

  root.querySelector('#cmsNewSl').onclick = function(){ openSliderForm(null); };
  load();
}


/* ================================================================
   FEATURES — آیتم‌های فروشگاه
   ================================================================ */


/* ================================================================
   FESTIVALS — جشنواره‌ها
   ================================================================ */




/* ================================================================
   FEATURES — آیتم‌های فروشگاه با آپلود عکس
   ================================================================ */
async function renderSiteFeatures(root){
  root.innerHTML = `
    <div class="adm-sec-head">
      <h2>آیتم‌های فروشگاه</h2>
      <span class="adm-sec-sub" id="featCount">—</span>
      <div class="adm-sec-actions">
        <button class="adm-btn primary" id="featNew" type="button">${ic('plus',15)} آیتم جدید</button>
      </div>
    </div>
    <div class="adm-card" style="padding:16px">
      <div class="adm-hint" style="margin:0 0 12px">این آیتم‌ها در ردیف زیر اسلایدر صفحه اصلی نمایش داده می‌شوند. می‌توانید آیکون SVG یا عکس دلخواه بگذارید.</div>
      <div class="site-feat-preview" id="featList"></div>
    </div>
  `;

  const list = root.querySelector('#featList');
  const cnt = root.querySelector('#featCount');
  let items = [];

  async function load(){
    list.innerHTML = '<div class="adm-sk" style="height:80px;border-radius:12px"></div>'.repeat(2);
    try{
      const r = await apiGet('/site/features?all=true');
      items = r.features || [];
      cnt.textContent = fa(items.length) + ' آیتم';
      paint();
    }catch(e){ list.innerHTML = '<div style="padding:20px;color:var(--adm-danger)">' + esc(e.message) + '</div>'; }
  }

  function paint(){
    if(!items.length){
      list.innerHTML = '<div class="adm-empty" style="padding:32px"><h3>آیتمی نیست</h3></div>';
      return;
    }
    list.innerHTML = items.map(function(f){
      var thumb = f.image_url
        ? '<div class="site-feat-thumb" style="background-image:url(' + JSON.stringify(window.__ASSET__ ? window.__ASSET__(f.image_url) : f.image_url) + ')"></div>'
        : '<div class="site-feat-ic" style="background:color-mix(in srgb,' + f.color + ' 14%, transparent);color:' + f.color + '">' + ic(f.icon || 'shield', 20) + '</div>';
      return '<div class="site-feat-row" data-id="' + f.id + '">' +
        thumb +
        '<div class="site-feat-body">' +
          '<b>' + esc(f.title) + '</b>' +
          '<span>' + esc(f.subtitle || '') + '</span>' +
        '</div>' +
        '<div class="site-feat-badge">' + (f.is_active ? '<span class="adm-bdg ok">فعال</span>' : '<span class="adm-bdg">غیرفعال</span>') + '</div>' +
        '<div class="site-feat-btns">' +
          '<button class="adm-iconbtn-sm" data-edit="' + f.id + '" title="ویرایش">' + ic('edit', 16) + '</button>' +
          '<button class="adm-iconbtn-sm" data-toggle="' + f.id + '" title="فعال/غیرفعال">' + ic('toggleOn', 16) + '</button>' +
          '<button class="adm-iconbtn-sm danger" data-del="' + f.id + '" title="حذف">' + ic('trash', 16) + '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('[data-edit]').forEach(function(b){
      b.onclick = function(){ openFeatureForm(items.find(function(x){ return x.id === +b.dataset.edit; })); };
    });
    list.querySelectorAll('[data-toggle]').forEach(function(b){
      b.onclick = async function(){
        var it = items.find(function(x){ return x.id === +b.dataset.toggle; });
        try{ await apiPut('/site/features/' + it.id, Object.assign({}, it, { is_active: !it.is_active })); load(); }
        catch(e){ toast(e.message, 'err'); }
      };
    });
    list.querySelectorAll('[data-del]').forEach(function(b){
      b.onclick = async function(){
        var yes = await confirmDialog({ title:'حذف', message:'مطمئنید؟', confirmText:'حذف' });
        if(!yes) return;
        try{ await apiDel('/site/features/' + b.dataset.del); load(); toast('حذف شد.', 'ok'); }
        catch(e){ toast(e.message, 'err'); }
      };
    });
  }

  function openFeatureForm(f){
    var isEdit = !!f;
    var icons = ['truck','shield','ret','card','bag','check','star','heart','user','home'];
    var imgUrl = f ? (f.image_url || '') : '';
    openModal(
      '<div class="adm-modal-head"><h3>' + (isEdit ? 'ویرایش آیتم' : 'آیتم جدید') + '</h3>' +
        '<button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">' + ic('x', 18) + '</button></div>' +
      '<div class="adm-modal-body">' +
        '<div class="adm-fld"><label>عنوان <span class="req">*</span></label>' +
          '<input class="adm-input" id="feTitle" value="' + esc(f ? f.title : '') + '" data-autofocus></div>' +
        '<div class="adm-fld"><label>زیرعنوان</label>' +
          '<input class="adm-input" id="feSub" value="' + esc(f ? f.subtitle || '' : '') + '"></div>' +
        '<div class="adm-fld"><label>تصویر (اختیاری — جایگزین آیکون می‌شود)</label>' +
          '<div class="adm-img-picker" id="feImgPicker" style="background-image:url(' + JSON.stringify(imgUrl ? (window.__ASSET__ ? window.__ASSET__(imgUrl) : imgUrl) : '') + ')">' +
            (imgUrl ? '' : '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>') +
          '</div>' +
          '<input type="hidden" id="feImg" value="' + esc(imgUrl) + '">' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
            '<label class="adm-btn outline sm" for="feFile" style="cursor:pointer;display:inline-flex">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>' +
              'آپلود از دستگاه' +
            '</label>' +
            (imgUrl ? '<button class="adm-btn outline sm" type="button" id="feImgClear">حذف تصویر</button>' : '') +
          '</div>' +
          '<input type="file" id="feFile" accept="image/*" style="display:none" onchange="window.__pickAdmImg(this, \'feImg\', \'feImgPicker\')">' +
        '</div>' +
        '<div class="adm-grid-2">' +
          '<div class="adm-fld"><label>آیکون (اگر عکس نبود)</label>' +
            '<select class="adm-select" id="feIcon">' +
              icons.map(function(i){ return '<option value="' + i + '"' + ((f && f.icon === i) || (!f && i === 'shield') ? 'selected' : '') + '>' + i + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="adm-fld"><label>رنگ آیکون</label>' +
            '<input class="adm-input" id="feColor" dir="ltr" value="' + esc(f ? f.color : '#c81e3a') + '"></div>' +
        '</div>' +
        '<div class="adm-fld"><label>ترتیب</label>' +
          '<input class="adm-input" id="feSort" type="number" value="' + ((f && f.sort_order) || 0) + '"></div>' +
        '<div class="adm-fld"><label><input type="checkbox" id="feActive" ' + ((!f || f.is_active) ? 'checked' : '') + '> فعال</label></div>' +
      '</div>' +
      '<div class="adm-modal-foot">' +
        '<button class="adm-btn outline" data-close type="button">انصراف</button>' +
        '<button class="adm-btn primary" id="feSave" type="button">' + (isEdit ? 'ذخیره' : 'افزودن') + '</button>' +
      '</div>'
    );

    var picker = document.querySelector('#feImgPicker');
    picker.onclick = function(){ document.querySelector('#feFile').click(); };

    var clearBtn = document.querySelector('#feImgClear');
    if(clearBtn){
      clearBtn.onclick = function(){
        document.querySelector('#feImg').value = '';
        picker.style.backgroundImage = '';
        picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
        clearBtn.remove();
      };
    }

    document.querySelector('#feSave').onclick = async function(){
      var p = {
        title: document.querySelector('#feTitle').value.trim(),
        subtitle: document.querySelector('#feSub').value.trim(),
        icon: document.querySelector('#feIcon').value,
        color: document.querySelector('#feColor').value.trim(),
        image_url: document.querySelector('#feImg').value,
        sort_order: Number(document.querySelector('#feSort').value) || 0,
        is_active: document.querySelector('#feActive').checked
      };
      if(!p.title){ toast('عنوان لازم است.', 'warn'); return; }
      try{
        if(isEdit) await apiPut('/site/features/' + f.id, p);
        else await apiPost('/site/features', p);
        closeModal(); load(); toast('ذخیره شد.', 'ok');
      }catch(e){ toast(e.message, 'err'); }
    };
  }

  root.querySelector('#featNew').onclick = function(){ openFeatureForm(null); };
  load();
}

/* ================================================================
   FESTIVALS — جشنواره‌ها (کامل و کارا)
   ================================================================ */


/* ================================================================
   CATEGORIES با آپلود عکس
   ================================================================ */
async function renderCategories(root){
  root.innerHTML = `
    <div class="adm-sec-head">
      <h2>دسته‌بندی‌ها</h2>
      <span class="adm-sec-sub" id="catCount">—</span>
      <div class="adm-sec-actions">
        <button class="adm-btn primary" id="catNew" type="button">${ic('plus',15)} دسته جدید</button>
      </div>
    </div>
    <div class="adm-card" style="padding:16px">
      <div class="adm-hint" style="margin:0 0 12px">این دسته‌ها در تب‌های بالای سایت و بخش «خرید بر اساس دسته‌بندی» نمایش داده می‌شوند. می‌توانید برای هر دسته عکس بگذارید.</div>
      <div id="catGrid" class="cat-grid-admin"></div>
    </div>
  `;

  const grid = root.querySelector('#catGrid');
  const cnt = root.querySelector('#catCount');
  let cats = [];

  async function load(){
    grid.innerHTML = '<div class="adm-sk" style="height:180px;border-radius:14px"></div>'.repeat(4);
    try{
      const r = await apiGet('/categories?all=true');
      cats = r.categories || [];
      cnt.textContent = fa(cats.length) + ' دسته';
      paint();
    }catch(e){ grid.innerHTML = '<div style="padding:20px;color:var(--adm-danger)">' + esc(e.message) + '</div>'; }
  }

  function paint(){
    if(!cats.length){
      grid.innerHTML = '<div class="adm-empty" style="padding:32px;grid-column:1/-1"><h3>دسته‌ای نیست</h3></div>';
      return;
    }
    grid.innerHTML = cats.map(function(c){
      var thumb = c.image_url
        ? '<div class="cat-card-thumb" style="background-image:url(' + JSON.stringify(window.__ASSET__ ? window.__ASSET__(c.image_url) : c.image_url) + ')"></div>'
        : '<div class="cat-card-thumb" style="background:color-mix(in srgb,' + c.color + ' 14%, var(--adm-surface-2));color:' + c.color + '">' + ic(c.icon || 'grid', 32) + '</div>';
      return '<div class="cat-card-admin" data-id="' + c.id + '">' +
        thumb +
        '<div class="cat-card-info">' +
          '<b>' + esc(c.name) + '</b>' +
          '<span>' + fa(c.productCount || 0) + ' محصول</span>' +
        '</div>' +
        '<div class="cat-card-actions">' +
          '<button class="adm-iconbtn-sm" data-edit="' + c.id + '" title="ویرایش">' + ic('edit', 16) + '</button>' +
          '<button class="adm-iconbtn-sm danger" data-del="' + c.id + '" title="حذف">' + ic('trash', 16) + '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('[data-edit]').forEach(function(b){
      b.onclick = function(){ openCatForm(cats.find(function(x){ return x.id === +b.dataset.edit; })); };
    });
    grid.querySelectorAll('[data-del]').forEach(function(b){
      b.onclick = async function(){
        var yes = await confirmDialog({ title:'حذف', message:'مطمئنید؟', confirmText:'حذف' });
        if(!yes) return;
        try{ await apiDel('/categories/' + b.dataset.del); load(); toast('حذف شد.', 'ok'); }
        catch(e){ toast(e.message, 'err'); }
      };
    });
  }

  function openCatForm(c){
    var isEdit = !!c;
    var imgUrl = c ? (c.image_url || '') : '';
    var icons = ['grid','phone','laptop','headphones','watch','sneaker','kettle','book','home','bag'];
    openModal(
      '<div class="adm-modal-head"><h3>' + (isEdit ? 'ویرایش دسته' : 'دسته جدید') + '</h3>' +
        '<button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">' + ic('x', 18) + '</button></div>' +
      '<div class="adm-modal-body">' +
        '<div class="adm-fld"><label>نام <span class="req">*</span></label>' +
          '<input class="adm-input" id="catName" value="' + esc(c ? c.name : '') + '" data-autofocus></div>' +
        '<div class="adm-fld"><label>تصویر (اختیاری)</label>' +
          '<div class="adm-img-picker" id="catImgPicker" style="background-image:url(' + JSON.stringify(imgUrl ? (window.__ASSET__ ? window.__ASSET__(imgUrl) : imgUrl) : '') + ')">' +
            (imgUrl ? '' : '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>') +
          '</div>' +
          '<input type="hidden" id="catImg" value="' + esc(imgUrl) + '">' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
            '<label class="adm-btn outline sm" for="catFile" style="cursor:pointer;display:inline-flex">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>' +
              'آپلود از دستگاه' +
            '</label>' +
            (imgUrl ? '<button class="adm-btn outline sm" type="button" id="catImgClear">حذف تصویر</button>' : '') +
          '</div>' +
          '<input type="file" id="catFile" accept="image/*" style="display:none" onchange="window.__pickAdmImg(this, \'catImg\', \'catImgPicker\')">' +
        '</div>' +
        '<div class="adm-grid-2">' +
          '<div class="adm-fld"><label>آیکون (اگر عکس نبود)</label>' +
            '<select class="adm-select" id="catIcon">' +
              icons.map(function(i){ return '<option value="' + i + '"' + ((c && c.icon === i) || (!c && i === 'grid') ? 'selected' : '') + '>' + i + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="adm-fld"><label>رنگ</label>' +
            '<input class="adm-input" id="catColor" dir="ltr" value="' + esc(c ? c.color : '#3b82f6') + '"></div>' +
        '</div>' +
        '<div class="adm-fld"><label>ترتیب</label>' +
          '<input class="adm-input" id="catOrder" type="number" value="' + ((c && c.order) || 0) + '"></div>' +
      '</div>' +
      '<div class="adm-modal-foot">' +
        '<button class="adm-btn outline" data-close type="button">انصراف</button>' +
        '<button class="adm-btn primary" id="catSave" type="button">' + (isEdit ? 'ذخیره' : 'افزودن') + '</button>' +
      '</div>'
    );

    var picker = document.querySelector('#catImgPicker');
    picker.onclick = function(){ document.querySelector('#catFile').click(); };

    var clearBtn = document.querySelector('#catImgClear');
    if(clearBtn){
      clearBtn.onclick = function(){
        document.querySelector('#catImg').value = '';
        picker.style.backgroundImage = '';
        picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
        clearBtn.remove();
      };
    }

    document.querySelector('#catSave').onclick = async function(){
      var p = {
        name: document.querySelector('#catName').value.trim(),
        icon: document.querySelector('#catIcon').value,
        color: document.querySelector('#catColor').value.trim(),
        image_url: document.querySelector('#catImg').value,
        order: Number(document.querySelector('#catOrder').value) || 0
      };
      if(!p.name){ toast('نام لازم است.', 'warn'); return; }
      try{
        if(isEdit) await apiPut('/categories/' + c.id, p);
        else await apiPost('/categories', p);
        closeModal(); load(); toast('ذخیره شد.', 'ok');
      }catch(e){ toast(e.message, 'err'); }
    };
  }

  root.querySelector('#catNew').onclick = function(){ openCatForm(null); };
  load();
}




/* ================================================================
   تاریخ شمسی + شمارش زمان
   ================================================================ */
function toJalali(date){
  if(!date) return '';
  var d = date instanceof Date ? date : new Date(date);
  if(isNaN(d.getTime())) return '';
  try{
    var fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    return fmt.format(d);
  }catch(e){
    return d.toLocaleString('fa-IR');
  }
}

function toJalaliDate(date){
  if(!date) return '';
  var d = date instanceof Date ? date : new Date(date);
  if(isNaN(d.getTime())) return '';
  try{
    var fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    return fmt.format(d);
  }catch(e){ return ''; }
}

/* تبدیل تاریخ شمسی → میلادی */

function parseLocalDate(s){
  if(!s) return null;
  /* حذف Z و میلی‌ثانیه — چون ذخیره به وقت محلی هست */
  var str = String(s).replace(' ', 'T').replace(/Z$/, '').replace(/\.\d+$/, '');
  /* حذف +00:00 یا +03:30 آخر */
  str = str.replace(/[+-]\d{2}:\d{2}$/, '');
  var d = new Date(str);
  if(isNaN(d.getTime())) return null;
  return d;
}


/* زمان باقی‌مانده — بر اساس زمان محلی */
function timeLeft(endsAt){
  if(!endsAt) return { text: 'بدون پایان', expired: false };
  var endDate = parseLocalDate(endsAt);
  if(!endDate) return { text: 'نامعتبر', expired: true };

  var end = endDate.getTime();
  var diff = end - Date.now();

  if(diff <= 0) return { text: 'به پایان رسیده', expired: true };

  var sec = Math.floor(diff / 1000);
  var d = Math.floor(sec / 86400);
  var h = Math.floor((sec % 86400) / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var ss = sec % 60;
  var fa = function(n){ return String(n).padStart(2, '0').replace(/\d/g, function(x){ return '۰۱۲۳۴۵۶۷۸۹'[x]; }); };

  if(d > 0) return { text: fa(d) + ' روز و ' + fa(h) + ' ساعت', expired: false };
  if(h > 0) return { text: fa(h) + ' ساعت و ' + fa(m) + ' دقیقه', expired: false };
  if(m > 0) return { text: fa(m) + ' دقیقه و ' + fa(ss) + ' ثانیه', expired: false };
  return { text: fa(ss) + ' ثانیه', expired: false };
}

function jalaliToDate(jy, jm, jd, hh, mm){
  jy = Number(jy); jm = Number(jm); jd = Number(jd);
  hh = Number(hh) || 0; mm = Number(mm) || 0;

  /* الگوریتم تبدیل جلالی به میلادی */
  var gy, gm, gd;
  jy += 1595;
  var days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if(days > 36524){
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if(days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if(days > 365){
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  gd = days + 1;
  var sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for(gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];

  var dt = new Date(gy, gm - 1, gd, hh, mm, 0, 0);
  return dt;
}

/* زمان باقی‌مانده به فرمت خوانا */




/* ================================================================
   FESTIVALS — مدیریت کامل با تایمر و تاریخ شمسی
   ================================================================ */
async function renderSiteFestivals(root){
  root.innerHTML = [
    '<div class="adm-sec-head">',
      '<h2>جشنواره‌ها</h2>',
      '<span class="adm-sec-sub" id="fesCount">—</span>',
      '<div class="adm-sec-actions">',
        '<button class="adm-btn primary" id="fesNew" type="button">' + ic('plus',15) + ' جشنواره جدید</button>',
      '</div>',
    '</div>',
    '<div class="adm-card" style="padding:16px">',
      '<div class="adm-hint" style="margin:0 0 14px">جشنواره‌ی فعال با <b>نزدیک‌ترین زمان پایان</b> در سایت نمایش داده می‌شود.</div>',
      '<div id="fesList"></div>',
    '</div>'
  ].join('');

  const list = root.querySelector('#fesList');
  const cnt = root.querySelector('#fesCount');
  let items = [];
  let tickInt = null;

  async function load(){
    list.innerHTML = '<div class="adm-sk" style="height:280px;border-radius:16px"></div>';
    try{
      const r = await apiGet('/site/festivals?all=true');
      items = r.festivals || [];
      cnt.textContent = fa(items.length) + ' جشنواره';
      paint();
      startTimer();
    }catch(e){
      list.innerHTML = '<div style="padding:20px;color:var(--adm-danger)">' + esc(e.message) + '</div>';
    }
  }

  function startTimer(){
    if(tickInt) clearInterval(tickInt);
    tickInt = setInterval(function(){
      if(!document.body.contains(list)){ clearInterval(tickInt); return; }
      var timers = list.querySelectorAll('[data-timer]');
      for(var i = 0; i < timers.length; i++){
        var el = timers[i];
        var tl = timeLeft(el.getAttribute('data-ends'));
        el.textContent = tl.text;
        el.style.color = tl.expired ? '#fecaca' : '#ffffff';
      }
    }, 1000);
  }

  function paint(){
    if(!items.length){
      list.innerHTML = '<div style="padding:48px;text-align:center;color:var(--adm-muted)">' +
        '<h3 style="margin:0 0 8px;color:var(--adm-text,#0f172a)">هنوز جشنواره‌ای نساخته‌اید</h3>' +
        '<p style="margin:0">روی «جشنواره جدید» بزنید.</p>' +
      '</div>';
      return;
    }

    var sorted = items.slice().sort(function(a, b){
      if(a.is_active !== b.is_active) return b.is_active ? 1 : -1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    var html = '';
    for(var i = 0; i < sorted.length; i++){
      var f = sorted[i];
      var tl = timeLeft(f.ends_at);
      var bg = f.bg_color || '#7b1e3a';
      var endsJ = f.ends_at ? toJalali(parseLocalDate(f.ends_at)) : 'بدون پایان';
      var createdJ = f.created_at ? toJalaliDate(f.created_at) : '—';
      var inactive = !f.is_active ? 'opacity:.55;filter:grayscale(.4);' : '';
      var imgUrl = f.image_url ? (window.__ASSET__ ? window.__ASSET__(f.image_url) : f.image_url) : null;

      /* پس‌زمینه کارت */
      var bgStyle = 'background:' + bg + ';';
      if(imgUrl){
        bgStyle = 'background:#000;';
      }

      html += '<div class="fes-card" style="border-radius:20px;padding:0;color:#ffffff;margin-bottom:20px;background:' + bg + ';box-shadow:0 20px 50px -20px rgba(0,0,0,.35), 0 10px 20px -10px rgba(0,0,0,.15);position:relative;overflow:hidden;' + inactive + '">';

      /* کانتینر اصلی */
      html += '<div style="position:relative;min-height:280px;overflow:hidden">';

      /* عکس پس‌زمینه */
      if(imgUrl){
        html += '<div class="fes-bg" style="position:absolute;inset:0;z-index:0"></div>';
        html += '<div style="position:absolute;inset:0;background:linear-gradient(135deg, rgba(0,0,0,.7) 0%, rgba(0,0,0,.4) 50%, rgba(0,0,0,.75) 100%);z-index:1"></div>';
      } else {
        html += '<div style="position:absolute;inset:0;background:linear-gradient(135deg, ' + bg + ' 0%, rgba(0,0,0,.4) 100%);z-index:0"></div>';
        html += '<div style="position:absolute;top:-60px;inset-inline-end:-60px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.18),transparent 70%);pointer-events:none;z-index:1"></div>';
      }

      /* محتوا */
      html += '<div style="position:relative;z-index:2;padding:24px">';

      /* هدر: عنوان + badges */
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:18px">';
      html += '<div style="min-width:0;flex:1">';
      html += '<div style="font-size:24px;font-weight:900;line-height:1.3;letter-spacing:-.5px;text-shadow:0 2px 12px rgba(0,0,0,.5)">' + esc(f.title) + '</div>';
      if(f.subtitle){
        html += '<div style="font-size:14px;opacity:.95;margin-top:6px;line-height:1.7;text-shadow:0 1px 6px rgba(0,0,0,.4)">' + esc(f.subtitle) + '</div>';
      }
      html += '</div>';
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;flex:none">';
      if(f.is_active){
        html += '<span style="background:#10b981;color:#fff;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:800;border:1px solid rgba(255,255,255,.3);box-shadow:0 4px 12px rgba(16,185,129,.4)">✓ فعال</span>';
      } else {
        html += '<span style="background:#6b7280;color:#fff;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:800;border:1px solid rgba(255,255,255,.2)">غیرفعال</span>';
      }
      if(tl.expired && f.ends_at){
        html += '<span style="background:#dc2626;color:#fff;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:800;border:1px solid rgba(255,255,255,.2)">منقضی</span>';
      }
      html += '</div></div>';

      /* تایمر بزرگ */
      html += '<div style="background:rgba(0,0,0,.4);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.25);border-radius:16px;padding:16px 20px;margin-bottom:16px">';
      html += '<div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px;color:#fff">⏱ زمان باقی‌مانده</div>';
      html += '<div data-timer data-ends="' + esc(f.ends_at || '') + '" style="font-size:26px;font-weight:900;letter-spacing:-.5px;font-variant-numeric:tabular-nums;color:' + (tl.expired ? '#fecaca' : '#ffffff') + ';text-shadow:0 2px 12px rgba(0,0,0,.5)">' + tl.text + '</div>';
      html += '</div>';

      /* اطلاعات (تاریخ + متن دکمه) */
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">';
      html += '<div style="background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px 12px">';
      html += '<div style="font-size:10px;opacity:.8;font-weight:700;margin-bottom:4px;color:#fff;letter-spacing:.5px">📅 پایان</div>';
      html += '<div style="font-size:12.5px;font-weight:700;color:#fff;line-height:1.5">' + esc(endsJ) + '</div>';
      html += '</div>';
      html += '<div style="background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px 12px">';
      html += '<div style="font-size:10px;opacity:.8;font-weight:700;margin-bottom:4px;color:#fff;letter-spacing:.5px">🔤 متن دکمه</div>';
      html += '<div style="font-size:12.5px;font-weight:700;color:#fff;line-height:1.5">' + esc(f.button_text || 'دیدن همه') + '</div>';
      html += '</div>';
      html += '<div style="background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px 12px">';
      html += '<div style="font-size:10px;opacity:.8;font-weight:700;margin-bottom:4px;color:#fff;letter-spacing:.5px">⏰ ساخته‌شده</div>';
      html += '<div style="font-size:12.5px;font-weight:700;color:#fff;line-height:1.5">' + esc(createdJ) + '</div>';
      html += '</div>';
      html += '</div>';

      /* دکمه‌های عملیات */
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';

      html += '<button type="button" data-act="edit" data-id="' + f.id + '" class="fes-btn fes-btn-edit">';
      html += '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>';
      html += '<span>ویرایش</span>';
      html += '</button>';

      html += '<button type="button" data-act="toggle" data-id="' + f.id + '" class="fes-btn fes-btn-toggle">';
      html += '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>';
      html += '<span>' + (f.is_active ? 'غیرفعال کردن' : 'فعال کردن') + '</span>';
      html += '</button>';

      html += '<button type="button" data-act="del" data-id="' + f.id + '" class="fes-btn fes-btn-del">';
      html += '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
      html += '<span>حذف</span>';
      html += '</button>';

      html += '</div>';

      html += '</div>'; /* end content */
      html += '</div>'; /* end min-height container */
      html += '</div>'; /* end card */
    }

    list.innerHTML = html;

    /* Set festival card backgrounds */
    var fesBgDivs = list.querySelectorAll('.fes-bg');
    var fesCards = list.querySelectorAll('.fes-card');
    for(var b = 0; b < fesCards.length; b++){
      var fObj = sorted[b];
      if(fObj && fObj.image_url){
        var realUrl = window.__ASSET__ ? window.__ASSET__(fObj.image_url) : fObj.image_url;
        var bgDiv = fesCards[b].querySelector('.fes-bg');
        if(bgDiv){
          bgDiv.style.backgroundImage = 'url("' + realUrl + '")';
          bgDiv.style.backgroundSize = 'cover';
          bgDiv.style.backgroundPosition = 'center';
        }
      }
    }

    /* bind دکمه‌ها */
    var editBtns = list.querySelectorAll('[data-act="edit"]');
    for(var j = 0; j < editBtns.length; j++){
      (function(b){
        b.onclick = function(){ openFestForm(items.find(function(x){ return x.id === +b.dataset.id; })); };
      })(editBtns[j]);
    }

    var toggleBtns = list.querySelectorAll('[data-act="toggle"]');
    for(var k = 0; k < toggleBtns.length; k++){
      (function(b){
        b.onclick = async function(){
          var it = items.find(function(x){ return x.id === +b.dataset.id; });
          try{
            await apiPut('/site/festivals/' + it.id, {
              title: it.title,
              subtitle: it.subtitle,
              button_text: it.button_text,
              link: it.link,
              bg_color: it.bg_color,
              ends_at: it.ends_at,
              image_url: it.image_url,
              sort_order: it.sort_order,
              is_active: !it.is_active
            });
            load();
            toast(it.is_active ? 'غیرفعال شد.' : 'فعال شد.', 'ok');
          }catch(e){ toast(e.message, 'err'); }
        };
      })(toggleBtns[k]);
    }

    var delBtns = list.querySelectorAll('[data-act="del"]');
    for(var m = 0; m < delBtns.length; m++){
      (function(b){
        b.onclick = async function(){
          var yes = await confirmDialog({ title:'حذف جشنواره', message:'مطمئنید؟', confirmText:'حذف' });
          if(!yes) return;
          try{ await apiDel('/site/festivals/' + b.dataset.id); load(); toast('حذف شد.', 'ok'); }
          catch(e){ toast(e.message, 'err'); }
        };
      })(delBtns[m]);
    }
  }

  function openFestForm(f){
    var isEdit = !!f;
    var defY = '', defM = '', defD = '', defTime = '23:59';

    if(f && f.ends_at){
      try{
        var d = parseLocalDate(f.ends_at);
        if(d){
          var fmt = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric', month:'numeric', day:'numeric' });
          var parts = fmt.formatToParts(d);
          var o = {};
          parts.forEach(function(p){ o[p.type] = p.value; });
          defY = o.year;
          defM = o.month;
          defD = o.day;
          defTime = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        }
      }catch(e){}
    }

    if(!defY){
      try{
        var t = new Date(Date.now() + 24 * 3600 * 1000);
        var fmt2 = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric', month:'numeric', day:'numeric' });
        var parts2 = fmt2.formatToParts(t);
        var o2 = {};
        parts2.forEach(function(p){ o2[p.type] = p.value; });
        defY = o2.year;
        defM = o2.month;
        defD = o2.day;
      }catch(e){}
    }

    var imgUrl = f ? (f.image_url || '') : '';

    var html = '<div class="adm-modal-head"><h3>' + (isEdit ? 'ویرایش جشنواره' : 'جشنواره جدید') + '</h3>';
    html += '<button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">' + ic('x', 18) + '</button></div>';
    html += '<div class="adm-modal-body">';

    html += '<div class="adm-fld"><label>عنوان <span class="req">*</span></label><input class="adm-input" id="fsTitle" value="' + esc(f ? f.title : '') + '" data-autofocus></div>';

    html += '<div class="adm-fld"><label>زیرعنوان / توضیحات</label><input class="adm-input" id="fsSub" value="' + esc(f ? f.subtitle || '' : '') + '" placeholder="مثلاً: تخفیف‌های ویژهٔ امروز"></div>';

    html += '<div class="adm-fld"><label>متن دکمه <span style="font-size:11px;color:var(--adm-muted);font-weight:400">(متنی که روی دکمه در سایت نشون داده می‌شه)</span></label><input class="adm-input" id="fsButtonText" value="' + esc(f ? (f.button_text || 'دیدن همه') : 'دیدن همه') + '" placeholder="دیدن همه" maxlength="80"></div>';

    html += '<div class="adm-fld"><label>تصویر پس‌زمینه (اختیاری)</label>';
    html += '<div class="adm-img-picker" id="fsImgPicker" style="background-image:url(' + JSON.stringify(imgUrl ? (window.__ASSET__ ? window.__ASSET__(imgUrl) : imgUrl) : '') + ')">';
    if(!imgUrl) html += '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
    html += '</div>';
    html += '<input type="hidden" id="fsImg" value="' + esc(imgUrl) + '">';
    html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">';
    html += '<label for="fsFile" class="adm-btn outline sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>آپلود از دستگاه</label>';
    html += '<input type="file" id="fsFile" accept="image/*" style="display:none">';
    if(imgUrl) html += '<button type="button" class="adm-btn outline sm" id="fsImgClear">حذف تصویر</button>';
    html += '</div></div>';

    html += '<div class="adm-fld"><label>لینک (اختیاری)</label><input class="adm-input" id="fsLink" dir="ltr" value="' + esc(f ? f.link || '' : '') + '" placeholder="#offers"></div>';

    html += '<div class="adm-fld" style="background:var(--adm-surface-2);padding:18px;border-radius:14px;border:1px solid var(--adm-border)">';
    html += '<label style="margin-bottom:14px;display:block;font-weight:800;font-size:14px">📅 تاریخ پایان</label>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">';
    html += '<div><label style="font-size:11.5px;color:var(--adm-muted);font-weight:700;margin-bottom:5px;display:block">سال</label><input class="adm-input" id="fsYear" type="number" value="' + defY + '" style="text-align:center;font-size:16px;font-weight:700"></div>';
    html += '<div><label style="font-size:11.5px;color:var(--adm-muted);font-weight:700;margin-bottom:5px;display:block">ماه</label><input class="adm-input" id="fsMonth" type="number" min="1" max="12" value="' + defM + '" style="text-align:center;font-size:16px;font-weight:700"></div>';
    html += '<div><label style="font-size:11.5px;color:var(--adm-muted);font-weight:700;margin-bottom:5px;display:block">روز</label><input class="adm-input" id="fsDay" type="number" min="1" max="31" value="' + defD + '" style="text-align:center;font-size:16px;font-weight:700"></div>';
    html += '</div>';
    html += '<label style="font-size:11.5px;color:var(--adm-muted);font-weight:700;margin-bottom:5px;display:block">⏰ ساعت (۲۴ ساعته)</label>';
    html += '<input type="time" id="fsTime" value="' + defTime + '" step="60" style="width:100%;height:52px;padding:0 14px;border-radius:12px;border:1.5px solid var(--adm-border-strong);background:var(--adm-surface);font-size:18px;font-weight:700;text-align:center;letter-spacing:2px;direction:ltr;cursor:pointer">';
    html += '</div>';

    html += '<div class="adm-grid-2">';
    html += '<div class="adm-fld"><label>رنگ پس‌زمینه</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="fsBgColor" value="' + (f ? f.bg_color || '#7b1e3a' : '#7b1e3a') + '" style="width:48px;height:48px;border-radius:10px;border:2px solid var(--adm-border-strong);padding:2px;cursor:pointer;flex:none"><input class="adm-input" id="fsBg" dir="ltr" value="' + esc(f ? f.bg_color : '#7b1e3a') + '" style="flex:1"></div></div>';
    html += '<div class="adm-fld"><label>ترتیب</label><input class="adm-input" id="fsSort" type="number" value="' + ((f && f.sort_order) || 0) + '"></div>';
    html += '</div>';

    html += '<div class="adm-fld" style="padding:12px 0"><label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="fsActive" ' + ((!f || f.is_active) ? 'checked' : '') + ' style="width:22px;height:22px;accent-color:var(--adm-brand)"><span style="font-weight:700;font-size:14px">فعال باشد</span></label></div>';

    html += '</div>';
    html += '<div class="adm-modal-foot"><button class="adm-btn outline" data-close type="button">انصراف</button><button class="adm-btn primary" id="fsSave" type="button">' + (isEdit ? 'ذخیره' : 'ساخت جشنواره') + '</button></div>';

    openModal(html);

    var picker = document.querySelector('#fsImgPicker');
    var fileInput = document.querySelector('#fsFile');
    var imgField = document.querySelector('#fsImg');

    picker.onclick = function(){ fileInput.click(); };

    fileInput.onchange = function(){
      var file = fileInput.files && fileInput.files[0];
      if(!file) return;
      if(file.size > 5 * 1024 * 1024){ toast('حجم عکس بیش از ۵ مگابایت است.', 'warn'); return; }
      picker.innerHTML = '<div class="adm-img-picker-loading">در حال آپلود...</div>';
      var API_BASE = window.__API_BASE__ || window.__API_BASE || '/api';
      var fd = new FormData();
      fd.append('image', file);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/upload/product-single', true);
      xhr.withCredentials = true;
      xhr.onload = function(){
        try{
          var r = JSON.parse(xhr.responseText || '{}');
          if(xhr.status >= 200 && xhr.status < 300 && r.success){
            imgField.value = r.url;
            var full = window.__ASSET__ ? window.__ASSET__(r.url) : r.url;
            picker.style.backgroundImage = 'url(' + JSON.stringify(full) + ')';
            picker.innerHTML = '';
            toast('عکس آپلود شد.', 'ok');
          }else{
            picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
            toast(r.message || 'خطا در آپلود', 'err');
          }
        }catch(e){
          picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
          toast('خطای پاسخ', 'err');
        }
      };
      xhr.onerror = function(){
        picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
        toast('خطای شبکه', 'err');
      };
      xhr.send(fd);
    };

    var clearBtn = document.querySelector('#fsImgClear');
    if(clearBtn){
      clearBtn.onclick = function(){
        imgField.value = '';
        picker.style.backgroundImage = '';
        picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
        clearBtn.remove();
      };
    }

    var bgColor = document.querySelector('#fsBgColor');
    var bgText = document.querySelector('#fsBg');
    bgColor.oninput = function(){ bgText.value = bgColor.value; };
    bgText.oninput = function(){ if(/^#[0-9a-f]{6}$/i.test(bgText.value)) bgColor.value = bgText.value; };

    document.querySelector('#fsSave').onclick = async function(){
      var title = document.querySelector('#fsTitle').value.trim();
      var y = Number(document.querySelector('#fsYear').value);
      var m = Number(document.querySelector('#fsMonth').value);
      var d = Number(document.querySelector('#fsDay').value);
      var timeVal = document.querySelector('#fsTime').value;

      if(!title){ toast('عنوان الزامی است.', 'warn'); return; }
      if(!y || m < 1 || m > 12 || d < 1 || d > 31){ toast('تاریخ را کامل کنید.', 'warn'); return; }
      if(!timeVal){ toast('ساعت را وارد کنید.', 'warn'); return; }

      var timeParts = timeVal.split(':');
      var hh = Number(timeParts[0]);
      var mm = Number(timeParts[1]);

      var gDate = jalaliToDate(y, m, d, hh, mm);
      var endsAt = gDate.getFullYear() + '-' + String(gDate.getMonth() + 1).padStart(2, '0') + '-' + String(gDate.getDate()).padStart(2, '0') + ' ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':00';

      var p = {
        title: title,
        subtitle: document.querySelector('#fsSub').value.trim(),
        button_text: (document.querySelector('#fsButtonText') && document.querySelector('#fsButtonText').value.trim()) || 'دیدن همه',
        link: document.querySelector('#fsLink').value.trim(),
        image_url: imgField.value,
        ends_at: endsAt,
        bg_color: document.querySelector('#fsBg').value.trim() || '#7b1e3a',
        sort_order: Number(document.querySelector('#fsSort').value) || 0,
        is_active: document.querySelector('#fsActive').checked
      };

      var saveBtn = document.querySelector('#fsSave');
      saveBtn.disabled = true; var old = saveBtn.textContent;
      saveBtn.textContent = 'در حال ذخیره...';

      try{
        if(isEdit) await apiPut('/site/festivals/' + f.id, p);
        else await apiPost('/site/festivals', p);
        closeModal();
        load();
        toast(isEdit ? 'ذخیره شد.' : 'جشنواره ساخته شد.', 'ok');
      }catch(e){
        toast(e.message, 'err');
        saveBtn.disabled = false; saveBtn.textContent = old;
      }
    };
  }

  root.querySelector('#fesNew').onclick = function(){ openFestForm(null); };
  load();
}




/* ================================================================
   فرم جشنواره — ساعت ۲۴س + آپلود عکس
   ================================================================ */




/* ================================================================
   فرم جشنواره — ساده
   ================================================================ */
function openFestForm(f){
  var isEdit = !!f;

  /* مقادیر پیش‌فرض تاریخ */
  var defY = '', defM = '', defD = '', defTime = '23:59';

  if(f && f.ends_at){
    try{
      var d = parseLocalDate(f.ends_at);
      if(!isNaN(d.getTime())){
        var fmt = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric', month:'numeric', day:'numeric' });
        var parts = fmt.formatToParts(d);
        var o = {};
        parts.forEach(function(p){ o[p.type] = p.value; });
        defY = o.year;
        defM = o.month;
        defD = o.day;
        defTime = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }
    }catch(e){}
  }

  if(!defY){
    try{
      var t = new Date(Date.now() + 24 * 3600 * 1000);
      var fmt2 = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric', month:'numeric', day:'numeric' });
      var parts2 = fmt2.formatToParts(t);
      var o2 = {};
      parts2.forEach(function(p){ o2[p.type] = p.value; });
      defY = o2.year;
      defM = o2.month;
      defD = o2.day;
    }catch(e){}
  }

  var imgUrl = f ? (f.image_url || '') : '';

  openModal(
    '<div class="adm-modal-head"><h3>' + (isEdit ? 'ویرایش جشنواره' : 'جشنواره جدید') + '</h3>' +
      '<button class="adm-iconbtn-sm" data-close type="button" style="margin-inline-start:auto">' + ic('x', 18) + '</button></div>' +

    '<div class="adm-modal-body">' +

      /* عنوان */
      '<div class="adm-fld"><label>عنوان <span class="req">*</span></label>' +
        '<input class="adm-input" id="fsTitle" value="' + esc(f ? f.title : '') + '" data-autofocus placeholder="مثلاً: جشنواره تخفیف پاییزی"></div>' +

      /* زیرعنوان */
      '<div class="adm-fld"><label>زیرعنوان / توضیح</label>' +
        '<input class="adm-input" id="fsSub" value="' + esc(f ? f.subtitle || '' : '') + '" placeholder="مثلاً: تخفیف‌های ویژهٔ امروز"></div>' +

      /* تصویر */
      '<div class="adm-fld"><label>تصویر پس‌زمینه (اختیاری)</label>' +
        '<div class="adm-img-picker" id="fsImgPicker" style="background-image:url(' + JSON.stringify(imgUrl ? (window.__ASSET__ ? window.__ASSET__(imgUrl) : imgUrl) : '') + ')">' +
          (imgUrl ? '' : '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>') +
        '</div>' +
        '<input type="hidden" id="fsImg" value="' + esc(imgUrl) + '">' +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
          '<label for="fsFile" class="adm-btn outline sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>' +
            'آپلود از دستگاه' +
          '</label>' +
          '<input type="file" id="fsFile" accept="image/*" style="display:none">' +
          (imgUrl ? '<button type="button" class="adm-btn outline sm" id="fsImgClear">حذف تصویر</button>' : '') +
        '</div>' +
      '</div>' +

      /* لینک */
      '<div class="adm-fld"><label>لینک (اختیاری)</label>' +
        '<input class="adm-input" id="fsLink" dir="ltr" value="' + esc(f ? f.link || '' : '') + '" placeholder="#offers"></div>' +

      /* تاریخ و ساعت */
      '<div class="adm-fld" style="background:var(--adm-surface-2);padding:18px;border-radius:14px;border:1px solid var(--adm-border)">' +
        '<label style="margin-bottom:14px;display:block;font-weight:800;font-size:14px">📅 تاریخ پایان</label>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">' +
          '<div>' +
            '<label style="font-size:11.5px;color:var(--adm-muted);font-weight:700;margin-bottom:5px;display:block">سال</label>' +
            '<input class="adm-input" id="fsYear" type="number" value="' + defY + '" placeholder="۱۴۰۴" style="text-align:center;font-size:16px;font-weight:700">' +
          '</div>' +
          '<div>' +
            '<label style="font-size:11.5px;color:var(--adm-muted);font-weight:700;margin-bottom:5px;display:block">ماه</label>' +
            '<input class="adm-input" id="fsMonth" type="number" min="1" max="12" value="' + defM + '" style="text-align:center;font-size:16px;font-weight:700">' +
          '</div>' +
          '<div>' +
            '<label style="font-size:11.5px;color:var(--adm-muted);font-weight:700;margin-bottom:5px;display:block">روز</label>' +
            '<input class="adm-input" id="fsDay" type="number" min="1" max="31" value="' + defD + '" style="text-align:center;font-size:16px;font-weight:700">' +
          '</div>' +
        '</div>' +

        '<label style="font-size:11.5px;color:var(--adm-muted);font-weight:700;margin-bottom:5px;display:block">⏰ ساعت (۲۴ ساعته)</label>' +
        '<input type="time" id="fsTime" value="' + defTime + '" step="60" style="width:100%;height:52px;padding:0 14px;border-radius:12px;border:1.5px solid var(--adm-border-strong);background:var(--adm-surface);font-size:18px;font-weight:700;text-align:center;letter-spacing:2px;direction:ltr;cursor:pointer">' +

        '<div style="font-size:11.5px;color:var(--adm-muted);margin-top:10px;text-align:center">' +
          'مثال: ۱۴:۳۰ = دو و نیم بعدازظهر · ۲۳:۵۹ = یازده و پنجاه‌ونه شب' +
        '</div>' +
      '</div>' +

      /* رنگ + ترتیب */
      '<div class="adm-grid-2">' +
        '<div class="adm-fld"><label>رنگ پس‌زمینه</label>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<input type="color" id="fsBgColor" value="' + (f ? f.bg_color || '#7b1e3a' : '#7b1e3a') + '" style="width:48px;height:48px;border-radius:10px;border:2px solid var(--adm-border-strong);padding:2px;cursor:pointer;flex:none">' +
            '<input class="adm-input" id="fsBg" dir="ltr" value="' + esc(f ? f.bg_color : '#7b1e3a') + '" style="flex:1">' +
          '</div>' +
        '</div>' +
        '<div class="adm-fld"><label>ترتیب</label>' +
          '<input class="adm-input" id="fsSort" type="number" value="' + ((f && f.sort_order) || 0) + '"></div>' +
      '</div>' +

      /* فعال */
      '<div class="adm-fld" style="padding:12px 0">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
          '<input type="checkbox" id="fsActive" ' + ((!f || f.is_active) ? 'checked' : '') + ' style="width:22px;height:22px;accent-color:var(--adm-brand)">' +
          '<span style="font-weight:700;font-size:14px">فعال باشد</span>' +
        '</label>' +
      '</div>' +

    '</div>' +

    '<div class="adm-modal-foot">' +
      '<button class="adm-btn outline" data-close type="button">انصراف</button>' +
      '<button class="adm-btn primary" id="fsSave" type="button">' + (isEdit ? 'ذخیره' : 'ساخت جشنواره') + '</button>' +
    '</div>'
  );

  /* آپلود عکس */
  var picker = document.querySelector('#fsImgPicker');
  var fileInput = document.querySelector('#fsFile');
  var imgField = document.querySelector('#fsImg');

  picker.onclick = function(){ fileInput.click(); };

  fileInput.onchange = function(){
    var file = fileInput.files && fileInput.files[0];
    if(!file) return;
    if(file.size > 5 * 1024 * 1024){ toast('حجم عکس بیش از ۵ مگابایت است.', 'warn'); return; }
    picker.innerHTML = '<div class="adm-img-picker-loading">در حال آپلود...</div>';
    var API_BASE = window.__API_BASE__ || window.__API_BASE || '/api';
    var fd = new FormData();
    fd.append('image', file);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE + '/upload/product-single', true);
    xhr.withCredentials = true;
    xhr.onload = function(){
      try{
        var r = JSON.parse(xhr.responseText || '{}');
        if(xhr.status >= 200 && xhr.status < 300 && r.success){
          imgField.value = r.url;
          var full = window.__ASSET__ ? window.__ASSET__(r.url) : r.url;
          picker.style.backgroundImage = 'url(' + JSON.stringify(full) + ')';
          picker.innerHTML = '';
          toast('عکس آپلود شد.', 'ok');
        }else{
          picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
          toast(r.message || 'خطا در آپلود', 'err');
        }
      }catch(e){
        picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
        toast('خطای پاسخ', 'err');
      }
    };
    xhr.onerror = function(){
      picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
      toast('خطای شبکه', 'err');
    };
    xhr.send(fd);
  };

  var clearBtn = document.querySelector('#fsImgClear');
  if(clearBtn){
    clearBtn.onclick = function(){
      imgField.value = '';
      picker.style.backgroundImage = '';
      picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب عکس کلیک کنید</div>';
      clearBtn.remove();
    };
  }

  /* رنگ */
  var bgColor = document.querySelector('#fsBgColor');
  var bgText = document.querySelector('#fsBg');
  bgColor.oninput = function(){ bgText.value = bgColor.value; };
  bgText.oninput = function(){ if(/^#[0-9a-f]{6}$/i.test(bgText.value)) bgColor.value = bgText.value; };

  /* ذخیره */
  document.querySelector('#fsSave').onclick = async function(){
    var title = document.querySelector('#fsTitle').value.trim();
    var y = Number(document.querySelector('#fsYear').value);
    var m = Number(document.querySelector('#fsMonth').value);
    var d = Number(document.querySelector('#fsDay').value);
    var timeVal = document.querySelector('#fsTime').value;

    if(!title){ toast('عنوان الزامی است.', 'warn'); document.querySelector('#fsTitle').focus(); return; }
    if(!y || m < 1 || m > 12 || d < 1 || d > 31){ toast('تاریخ را کامل وارد کنید.', 'warn'); return; }
    if(!timeVal){ toast('ساعت را وارد کنید.', 'warn'); return; }

    var timeParts = timeVal.split(':');
    var hh = Number(timeParts[0]);
    var mm = Number(timeParts[1]);

    var gDate = jalaliToDate(y, m, d, hh, mm);
    var endsAt = gDate.getFullYear() + '-' +
      String(gDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(gDate.getDate()).padStart(2, '0') + ' ' +
      String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':00';

    var p = {
      title: title,
      subtitle: document.querySelector('#fsSub').value.trim(),
      link: document.querySelector('#fsLink').value.trim(),
      image_url: imgField.value,
      ends_at: endsAt,
      bg_color: document.querySelector('#fsBg').value.trim() || '#7b1e3a',
      sort_order: Number(document.querySelector('#fsSort').value) || 0,
      is_active: document.querySelector('#fsActive').checked
    };

    var saveBtn = document.querySelector('#fsSave');
    saveBtn.disabled = true; var old = saveBtn.textContent;
    saveBtn.textContent = 'در حال ذخیره...';

    try{
      if(isEdit) await apiPut('/site/festivals/' + f.id, p);
      else await apiPost('/site/festivals', p);
      closeModal();
      if(state.refresh) state.refresh();
      toast(isEdit ? 'ذخیره شد.' : 'جشنواره ساخته شد.', 'ok');
    }catch(e){
      toast(e.message, 'err');
      saveBtn.disabled = false; saveBtn.textContent = old;
    }
  };
}

/* ================================================================
   INIT
   ================================================================ */
/* ================================================================
   PAGE: Site Settings
   ================================================================ */
/* async /* function renderSiteSettings( — removed */

init();

  /* __FORCE_TOABS__ */
  window.__toAbsUrl = function(u){
    if(!u) return '';
    if(/^https?:\/\//.test(u)) return u;
    var origin = window.__BACKEND_ORIGIN__ || '';
    if(!origin){
      var api = window.__API_BASE || '';
      origin = api.replace(/\/api$/, '');
    }
    if(u.charAt(0) === '/') return origin + u;
    return origin + '/' + u;
  };
  /* override the local toAbsUrl if it exists in this scope */
  if(typeof toAbsUrl === 'function'){
    try{ toAbsUrl = window.__toAbsUrl; }catch(e){}
  }

/* ADMIN IMAGE PICKER */
window.__pickAdmImg = function(input, imgFieldId, pickerId){
  var f = input.files && input.files[0];
  input.value = '';
  if(!f) return;
  if(f.size > 5 * 1024 * 1024){ try{ toast('حجم تصویر بیش از ۵ مگابایت است.', 'warn'); }catch(e){} return; }
  var picker = document.getElementById(pickerId);
  if(picker) picker.innerHTML = '<div class="adm-img-picker-loading">در حال آپلود...</div>';
  var API_BASE = window.__API_BASE__ || window.__API_BASE || '/api';
  var fd = new FormData();
  fd.append('image', f);
  var xhr = new XMLHttpRequest();
  xhr.open('POST', API_BASE + '/upload/product-single', true);
  xhr.withCredentials = true;
  xhr.onload = function(){
    try{
      var r = JSON.parse(xhr.responseText || '{}');
      if(xhr.status >= 200 && xhr.status < 300 && r.success){
        var field = document.getElementById(imgFieldId);
        if(field) field.value = r.url;
        var full = window.__ASSET__ ? window.__ASSET__(r.url) : r.url;
        if(picker){
          picker.style.backgroundImage = 'url(' + JSON.stringify(full) + ')';
          picker.innerHTML = '';
        }
        try{ toast('تصویر آپلود شد.', 'ok'); }catch(e){}
      }else{
        if(picker) picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب کلیک کنید</div>';
        try{ toast(r.message || 'خطا در آپلود', 'err'); }catch(e){}
      }
    }catch(e){
      if(picker) picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب کلیک کنید</div>';
      try{ toast('خطای پردازش پاسخ', 'err'); }catch(e){}
    }
  };
  xhr.onerror = function(){
    if(picker) picker.innerHTML = '<div class="adm-img-picker-empty">برای انتخاب کلیک کنید</div>';
    try{ toast('خطای شبکه', 'err'); }catch(e){}
  };
  xhr.send(fd);
};

})();