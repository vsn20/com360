import React from 'react'

const AdminForm = ({ formData, handleChange, handleFileChange, onBack, onNext, isLoading }) => {
  return (
    <div className="subscribersignupForm">
      <p className="subscribersignupSubtitle">Step 2: Admin Setup</p>

      <div className="subscribersignupInputGroup">
        <label className="subscribersignupLabel">Username</label>
        <input 
          type="text" 
          name="username"
          value={formData.username}
          onChange={handleChange}
          className="subscribersignupInput" 
          placeholder="Admin Username"
          required
        />
      </div>

      <div className="subscribersignupInputGroup">
        <label className="subscribersignupLabel">Email Address</label>
        <input 
          type="email" 
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="subscribersignupInput" 
          placeholder="admin@company.com"
          required
        />
      </div>

      <div className="subscribersignupInputGroup">
        <label className="subscribersignupLabel">Password</label>
        <input 
          type="password" 
          name="password"
          value={formData.password}
          onChange={handleChange}
          className="subscribersignupInput" 
          required
        />
      </div>

      <div className="subscribersignupInputGroup">
        <label className="subscribersignupLabel">Confirm Password</label>
        <input 
          type="password" 
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="subscribersignupInput" 
          required
        />
      </div>

      <div className="subscribersignupInputGroup">
        <label className="subscribersignupLabel">Company Logo</label>
        <input 
          type="file" 
          name="logo"
          accept="image/*"
          onChange={handleFileChange}
          className="subscribersignupInput" 
          style={{padding: '10px'}}
        />
      </div>

      <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
        <button type="button" onClick={onBack} className="subscribersignupButton" style={{background: '#666'}}>
          Back
        </button>
        <button type="button" onClick={onNext} className="subscribersignupButton" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Next'}
        </button>
      </div>
    </div>
  )
}

export default AdminForm