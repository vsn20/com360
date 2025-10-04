const bcrypt = require('bcrypt');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to hash the input
async function hashInput(input) {
  try {
    // Hash the input with bcrypt (salt rounds = 10)
    const hashedOutput = await bcrypt.hash(input, 10);
    console.log('Hashed Output:', hashedOutput);
  } catch (error) {
    console.error('Error hashing input:', error.message);
  } finally {
    rl.close();
  }
}

// Prompt user for input
rl.question('Enter the text to hash: ', (input) => {
  if (!input) {
    console.error('No input provided.');
    rl.close();
    return;
  }
  hashInput(input);
});