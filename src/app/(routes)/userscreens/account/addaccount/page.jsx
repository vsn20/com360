"use server";

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Addaccount from "@/app/components/Account/Addaccount";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function Page() {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

  if (!token) {
    console.error("No token found, redirecting to login");
    redirect("/login"); // Adjust to your login route
  }

  let orgid;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.orgid) {
      console.error("Invalid token: orgId not found");
      redirect("/login");
    }
    orgid = decoded.orgid;
  } catch (err) {
    console.error("Error verifying JWT:", err.message);
    redirect("/login");
  }

  return (
    <div>
      <Addaccount orgid={orgid} />
    </div>
  );
}