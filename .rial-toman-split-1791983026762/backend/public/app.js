(()=>{
'use strict';

/* ================================================================
   API BASE — آدرس بک‌اند
   ================================================================ */
const API = window.__API_BASE__ || '/api';


/* ================================================================
   HELPERS
   ================================================================ */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const fa=n=>Number(n).toLocaleString('fa-IR');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s).toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک')
  .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/\u200c/g,' ').replace(/\s+/g,' ').trim();
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================
   THEME
   ================================================================ */
const theme={
  get(){return store.get('bz.theme',null)},
  set(t){store.set('bz.theme',t);document.documentElement.dataset.theme=t}
};
const savedTheme=theme.get();
if(savedTheme)document.documentElement.dataset.theme=savedTheme;

/* ================================================================
   SEARCH HISTORY
   ================================================================ */
const hist={
  get(){return store.get('bz.hist',[])},
  add(q){if(!q)return;const l=hist.get().filter(x=>x!==q);l.unshift(q);store.set('bz.hist',l.slice(0,6))},
  clear(){store.set('bz.hist',[])},
  remove(q){store.set('bz.hist',hist.get().filter(x=>x!==q))}
};

/* ================================================================
   VIEW MODE
   ================================================================ */
const viewMode={
  get(){return store.get('bz.view','grid')},
  set(v){store.set('bz.view',v)}
};

/* ================================================================
   API CLIENT
   ================================================================ */
async function apiFetch(path,opts={}){
  const res=await fetch(API+path,{
    credentials:'include',
    ...opts,
    headers: Object.assign(
      {'Content-Type':'application/json'},
      opts.headers || {}
    )
  });
  const data=await res.json().catch(()=>({success:false,message:'پاسخ نامعتبر'}));
  
  /* ← این بلاک رو اضافه کن */
  if(res.status === 401){
    state.user = null;
    store.set('bz.user', null);
    paintUser();
  }
  
  if(!res.ok) throw new Error(data.message||'خطا');
  return data;
}
const apiGet   = p      => apiFetch(p);
const apiPost  = (p,b)  => apiFetch(p,{method:'POST',body:JSON.stringify(b||{})});
const apiPut   = (p,b)  => apiFetch(p,{method:'PUT',body:JSON.stringify(b||{})});
const apiPatch = (p,b)  => apiFetch(p,{method:'PATCH',body:JSON.stringify(b||{})});
const apiDel   = p      => apiFetch(p,{method:'DELETE'});

/* ================================================================
   ICONS
   ================================================================ */
const IC={
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.500-3.500"/>',
  cart:'<circle cx="9" cy="20" r="1.500"/><circle cx="18" cy="20" r="1.500"/><path d="M2 3h3l2.600 12.400a2 2 0 0 0 2 1.600h7.700a2 2 0 0 0 2-1.500L21 8H6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.600-7 8-7s8 3 8 7"/>',
  heart:'<path d="M12 21s-7.500-4.600-9.500-9.300C1 8 3.200 4.500 6.800 4.500c2 0 3.500 1 5.200 3 1.700-2 3.200-3 5.200-3 3.600 0 5.800 3.500 4.300 7.200C19.500 16.400 12 21 12 21z"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  truck:'<path d="M2 6h11v10H2zM13 10h4l4 3v3h-8"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M8.500 12l2.500 2.500 4.500-5"/>',
  ret:'<path d="M4 12a8 8 0 1 1 3 6.200"/><path d="M4 5v7h7"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2.500"/><path d="M3 10h18"/>',
  filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',
  home:'<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  chr:'<path d="M9 6l6 6-6 6"/>',
  chl:'<path d="M15 6l-6 6 6 6"/>',
  check:'<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.010M3 12h.010M3 18h.010"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  lock:'<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
,
  wallet:'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4Z'};
const ic=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IC[n]||''}</svg>`;
const hydrateIcons=(root=document)=>$$('[data-ic]',root).forEach(e=>{e.innerHTML=ic(e.dataset.ic,e.dataset.s||20)});

/* ================================================================
   SVG ART
   ================================================================ */
const ART={
  phone:c=>`<rect x="60" y="18" width="80" height="164" rx="16" fill="${c}"/><rect x="66" y="24" width="68" height="152" rx="11" fill="#0f172a"/><circle cx="106" cy="78" r="24" fill="${c}" fill-opacity=".6"/><circle cx="90" cy="96" r="14" fill="#fff" fill-opacity=".18"/><rect x="74" y="122" width="52" height="8" rx="4" fill="#fff" fill-opacity=".85"/><rect x="74" y="138" width="34" height="8" rx="4" fill="#fff" fill-opacity=".4"/>`,
  laptop:c=>`<rect x="36" y="44" width="128" height="88" rx="8" fill="${c}"/><rect x="42" y="50" width="116" height="76" rx="4" fill="#0f172a"/><rect x="52" y="62" width="44" height="6" rx="3" fill="#fff" fill-opacity=".85"/><rect x="52" y="74" width="70" height="5" rx="2.5" fill="#fff" fill-opacity=".35"/><circle cx="134" cy="102" r="14" fill="${c}" fill-opacity=".75"/><path d="M22 136h156l-6 12q-2 4-8 4H36q-6 0-8-4z" fill="${c}" opacity=".85"/>`,
  headphones:c=>`<path d="M46 118C46 44 154 44 154 118" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round"/><rect x="32" y="104" width="34" height="62" rx="16" fill="${c}"/><rect x="134" y="104" width="34" height="62" rx="16" fill="${c}"/><rect x="58" y="112" width="14" height="46" rx="7" fill="#111827" fill-opacity=".85"/><rect x="128" y="112" width="14" height="46" rx="7" fill="#111827" fill-opacity=".85"/>`,
  watch:c=>`<rect x="76" y="10" width="48" height="180" rx="12" fill="${c}"/><rect x="58" y="56" width="84" height="88" rx="26" fill="#1f2937"/><rect x="63" y="61" width="74" height="78" rx="21" fill="#0b1020"/><circle cx="100" cy="100" r="26" fill="none" stroke="${c}" stroke-width="7" stroke-dasharray="118 46" stroke-linecap="round" transform="rotate(-90 100 100)"/><text x="100" y="105" text-anchor="middle" direction="ltr" font-size="14" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">10:09</text>`,
  speaker:c=>`<rect x="52" y="56" width="96" height="96" rx="32" fill="${c}"/><rect x="70" y="76" width="60" height="4" rx="2" fill="#000" fill-opacity=".22"/><rect x="70" y="88" width="60" height="4" rx="2" fill="#000" fill-opacity=".22"/><rect x="70" y="100" width="60" height="4" rx="2" fill="#000" fill-opacity=".22"/><circle cx="100" cy="140" r="4" fill="#fff" fill-opacity=".75"/>`,
  camera:c=>`<path d="M66 68l10-18h32l10 18z" fill="${c}"/><rect x="28" y="68" width="144" height="88" rx="14" fill="${c}"/><circle cx="88" cy="112" r="36" fill="#0f172a"/><circle cx="88" cy="112" r="28" fill="#1e293b"/><circle cx="88" cy="112" r="16" fill="#334155"/><circle cx="80" cy="104" r="5" fill="#fff" fill-opacity=".55"/>`,
  sneaker:c=>`<path d="M22 132C22 108 32 94 52 92l20-4c6-10 18-16 30-14 8 18 26 26 48 30 22 4 34 14 34 28z" fill="${c}"/><path d="M60 120c30-4 70-4 112 2" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="5" stroke-linecap="round"/><rect x="18" y="130" width="170" height="18" rx="9" fill="#f8fafc"/>`,
  backpack:c=>`<path d="M78 46C78 24 122 24 122 46" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/><rect x="50" y="42" width="100" height="134" rx="34" fill="${c}"/><rect x="64" y="108" width="72" height="50" rx="14" fill="#000" fill-opacity=".16"/><rect x="90" y="122" width="20" height="6" rx="3" fill="#fff" fill-opacity=".85"/>`,
  hoodie:c=>`<path d="M72 34l28 12 28-12 48 28-18 40-18-10v76q0 6-6 6H66q-6 0-6-6V92l-18 10-18-40z" fill="${c}"/><path d="M72 34C78 14 122 14 128 34c-6 20-50 20-56 0z" fill="${c}"/><path d="M92 50v30M108 50v30" stroke="#fff" stroke-opacity=".85" stroke-width="3" stroke-linecap="round"/>`,
  kettle:c=>`<path d="M136 80l30-22 6 10-28 32z" fill="${c}"/><path d="M62 62h76l10 96q0 10-10 10H62q-10 0-10-10z" fill="${c}"/><rect x="66" y="44" width="68" height="18" rx="9" fill="#111827" fill-opacity=".85"/><circle cx="100" cy="42" r="6" fill="#111827" fill-opacity=".85"/><rect x="46" y="168" width="108" height="10" rx="5" fill="#111827" fill-opacity=".85"/>`,
  lamp:c=>`<path d="M62 86L30 176h140l-32-90z" fill="#fbbf24" fill-opacity=".17"/><rect x="96" y="86" width="8" height="82" fill="#374151"/><ellipse cx="100" cy="172" rx="34" ry="8" fill="#374151"/><path d="M66 86l16-54h36l16 54z" fill="${c}"/><ellipse cx="100" cy="86" rx="34" ry="5" fill="#fef3c7"/>`,
  book:c=>`<rect x="48" y="40" width="104" height="132" rx="7" fill="${c}"/><rect x="48" y="40" width="16" height="132" rx="7" fill="#000" fill-opacity=".2"/><rect x="76" y="66" width="62" height="9" rx="4.5" fill="#fff" fill-opacity=".9"/><rect x="76" y="82" width="44" height="9" rx="4.5" fill="#fff" fill-opacity=".9"/>`
};
const art=(t,c)=>`<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">${(ART[t]||ART.book)(c)}</svg>`;

/* ================================================================
   STATE
   ================================================================ */
const state={
  cat:'all', q:'', qRaw:'', sort:'sales', max:1e9, minRate:0,
  disc:false, stock:false, wishOnly:false, shown:12,
  perPage:24, page:1, totalPages:1, totalProducts:0,
  needsReload:false, reloadInFlight:false, loadingMore:false,
  cart:store.get('bz.cart',{}),
  wish:new Set(store.get('bz.wish',[])),
  user:store.get('bz.user',null),
  categories:[]
};
let MAXP = 1e9;
let ALL_PRODUCTS = [];
let byId = {};

const persist=()=>{store.set('bz.cart',state.cart);store.set('bz.wish',[...state.wish])};

/* ================================================================
   NORMALIZE API -> CLIENT FORMAT
   ================================================================ */
