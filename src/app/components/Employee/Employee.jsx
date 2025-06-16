'use client'
import React from 'react'
import { useRouter,useParams } from 'next/navigation'



const Employee = () => {

    const router=useRouter();
    const params=useParams();
    const role=params?.role||"";

    const handleaddemployeeclick=()=>{
        router.push(`/homepage/${role}/employee/addemployee`);
    }
  return (
    <div>
       <h1>Employee page</h1>
       <button onClick={handleaddemployeeclick}
       style={{
          padding: "10px 20px",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginTop: "10px",
        }}>
        Add Emplyoee
       </button>
    </div>
  )
}

export default Employee