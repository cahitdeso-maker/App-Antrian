require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createDefaultUser() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_antrian',
    });

    console.log('Connected to database');

    // Check if user exists
    const [users] = await connection.query('SELECT id, username FROM users LIMIT 1');
    
    if (users.length > 0) {
      console.log('Users already exist:', users);
      return;
    }

    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await connection.query(
      'INSERT INTO users (username, password, role, name, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      ['admin', hashedPassword, 'admin', 'Administrator', 'true']
    );

    console.log('✅ Default admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createDefaultUser();
