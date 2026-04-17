require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function checkAuthSetup() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_antrian',
    });

    console.log('\n=== Better Auth Setup Check ===\n');

    // Check users table structure
    const [columns] = await connection.query('DESCRIBE users');
    console.log('Users table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'NO' ? 'required' : 'optional'})`);
    });

    // Check if there are any users
    const [users] = await connection.query('SELECT id, username, role, created_at FROM users');
    console.log(`\nTotal users: ${users.length}`);
    
    if (users.length > 0) {
      console.log('\nExisting users:');
      users.forEach(user => {
        console.log(`  - ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
      });
    } else {
      console.log('\n⚠️  No users found. Creating default admin user...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await connection.query(
        'INSERT INTO users (username, password, role, name, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        ['admin', hashedPassword, 'admin', 'Administrator', 'true']
      );

      console.log('✅ Default admin user created!');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    }

    // Check sessions table
    const [tableExists] = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'sessions'",
      [process.env.DB_NAME || 'db_antrian']
    );

    if (tableExists[0].count === 0) {
      console.log('\n⚠️  Sessions table not found. Creating...');
      
      await connection.query(`
        CREATE TABLE sessions (
          id VARCHAR(255) PRIMARY KEY,
          user_id INT NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          ip_address VARCHAR(255),
          user_agent VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      console.log('✅ Sessions table created!');
    } else {
      console.log('\n✅ Sessions table exists');
    }

    console.log('\n=== Check Complete ===\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAuthSetup();
