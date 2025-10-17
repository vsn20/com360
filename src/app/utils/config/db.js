import mysql from 'mysql2/promise';

// Remote MySQL credentials
const pool = mysql.createPool({
  host: '132.148.221.65', // or IP address
  port: 3306, // default MySQL port
  user: 'saichand',
  password: 'SAIchand$8393',
  database: 'com360',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function DBconnection() {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully to remote server');
    connection.release();
    return pool;
  } catch (error) {
    console.error('Error connecting to remote MySQL:', error);
    throw new Error('Failed to connect to remote MySQL');
  }
}

export default DBconnection;