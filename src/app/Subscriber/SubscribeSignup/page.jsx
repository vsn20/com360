import React from 'react'
import './SubscribeSignup.css'

const page = () => {
  return (
    <div className="subscribersignupContainer">
      <div className="subscribersignupCard">
        <h1 className="subscribersignupTitle">Subscribe Now</h1>
        <p className="subscribersignupSubtitle">
          Join us and get started with your free subscription
        </p>
        
        <form className="subscribersignupForm">
          <div className="subscribersignupInputGroup">
            <label className="subscribersignupLabel">First Name</label>
            <input 
              type="text" 
              className="subscribersignupInput" 
              placeholder="Enter your first name"
            />
          </div>
          
          <div className="subscribersignupInputGroup">
            <label className="subscribersignupLabel">Last Name</label>
            <input 
              type="text" 
              className="subscribersignupInput" 
              placeholder="Enter your last name"
            />
          </div>
          
          <div className="subscribersignupInputGroup">
            <label className="subscribersignupLabel">Company Name</label>
            <input 
              type="text" 
              className="subscribersignupInput" 
              placeholder="Enter your company name"
            />
          </div>
          
          <div className="subscribersignupInputGroup">
            <label className="subscribersignupLabel">Company URL</label>
            <input 
              type="url" 
              className="subscribersignupInput" 
              placeholder="https://yourcompany.com"
            />
          </div>
          
          <button type="submit" className="subscribersignupButton">
            Complete Subscription
          </button>
        </form>
      </div>
    </div>
  )
}

export default page