function np(p){
  const price = Number(p.price)||0;
  const off   = Number(p.off)||0;
  const fin   = Number(p.finalPrice)||Math.round(price*(1-off/100)/1000)*1000;
  return {
    id: p.id,
    n:  p.name,
    b:  p.brand || '',
    c:  (p.category && (p.category.slug || String(p.category.id))) || '',
    t:  p.art || 'book',
    pr: price,
    off,
    fin,
    r:  Number(p.rating)||0,
    v:  Number(p.numReviews)||0,
    st: Number(p.stock)||0,
    s:  Number(p.sales)||0,
    col:(p.colors&&p.colors.length? p.colors : [{name:'پیش‌فرض',hex:'#94a3b8'}]).map(c=>[c.name,c.hex]),
    sp: (p.specs||[]).map(s=>[s.key||s.spec_key||'',s.value||'']),
    imgs: Array.isArray(p.images) ? p.images.slice() : (Array.isArray(p.imgs) ? p.imgs.slice() : []),
    images: Array.isArray(p.images) ? p.images.slice() : [],
    d:  p.description || ''
  };
}

/* ================================================================
   LOAD DATA FROM API
   ================================================================ */
/* __resolveCartProducts__ */
async function resolveCartProducts(){
  var missing = [];
  for (var k in state.cart) {
    var id = state.cart[k].id;
    if (!byId[id] && missing.indexOf(id) === -1) missing.push(id);
  }
  if (state.wish && typeof state.wish.forEach === 'function') {
    state.wish.forEach(function(w){
      if (!byId[w] && missing.indexOf(w) === -1) missing.push(w);
    });
  }
  if (!missing.length) return 0;
  console.log('[cart] resolving', missing.length, 'missing product(s)');
  var resolved = 0;
  for (var i = 0; i < missing.length; i++) {
    var pid = missing[i];
    try {
      var r = await apiGet('/products/' + pid);
      if (r && r.product) {
        var p = np(r.product);
        if (!byId[p.id]) {
          ALL_PRODUCTS.push(p);
          byId[p.id] = p;
        }
        resolved++;
      }
    } catch (e) {
      /* محصول حذف شده → از سبد و علاقه‌مندی پاک کن */
      for (var kk in state.cart) {
        if (state.cart[kk].id === pid) delete state.cart[kk];
      }
      if (state.wish && typeof state.wish.delete === 'function') state.wish.delete(pid);
    }
  }
  persist();
  updateCartUI();
  return resolved;
}

function buildProductQuery(page){
  var p = new URLSearchParams();
  p.set('page', String(page || 1));
  p.set('limit', String(state.perPage || 24));
  if(state.qRaw) p.set('q', state.qRaw);
  if(state.cat && state.cat !== 'all'){
    var cat = state.categories.find(function(c){ return c.id === state.cat; });
    if(cat && cat.slug) p.set('category', cat.slug);
  }
  if(state.sort) p.set('sort', state.sort);
  if(state.max && state.max < MAXP) p.set('maxPrice', String(state.max));
  if(state.minRate > 0) p.set('minRating', String(state.minRate));
  if(state.disc) p.set('hasOff', 'true');
  if(state.stock) p.set('inStock', 'true');
  return p;
}

async function loadProducts(opts){
  opts = opts || {};
  var page = opts.append ? (state.page + 1) : 1;
  var params = buildProductQuery(page);
  var res;
  try{
    res = await apiGet('/products?' + params.toString());
  }catch(e){
    console.error('[loadProducts]', e);
    throw e;
  }
  var items = (res.items || []).map(np);

  if(opts.append){
    ALL_PRODUCTS = ALL_PRODUCTS.concat(items);
    state.page = page;
  }else{
    ALL_PRODUCTS = items;
    byId = {};
    state.page = 1;
  }
  items.forEach(function(x){ byId[x.id] = x; });

  state.totalProducts = (res.pagination && res.pagination.total) || ALL_PRODUCTS.length;
  state.totalPages    = (res.pagination && res.pagination.pages) || 1;

  /* اگه اولین باره، سقف قیمت رو از نتایج بگیر */
  if(!opts.append && ALL_PRODUCTS.length){
    var maxP = 0;
    for(var i=0;i<ALL_PRODUCTS.length;i++){
      if(ALL_PRODUCTS[i].fin > maxP) maxP = ALL_PRODUCTS[i].fin;
    }
    if(maxP > 0){
      MAXP = Math.ceil(maxP/1000000)*1000000;
      if(state.max > MAXP) state.max = MAXP;
    }
  }

  return res;
}

async function applyFilters(){
  state.needsReload = true;
  renderList();
}

async function loadMore(){
  if(state.page >= state.totalPages) return;
  if(state.loadingMore) return;
  state.loadingMore = true;
  try{
    await loadProducts({ append:true });
    renderList();
  }catch(e){
    toast('خطا در بارگذاری بیشتر: '+e.message);
  }
  state.loadingMore = false;
}

async function loadAll(){
  /* فقط دسته‌بندی‌ها (کوچک) */
  try{
    const catRes = await apiGet('/categories');
    state.categories = (catRes.categories||[]).map(c=>({
      id: c.slug || String(c.id),
      apiId: c.id,
      slug: c.slug || String(c.id),
      n: c.name,
      t: c.icon || 'book',
      c: c.color || '#3b82f6',
      img: c.image_url || null,
      count: c.productCount||0
    }));
  }catch(e){
    console.error('Categories load error:', e);
  }

  /* اولین صفحه محصولات */
  try{
    await loadProducts({ append:false });
  }catch(e){
    console.error('Products load error:', e);
    toast('خطا در بارگذاری محصولات: '+e.message);
    return false;
  }

  return true;
}

/* ================================================================
   FILTER / SORT
   ================================================================ */
const catName = id => (state.categories.find(c=>c.id===id)||{}).n || 'دسته';
const catColor= id => (state.categories.find(c=>c.id===id)||{}).c || '#3b82f6';

function filtered(){
  /* با صفحه‌بندی سمت سرور، ALL_PRODUCTS همان نتایج فیلترشده است.
     فقط فیلتر wishOnly که کلاینتیه باقی مونده. */
  if(state.wishOnly){
    return ALL_PRODUCTS.filter(function(p){ return state.wish.has(p.id); });
  }
  return ALL_PRODUCTS.slice();
}
function countFor(catId){return ALL_PRODUCTS.filter(p=>catId==='all'||p.c===catId).length}

/* ================================================================
   CARD
   ================================================================ */
const stars=r=>`<span class="stars" style="--p:${(r/5*100).toFixed(0)}%" role="img" aria-label="امتیاز ${fa(r)} از ۵"></span>`;
function cardHTML(p){
  const sold=!p.st, wished=state.wish.has(p.id), lowStock=p.st>0&&p.st<=5;
  let tag='';
  if(p.s>=8000)tag='<span class="tag hot">پرفروش</span>';
  else if(p.r>=4.7)tag='<span class="tag top">برتر</span>';
  return `<article class="card${sold?' sold':''}">
    <button class="wish" data-action="wish" data-id="${p.id}" aria-pressed="${wished}" aria-label="${wished?'حذف از':'افزودن به'} علاقه‌مندی‌ها">${ic('heart',18)}</button>
    ${tag}
    <a class="clink" href="#p${p.id}" data-action="open" data-id="${p.id}" aria-label="${esc(p.n)}">
      <div class="thumb" style="--tint:${p.col[0][1]};position:relative">
        ${(p.imgs && p.imgs.length) || (p.images && p.images.length) ? '<img src="'+window.__resolveCardImg(p)+'" alt="${esc(p.n)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1" onerror="this.style.display=\'none\'">' : ''}
        ${art(p.t,p.col[0][1])}${p.off&&!sold?``:''}
        ${p.off && !sold ? '<span class="off-badge">'+fa(p.off)+'٪</span>' : ''}
      </div>
      <div class="title">${esc(p.n)}</div>
      <div class="cmeta"><span class="rate"><span class="star">★</span> ${fa(p.r)} <span class="muted">(${fa(p.v)})</span></span>
        <span class="dots-c" aria-hidden="true">${p.col.slice(0,4).map(c=>`<i style="--c:${c[1]}"></i>`).join('')}</span></div>
      ${lowStock?`<div class="low">تنها ${fa(p.st)} عدد در انبار</div><div class="stock-bar"><i style="width:${p.st/5*100}%"></i></div>`:sold?'<div class="low">ناموجود</div>':'<div class="low"></div>'}
      <div class="prices">${sold?'<span class="muted">ناموجود</span>':`${p.off?`<div class="was-row"><span class="was">${fa(p.pr)}</span></div>`:''}<div class="now">${fa(p.fin)} <small>ریال</small></div>`}</div>
    </a>
    <button class="add" data-action="add" data-id="${p.id}" ${sold?'disabled':''}>${sold?'ناموجود':`${ic('plus',16)} افزودن به سبد`}</button>
  </article>`;
}

/* ================================================================
   STATIC SECTIONS
   ================================================================ */
function renderCatbar(){
  const items=[['all','همه کالاها'],...state.categories.map(c=>[c.id,c.n])];
  $('#catbar').innerHTML=items.map(([id,n])=>`<button data-action="cat" data-cat="${id}" aria-current="${state.cat===id}">${n}</button>`).join('')
    +`<button data-action="deals" aria-current="${state.disc}">تخفیف‌ها</button>`;
}
function renderTrust(){
  const T=[['truck','ارسال سریع','تحویل ۱ تا ۳ روز کاری'],['shield','ضمانت اصالت کالا','همهٔ کالاها با گارانتی معتبر'],['ret','بازگشت ۷ روزه','برای کالاهای سالم'],['card','پرداخت امن','درگاه بانکی یا پرداخت در محل']];
  $('#trust').innerHTML=T.map(([i,t,d])=>`<div><span class="ti">${ic(i,20)}</span><p style="margin:0"><b>${t}</b><span>${d}</span></p></div>`).join('');
}
function renderCatTiles(){
  $('#catTiles').innerHTML=state.categories.map(function(c){
      var inner;
      if(c.img){
        var imgSrc = window.__ASSET__ ? window.__ASSET__(c.img) : c.img;
        inner = '<span class="ct" style="--tint:' + c.c + '"><img class="ct-img" src="' + esc(imgSrc) + '" alt="' + esc(c.n) + '" loading="lazy" onerror="this.style.display=\'none\'"></span>';
      } else {
        inner = '<span class="ct" style="--tint:' + c.c + '">' + art(c.t, c.c) + '</span>';
      }
      return '<button data-action="cat" data-cat="' + c.id + '">' + inner + esc(c.n) + '</button>';
    }).join('');
}
function renderOffers(){
  const L=ALL_PRODUCTS.filter(p=>p.off>=15&&p.st).sort((a,b)=>b.off-a.off).slice(0,8);
  $('#offers').innerHTML=`<div class="o-head"><div><h2>شگفت‌انگیزها</h2><p>تخفیف‌های ویژهٔ امروز</p></div>
    <div class="cd" aria-label="زمان باقی‌مانده" role="timer"><span id="cdH">۰۰</span><span id="cdM">۰۰</span><span id="cdS">۰۰</span></div>
    <button class="btn light" data-action="deals">دیدن همه</button></div>
    <div class="rail" tabindex="0">${L.map(cardHTML).join('')}</div>`;
}
function tick(){
  var isFest = window.__festivalActive === true;
  var endMs = window.__festivalEnds || 0;
  var now = Date.now();

  /* جشنواره تموم شد → حذف تایمر و پیام «جشنواره فعالی وجود ندارد» */
  if(isFest && endMs && endMs <= now){
    console.log('[festival] ⏰ جشنواره به پایان رسید — حذف تایمر');
    window.__festivalActive = false;
    window.__festivalEnds = 0;
    if(typeof showNoFestival === 'function') showNoFestival();
    return;
  }

  /* بدون جشنواره → عدد تایمر آپدیت نمی‌شه چون وجود نداره */
  if(!isFest || !endMs) return;

  var s = Math.max(0, Math.floor((endMs - now) / 1000));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  s = s % 60;
  var fp = function(n){ return String(n).padStart(2, '0').replace(/\d/g, function(x){ return '۰۱۲۳۴۵۶۷۸۹'[x]; }); };
  var A = $('#cdH'), B = $('#cdM'), C = $('#cdS');
  if(A){ A.textContent = fp(h); B.textContent = fp(m); C.textContent = fp(s); }
}

