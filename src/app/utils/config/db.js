// import mongoose from "mongoose"

// const DBconnection=async()=>{
//     try {
//          await mongoose.connect(process.env.MONGO_URL);
//          console.log("DB CONNECTED")
//     } catch (error) {
//         console.log(error)
//     }     
// }

// export default DBconnection;





import mysql from 'mysql2/promise';

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Chernan$#123', // Replace with your MySQL password
  database: process.env.MYSQL_DATABASE || 'intern_proj',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function DBconnection() {
  try {
    // Test the connection by getting a connection from the pool
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully');
    connection.release(); // Release the connection back to the pool
    return pool; // Return the pool for querying
  } catch (error) {
    console.error('Error connecting to MySQL:', error);
    throw new Error('Failed to connect to MySQL');
  }
}

export default DBconnection;