// 'use server'

// import DBconnection from "../utils/config/db";
// import navbar from "../utils/models/Navbar";

// export async function getnavbaritems() {
//   try {
//     await DBconnection();
//     const navbarItems = await navbar.find().select("name href").lean();
//     // Log the fetched items for debugging
//     console.log("Fetched navbar items from MongoDB:", navbarItems);
//     // Convert _id to string to avoid serialization issues
//     const transformedItems = navbarItems.map(item => ({
//       ...item,
//       _id: item._id.toString(),
//     }));
//     console.log("Transformed navbar items:", transformedItems);
//     return transformedItems;
//   } catch (error) {
//     console.error("Error fetching navbar items:", error);
//     throw new Error("Failed to fetch navbar items"); // Throw error to be caught by Client Component
//   }
// }












// 'use server'

// import DBconnection from "../utils/config/db";

// export async function getnavbaritems() {
//   try {
//     const pool = await DBconnection(); // Get the MySQL connection pool
//     const [rows] = await pool.query('SELECT * FROM navbars'); // Query the navbars table
//     console.log("Fetched navbar items from MySQL:", rows);
//     return rows; // Return the rows directly (already plain JavaScript objects)
//   } catch (error) {
//     console.error("Error fetching navbar items:", error);
//     throw new Error("Failed to fetch navbar items");
//   }
// }