/* ================================================================
   HERO
   ================================================================ */
const SLIDES=[
 {bg:'#d92a3f',t:'جشنوارهٔ تخفیف لوازم دیجیتال',d:'تا ۳۰٪ تخفیف روی موبایل، هدفون و ساعت هوشمند',cta:'دیدن کالاهای تخفیف‌دار',act:'disc',a:['phone','#f8fafc']},
 {bg:'#0f3f45',t:'ارسال رایگان برای سفارش‌های بالای ۱ میلیون ریال',d:'امروز سفارش بدهید، ظرف سه روز کاری تحویل بگیرید',cta:'شروع خرید',act:'all',a:['kettle','#f59e0b']},
 {bg:'#26305f',t:'کتاب‌های تازه‌رسیده را ببینید',d:'رمان، مهارت و برنامه‌نویسی با تخفیف ویژه',cta:'دیدن کتاب‌ها',act:'cat:books',a:['book','#fbbf24']}
];
let heroI=0,heroTimer=null;
function renderHero(){
  $('#hero').innerHTML=SLIDES.map((s,i)=>`<div class="slide${i===0?' on':''}" style="background:${s.bg};color:#fff" role="group" aria-label="${fa(i+1)} از ${fa(SLIDES.length)}" aria-hidden="${i!==0}">
    <div><h2>${s.t}</h2><p>${s.d}</p><button class="btn light" data-action="hero-cta" data-i="${i}" ${i!==0?'tabindex="-1"':''}>${s.cta}</button></div>
    <div class="art">${art(s.a[0],s.a[1])}</div></div>`).join('')
    +`<button class="hnav prev" data-action="hero-prev" aria-label="قبلی">${ic('chr',20)}</button><button class="hnav next" data-action="hero-next" aria-label="بعدی">${ic('chl',20)}</button>
    <div class="dots">${SLIDES.map((_,i)=>`<button data-action="hero-go" data-i="${i}" aria-label="اسلاید ${fa(i+1)}" aria-current="${i===0}"></button>`).join('')}</div>`;
}
function heroGo(i){
  heroI=(i+SLIDES.length)%SLIDES.length;
  $$('.slide').forEach((s,k)=>{const on=k===heroI;s.classList.toggle('on',on);s.setAttribute('aria-hidden',!on);const b=$('.btn',s);if(b)b.tabIndex=on?0:-1});
  $$('.dots button').forEach((d,k)=>d.setAttribute('aria-current',k===heroI));
}
function heroAuto(){
  clearInterval(heroTimer);
  if(reduceMotion)return;
  heroTimer=setInterval(()=>{if(!document.hidden)heroGo(heroI+1)},6000);
}

/* ================================================================
   FILTERS UI
   ================================================================ */
const SORTS=[['sales','پرفروش‌ترین'],['rate','بهترین امتیاز'],['cheap','ارزان‌ترین'],['exp','گران‌ترین'],['off','بیشترین تخفیف']];
function buildFilters(){
  $('#fCats').innerHTML=[['all','همه'],...state.categories.map(c=>[c.id,c.n])].map(([id,n])=>`<label class="radio"><input type="radio" name="fcat" value="${id}"> ${n}<em>${fa(countFor(id))}</em></label>`).join('');
  const r=$('#fPrice');r.min=500000;r.max=MAXP;r.step=500000;r.value=state.max;
  $('#fRate').innerHTML=[[0,'همه'],[4,'۴ به بالا'],[4.5,'۴٫۵ به بالا']].map(([v,t])=>`<button class="pill" role="radio" data-action="rate" data-v="${v}" aria-checked="${state.minRate===v}">${t}</button>`).join('');
  $('#sorts').innerHTML=SORTS.map(([k,t])=>`<button class="pill" role="radio" data-action="sort" data-k="${k}" aria-checked="${state.sort===k}">${t}</button>`).join('');
}
function syncFilters(){
  $$('input[name=fcat]').forEach(i=>i.checked=i.value===state.cat);
  $('#fPrice').value=state.max;
  $('#fPriceOut').textContent=state.max>=MAXP?'بدون محدودیت':`تا ${fa(state.max)} ریال`;
  $('#fStock').checked=state.stock;$('#fDisc').checked=state.disc;
  $$('#fRate .pill').forEach(b=>b.setAttribute('aria-checked',Number(b.dataset.v)===state.minRate));
  $$('#sorts .pill').forEach(b=>b.setAttribute('aria-checked',b.dataset.k===state.sort));
  $$('#catbar button').forEach(b=>{const c=b.dataset.cat;if(c)b.setAttribute('aria-current',state.cat===c);else b.setAttribute('aria-current',state.disc)});
}

/* ================================================================
   LIST
   ================================================================ */
function renderChips(){
  const C=[];
  if(state.cat!=='all')C.push(['cat',catName(state.cat)]);
  if(state.q)C.push(['q',`«${state.qRaw||state.q}»`]);
  if(state.max<MAXP)C.push(['max',`تا ${fa(state.max)} ریال`]);
  if(state.minRate)C.push(['rate',`امتیاز ${fa(state.minRate)} به بالا`]);
  if(state.disc)C.push(['disc','تخفیف‌دار']);
  if(state.stock)C.push(['stock','فقط موجود']);
  if(state.wishOnly)C.push(['wish','علاقه‌مندی‌ها']);
  $('#chips').innerHTML=C.map(([k,t])=>`<button class="chip" data-action="chip" data-k="${k}">${esc(t)} ${ic('x',14)}</button>`).join('');
}
function renderList(){
  /* اگه فیلترها عوض شدن → از سرور reload کن */
  if(state.needsReload){
    if(state.reloadInFlight){
      state.needsReload = false;
      return;
    }
    state.needsReload = false;
    state.reloadInFlight = true;
    loadProducts({ append:false }).then/* __sanitize__ — با DOMPurify و fallback whitelist */
window.__sanitize = window.__sanitize || function(html){
  if(html === null || html === undefined) return '';
  html = String(html);

  /* اگه DOMPurify لود شده، ازش استفاده کن */
  if(typeof window.DOMPurify !== 'undefined' && window.DOMPurify.sanitize){
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','hr','strong','b','em','i','u','s','del','ins','mark','sub','sup',
                     'h1','h2','h3','h4','h5','h6',
                     'ul','ol','li','blockquote','pre','code',
                     'a','img',
                     'table','thead','tbody','tfoot','tr','th','td',
                     'div','span','section','article','aside','header','footer','nav'],
      ALLOWED_ATTR: ['href','title','target','rel','src','alt','width','height','class','id','style',
                     'colspan','rowspan','align','dir'],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      FORBID_TAGS: ['script','style','iframe','frame','frameset','object','embed','applet','form',
                    'input','button','select','option','textarea','base','link','meta','svg','math'],
      FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onmouseout','onfocus','onblur',
                    'onchange','onsubmit','onkeydown','onkeyup','onkeypress','oninput',
                    'formaction','action','srcdoc','xlink:href'],
      ADD_ATTR: ['target'],
      KEEP_CONTENT: true,
    });
  }

  /* fallback: whitelist regex (اگه DOMPurify لود نشد) */
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/?>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<style[^>]*\/?>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<iframe[^>]*\/?>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object\s*>/gi, '')
    .replace(/<object[^>]*\/?>/gi, '')
    .replace(/<embed[^>]*\/?>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form\s*>/gi, '')
    .replace(/<form[^>]*\/?>/gi, '')
    .replace(/<input[^>]*\/?>/gi, '')
    .replace(/<button[^>]*>[\s\S]*?<\/button\s*>/gi, '')
    .replace(/<button[^>]*\/?>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg\s*>/gi, '')
    .replace(/<svg[^>]*\/?>/gi, '')
    .replace(/<meta[^>]*\/?>/gi, '')
    .replace(/<link[^>]*\/?>/gi, '')
    .replace(/<base[^>]*\/?>/gi, '')
    .replace(/<math[^>]*>[\s\S]*?<\/math\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s+(?:href|src|action|formaction|xlink:href)\s*=\s*"\s*javascript:[^"]*"/gi, '')
    .replace(/\s+(?:href|src|action|formaction|xlink:href)\s*=\s*'\s*javascript:[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '');
};

