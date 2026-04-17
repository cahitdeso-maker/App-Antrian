const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');

async function fixAdminPassword() {
  try {
    // Connect to database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_antrian',
    });

    // Check current users
    const [users] = await connection.execute('SELECT id, username, password_hash FROM users');
    console.log('\n=== Current Users ===');
    console.table(users);

    // Generate new password hash for "admin123"
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('\nGenerated hash:', passwordHash);

    // Update admin password
    await connection.execute(
      'UPDATE users SET password_hash = ? WHERE username = ?',
      [passwordHash, 'admin']
    );

    console.log('\n✅ Admin password updated successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');

    // Verify update
    const [updatedUsers] = await connection.execute('SELECT id, username, password_hash FROM users WHERE username = "admin"');
    console.log('\n=== Updated Admin User ===');
    console.table(updatedUsers);

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixAdminPassword();
