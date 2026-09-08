require('dotenv').config({ path: '../.env.local' });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

async function createAdminUser() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_antrian',
    });

    console.log('✅ Connected to database');

    const userId = randomUUID();
    const username = 'admin';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Delete existing admin
    console.log('🗑️  Cleaning up existing data...');
    await connection.query('DELETE FROM session WHERE userId IN (SELECT id FROM user WHERE username = ?)', [username]);
    await connection.query('DELETE FROM user WHERE username = ?', [username]);
    console.log('   Done\n');

    // Create admin user
    console.log('📝 Creating admin user...');
    await connection.query(
      'INSERT INTO user (id, username, password, role, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [userId, username, hashedPassword, 'admin', 'Administrator']
    );
    console.log('   User created\n');

    // Verify the password
    console.log('🔑 Verifying password...');
    const [rows] = await connection.query('SELECT password FROM user WHERE id = ?', [userId]);
    const storedHash = rows[0].password;
    const isValid = await bcrypt.compare(password, storedHash);
    console.log('   Password valid:', isValid ? '✅ YES' : '❌ NO');

    console.log('\n✅ Admin user ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Username: admin');
    console.log('🔑 Password: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createAdminUser();