/* __safeLink__ — فقط http(s) و مسیرهای نسبی مجاز */
window.__safeLink = function(url){
  if(!url) return '';
  url = String(url).trim();
  if(!url) return '';
  /* مسیر نسبی */
  if(url.charAt(0) === '/' || url.charAt(0) === '#' || url.charAt(0) === '?') return url;
  /* http(s) */
  if(/^https?:\/\//i.test(url)) return url;
  /* mailto, tel */
  if(/^(mailto|tel):/i.test(url)) return url;
  /* هر چیز دیگه (javascript:, data:, vbscript:, ...) → خالی */
  return '';
};

(function(){
      state.reloadInFlight = false;
      renderList();
    }).catch(function(e){
      state.reloadInFlight = false;
      toast('خطا: '+e.message);
    });
    return;
  }

  const L = filtered();
  const vis = L;
  $('#grid').innerHTML = vis.length
    ? vis.map(cardHTML).join('')
    : '<div class="empty"><h3>کالایی پیدا نشد</h3><p>فیلترها را کمتر کنید یا عبارت دیگری را جستجو کنید.</p><button class="btn primary" data-action="reset">حذف همه فیلترها</button></div>';

  const total = state.totalProducts || L.length;
  $('#count').textContent = fa(total) + ' کالا';
  $('#fCount').textContent = fa(total);
  $('#more').hidden = (state.page >= state.totalPages);

  $('#shopTitle').textContent = state.q
    ? 'نتایج جستجو'
    : state.wishOnly
      ? 'علاقه‌مندی‌های شما'
      : state.cat === 'all'
        ? (state.disc ? 'کالاهای تخفیف‌دار' : 'همه کالاها')
        : catName(state.cat);

  const grid = $('#grid');
  grid.classList.toggle('list-view', viewMode.get() === 'list');
  renderChips(); syncFilters();
}
function scrollToShop(){$('#shop').scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'})}
function resetFilters(){
  Object.assign(state, {
    cat:'all', q:'', qRaw:'', sort:'sales', max:MAXP, minRate:0,
    disc:false, stock:false, wishOnly:false, shown:12
  });
  $('#q').value = '';
  applyFilters();
}

/* ================================================================
   CART
   ================================================================ */
const cartLines=()=>Object.entries(state.cart).map(([k,i])=>({k,...i,p:byId[i.id]})).filter(x=>x.p);
const FREE = (window.__SHIPPING__ && window.__SHIPPING__.FREE_THRESHOLD) || 10000000;
const SHIP = (window.__SHIPPING__ && window.__SHIPPING__.COST) || 600000;
function totals(){
  let old=0,now=0,n=0;
  for(const i of cartLines()){old+=i.p.pr*i.qty;now+=i.p.fin*i.qty;n+=i.qty}
  const ship=(now===0||now>=FREE)?0:SHIP;
  return {old,now,n,disc:old-now,ship,pay:now+ship};
}
function addToCart(id,ci=0,qty=1,sourceEl=null){
  const p=byId[id];if(!p||!p.st)return false;
  const k=id+':'+ci,cur=state.cart[k]?.qty||0,max=Math.min(p.st,10);
  if(cur>=max){toast(`حداکثر تعداد قابل سفارش این کالا ${fa(max)} عدد است`);return false}
  state.cart[k]={id,ci,qty:Math.min(max,cur+qty)};
  persist();updateCartUI();
  if(sourceEl)flyToCart(sourceEl,p.col[ci]?.[1]||'#d92a3f');
  bumpBadge();
  return true;
}
function updateCartUI(){
  const t=totals();
  for(const id of ['cartBadge','cartBadge2']){const b=$('#'+id);if(b){b.hidden=!t.n;b.textContent=fa(t.n)}}
  const wd=$('#wishDot');if(wd)wd.hidden=!state.wish.size;
  if($('#cart').classList.contains('open'))renderCart();
}
function renderCart(){
  const L=cartLines(),t=totals(),body=$('#cartBody'),foot=$('#cartFoot');
  if(!L.length){
    body.innerHTML=`<div class="cart-empty"><div class="big">${ic('cart',40)}</div><h3>سبد خرید شما خالی است</h3><p>کالاهای مورد علاقه‌تان را به سبد اضافه کنید.</p><button class="btn primary" data-action="close-shop">دیدن کالاها</button></div>`;
    foot.hidden=true;return;
  }
  const left=Math.max(0,FREE-t.now),pct=Math.min(100,t.now/FREE*100);
  body.innerHTML=`<div class="free">${left?`با <b>${fa(left)} ریال</b> خرید بیشتر، ارسال رایگان می‌شود.`:'<b style="color:var(--ok)">ارسال این سفارش رایگان است.</b>'}<div class="bar"><i style="width:${pct}%"></i></div></div>`
    +L.map(i=>{const p=i.p,c=p.col[i.ci]||p.col[0],max=Math.min(p.st,10);return `<div class="ci">
      <a class="thumb" href="#p${p.id}" data-action="open" data-id="${p.id}" style="--tint:${c[1]}">${art(p.t,c[1])}</a>
      <div><h3>${esc(p.n)}</h3><div class="cl"><i style="--c:${c[1]}"></i>${c[0]}</div>
        <div class="ci-row"><div class="qty"><button data-action="c-dec" data-k="${i.k}" aria-label="کم کردن">${ic('minus',16)}</button><output>${fa(i.qty)}</output><button data-action="c-inc" data-k="${i.k}" aria-label="زیاد کردن" ${i.qty>=max?'disabled':''}>${ic('plus',16)}</button></div>
        <div class="now" style="font-size:15px">${fa(p.fin*i.qty)} <small>ریال</small></div></div>
        <button class="rm" style="margin-top:4px;width:auto;padding:0 8px;height:30px;font-size:12.5px;gap:4px;display:inline-flex;align-items:center" data-action="c-rm" data-k="${i.k}">${ic('trash',15)} حذف</button>
      </div></div>`}).join('');
  foot.hidden=false;
  foot.innerHTML=`<div class="sum-row"><span>قیمت کالاها (${fa(t.n)})</span><span>${fa(t.old)} ریال</span></div>
    ${t.disc?`<div class="sum-row disc"><span>سود شما از خرید</span><span>${fa(t.disc)} ریال</span></div>`:''}
    <div class="sum-row"><span>هزینهٔ ارسال</span><span>${t.ship?fa(t.ship)+' ریال':'رایگان'}</span></div>
    <div class="sum-row pay"><span>مبلغ قابل پرداخت</span><span>${fa(t.pay)} ریال</span></div>
    <button class="btn primary block" style="margin-top:12px;height:46px" data-action="checkout">ادامه و تکمیل سفارش</button>`;
}

/* ================================================================
   TOAST
   ================================================================ */
let toastTimer,toastEl;
function toast(msg,label,fn){
  const box=$('#toasts');
  if(toastEl)toastEl.remove();
  const el=document.createElement('div');el.className='toast';
  const s=document.createElement('span');s.textContent=msg;el.append(s);
  if(label){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();box.innerHTML='';toastEl=null};el.append(b)}
  const prog=document.createElement('div');prog.className='t-progress';prog.innerHTML='<i></i>';el.append(prog);
  box.append(el);toastEl=el;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
    el.classList.add('out');
    setTimeout(()=>{el.remove();if(toastEl===el)toastEl=null},300);
  },3200);
}

/* ================================================================
   RIPPLE / FLY / BADGE
   ================================================================ */
function ripple(e){
  const b=e.currentTarget;
  const r=document.createElement('span');
  r.className='ripple';
  const rect=b.getBoundingClientRect();
  const size=Math.max(rect.width,rect.height);
  r.style.width=r.style.height=size+'px';
  r.style.left=(e.clientX-rect.left-size/2)+'px';
  r.style.top=(e.clientY-rect.top-size/2)+'px';
  b.appendChild(r);
  setTimeout(()=>r.remove(),600);
}
function flyToCart(sourceEl,tint='#d92a3f'){
  if(reduceMotion)return;
  const cart=$('[data-action="cart"]');if(!cart)return;
  const src=sourceEl.getBoundingClientRect();
  const dst=cart.getBoundingClientRect();
  const fly=document.createElement('div');
  fly.className='fly-item';
  fly.style.left=src.left+'px';fly.style.top=src.top+'px';
  fly.innerHTML=`<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${tint}"/><path d="M9.5 12.5h13l-1.2 11H10.7z" fill="#fff"/><path d="M12.8 12.5c0-4.4 6.4-4.4 6.4 0" stroke="#fff" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`;
  document.body.appendChild(fly);
  requestAnimationFrame(()=>{
    fly.style.left=(dst.left+dst.width/2-30)+'px';
    fly.style.top=(dst.top+dst.height/2-30)+'px';
    fly.style.transform='scale(.3) rotate(360deg)';
    fly.style.opacity='0.2';
  });
  setTimeout(()=>fly.remove(),900);
}
function bumpBadge(){
  for(const id of ['cartBadge','cartBadge2']){
    const b=$('#'+id);if(!b)continue;
    b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump');
  }
}

/* ================================================================
   LAYERS
   ================================================================ */
let current=null,lastFocus=null;
function openLayer(el,scrim){
  if(current&&current!==el)closeLayer(true);
  lastFocus=document.activeElement;current=el;
  el.classList.add('open');document.documentElement.classList.add('lock');
  if(scrim)$('#scrim').classList.add('on');
  setTimeout(()=>{const f=$('[data-autofocus]',el)||$('button,input,select,a[href]',el);f&&f.focus({preventScroll:true})},30);
}
function closeLayer(keepFocus){
  if(!current)return;
  current.classList.remove('open');$('#scrim').classList.remove('on');
  document.documentElement.classList.remove('lock');
  const f=lastFocus;current=null;
  if(!keepFocus&&f&&f.focus&&document.contains(f))f.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if($('#sugg') && !$('#sugg').hidden){closeSugg();return}
    if(current){closeLayer();e.preventDefault()}
  }
  if(e.key==='Tab'&&current){
    const f=$$('button:not([disabled]),input:not([disabled]),select,textarea,a[href],[tabindex]:not([tabindex="-1"])',current).filter(x=>x.offsetParent!==null);
    if(!f.length)return;
    const a=f[0],z=f[f.length-1];
    if(e.shiftKey&&document.activeElement===a){z.focus();e.preventDefault()}
    else if(!e.shiftKey&&document.activeElement===z){a.focus();e.preventDefault()}
  }
});
['pm','co','lg'].forEach(id=>{const el=$('#'+id);if(el)el.addEventListener('mousedown',e=>{if(e.target.id===id)closeLayer()})});

/* ================================================================
   PRODUCT MODAL
   ================================================================ */
