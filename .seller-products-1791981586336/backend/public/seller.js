(function(){
'use strict';
if(window.__SELLER_LOADED__) return;
window.__SELLER_LOADED__ = true;

var API = (window.__API_BASE__ || '/api');

/* ============== helpers ============== */
var $  = function(s,r){ return (r||document).querySelector(s); };
var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
var fa = function(n){ try{ return Number(n||0).toLocaleString('fa-IR'); }catch(e){ return String(n||0); } };
var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var store = {
  get: function(k,d){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set: function(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del: function(k){ try{ localStorage.removeItem(k); }catch(e){} }
};

/* ============== api ============== */
async function api(path, opts){
  opts = opts || {};
  var res = await fetch(API + path, Object.assign({
    credentials: 'include',
    headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  }, opts));
  var data = null;
  try{ data = await res.json(); }catch(e){ data = { success:false, message:'پاسخ نامعتبر' }; }
  if(res.status === 401){
    showBoot('نشست منقضی شد، در حال انتقال...');
    setTimeout(function(){ location.href = 'login.html'; }, 1200);
    throw new Error('unauth');
  }
  if(res.status === 403){
    toast('دسترسی ندارید.', 'err');
    throw new Error(data.message || 'forbidden');
  }
  if(!res.ok) throw new Error(data.message || ('HTTP ' + res.status));
  return data;
}
var apiGet = function(p){ return api(p); };

/* ============== icons ============== */
var ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  box: '<path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7M21 4v6h-6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  chevdown: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 14h.01"/>',
  trend: '<path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/>',
  star: '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9z"/>'
};
var ic = function(n,s){ s=s||20; return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[n]||'')+'</svg>'; };

/* ============== state ============== */
var state = {
  page: 'dashboard',
  user: null,
  theme: store.get('bz.sl.theme','light')
};
document.documentElement.dataset.admTheme = state.theme;

/* ============== toast ============== */
function toast(msg, type, dur){
  type = type || 'info'; dur = dur || 3200;
  var box = $('#toasts');
  var el = document.createElement('div');
  el.className = 'adm-toast ' + (type==='ok'?'ok':type==='err'?'err':type==='warn'?'warn':'');
  el.innerHTML = '<div class="adm-toast-ic">' + ic(type==='ok'?'check':'x', 18) + '</div>' +
    '<div class="adm-toast-msg"></div>' +
    '<button class="adm-toast-x" type="button">×</button>';
  el.querySelector('.adm-toast-msg').textContent = String(msg);
  var remove = function(){ el.classList.add('out'); setTimeout(function(){ el.remove(); }, 200); };
  el.querySelector('.adm-toast-x').onclick = remove;
  box.appendChild(el);
  setTimeout(remove, dur);
}

/* ============== boot ============== */
function showBoot(msg){ $('#bootLoader').hidden = false; $('#app').hidden = true; if(msg) $('#bootMsg').textContent = msg; }

/* ============== sidebar ============== */
function openSidebar(){ $('#sidebar').classList.add('open'); $('#sideScrim').hidden = false; }
function closeSidebar(){ $('#sidebar').classList.remove('open'); $('#sideScrim').hidden = true; }

/* ============== nav ============== */
var PAGES = [
  { id: 'dashboard', label: 'داشبورد', icon: 'dashboard' },
  { id: 'products',  label: 'محصولات من', icon: 'box' },
  { id: 'orders',    label: 'سفارش‌ها', icon: 'cart' }
];

function renderNav(){
  var nav = $('#nav');
  nav.innerHTML = PAGES.map(function(p){
    return '<a class="adm-nav-it' + (state.page === p.id ? ' active' : '') + '" data-page="' + p.id + '" tabindex="0">' +
      '<span class="adm-nav-ic" data-ic="' + p.icon + '"></span><span>' + p.label + '</span></a>';
  }).join('');
  hydrateIcons(nav);
  nav.querySelectorAll('.adm-nav-it').forEach(function(el){
    el.onclick = function(){ go(el.dataset.page); };
  });
}

function hydrateIcons(root){
  (root || document).querySelectorAll('[data-ic]').forEach(function(e){ e.innerHTML = ic(e.dataset.ic, e.dataset.s || 20); });
}

function go(page){
  state.page = page;
  document.querySelectorAll('.adm-nav-it').forEach(function(el){ el.classList.toggle('active', el.dataset.page === page); });
  closeSidebar();
  var P = PAGES.filter(function(p){ return p.id === page; })[0];
  $('#pageTitle').textContent = P ? P.label : '';
  $('#pageSub').textContent = '';
  var c = $('#content');
  c.innerHTML = '';
  if(page === 'dashboard') renderDashboard(c);
  else if(page === 'products') renderProducts(c);
  else if(page === 'orders') renderOrders(c);
}

/* ============== dashboard ============== */
async function renderDashboard(root){
  root.innerHTML = '<div class="adm-sk" style="height:100px;border-radius:14px;margin-bottom:14px"></div>' +
    '<div class="adm-sk" style="height:60px;border-radius:14px;margin-bottom:14px"></div>' +
    '<div class="adm-sk" style="height:200px;border-radius:14px"></div>';
  var d;
  try{ d = await apiGet('/seller/dashboard'); }
  catch(e){ root.innerHTML = '<div class="adm-empty" style="padding:60px 20px"><h3>خطا در بارگذاری</h3><p>' + esc(e.message) + '</p></div>'; return; }
  var money = function(n){ return fa(Math.round(Number(n)||0)) + ' <small>تومان</small>'; };
  var STATUS = { pending:'در انتظار', paid:'پرداخت‌شده', processing:'در حال پردازش', shipped:'ارسال‌شده', delivered:'تحویل‌شده', cancelled:'لغو‌شده', refunded:'مرجوعی' };
  root.innerHTML =
    '<div class="adm-dash-hero" style="margin-bottom:18px">' +
      '<div class="adm-dash-hero-bg"></div>' +
      '<div class="adm-dash-hero-body">' +
        '<div class="adm-dash-hero-txt">' +
          '<span class="adm-dash-eyebrow">پنل فروشنده</span>' +
          '<h2>خوش آمدید، ' + esc(state.user && state.user.name ? state.user.name : 'فروشنده') + ' 👋</h2>' +
          '<p class="adm-dash-hero-date">خلاصه‌ای از فعالیت فروشگاه شما</p>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="adm-kpi-grid is-3">' +
      '<div class="adm-kpi is-sales"><div class="adm-kpi-top"><span class="adm-kpi-lbl">محصولات من</span></div><div class="adm-kpi-val-lg">' + fa(d.stats.products) + '</div><div class="adm-kpi-sub">' + fa(d.stats.activeProducts) + ' فعال</div></div>' +
      '<div class="adm-kpi is-wallet"><div class="adm-kpi-top"><span class="adm-kpi-lbl">سفارش‌ها</span></div><div class="adm-kpi-val-lg">' + fa(d.stats.orders) + '</div><div class="adm-kpi-sub">شامل محصولات شما</div></div>' +
      '<div class="adm-kpi is-inv"><div class="adm-kpi-top"><span class="adm-kpi-lbl">درآمد کل</span></div><div class="adm-kpi-val">' + money(d.stats.revenue) + '</div><div class="adm-kpi-sub">از سفارش‌های موفق</div></div>' +
    '</div>' +
    '<div class="adm-kpi-grid is-2" style="margin-top:14px">' +
      '<div class="adm-kpi is-wallet"><div class="adm-kpi-head"><span class="adm-kpi-icon is-warn">' + ic('trend',18) + '</span><span class="adm-kpi-lbl">موجودی کم</span></div><div class="adm-kpi-val-lg">' + fa(d.stats.lowStock) + '</div></div>' +
      '<div class="adm-kpi is-wallet"><div class="adm-kpi-head"><span class="adm-kpi-icon is-danger">' + ic('x',18) + '</span><span class="adm-kpi-lbl">ناموجود</span></div><div class="adm-kpi-val-lg">' + fa(d.stats.outOfStock) + '</div></div>' +
    '</div>' +
    '<div class="adm-card" style="margin-top:18px">' +
      '<div class="adm-card-head"><h3>آخرین سفارش‌ها</h3></div>' +
      (d.latestOrders && d.latestOrders.length ?
        '<div class="adm-tbl-wrap"><table class="adm-tbl"><thead><tr>' +
        '<th>کد</th><th>مشتری</th><th>مبلغ</th><th>وضعیت</th><th>تاریخ</th>' +
        '</tr></thead><tbody>' +
        d.latestOrders.map(function(o){
          return '<tr><td><b dir="ltr">' + esc(o.trackingCode) + '</b></td>' +
            '<td>' + esc(o.customer || '—') + '</td>' +
            '<td>' + money(o.total) + '</td>' +
            '<td><span class="adm-bdg">' + esc(STATUS[o.status] || o.status) + '</span></td>' +
            '<td>' + (o.createdAt ? new Date(o.createdAt).toLocaleDateString('fa-IR') : '—') + '</td></tr>';
        }).join('') +
        '</tbody></table></div>'
        : '<div class="adm-empty" style="padding:40px"><h3>هنوز سفارشی نیست</h3></div>') +
    '</div>';
}

/* ============== products ============== */
async function renderProducts(root){
  root.innerHTML = '<div class="adm-sec-head"><h2>محصولات من</h2><span class="adm-sec-sub" id="prCount"></span></div>' +
    '<div class="adm-card">' +
    '<div class="adm-toolbar"><div class="adm-search"><span class="adm-search-ic">' + ic('search',18) + '</span><input id="prQ" placeholder="جستجو..." autocomplete="off"></div>' +
    '<select class="adm-select" id="prStatus" style="max-width:180px"><option value="">همه وضعیت‌ها</option><option value="true">فعال</option><option value="false">غیرفعال</option></select>' +
    '</div>' +
    '<div class="adm-tbl-wrap"><table class="adm-tbl"><thead><tr>' +
    '<th>محصول</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th>فروش</th><th>وضعیت</th>' +
    '</tr></thead><tbody id="prBody"></tbody></table></div></div>';
  var body = $('#prBody');
  var cntEl = $('#prCount');
  var timer;
  async function load(){
    body.innerHTML = '<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--adm-muted)">در حال بارگذاری...</td></tr>';
    var params = new URLSearchParams();
    var qv = $('#prQ').value.trim();
    var st = $('#prStatus').value;
    if(qv) params.set('q', qv);
    if(st) params.set('active', st);
    params.set('limit', '100');
    try{
      var r = await apiGet('/seller/products?' + params.toString());
      var items = r.items || [];
      cntEl.textContent = fa(r.pagination && r.pagination.total || items.length) + ' محصول';
      if(!items.length){
        body.innerHTML = '<tr><td colspan="6"><div class="adm-empty" style="padding:52px 16px"><h3>محصولی نیست</h3></div></td></tr>';
        return;
      }
      body.innerHTML = items.map(function(p){
        var img = p.images && p.images.length ? window.__ASSET__(p.images[0]) : null;
        var stockBadge = p.stock <= 0 ? '<span class="adm-bdg danger">ناموجود</span>' : (p.stock <= 5 ? '<span class="adm-bdg warn">' + fa(p.stock) + ' (کم)</span>' : '<span class="adm-bdg ok">' + fa(p.stock) + ' عدد</span>');
        return '<tr>' +
          '<td><div style="display:flex;align-items:center;gap:10px">' +
            '<div class="adm-prod-thumb" style="position:relative;overflow:hidden">' +
            (img ? '<img src="' + esc(img) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display=&quot;none&quot;">' : '') +
            '<span style="position:relative;z-index:0;display:grid;place-items:center;width:100%;height:100%">' + ic(p.art || 'box', 22) + '</span></div>' +
            '<div><b>' + esc(p.name) + '</b><div style="font-size:11.5px;color:var(--adm-muted)">' + esc(p.brand || '') + '</div></div>' +
          '</div></td>' +
          '<td><span class="adm-bdg">' + esc(p.category ? p.category.name : '—') + '</span></td>' +
          '<td><b>' + fa(p.finalPrice) + '</b>' + (p.off ? ' <small style="color:var(--adm-danger)">-' + fa(p.off) + '%</small>' : '') + '</td>' +
          '<td>' + stockBadge + '</td>' +
          '<td>' + fa(p.sales) + '</td>' +
          '<td>' + (p.isActive ? '<span class="adm-bdg ok">منتشرشده</span>' : '<span class="adm-bdg">پیش‌نویس</span>') + '</td>' +
        '</tr>';
      }).join('');
    }catch(e){
      body.innerHTML = '<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--adm-danger)">' + esc(e.message) + '</td></tr>';
    }
  }
  $('#prQ').addEventListener('input', function(){ clearTimeout(timer); timer = setTimeout(load, 300); });
  $('#prStatus').addEventListener('change', load);
  load();
}

/* ============== orders ============== */
async function renderOrders(root){
  root.innerHTML = '<div class="adm-sec-head"><h2>سفارش‌ها</h2><span class="adm-sec-sub" id="orCount"></span></div>' +
    '<div class="adm-card"><div class="adm-tbl-wrap"><table class="adm-tbl"><thead><tr>' +
    '<th>کد</th><th>مشتری</th><th>اقلام من</th><th>مبلغ من</th><th>وضعیت</th><th>تاریخ</th>' +
    '</tr></thead><tbody id="orBody"></tbody></table></div></div>';
  var body = $('#orBody');
  var cntEl = $('#orCount');
  var STATUS = { pending:'در انتظار پرداخت', paid:'پرداخت‌شده', processing:'در حال پردازش', shipped:'ارسال‌شده', delivered:'تحویل‌شده', cancelled:'لغو‌شده', refunded:'مرجوعی' };
  var CLS = { pending:'warn', paid:'info', processing:'info', shipped:'brand', delivered:'ok', cancelled:'danger', refunded:'danger' };
  body.innerHTML = '<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--adm-muted)">در حال بارگذاری...</td></tr>';
  try{
    var r = await apiGet('/seller/orders?limit=100');
    var items = r.orders || [];
    cntEl.textContent = fa(r.pagination && r.pagination.total || items.length) + ' سفارش';
    if(!items.length){
      body.innerHTML = '<tr><td colspan="6"><div class="adm-empty" style="padding:52px 16px"><h3>سفارشی شامل محصولات شما نیست</h3></div></td></tr>';
      return;
    }
    body.innerHTML = items.map(function(o){
      return '<tr>' +
        '<td><b dir="ltr">' + esc(o.trackingCode) + '</b></td>' +
        '<td>' + esc(o.customer || '—') + '<div style="font-size:11.5px;color:var(--adm-muted)" dir="ltr">' + esc(o.customerPhone || '') + '</div></td>' +
        '<td><span class="adm-bdg">' + fa(o.itemsCount) + ' قلم</span></td>' +
        '<td><b>' + fa(o.sellerTotal) + '</b> <small style="color:var(--adm-muted)">تومان</small></td>' +
        '<td><span class="adm-bdg ' + (CLS[o.status]||'') + '">' + esc(STATUS[o.status] || o.status) + '</span></td>' +
        '<td>' + (o.createdAt ? new Date(o.createdAt).toLocaleDateString('fa-IR') : '—') + '</td>' +
      '</tr>';
    }).join('');
  }catch(e){
    body.innerHTML = '<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--adm-danger)">' + esc(e.message) + '</td></tr>';
  }
}

/* ============== init ============== */
async function init(){
  hydrateIcons();
  renderNav();
  try{
    var r = await apiGet('/auth/me');
    if(!r.user || (r.user.role !== 'seller' && r.user.role !== 'admin')){
      showBoot('دسترسی فروشنده لازم است. در حال انتقال...');
      setTimeout(function(){ location.href = 'index.html'; }, 1200);
      return;
    }
    state.user = r.user;
    $('#userAvatar').textContent = (r.user.name || 'ف').trim().charAt(0);
    $('#userName').textContent = r.user.name || 'فروشنده';
    $('#userEmail').textContent = r.user.phone || r.user.email || '';
  }catch(e){
    if(e.message !== 'unauth'){
      showBoot('برای دسترسی وارد شوید...');
      setTimeout(function(){ location.href = 'login.html'; }, 1200);
    }
    return;
  }
  $('#bootLoader').hidden = true;
  $('#app').hidden = false;
  go('dashboard');

  $('#menuBtn').onclick = openSidebar;
  $('#sideScrim').onclick = closeSidebar;
  $('#refreshBtn').onclick = function(){ if(state.page === 'dashboard') renderDashboard($('#content')); else if(state.page === 'products') renderProducts($('#content')); else renderOrders($('#content')); };
  $('#themeBtn').onclick = function(){
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.admTheme = state.theme;
    store.set('bz.sl.theme', state.theme);
  };

  /* user chip */
  var chip = $('#userChip');
  chip.onclick = function(e){
    if(e.target.closest('[data-user-menu]')) return;
    var m = $('#userMenu');
    m.hidden = !m.hidden;
    chip.classList.toggle('open', !m.hidden);
  };
  $('#userMenu').onclick = function(e){
    var btn = e.target.closest('[data-user-menu]');
    if(!btn) return;
    var a = btn.dataset.userMenu;
    $('#userMenu').hidden = true; chip.classList.remove('open');
    if(a === 'site') window.open('index.html','_blank');
    else if(a === 'logout'){
      fetch(API + '/auth/logout', { method:'POST', credentials:'include' }).then(function(){ location.href = 'index.html'; });
    }
  };
}

init();
})();