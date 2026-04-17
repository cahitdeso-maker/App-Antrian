require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function testPassword() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_antrian',
    });

    console.log('\n=== Password Test ===\n');

    // Get the admin user
    const [users] = await connection.query(
      'SELECT id, username, password FROM users WHERE username = ?',
      ['admin']
    );

    if (users.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }

    const user = users[0];
    console.log(`Testing user: ${user.username}`);
    console.log(`Password hash in DB: ${user.password.substring(0, 30)}...`);

    // Test with 'admin123'
    const testPassword = 'admin123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    console.log(`\nPassword test: "${testPassword}"`);
    console.log(`Valid: ${isValid ? '✅ YES' : '❌ NO'}`);

    if (!isValid) {
      console.log('\n⚠️  Password is incorrect. Resetting to "admin123"...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await connection.query(
        'UPDATE users SET password = ? WHERE username = ?',
        [hashedPassword, 'admin']
      );

      console.log('✅ Password reset successfully!');
      
      // Verify the new password
      const [updatedUsers] = await connection.query(
        'SELECT id, username, password FROM users WHERE username = ?',
        ['admin']
      );
      
      const newIsValid = await bcrypt.compare('admin123', updatedUsers[0].password);
      console.log(`New password verification: ${newIsValid ? '✅ YES' : '❌ NO'}`);
    }

    console.log('\n=== Test Complete ===\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testPassword();