const pm={id:0,ci:0,qty:1,tab:'desc',reviews:[]};
function openProduct(id,ci=0){
  const p=byId[id];
  try{ window.__curPmProduct = p; }catch(e){}if(!p)return;
  Object.assign(pm,{id,ci,qty:1,tab:'desc',reviews:[]});
  renderPM();
  if(current!==$('#pm'))openLayer($('#pm'));
  $('#pmSheet').scrollTop=0;
  apiGet('/reviews/product/'+id).then(r=>{
    pm.reviews=(r.reviews||[]).map(x=>({
      name:(x.user&&x.user.name)||'کاربر',
      rating:x.rating, comment:x.comment
    }));
    if(pm.tab==='rev')$('#pmPanel').innerHTML=panelHTML(byId[pm.id]);
  }).catch(()=>{});
}
function panelHTML(p){
  if(pm.tab==='spec'){
    if(!p.sp.length)return '<p class="muted">مشخصات فنی ثبت نشده است.</p>';
    return '<table class="spec"><tbody>'+p.sp.map(function(x){return '<tr><th scope="row">'+esc(x[0])+'</th><td>'+esc(x[1])+'</td></tr>';}).join('')+'<tr><th scope="row">برند</th><td>'+esc(p.b)+'</td></tr></tbody></table>';
  }
  if(pm.tab==='rev'){
    if(!pm.reviews.length){
      return '<div class="reviews-empty">' +
        '<div class="reviews-empty-ic">' +
          '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
            '<path d="M8 9h8M8 13h5"/>' +
          '</svg>' +
        '</div>' +
        '<h4>هنوز نظری ثبت نشده</h4>' +
        '<p>اولین نفری باش که نظر خود را درباره این کالا ثبت می‌کند.</p>' +
      '</div>';
    }
    return pm.reviews.map(function(r){
      return '<div class="rev">' +
        '<b>' + esc(r.name) + '</b> ' + stars(r.rating) +
        '<p>' + esc(r.comment) + '</p>' +
      '</div>';
    }).join('');
  }
  return '<p>'+esc(p.d||'توضیحی ثبت نشده است.')+'</p>';
}
function renderPM(){
  const p=byId[pm.id];if(!p)return;
  const c=p.col[pm.ci]||p.col[0],sold=!p.st,max=Math.min(p.st,10);
  const sim=ALL_PRODUCTS.filter(x=>x.c===p.c&&x.id!==p.id).concat(ALL_PRODUCTS.filter(x=>x.c!==p.c).sort((a,b)=>b.s-a.s)).slice(0,4);
  $('#pmSheet').innerHTML=`<button class="x icon-btn" data-action="close" aria-label="بستن">${ic('x',22)}</button>
  <div class="pm-grid">
    <div><div class="thumb big" id="pmThumb" style="--tint:${c[1]};position:relative;overflow:hidden">
        ${(p.imgs && p.imgs.length) || (p.images && p.images.length) ? '<img class="thumb-img big" src="'+window.__resolveCardImg(p)+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1" onerror="this.style.display=\'none\'">' : ''}
        <span class="thumb-art big">${art(p.t,c[1])}</span>${p.off&&!sold?`<span class="off-badge">${fa(p.off)}٪ تخفیف</span>`:''}</div>
      <ul class="perks"><li>${ic('shield',18)} اصالت و سلامت فیزیکی کالا</li><li>${ic('truck',18)} ${p.fin>=FREE?'ارسال رایگان':'ارسال رایگان برای خرید بالای ۱ میلیون ریال'}</li><li>${ic('ret',18)} هفت روز مهلت بازگشت</li></ul></div>
    <div class="pm-info">
      <div class="crumb">${esc(catName(p.c))} / ${esc(p.b)}</div>
      <h2 id="pmTitle">${esc(p.n)}</h2>
      <div class="mrow">${stars(p.r)}<b>${fa(p.r)}</b><span class="muted">(${fa(p.v)} نظر)</span><span class="muted">· ${fa(p.s)} فروش</span></div>
      <div class="opt"><div class="opt-l">رنگ: <b id="pmColor">${c[0]}</b></div>
        <div class="swatches" role="radiogroup" aria-label="انتخاب رنگ">${p.col.map((x,i)=>`<button role="radio" aria-checked="${i===pm.ci}" aria-label="${x[0]}" title="${x[0]}" data-action="pm-color" data-i="${i}" style="--sw:${x[1]}"></button>`).join('')}</div></div>
      <div class="buy">
        <div class="prices">${sold?'<span class="muted">این کالا در حال حاضر ناموجود است</span>':`${p.off?`<div class="was-row"><span class="pct">${fa(p.off)}٪</span><span class="was">${fa(p.pr)}</span></div>`:''}<div class="now">${fa(p.fin)} <small>ریال</small></div>`}</div>
        ${sold?`<button class="btn outline block" disabled>ناموجود</button>`:`<div class="row"><div class="qty"><button data-action="pm-dec" aria-label="کم کردن" ${pm.qty<=1?'disabled':''}>${ic('minus',16)}</button><output id="pmQty">${fa(pm.qty)}</output><button data-action="pm-inc" aria-label="زیاد کردن" ${pm.qty>=max?'disabled':''}>${ic('plus',16)}</button></div><button class="btn primary" data-action="pm-add" data-autofocus>${ic('cart',18)} افزودن به سبد</button></div>${p.st<=5?`<div class="note">تنها ${fa(p.st)} عدد در انبار باقی مانده است.</div>`:''}`}
      </div>
    </div>
  </div>
  <div class="tabs" role="tablist">${[['desc','معرفی'],['spec','مشخصات فنی'],['rev','نظرات کاربران']].map(([k,t])=>`<button role="tab" aria-selected="${pm.tab===k}" data-action="pm-tab" data-tab="${k}">${t}</button>`).join('')}</div>
  <div class="panel" id="pmPanel" role="tabpanel">${panelHTML(p)}</div>
  <h3 class="sim-h">کالاهای مشابه</h3><div class="sim"><div class="rail">${sim.map(cardHTML).join('')}</div></div>`;
}

/* ================================================================
   CHECKOUT (real API)
   ================================================================ */
const CITIES=['تهران','کرج','مشهد','اصفهان','شیراز','تبریز','اهواز','قم','کرمانشاه','رشت','زاهدان','ارومیه','کرمان','یزد','اردبیل','بندرعباس','اراک','زنجان','سنندج','گرگان','ساری','بوشهر','بیرجند','خرم‌آباد','ایلام','شهرکرد','یاسوج','سمنان','قزوین','بجنورد','سایر شهرها'];
function openCheckout(){
  const L=cartLines();if(!L.length){toast('سبد خرید خالی است');return}
  const t=totals();
  $('#coSheet').innerHTML=`<button class="x icon-btn" data-action="close" aria-label="بستن">${ic('x',22)}</button>
  <div class="sheet-in"><h2 id="coTitle">تکمیل سفارش</h2><p class="muted" style="margin:0 0 6px;font-size:13.5px">اطلاعات تحویل را وارد کنید.</p>
  <form id="coForm" novalidate><div class="co-grid"><div>
    <div class="two"><div class="field"><label for="fn">نام و نام خانوادگی</label><input id="fn" name="name" autocomplete="name" data-autofocus value="${state.user?esc(state.user.name||''):''}"><div class="err" data-for="fn"></div></div>
    <div class="two"><div class="field"><label for="pr">استان</label><input id="pr" name="province" autocomplete="address-level1" placeholder="مثلاً تهران"></div><div class="field"><label for="pc">کد پستی</label><input id="pc" name="postalCode" inputmode="numeric" autocomplete="postal-code" placeholder="۱۰ رقم"><div class="err" data-for="pc"></div></div></div>
    <div class="field"><label for="ph">شماره موبایل</label><input id="ph" name="phone" inputmode="tel" autocomplete="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" value="${state.user?esc(state.user.phone||''):''}"><div class="err" data-for="ph"></div></div></div>
    <div class="field"><label for="ct">شهر</label><select id="ct" name="city"><option value="">انتخاب کنید</option>${CITIES.map(c=>`<option>${c}</option>`).join('')}</select><div class="err" data-for="ct"></div></div>
    <div class="field"><label for="ad">نشانی کامل</label><textarea id="ad" name="addr" autocomplete="street-address"></textarea><div class="err" data-for="ad"></div></div>
    <div class="field"><label>روش پرداخت</label><div class="pay-opts"><label><input type="radio" name="pay" value="online" checked> پرداخت آنلاین با کارت بانکی</label><label><input type="radio" name="pay" value="cod"> پرداخت در محل هنگام تحویل</label></div></div>
  </div>
  <div class="co-sum"><h3>خلاصهٔ سفارش</h3>${L.map(i=>`<div class="co-it"><span>${fa(i.qty)}× ${esc(i.p.n)}</span><span>${fa(i.p.fin*i.qty)}</span></div>`).join('')}
    <div class="sum-row" style="margin-top:8px"><span>هزینهٔ ارسال</span><span>${t.ship?fa(t.ship)+' ریال':'رایگان'}</span></div>
    <div class="sum-row pay"><span>قابل پرداخت</span><span>${fa(t.pay)} ریال</span></div>
    <button class="btn primary block" style="margin-top:14px;height:46px" type="submit">ثبت نهایی سفارش</button></div></div></form></div>`;
  openLayer($('#co'));
  $('#coForm').addEventListener('submit',submitOrder);
}
async function submitOrder(e){
  e.preventDefault();
  const f=e.target,v=n=>f.elements[n].value.trim(),errs={};
  if(v('name').length<3)errs.fn='نام و نام خانوادگی را وارد کنید.';
  if(!/^09\d{9}$/.test(norm(v('phone'))))errs.ph='شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.';
  if(!v('city'))errs.ct='شهر را انتخاب کنید.';
  if(v('addr').length<10)errs.ad='نشانی را کامل‌تر وارد کنید.';
  $$('.err',f).forEach(x=>{const k=x.dataset.for,inp=$('#'+k);x.textContent=errs[k]||'';inp.setAttribute('aria-invalid',!!errs[k])});
  const first=Object.keys(errs)[0];
  if(first){$('#'+first).focus();return}

  if(!state.user){
    toast('برای ثبت سفارش ابتدا وارد شوید.','ورود',()=>{closeLayer();openLogin()});
    return;
  }

  const btn=f.querySelector('button[type=submit]');
  btn.disabled=true;btn.textContent='در حال ثبت...';

  const items=cartLines().map(i=>({
    product:i.p.id, qty:i.qty, color:{name:i.p.col[i.ci][0],hex:i.p.col[i.ci][1]}
  }));
  const shippingAddress={
    name:v('name'), phone:norm(v('phone')),
    province:v('province') || null,
    city:v('city'), street:v('addr'),
    postalCode:v('postalCode') ? norm(v('postalCode')) : null
  };
  const payload={
    items, shippingAddress,
    paymentMethod:f.elements.pay.value,
    note:''
  };

  try{
    const res=await apiPost('/orders',payload);
    const code=res.order.trackingCode;
    const cod=f.elements.pay.value==='cod';
    const total=res.order.totalPrice;

    state.cart={};persist();updateCartUI();
    $('#coSheet').innerHTML=`<button class="x icon-btn" data-action="close" aria-label="بستن">${ic('x',22)}</button>
    <div class="sheet-in"><div class="done"><div class="okc">${ic('check',36)}</div><h2 id="coTitle">سفارش شما ثبت شد</h2>
    <p class="muted" style="margin:6px 0 0">${cod?`مبلغ ${fa(total)} ریال را هنگام تحویل پرداخت کنید.`:`مبلغ ${fa(total)} ریال با موفقیت پرداخت شد.`}</p>
    <div class="code">کد پیگیری: ${esc(code)}</div><br><button class="btn primary" data-action="close" data-autofocus>ادامه خرید</button></div></div>`;
    $('#coSheet [data-autofocus]').focus();
  }catch(err){
    toast('خطا: '+err.message);
    btn.disabled=false;btn.textContent='ثبت نهایی سفارش';
  }
}

