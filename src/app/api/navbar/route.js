import DBconnection from "@/app/utils/config/db";
import navbar from "@/app/utils/models/Navbar";
import { NextResponse } from "next/server";


export async function GET(){
    try {
        await DBconnection();
        const navbarItems=await navbar.find().select('name href');
        return NextResponse.json(navbarItems)
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}