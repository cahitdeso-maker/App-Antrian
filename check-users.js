const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function checkAndFixUsers() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_antrian',
    });

    // Check all users
    const [users] = await connection.execute('SELECT id, username, password_hash, role, name FROM users');
    console.log('\n=== Current Users in Database ===');
    console.table(users);

    // Check table structure
    const [columns] = await connection.execute('DESCRIBE users');
    console.log('\n=== Users Table Structure ===');
    console.table(columns);

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAndFixUsers();