/* ================================================================
   LOGIN / REGISTER (real API)
   ================================================================ */
function openLogin(mode){
  /* مودال قدیمی حذف شد — همه‌جا به login.html هدایت می‌شه */
  var target = 'login.html';
  if(mode === 'register' || mode === 'signup') target += '?signup=1';
  window.location.href = target;
}
function renderLogin(err){
  /* فقط حالت کاربر لاگین‌شده */
  if(state.user){
    var sh = $('#lgSheet');
    var x = '<button class="x icon-btn" data-action="close" aria-label="بستن">' + ic('x',22) + '</button>';
    sh.innerHTML = x + '<div class="sheet-in"><h2 id="lgTitle">حساب من</h2>' +
      '<p class="muted">' + esc(state.user.name || 'کاربر') + ' عزیز، خوش آمدید.</p>' +
      '<p class="muted" style="font-size:13.5px">شماره: <b dir="ltr">' + esc(state.user.phone || '—') + '</b></p>' +
      '<button class="btn primary block" data-action="my-orders" style="margin-top:12px">سفارش‌های من</button>' +
      '<button class="btn outline block" data-action="logout" style="margin-top:8px" data-autofocus>' + ic('logout',16) + ' خروج از حساب</button>' +
    '</div>';
    return;
  }
  /* کاربر لاگین نیست → به login.html */
  window.location.href = 'login.html';
}
function paintUser(){
  const txt=$('#loginTxt');
  if(txt)txt.textContent=state.user?(state.user.name?state.user.name.split(' ')[0]:'حساب من'):'ورود | ثبت‌نام';
}

/* ================================================================
   SEARCH SUGGESTIONS
   ================================================================ */
function closeSugg(){const b=$('#sugg');if(b)b.hidden=true;$('#q').setAttribute('aria-expanded','false')}
function renderSugg(){
  const q=norm($('#q').value),box=$('#sugg');if(!box)return;
  const raw=$('#q').value.trim();
  if(!q){
    const h=hist.get();
    const trends=ALL_PRODUCTS.filter(p=>p.s>=6000).slice(0,5);
    box.innerHTML=`
      ${h.length?`<div class="s-head"><span>جستجوهای اخیر</span><button class="clear" data-action="clear-hist">پاک کردن</button></div>
        <div style="padding:4px 8px 8px">${h.map(x=>`<button class="history-chip" data-action="hist-item" data-q="${esc(x)}">${esc(x)} <span class="x" data-action="hist-rm" data-q="${esc(x)}">×</span></button>`).join('')}</div>`:''}
      <div class="s-head"><span>پیشنهادهای پرطرفدار</span></div>
      ${trends.map(p=>`<button data-action="open" data-id="${p.id}"><span class="st" style="--tint:${p.col[0][1]}">${art(p.t,p.col[0][1])}</span><span class="sn">${esc(p.n)}</span><span class="sp">${fa(p.fin)}</span></button>`).join('')}
    `;
    box.hidden=false;$('#q').setAttribute('aria-expanded','true');
    return;
  }
  const R=ALL_PRODUCTS.filter(p=>{const h=norm(`${p.n} ${p.b}`);return q.split(' ').every(w=>h.includes(w))});
  const hl=txt=>{
    if(!raw)return esc(txt);
    let out=esc(txt);
    raw.split(/\s+/).filter(Boolean).forEach(w=>{
      const re=new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
      out=out.replace(re,'<span class="highlight">$1</span>');
    });
    return out;
  };
  box.innerHTML=R.length?R.slice(0,6).map(p=>`<button data-action="open" data-id="${p.id}"><span class="st" style="--tint:${p.col[0][1]}">${art(p.t,p.col[0][1])}</span><span class="sn">${hl(p.n)}</span><span class="sp">${fa(p.fin)}</span></button>`).join('')
    +(R.length>6?`<button class="all" data-action="see-all">نمایش همهٔ ${fa(R.length)} نتیجه</button>`:''):`<div class="none">نتیجه‌ای پیدا نشد.</div>`;
  box.hidden=false;$('#q').setAttribute('aria-expanded','true');
}
let qTimer;
const qInput=$('#q');
if(qInput){
  qInput.addEventListener('input',e=>{
    state.qRaw=e.target.value.trim();state.q=norm(e.target.value);state.shown=12;
    renderSugg();clearTimeout(qTimer);qTimer=setTimeout(applyFilters,300);
  });
  qInput.addEventListener('change',e=>{const v=e.target.value.trim();if(v.length>=2)hist.add(v)});
  qInput.addEventListener('keydown',e=>{if(e.key==='Enter'){closeSugg();renderList();scrollToShop()}});
  qInput.addEventListener('focus',()=>renderSugg());
  document.addEventListener('mousedown',e=>{if(!e.target.closest('.search'))closeSugg()});
}

/* ================================================================
   MY ORDERS MODAL
   ================================================================ */
async function openMyOrders(){
  const sh=$('#lgSheet');
  const x=`<button class="x icon-btn" data-action="close" aria-label="بستن">${ic('x',22)}</button>`;
  sh.innerHTML=`${x}<div class="sheet-in"><h2 id="lgTitle">سفارش‌های من</h2><p class="muted">در حال بارگذاری...</p></div>`;
  try{
    const res=await apiGet('/orders/my');
    const orders=res.orders||[];
    if(!orders.length){
      sh.innerHTML=`${x}<div class="sheet-in"><h2 id="lgTitle">سفارش‌های من</h2><p class="muted">هنوز سفارشی ثبت نکرده‌اید.</p><button class="btn primary block" data-action="close" style="margin-top:12px" data-autofocus>بستن</button></div>`;
    }else{
      const statusMap={pending:'در انتظار پرداخت',paid:'پرداخت‌شده',processing:'در حال پردازش',shipped:'ارسال شده',delivered:'تحویل داده شده',cancelled:'لغو شده',refunded:'بازگشت داده شده'};
      sh.innerHTML=`${x}<div class="sheet-in"><h2 id="lgTitle">سفارش‌های من</h2>
        ${orders.map(o=>`<div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:10px">
          <div style="display:flex;justify-content:space-between;font-size:13px"><b>کد: ${esc(o.trackingCode)}</b><span class="muted">${statusMap[o.status]||o.status}</span></div>
          <div class="muted" style="font-size:12.5px;margin-top:4px">${(o.items||[]).length} کالا · مبلغ: ${fa(o.totalPrice)} ریال</div>
        </div>`).join('')}
        <button class="btn primary block" data-action="close" style="margin-top:16px" data-autofocus>بستن</button></div>`;
    }
  }catch(err){
    sh.innerHTML=`${x}<div class="sheet-in"><h2 id="lgTitle">سفارش‌های من</h2><p class="err">${esc(err.message)}</p><button class="btn outline block" data-action="close" style="margin-top:12px">بستن</button></div>`;
  }
}

/* ================================================================
   CLICK HANDLER
   ================================================================ */
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el)return;
  const a=el.dataset.action,id=Number(el.dataset.id);

  if(a==='open'){e.preventDefault();closeSugg();openProduct(id);return}

  switch(a){
    case 'add':{
      const p=byId[id];
      const thumb=el.closest('.card')?.querySelector('.thumb');
      if(addToCart(id,0,1,thumb))toast(`«${p.n.split(' ').slice(0,4).join(' ')}…» اضافه شد`,'مشاهده سبد',openCart);
      break}
    case 'wish':{
      if(state.wish.has(id)){state.wish.delete(id);toast('از علاقه‌مندی‌ها حذف شد')}else{state.wish.add(id);toast('به علاقه‌مندی‌ها اضافه شد')}
      persist();updateCartUI();
      if(state.wishOnly)renderList();else $$(`[data-action=wish][data-id="${id}"]`).forEach(b=>{const on=state.wish.has(id);b.setAttribute('aria-pressed',on)});
      break}
    case 'wishlist':
      if(!state.wish.size&&!state.wishOnly){toast('هنوز کالایی به علاقه‌مندی‌ها اضافه نکرده‌اید.');break}
      closeLayer(true);state.wishOnly=!state.wishOnly;state.shown=12;renderList();if(state.wishOnly)scrollToShop();break;
    case 'cat':closeLayer(true);state.cat=el.dataset.cat;state.disc=false;applyFilters().then(scrollToShop);break;
    case 'deals':closeLayer(true);state.disc=true;state.cat='all';state.sort='off';applyFilters().then(scrollToShop);break;
    case 'sort':state.sort=el.dataset.k;applyFilters();break;
    case 'rate':state.minRate=Number(el.dataset.v);applyFilters();break;
    case 'more':loadMore();break;
    case 'reset':resetFilters();break;
    case 'see-all':closeSugg();renderList();scrollToShop();break;
    case 'chip':{const k=el.dataset.k;
      if(k==='cat')state.cat='all';
      if(k==='q'){state.q='';state.qRaw='';if(qInput)qInput.value=''}
      if(k==='max')state.max=MAXP;
      if(k==='rate')state.minRate=0;
      if(k==='disc')state.disc=false;
      if(k==='stock')state.stock=false;
      if(k==='wish')state.wishOnly=false;
      applyFilters();break}
    case 'filters':openLayer($('#filters'),true);break;
    case 'filters-close':closeLayer();break;
    case 'close':closeLayer();break;
    case 'close-shop':closeLayer(true);scrollToShop();break;
    case 'home':closeLayer(true);scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});break;
    case 'newsletter':{e.preventDefault();var em=el.querySelector('input[type=email]');if(!em||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value)){em&&em.focus();toast('ایمیل معتبر وارد کنید.');break}em.value='';toast('به‌زودی خبرنامه فعال می‌شود.');break}
    case 'cart':openCart();break;
    case 'c-inc':{const i=state.cart[el.dataset.k];if(i)addToCart(i.id,i.ci,1);break}
    case 'c-dec':{const k=el.dataset.k,i=state.cart[k];if(i){i.qty--;if(i.qty<=0)delete state.cart[k];persist();updateCartUI()}break}
    case 'c-rm':{const k=el.dataset.k,i=state.cart[k],p=i&&byId[i.id];delete state.cart[k];persist();updateCartUI();if(p)toast('از سبد خرید حذف شد','بازگردانی',()=>{state.cart[k]=i;persist();updateCartUI()});break}
    case 'checkout':closeLayer(true);openCheckout();break;
    case 'pm-color':{pm.ci=Number(el.dataset.i);const p=byId[pm.id],c=p.col[pm.ci];
      const thumb=$('#pmThumb');thumb.querySelector('svg').outerHTML=art(p.t,c[1]);
      thumb.style.setProperty('--tint',c[1]);$('#pmColor').textContent=c[0];
      $$('.swatches button').forEach((b,i)=>b.setAttribute('aria-checked',i===pm.ci));break}
    case 'pm-inc':case 'pm-dec':{const max=Math.min(byId[pm.id].st,10);pm.qty=Math.min(max,Math.max(1,pm.qty+(a==='pm-inc'?1:-1)));
      $('#pmQty').textContent=fa(pm.qty);const dec=$('[data-action=pm-dec]'),inc=$('[data-action=pm-inc]');
      if(dec)dec.disabled=pm.qty<=1;if(inc)inc.disabled=pm.qty>=max;break}
    case 'pm-add':{
      const p=byId[pm.id];
      if(addToCart(pm.id,pm.ci,pm.qty,$('#pmThumb')))toast(`${fa(pm.qty)} عدد به سبد اضافه شد`,'مشاهده سبد',()=>{closeLayer(true);openCart()});
      break}
    case 'pm-tab':{pm.tab=el.dataset.tab;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===pm.tab));$('#pmPanel').innerHTML=panelHTML(byId[pm.id]);break}
    case 'login':handleLoginClick(el);break;
    case 'logout':
      try{await apiPost('/auth/logout')}catch(_){}
      state.user=null;store.set('bz.user',null);paintUser();updateCartUI();closeLayer();toast('از حساب خود خارج شدید.');break;
    case 'my-orders':openMyOrders();break;
    case 'hero-prev':heroGo(heroI-1);heroAuto();break;
    case 'hero-next':heroGo(heroI+1);heroAuto();break;
    case 'hero-go':heroGo(Number(el.dataset.i));heroAuto();break;
    case 'hero-cta':{const s=SLIDES[Number(el.dataset.i)];
      if(s.act==='disc'){resetFilters();state.disc=true;state.sort='off';renderList()}
      else if(s.act.startsWith('cat:')){resetFilters();state.cat=s.act.slice(4);renderList()}
      else resetFilters();
      scrollToShop();break}
    case 'view':{viewMode.set(el.dataset.v);$$('[data-action="view"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===viewMode.get()));renderList();break}
    case 'clear-hist':hist.clear();renderSugg();break;
    case 'hist-item':{const q=el.dataset.q;$('#q').value=q;state.qRaw=q;state.q=norm(q);state.shown=12;closeSugg();renderList();scrollToShop();hist.add(q);break}
    case 'hist-rm':{e.stopPropagation();hist.remove(el.dataset.q);renderSugg();break}
  }
});
function openCart(){renderCart();openLayer($('#cart'),true)}

