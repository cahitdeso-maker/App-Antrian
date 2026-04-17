const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function checkDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_antrian',
    });

    // Check table structure
    console.log('\n=== Users Table Structure ===');
    const [columns] = await connection.execute('DESCRIBE users');
    console.table(columns);

    // Check all users
    console.log('\n=== Current Users ===');
    const [users] = await connection.execute('SELECT * FROM users');
    console.table(users);

    // Check if sessions table exists
    console.log('\n=== Sessions Table Structure ===');
    try {
      const [sessions] = await connection.execute('DESCRIBE sessions');
      console.table(sessions);
    } catch (e) {
      console.log('Sessions table does not exist');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkDatabase();
