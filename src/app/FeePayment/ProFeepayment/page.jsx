import Link from 'next/link'
import React from 'react'
import '../Feepayment.css'

const page = () => {
  return (
    <div className="feePaymentContainer">
      <div className="feePaymentContent">
        <h1 className="feePaymentTitle">Free for 2026</h1>
        <Link href='/Subscriber/ProSubscribeSignup' className="freeButton">
          Get Started Free
        </Link>
      </div>
    </div>
  )
}

export default page