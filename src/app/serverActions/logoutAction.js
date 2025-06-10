"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction() {
  console.log(`[logoutAction] Initiating logout at ${new Date().toISOString()}`);
  const cookieStore = cookies();
  cookieStore.delete("jwt_token");
  console.log("[logoutAction] JWT token cookie deleted successfully");
  redirect("/login");
}