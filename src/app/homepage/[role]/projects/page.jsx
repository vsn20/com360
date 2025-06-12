
import React from 'react'
import Projects from '@/app/components/Projects'
const page = () => {
  return (
    <div  style={{
        position: 'absolute',
        top: '60px', // below navbar
        left: '220px', // after sidebar
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '24px',
        fontWeight: 'bold',
        backgroundColor: '#f2f2f2', // optional for better visibility
        height: 'calc(100vh - 60px)', // remaining height after navbar
      }}>
          
        <Projects/>
    </div>
  )
}

export default page