require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, q, qOne, insert } = require('../db/init');

(async ()=>{
  try{
    const NAME  = process.argv[2];
    const PHONE = process.argv[3];
    const PASS  = process.argv[4];

    if(!NAME || !PHONE || !PASS){
      console.error('missing args');
      process.exit(1);
    }

    /* چک اگه از قبل هست */
    let user = await qOne('SELECT * FROM users WHERE phone = ? LIMIT 1', [PHONE]);
    const hash = await bcrypt.hash(PASS, 12);

    if(user){
      /* آپدیت به ادمین + رمز جدید */
      await q('UPDATE users SET name = ?, password = ?, role = ?, is_active = 1, token_version = COALESCE(token_version,0) + 1 WHERE id = ?', [NAME, hash, 'admin', user.id]);
      console.log('UPDATED');
    } else {
      /* ایجاد */
      const email = 'admin' + PHONE + '.' + Date.now().toString(36) + '@admin.local';
      const id = await insert(
        'INSERT INTO users (name, email, phone, password, role, is_active) VALUES (?,?,?,?,?,?)',
        [NAME, email, PHONE, hash, 'admin', 1]
      );
      console.log('CREATED id=' + id);
    }

    /* لیست ادمین‌ها */
    const [admins] = await pool.query("SELECT id, name, phone, is_active FROM users WHERE role = 'admin' ORDER BY id");
    console.log('ADMINS_TOTAL=' + admins.length);
    for(const a of admins){
      console.log('  #' + a.id + '  ' + a.name + '  |  ' + a.phone + '  |  ' + (a.is_active ? 'فعال' : 'غیرفعال'));
    }

    await pool.end();
    process.exit(0);
  }catch(e){
    console.error('ERR: ' + e.message);
    process.exit(1);
  }
})();