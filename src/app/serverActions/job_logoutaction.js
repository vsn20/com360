// "use server";

// import { cookies } from "next/headers";

// export async function job_logoutaction() {
//   try {
//     const cookieStore = await cookies();
//     await cookieStore.delete("job_jwt_token");
//     console.log("Job JWT token cookie deleted");
//     return { success: true };
//   } catch (error) {
//     console.log("Job logout error:", error.message);
//     return { success: false, error: "An error occurred during logout" };
//   }
// }


"use server";

import { cookies } from "next/headers";

export async function job_logoutaction() {
  try {
    const cookieStore = await cookies();
    // ✅ Make sure this matches the cookie name used in Login
    await cookieStore.delete("job_jwt_token"); 
    console.log("Job JWT token cookie deleted");
    return { success: true };
  } catch (error) {
    console.log("Job logout error:", error.message);
    return { success: false, error: "An error occurred during logout" };
  }
}