/* ================================================================
   FILTER EVENTS
   ================================================================ */
$('#filters').addEventListener('change',e=>{
  const t=e.target;
  if(t.name==='fcat')state.cat=t.value;
  else if(t.id==='fStock')state.stock=t.checked;
  else if(t.id==='fDisc')state.disc=t.checked;
  applyFilters();
});
let priceTimer;
$('#fPrice').addEventListener('input',e=>{state.max=Number(e.target.value);clearTimeout(priceTimer);priceTimer=setTimeout(applyFilters,300)});
$('#hero').addEventListener('mouseenter',()=>clearInterval(heroTimer));
$('#hero').addEventListener('mouseleave',heroAuto);
$('#hero').addEventListener('focusin',()=>clearInterval(heroTimer));
$('#hero').addEventListener('focusout',heroAuto);

/* ================================================================
   INIT
   ================================================================ */
async function loadSiteSettings(){
  try{
    var r = await apiGet('/site/settings');
    var s = (r && r.settings) || {};

    var el1 = document.getElementById('catSecTitle');
    if(el1 && s.cat_section_title) el1.textContent = s.cat_section_title;

    var el2 = document.getElementById('catSecDesc');
    if(el2){
      if(s.cat_section_desc){ el2.textContent = s.cat_section_desc; el2.style.display = ''; }
      else { el2.style.display = 'none'; }
    }

    /* مخفی کردن کل بخش trust اگه لازم بود */
    var trustEl = document.getElementById('trust');
    if(trustEl && s.trust_section_visible === '0'){
      trustEl.style.display = 'none';
    }
  }catch(e){
    console.warn('[settings] load failed:', e.message);
  }
}

async function init(){
  hydrateIcons();
  renderHero();
  await loadCmsContent();renderTrust();
  loadSiteSettings();
  const ok=await loadAll();
  await resolveCartProducts();
  if(!ok){toast('اتصال به سرور برقرار نشد. مطمئن شو بک‌اند روی ۵۰۰۰ اجراست.');}
  renderCatbar();renderCatTiles();renderOffers();
  buildFilters();renderList();updateCartUI();paintUser();
  /* سال کپی‌رایت */
  try{
    var el = document.getElementById("copyrightYear");
    if(el){
      var jy;
      try{ jy = new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric"}).format(new Date()).replace(/\D/g,""); }catch(e){}
      if(jy) el.textContent = jy;
    }
  }catch(e){}
  tick();setInterval(tick,1000);heroAuto();
 try{
    const r = await apiGet('/auth/me');
    if(r.user){
      state.user = r.user;
      store.set('bz.user', r.user);
      paintUser();
    }
  }catch(e){
    /* کوکی منقضی شده - کاربر رو لاگ‌اوت کن */
    if(state.user){
      state.user = null;
      store.set('bz.user', null);
      paintUser();
    }
  }

  /* scrolled header */
  const header=$('header.site');
  addEventListener('scroll',()=>{header.classList.toggle('scrolled',scrollY>10)},{passive:true});

  /* theme toggle */
  const sunIc='<svg class="ic sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
  const moonIc='<svg class="ic moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const actions=document.querySelector('.actions');
  if(actions && !$('.theme-toggle')){
    const tb=document.createElement('button');
    tb.className='icon-btn theme-toggle';
    tb.setAttribute('aria-label','تغییر تم');
    tb.innerHTML=sunIc+moonIc;
    actions.insertBefore(tb,actions.querySelector('#loginBtn'));
    tb.addEventListener('click',()=>{
      const cur=document.documentElement.dataset.theme;
      const isDark=cur?cur==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
      theme.set(isDark?'light':'dark');
    });
  }

  /* view toggle */
  if(!$('.view-toggle')){
    const sorts=$('#sorts');
    if(sorts){
      const vt=document.createElement('div');
      vt.className='view-toggle';
      vt.innerHTML=`<button data-action="view" data-v="grid" aria-pressed="${viewMode.get()==='grid'}" aria-label="نمای شبکه‌ای">${ic('grid',16)}</button>
        <button data-action="view" data-v="list" aria-pressed="${viewMode.get()==='list'}" aria-label="نمای لیستی">${ic('list',16)}</button>`;
      sorts.parentElement.insertBefore(vt,sorts.nextSibling);
    }
  }

  /* ripple */
  document.addEventListener('pointerdown',e=>{
    const b=e.target.closest('.btn.primary,.btn.outline');
    if(b)ripple(e);
  });

  /* infinite scroll */
  const moreBtn=$('#more');
  if(moreBtn){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(en=>{
        if(en.isIntersecting && !moreBtn.hidden){loadMore()}
      });
    },{rootMargin:'300px'});
    io.observe(moreBtn);
  }
}


/* ================================================================
   CMS — Banners, Sliders, Pages
   ================================================================ */
async function loadCmsContent(){
  try{
    const results = await Promise.all([
      apiGet('/cms/banners').catch(function(){ return { banners: [] }; }),
      apiGet('/cms/sliders').catch(function(){ return { sliders: [] }; }),
      apiGet('/cms/pages').catch(function(){ return { pages: [] }; })
    ]);
    var banners = (results[0] && results[0].banners) || [];
    var sliders = (results[1] && results[1].sliders) || [];
    var pages   = (results[2] && results[2].pages) || [];
    if(banners.length) renderCmsBanners(banners);
    if(sliders.length) renderCmsSliders(sliders);
    if(pages.length)   renderCmsFooterPages(pages);
  }catch(e){
    console.warn('[cms] load failed:', e.message);
  }
}

function renderCmsBanners(banners){
  var top = banners.filter(function(b){ return b.position === 'top'; });
  var mid = banners.filter(function(b){ return b.position === 'middle' || b.position === 'sidebar'; });
  paintBannersInto('#cmsTopBanners', top);
  paintBannersInto('#cmsMidBanners', mid);
}

