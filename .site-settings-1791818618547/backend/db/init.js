const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  dateStrings: false
});

async function q(sql, params = []){
  const [rows] = await pool.execute(sql, params);
  return rows;
}
async function qOne(sql, params = []){
  const rows = await q(sql, params);
  return rows[0] || null;
}
async function insert(sql, params = []){
  const [result] = await pool.execute(sql, params);
  return result.insertId;
}

async function initSchema(){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(60) NOT NULL,
      email VARCHAR(120) UNIQUE NOT NULL,
      phone VARCHAR(11) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('user','admin') DEFAULT 'user',
      avatar VARCHAR(500),
      is_active TINYINT(1) DEFAULT 1,
      reset_token VARCHAR(255),
      reset_expire BIGINT,
      last_login TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(80) NOT NULL,
      province VARCHAR(80),
      city VARCHAR(80) NOT NULL,
      street VARCHAR(255) NOT NULL,
      postal_code VARCHAR(20),
      phone VARCHAR(20),
      is_default TINYINT(1) DEFAULT 0,
      INDEX idx_addr_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) UNIQUE NOT NULL,
      slug VARCHAR(100) UNIQUE,
      icon VARCHAR(40) DEFAULT 'book',
      color VARCHAR(20) DEFAULT '#3b82f6',
      order_num INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(280) UNIQUE,
      brand VARCHAR(80) NOT NULL,
      category_id INT NOT NULL,
      price INT NOT NULL,
      off TINYINT DEFAULT 0,
      rating DECIMAL(3,1) DEFAULT 0,
      num_reviews INT DEFAULT 0,
      stock INT DEFAULT 0,
      sales INT DEFAULT 0,
      art VARCHAR(40) DEFAULT 'book',
      description TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_prod_cat (category_id),
      INDEX idx_prod_active (is_active),
      INDEX idx_prod_brand (brand),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_colors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      name VARCHAR(40) NOT NULL,
      hex VARCHAR(9) NOT NULL,
      INDEX idx_color_prod (product_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_specs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      spec_key VARCHAR(120) NOT NULL,
      value VARCHAR(255) NOT NULL,
      INDEX idx_spec_prod (product_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      payment_method ENUM('online','cod') DEFAULT 'online',
      items_price INT NOT NULL,
      discount INT DEFAULT 0,
      shipping_price INT DEFAULT 0,
      total_price INT NOT NULL,
      status ENUM('pending','paid','processing','shipped','delivered','cancelled','refunded') DEFAULT 'pending',
      tracking_code VARCHAR(20) UNIQUE,
      note TEXT,
      shipping_name VARCHAR(120) NOT NULL,
      shipping_phone VARCHAR(20) NOT NULL,
      shipping_province VARCHAR(80),
      shipping_city VARCHAR(80) NOT NULL,
      shipping_street VARCHAR(255) NOT NULL,
      shipping_postal VARCHAR(20),
      paid_at TIMESTAMP NULL,
      delivered_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_order_user (user_id),
      INDEX idx_order_status (status),
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      art VARCHAR(40),
      color_name VARCHAR(40),
      color_hex VARCHAR(9),
      price INT NOT NULL,
      qty INT NOT NULL,
      line_total INT NOT NULL,
      INDEX idx_item_order (order_id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      rating TINYINT NOT NULL,
      comment TEXT NOT NULL,
      is_approved TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_product (user_id, product_id),
      INDEX idx_rev_prod (product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[DB] Schema ready');
}

module.exports = { pool, q, qOne, insert, initSchema };