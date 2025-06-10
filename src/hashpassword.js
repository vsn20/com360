const bcrypt = require('bcrypt');

async function hashPassword() {
  try {
    const password = '12345678'; // The password you want to hash
    const saltRounds = 10; // Same as bcrypt default in your loginaction
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('Hashed Password:', hashedPassword);
  } catch (error) {
    console.error('Error hashing password:', error.message);
  }
}

hashPassword();