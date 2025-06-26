'use client'
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchprojectsbyorgid } from '@/app/serverActions/Projects/overview';
import './projectoverview.css'
const Overview = () => {
   const [projects,setprojects]=useState([]);
   const [error,seterrors]=useState([]);
   const router=useRouter();
   useEffect(()=>{
    const loadprojects=async()=>{
    try {
        const projectdata=await fetchprojectsbyorgid();
        setprojects(projectdata);
        seterrors(null);
    } catch (error) {
        console.error('error loading projects:-',error)
        seterrors(error.message);
        setprojects([]);
    }
   };
   loadprojects();
   },[])

  return (
    <div className='overview-container'>
        <h2>Projects Overview</h2>
         {error && <div className="error-message">{error}</div>}
      {projects.length === 0 && !error ? (
        <p>No Projects found.</p>
      ) : (
        <table className='employee-table'>
         <thead>
            <tr>
                <th>Project Id</th>
                <th>Project Name</th>
                <th>Project Desc</th>
                <th>Account</th>
            </tr>
         </thead>
         <tbody>
            {projects.map((project)=>(
                <tr key={project.PRJ_ID}>
                    <td>{project.PRJ_ID}</td>
                    <td>{project.PRJ_NAME}</td>
                    <td>{project.PRS_DESC}</td>
                    <td>{project.ACCNT_ID}</td>
                </tr>
            ))}
         </tbody>
        </table>
      )}
    </div>
  )
}

export default Overview