function paintBannersInto(sel, list){
  var el = document.querySelector(sel);
  if(!el) return;
  if(!list.length){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = list.map(function(b){
    var url = window.__ASSET__ ? window.__ASSET__(b.image_url) : b.image_url;
    var inner = '<img src="' + esc(url) + '" alt="' + esc(b.title || '') + '" loading="lazy">';
    var safeLink = window.__safeLink ? window.__safeLink(b.link) : '';
    if(safeLink){
      var tgt = safeLink.indexOf('http') === 0 ? ' target="_blank" rel="noopener noreferrer"' : '';
      return '<a class="cms-banner" href="' + esc(safeLink) + '"' + tgt + '>' + inner + '</a>';
    }
    return '<div class="cms-banner">' + inner + '</div>';
  }).join('');
}

function renderCmsSliders(sliders){
  var hero = document.querySelector('#hero');
  if(!hero || !sliders.length) return;

  var html = '';
  for(var i = 0; i < sliders.length; i++){
    var s = sliders[i];
    var imgUrl = window.__ASSET__ ? window.__ASSET__(s.image_url) : s.image_url;
    var bg = s.bg_color || '#0f172a';
    var btn = s.button_text || 'مشاهده';
    var link = s.link || '#';
    var onCls = i === 0 ? ' on' : '';
    var hidden = i === 0 ? 'false' : 'true';
    var tabIdx = i === 0 ? '' : ' tabindex="-1"';
    link = window.__safeLink ? window.__safeLink(link) : '';
    var tgt = link.indexOf('http') === 0 ? ' target="_blank" rel="noopener noreferrer"' : '';
    html += '<div class="slide' + onCls + '" style="background:' + esc(bg) + ';color:#fff" aria-label="' + fa(i+1) + ' از ' + fa(sliders.length) + '" aria-hidden="' + hidden + '">';
    html += '<div><h2>' + esc(s.title || '') + '</h2>';
    if(s.subtitle) html += '<p>' + esc(s.subtitle) + '</p>';
    html += '<a class="btn light" href="' + esc(link) + '"' + tgt + tabIdx + '>' + esc(btn) + '</a></div>';
    html += '<div class="art"><img src="' + esc(imgUrl) + '" alt="" style="position:relative;width:100%;height:100%;object-fit:cover;border-radius:inherit"></div>';
    html += '</div>';
  }
  html += '<button class="hnav prev" data-action="hero-prev" aria-label="قبلی"><svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>';
  html += '<button class="hnav next" data-action="hero-next" aria-label="بعدی"><svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>';
  html += '<div class="dots">';
  for(var j = 0; j < sliders.length; j++){
    html += '<button data-action="hero-go" data-i="' + j + '" aria-label="اسلاید ' + fa(j+1) + '" aria-current="' + (j === 0) + '"></button>';
  }
  html += '</div>';

  hero.innerHTML = html;
  try{ if(typeof heroGo === 'function') heroGo(0); }catch(e){}
  try{ if(typeof heroAuto === 'function') heroAuto(); }catch(e){}
}

function renderCmsFooterPages(pages){
  var el = document.querySelector('#cmsFooterLinks');
  if(!el) return;
  var menu = pages.filter(function(p){ return p.show_in_menu; });
  if(!menu.length){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = '<div class="cms-page-links-inner">' +
    menu.map(function(p){
      return '<a href="#/page/' + esc(p.slug) + '" data-page-slug="' + esc(p.slug) + '">' + esc(p.title) + '</a>';
    }).join('') +
    '</div>';

  var links = el.querySelectorAll('[data-page-slug]');
  for(var i = 0; i < links.length; i++){
    (function(a){
      a.onclick = function(e){
        e.preventDefault();
        openCmsPage(a.getAttribute('data-page-slug'));
      };
    })(links[i]);
  }
}

async function openCmsPage(slug){
  try{
    var r = await apiGet('/cms/pages/' + encodeURIComponent(slug));
    var p = r.page;
    if(!p){ toast('صفحه پیدا نشد.'); return; }
    var sheet = document.querySelector('#pmSheet');
    if(!sheet){ toast('خطا در باز کردن صفحه'); return; }
    var xBtn = '<button class="x icon-btn" data-action="close" aria-label="بستن"><svg class="ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    sheet.innerHTML = xBtn + '<div class="cms-page-view">' +
      '<h2 class="cms-page-title">' + esc(p.title) + '</h2>' +
      '<div class="cms-page-content">' + (window.__sanitize ? window.__sanitize(p.content || '') : '') + '</div>' +
      '</div>';
    openLayer(document.querySelector('#pm'));
    document.querySelector('#pmSheet').scrollTop = 0;
  }catch(e){ toast('خطا: ' + e.message); }
}


init();

function openCart(){renderCart();openLayer($('#cart'),true)}

/* __USER_DROPDOWN_PATCH__ */
/* ================================================================
   User Dropdown Menu
   ================================================================ */
let userMenuEl = null;
let userMenuOutsideBound = false;

function handleLoginClick(btn){
  if(state.user){
    toggleUserMenu(btn);
  }else{
    openLogin('login');
  }
}

function toggleUserMenu(btn){
  if(userMenuEl){ closeUserMenu(); return; }
  openUserMenu(btn);
}

function closeUserMenu(){
  if(!userMenuEl) return;
  const el = userMenuEl;
  el.classList.remove('on');
  userMenuEl = null;
  setTimeout(function(){ el.remove(); }, 220);
  if(userMenuOutsideBound){
    document.removeEventListener('mousedown', userMenuOutsideHandler);
    userMenuOutsideBound = false;
  }
  window.removeEventListener('resize', closeUserMenu);
  window.removeEventListener('scroll', closeUserMenu, true);
}

function userMenuOutsideHandler(e){
  if(userMenuEl && !userMenuEl.contains(e.target)){
    closeUserMenu();
  }
}

function openUserMenu(btn){
  const u = state.user || {};
  const initial = (u.name || 'ک').trim().charAt(0);
  const wishCount = state.wish.size || 0;

  const el = document.createElement('div');
  el.className = 'user-menu';
  el.setAttribute('role', 'menu');
  el.innerHTML = `
    <div class="user-menu-head">
      <div class="user-menu-avatar">${esc(initial)}</div>
      <div class="user-menu-info">
        <b>${esc(u.name || 'کاربر')}</b>
        <span dir="ltr">${esc(u.email || '')}</span>
      </div>
    </div>

    <div class="user-menu-list">
      <button type="button" class="user-menu-item" data-um="orders" role="menuitem">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/>
          <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>
        </svg>
        <span>سفارش‌های من</span>
      </button>

      <button type="button" class="user-menu-item" data-um="wishlist" role="menuitem">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.2 4.5 6.8 4.5c2 0 3.5 1 5.2 3 1.7-2 3.2-3 5.2-3 3.6 0 5.8 3.5 4.3 7.2C19.5 16.4 12 21 12 21z"/>
        </svg>
        <span>علاقه‌مندی‌ها</span>
        ${wishCount ? '<span class="um-count">' + fa(wishCount) + '</span>' : ''}
      </button>

      ${state.user && state.user.role === "admin" ? '<button type="button" class="user-menu-item admin-panel-item" data-um="admin-panel" role="menuitem">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="3" y="3" width="7" height="9" rx="1.5"/>' +
          '<rect x="14" y="3" width="7" height="5" rx="1.5"/>' +
          '<rect x="14" y="12" width="7" height="9" rx="1.5"/>' +
          '<rect x="3" y="16" width="7" height="5" rx="1.5"/>' +
        '</svg>' +
        '<span>رفتن به پنل ادمین</span>' +
        '</button>' : ""}
 + ${state.user && state.user.role === "seller" ? '<button type="button" class="user-menu-item admin-panel-item" data-um="seller-panel" role="menuitem">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
          '<path d="M9 22V12h6v10"/>' +
        '</svg>' +
        '<span>پنل فروشنده</span>' +
        '</button>' : ""}
      <button type="button" class="user-menu-item" data-um="reviews" role="menuitem">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 9h8M8 13h5"/>
        </svg>
        <span>دیدگاه و پرسش و پاسخ</span>
      </button>
    </div>

    <div class="user-menu-foot">
      <button type="button" class="user-menu-item danger" data-um="logout" role="menuitem">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        <span>خروج از حساب کاربری</span>
      </button>
    </div>
  `;

  document.body.appendChild(el);
  userMenuEl = el;

  /* Position under the button */
  const r = btn.getBoundingClientRect();
  const mw = el.offsetWidth;
  const mh = el.offsetHeight;

  let left = r.left + (r.width / 2) - (mw / 2);
  left = Math.max(12, Math.min(left, window.innerWidth - mw - 12));

  let top = r.bottom + 10;
  if(top + mh > window.innerHeight - 12){
    top = Math.max(12, r.top - mh - 10);
  }

  el.style.top = top + 'px';
  el.style.left = left + 'px';

  requestAnimationFrame(function(){ if(userMenuEl) userMenuEl.classList.add('on'); });

  /* Handle item clicks */
  el.addEventListener('click', function(e){
    const b = e.target.closest('[data-um]');
    if(!b) return;
    const um = b.dataset.um;
    closeUserMenu();
    if(um === 'admin-panel'){ window.location.href = 'admin.html'; return; }
    if(um === 'seller-panel'){ window.location.href = 'seller.html'; return; }
    if(um === 'orders'){
      if(typeof openMyOrders === 'function') openMyOrders();
    }else if(um === 'wishlist'){
      gotoWishlist();
    }else if(um === 'reviews'){
      openMyReviews();
    }else if(um === 'logout'){
      doUserLogout();
    }
  });

  /* Close on outside click */
  setTimeout(function(){
    document.addEventListener('mousedown', userMenuOutsideHandler);
    userMenuOutsideBound = true;
  }, 0);

  window.addEventListener('resize', closeUserMenu);
  window.addEventListener('scroll', closeUserMenu, true);
}

function gotoWishlist(){
  if(!state.wish.size){
    toast('هنوز کالایی به علاقه‌مندی‌ها اضافه نکرده‌اید.');
    return;
  }
  closeLayer(true);
  state.wishOnly = true;
  state.shown = 12;
  renderList();
  scrollToShop();
}

async function openMyReviews(){
  const sh = $('#lgSheet');
  const x = '<button class="x icon-btn" data-action="close" aria-label="بستن">' + ic('x',22) + '</button>';
  sh.innerHTML = x + '<div class="sheet-in"><h2>دیدگاه و پرسش و پاسخ</h2>'
    + '<p class="muted">در حال بارگذاری...</p></div>';
  openLayer($('#lg'));

  try{
    const res = await apiGet('/orders/my');
    const orders = res.orders || [];
    const items = [];
    orders.forEach(function(o){
      (o.items || []).forEach(function(it){
        if(!items.find(function(x){ return x.product === it.product; })){
          items.push({ product: it.product, name: it.name, art: it.art });
        }
      });
    });

    if(!items.length){
      sh.innerHTML = x + '<div class="sheet-in"><h2>دیدگاه و پرسش و پاسخ</h2>'
        + '<p class="muted">هنوز خریدی ثبت نکرده‌اید. بعد از خرید، می‌توانید نظر و پرسش خود را ثبت کنید.</p>'
        + '<button class="btn primary block" data-action="close" style="margin-top:16px" data-autofocus>بستن</button>'
        + '</div>';
      return;
    }

    sh.innerHTML = x + '<div class="sheet-in"><h2>دیدگاه و پرسش و پاسخ</h2>'
      + '<p class="muted" style="margin:0 0 12px;font-size:13.5px">کالاهایی که خریده‌اید، می‌توانید برایشان نظر ثبت کنید.</p>'
      + '<div class="my-rev-list">'
      + items.slice(0,20).map(function(it){
          return '<button type="button" class="my-rev-item" data-action="open" data-id="' + it.product + '">'
            + '<span class="my-rev-thumb">' + art(it.art || 'book', '#94a3b8') + '</span>'
            + '<span class="my-rev-name">' + esc(it.name) + '</span>'
            + '<span class="my-rev-arrow">›</span>'
            + '</button>';
        }).join('')
      + '</div>'
      + '<button class="btn outline block" data-action="close" style="margin-top:14px">بستن</button>'
      + '</div>';

    sh.querySelectorAll('[data-action="open"]').forEach(function(b){
      b.addEventListener('click', function(){
        closeLayer(true);
        openProduct(Number(b.dataset.id));
      });
    });
  }catch(e){
    sh.innerHTML = x + '<div class="sheet-in"><h2>دیدگاه و پرسش و پاسخ</h2>'
      + '<p class="err">' + esc(e.message) + '</p>'
      + '<button class="btn outline block" data-action="close" style="margin-top:12px">بستن</button>'
      + '</div>';
  }
}

async function doUserLogout(){
  try{ await apiPost('/auth/logout'); }catch(_){}
  state.user = null;
  store.set('bz.user', null);
  paintUser();
  updateCartUI();
  closeLayer();
  toast('از حساب خود خارج شدید.');
}

function attachUserMenuHover(){
  /* Auto-close on page navigation */
  window.addEventListener('beforeunload', closeUserMenu);
}
attachUserMenuHover();
/* ================================================================ */

})();