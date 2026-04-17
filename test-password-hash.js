const bcrypt = require('bcryptjs');

async function testPassword() {
  const hashedPassword = '$2b$10$ZN./NQPVMqGkIFSgYq8P6OR1fEsCnCzbbRcHkjvxn2cN64Eq5xDKy';
  const testPassword = 'admin123';
  
  const isValid = await bcrypt.compare(testPassword, hashedPassword);
  console.log(`Password "admin123" matches hash:`, isValid);
  
  if (!isValid) {
    console.log('\nCreating new hash for "admin123":');
    const newHash = await bcrypt.hash(testPassword, 10);
    console.log(newHash);
    console.log('\nUpdate query:');
    console.log(`UPDATE users SET password = '${newHash}' WHERE username = 'admin';`);
  }
}

testPassword();
