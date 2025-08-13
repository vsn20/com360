'use client'
import React, { useEffect, useState } from 'react'
import Details from './Details';
import { useRouter } from 'next/navigation';
const OfferGenerating = ({empid,orgid,interviewdetails,acceptingtime,handlebAck}) => {
  const router=useRouter();
  const[filetered,setfiletered]=useState([]);
  const[selectedid,setselectedid]=useState(null);


 const getdisplayprojectid = (prjid) => {
  return prjid.split('-')[1] || prjid;
};


  useEffect(()=>{
    setfiletered(interviewdetails);
  },[interviewdetails,orgid]);

  const selectid=(id)=>{
     setselectedid(id);
  }

  const handleback=()=>{
    router.refresh();
     setselectedid(null);
  }


  return (
    <div>
        {selectedid ? 
        (<>
        {/* <button onClick={handleback}>back</button> */}
        <Details
        selectid={selectedid}
        orgid={orgid}
        empid={empid}
        handleback={handleback}/>
        </>):        
        (<>
        <button onClick={handlebAck}>x</button>
         <table className="employee-table">
        <thead>
            <tr>
                <th>Interview ID</th>
                <th>Application Id</th>
                <th>Applicant Name</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            {filetered.map((details)=>(
                <tr key={details.interview_id} onClick={()=>selectid(details.interview_id)}>
                    <td>{getdisplayprojectid(details.interview_id)}</td>
                    <td>{getdisplayprojectid(details.application_id)}</td>
                    <td>{`${details.first_name} ${details.last_name}`}</td>
                    <td>{details.status}</td>
                </tr>
            ))}
        </tbody>
      </table>
        </>)
        }
    </div>
  )
}

export default OfferGenerating