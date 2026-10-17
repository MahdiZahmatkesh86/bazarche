#!/usr/bin/env node
/* ================================================================
   check-db.js — چک وضعیت دیتابیس
   ----------------------------------------------------------------
   اجرا: node check-db.js
   (از داخل پوشه backend اجرا کن)
   ================================================================ */
'use strict';

require('dotenv').config();
const { pool } = require('./db/init');

async function run() {
  console.log('==============================================');
  console.log('  Database Check');
  console.log('==============================================');
  console.log('  DB:', process.env.DB_NAME, '| Host:', process.env.DB_HOST + ':' + process.env.DB_PORT);
  console.log('');

  let ok = true;

  /* اتصال */
  try {
    const [c] = await pool.query('SELECT 1');
    console.log('✅ اتصال به MySQL');
  } catch (e) {
    console.log('❌ اتصال:', e.message);
    console.log('\n  ➜ چک کن .env درست باشه و MySQL روشن باشه');
    process.exit(1);
  }

  /* جدول‌ها */
  const tables = ['users', 'categories', 'products', 'product_colors', 'product_specs', 'orders', 'order_items', 'reviews', 'cms_pages', 'cms_banners', 'cms_sliders', 'site_features', 'site_festivals'];
  console.log('\n--- جدول‌ها ---');
  for (const t of tables) {
    try {
      const [r] = await pool.query('SELECT COUNT(*) c FROM ' + t);
      console.log('  ✅ ' + t.padEnd(20) + ' → ' + r[0].c + ' ردیف');
    } catch (e) {
      console.log('  ❌ ' + t.padEnd(20) + ' → ' + e.message);
      ok = false;
    }
  }

  /* محصولات فعال */
  console.log('\n--- محصولات ---');
  try {
    const [all] = await pool.query('SELECT COUNT(*) c FROM products');
    const [active] = await pool.query('SELECT COUNT(*) c FROM products WHERE is_active = 1');
    const [inactive] = await pool.query('SELECT COUNT(*) c FROM products WHERE is_active = 0');
    console.log('  کل محصولات:     ' + all[0].c);
    console.log('  فعال:           ' + active[0].c);
    console.log('  غیرفعال:        ' + inactive[0].c);

    if (all[0].c === 0) {
      console.log('\n  ⚠️  هیچ محصولی توی DB نیست.');
      console.log('  ➜ اجرا کن: node utils/seed.js');
    } else if (active[0].c === 0) {
      console.log('\n  ⚠️  همه محصولات غیرفعالن.');
      console.log('  ➜ فعالشون کن: UPDATE products SET is_active = 1;');
    }
  } catch (e) {
    console.log('  ❌', e.message);
  }

  /* دسته‌ها */
  console.log('\n--- دسته‌بندی‌ها ---');
  try {
    const [rows] = await pool.query('SELECT id, name, is_active FROM categories ORDER BY id LIMIT 10');
    if (!rows.length) {
      console.log('  ⚠️  هیچ دسته‌ای نیست → node utils/seed.js');
    } else {
      rows.forEach(r => console.log('  #' + r.id + ' ' + r.name + ' | active=' + r.is_active));
    }
  } catch (e) {
    console.log('  ❌', e.message);
  }

  /* ادمین‌ها */
  console.log('\n--- ادمین‌ها ---');
  try {
    const [rows] = await pool.query("SELECT id, name, phone, email, is_active FROM users WHERE role='admin'");
    if (!rows.length) {
      console.log('  ⚠️  هیچ ادمینی نیست');
      console.log('  ➜ اجرا کن: node utils/make-admin.js "نام" 09123456789 "پسورد-قوی"');
    } else {
      rows.forEach(r => console.log('  #' + r.id + ' ' + r.name + ' | ' + r.phone + ' | ' + r.email + ' | active=' + r.is_active));
    }
  } catch (e) {
    console.log('  ❌', e.message);
  }

  console.log('\n==============================================');
  console.log(ok ? '  ✅ همه جدول‌ها موجودن' : '  ⚠️  بعضی جدول‌ها مشکل دارن');
  console.log('==============================================\n');

  await pool.end();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });