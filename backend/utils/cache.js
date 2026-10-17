const store = new Map();
const MAX_ENTRIES = 500;

function get(k){
  const it = store.get(k);
  if(!it) return null;
  if(Date.now() > it.expires){ store.delete(k); return null; }
  return it.value;
}
function set(k, v, ttl){
  if(store.size >= MAX_ENTRIES){
    const first = store.keys().next().value;
    if(first) store.delete(first);
  }
  store.set(k, { value: v, expires: Date.now() + (ttl || 60000) });
}
function del(prefix){
  if(!prefix){ store.clear(); return; }
  for(const k of store.keys()){
    if(k.indexOf(prefix) === 0) store.delete(k);
  }
}
function cacheMiddleware(ttl){
  return function(req, res, next){
    if(req.method !== 'GET') return next();

    /* اگه کوکی یا هدر Authorization هست، کش نکن (ادمین/کاربر لاگین‌شده) */
    if(req.headers && (req.headers.authorization || req.headers.cookie)){
      res.setHeader('X-Cache', 'SKIP-AUTH');
      return next();
    }

    /* کلید کش: مسیر کامل شامل path و query */
    var key = 'http:' + req.originalUrl;

    var hit = get(key);
    if(hit){
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=' + Math.floor(ttl/1000));
      return res.json(hit);
    }

    var orig = res.json.bind(res);
    res.json = function(body){
      if(res.statusCode >= 200 && res.statusCode < 300){
        set(key, body, ttl);
      }
      res.setHeader('X-Cache', 'MISS');
      return orig(body);
    };
    next();
  };
}
setInterval(function(){
  const now = Date.now();
  for(const [k,v] of store.entries()){
    if(now > v.expires) store.delete(k);
  }
}, 300000);
module.exports = { get, set, del, cacheMiddleware };
