(function(){
  'use strict';

  var API = window.__API_BASE__ || '/api';

  /* هشدار: اگر hostname فرق داره، کوکی SameSite=Lax ممکنه ارسال نشه */
  try{
    var apiUrl = new URL(API, location.href);
    if(apiUrl.hostname !== location.hostname){
      console.warn("[login] hostname mismatch: page=" + location.hostname + " api=" + apiUrl.hostname + " — کوکی SameSite=Lax ممکنه ارسال نشه. از همون hostname استفاده کن.");
    }
  }catch(e){}

  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  var card = $('.auth-card');
  var form = $('#loginForm');
  var alertBox = $('#authAlert');
  var submitBtn = $('#authSubmit');

  function setAlert(msg, ok){
    if(!msg){ alertBox.hidden = true; return; }
    alertBox.hidden = false;
    alertBox.textContent = msg;
    alertBox.className = 'auth-alert' + (ok ? ' ok' : '');
  }

  function normPhone(v){
    return String(v || '')
      .replace(/[۰-۹]/g, function(d){ return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[^0-9]/g, '');
  }

  function switchMode(mode){
    card.setAttribute('data-mode', mode);
    form.setAttribute('data-mode', mode);
    $$('.auth-tab').forEach(function(t){
      t.classList.toggle('is-active', t.dataset.tab === mode);
    });
    var label = $('.auth-submit-label');
    if(label) label.textContent = mode === 'signup' ? 'ساخت حساب' : 'ورود به حساب';
    var pw = $('#auPassword');
    if(pw) pw.setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
    var pwS = $('#pwStrength');
    if(pwS) pwS.hidden = mode !== 'signup';
    setAlert('');
  }

  $$('.auth-tab').forEach(function(t){
    t.addEventListener('click', function(){ switchMode(t.dataset.tab); });
  });
  $$('[data-switch-to]').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      switchMode(a.dataset.switchTo);
    });
  });

  $$('.auth-eye').forEach(function(b){
    b.addEventListener('click', function(){
      var inp = document.getElementById(b.dataset.eye);
      if(!inp) return;
      var on = inp.type === 'text';
      inp.type = on ? 'password' : 'text';
      b.classList.toggle('is-on', !on);
    });
  });

  var pwInput = $('#auPassword');
  if(pwInput){
    pwInput.addEventListener('input', function(){
      var v = pwInput.value;
      var bar = $('#pwStrength .auth-pw-bar i');
      var lbl = $('#pwStrength .auth-pw-lbl');
      if(!bar) return;
      var s = 0;
      if(v.length >= 8) s++;
      if(v.length >= 12) s++;
      if(/[A-Z]/.test(v) || /[آ-ی]/.test(v)) s++;
      if(/\d/.test(v)) s++;
      if(/[^A-Za-z0-9آ-ی]/.test(v)) s++;
      var pct = Math.min(100, (s/5)*100);
      bar.style.width = pct + '%';
      bar.style.background = s <= 1 ? '#b91c4a' : (s <= 3 ? '#d97706' : '#0e7c5f');
      lbl.textContent = s <= 1 ? 'ضعیف' : (s <= 3 ? 'متوسط' : (s >= 5 ? 'بسیار قوی' : 'قوی'));
    });
  }

  var otpBtn = $('#otpBtn');
  if(otpBtn){
    otpBtn.addEventListener('click', function(e){
      e.preventDefault();
      setAlert('ورود با کد یکبار مصرف به زودی فعال می‌شود. لطفاً از رمز عبور استفاده کنید.');
    });
  }

  var forgotLink = $('#forgotLink');
  if(forgotLink){
    forgotLink.addEventListener('click', function(e){
      e.preventDefault();
      setAlert('برای بازیابی رمز، با پشتیبانی تماس بگیرید.');
    });
  }

  var phoneInput = $('#auPhone');
  if(phoneInput){
    phoneInput.addEventListener('input', function(){
      var v = normPhone(phoneInput.value);
      if(v.length > 11) v = v.slice(0, 11);
      phoneInput.value = v;
    });
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    setAlert('');
    var mode = form.getAttribute('data-mode') || 'login';
    var phone = normPhone($('#auPhone').value);
    var password = $('#auPassword').value;

    if(!/^09\d{9}$/.test(phone)){
      setAlert('شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.');
      $('#auPhone').focus();
      return;
    }

    if(mode === 'signup'){
      var name = $('#auName').value.trim();
      var confirm = $('#auConfirm').value;
      var terms = $('#auTerms').checked;

      if(name.length < 3){ setAlert('نام حداقل ۳ کاراکتر.'); $('#auName').focus(); return; }
      if(password.length < 8){ setAlert('رمز حداقل ۸ کاراکتر.'); $('#auPassword').focus(); return; }
      if(password !== confirm){ setAlert('رمز و تکرار یکسان نیست.'); $('#auConfirm').focus(); return; }
      if(!terms){ setAlert('پذیرش قوانین الزامی است.'); return; }

      submitBtn.disabled = true; submitBtn.classList.add('is-loading');
      try{
        var r1 = await fetch(API + '/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ name: name, phone: phone, password: password })
        });
        var d1 = await r1.json();
        if(!r1.ok) throw new Error(d1.message || 'ثبت‌نام ناموفق');
        setAlert('حساب ساخته شد! در حال انتقال...', true);
        setTimeout(function(){ var u=d.user||d.data&&d.data.user; var target=(u&&u.role==="admin")?"admin.html":"index.html"; window.location.href=target; }, 700);
      }catch(err){
        setAlert(err.message || 'خطا در ثبت‌نام');
      }finally{
        submitBtn.disabled = false; submitBtn.classList.remove('is-loading');
      }
      return;
    }

    if(!password){ setAlert('رمز عبور الزامی است.'); $('#auPassword').focus(); return; }

    submitBtn.disabled = true; submitBtn.classList.add('is-loading');
    try{
      var r = await fetch(API + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone: phone, password: password })
      });
      var d = await r.json();
      if(!r.ok) throw new Error(d.message || 'ورود ناموفق');
      setAlert('خوش آمدید! در حال انتقال...', true);
      setTimeout(function(){ var u=d.user||d.data&&d.data.user; var target=(u&&u.role==="admin")?"admin.html":"index.html"; window.location.href=target; }, 700);
    }catch(err){
      setAlert(err.message || 'شماره یا رمز اشتباه است.');
    }finally{
      submitBtn.disabled = false; submitBtn.classList.remove('is-loading');
    }
  });

  var params = new URLSearchParams(location.search);
  if(params.get('signup') === '1') switchMode('signup');
})();