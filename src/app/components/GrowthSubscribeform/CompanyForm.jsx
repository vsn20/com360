'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
// Import from shared subscription form
import { checkOrgName, initiateSignupOTP, validateSignupOTP, submitSubscriptionRequest, checkEmail, checkUsername } from '@/app/serverActions/SharedSubscriptionForm/SubscribeSignup'
import './GrowthSubscription.module.css'

const CompanyForm = ({ planId }) => {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    // Step 1: Company
    companyName: '',
    logo: null,
    // Step 2: Employee
    firstName: '',
    lastName: '',
    email: '',
    gender: '',       
    mobileNumber: '', 
    dob: '',          
    // Step 3: OTP
    otp: '',
    // Step 4: User Credentials
    username: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- UPDATED FILE HANDLING LOGIC (JPG ONLY) ---
  const handleFileChange = (e) => {
    // Clear previous errors
    setError('');

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Strict validation: Check MIME type
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        setFormData(prev => ({ ...prev, logo: file }));
      } else {
        // If not JPG, show error and reset
        setError('Invalid file format. Only JPG/JPEG files are allowed.');
        e.target.value = ''; // Clear the input visually
        setFormData(prev => ({ ...prev, logo: null })); // Clear from state
      }
    }
  };

  // --- Step 1: Company Details Logic ---
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await checkOrgName(formData.companyName);
      if (result.exists) {
        setError('Company name already exists. Please choose another.');
        setLoading(false);
        return;
      }
      setStep(2);
    } catch (err) {
      setError('Error checking company name.');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2: Employee Details Logic ---
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Check if Email exists before sending OTP
    try {
      const emailCheck = await checkEmail(formData.email);
      if (emailCheck.exists) {
        setError('Email address is already in use.');
        setLoading(false);
        return;
      }

      // Send OTP
      const otpData = new FormData();
      otpData.append('email', formData.email);

      const result = await initiateSignupOTP(otpData);
      if (result.success) {
        setSuccess(`OTP sent to ${formData.email}`);
        setTimeout(() => setSuccess(''), 2000);
        setStep(3);
      } else {
        setError(result.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setError('Network error processing request.');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 3: OTP Verification Logic ---
  const handleStep3Submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const verifyData = new FormData();
    verifyData.append('email', formData.email);
    verifyData.append('otp', formData.otp);

    try {
      const result = await validateSignupOTP(verifyData);
      if (result.success) {
        setSuccess('Email verified successfully.');
        setTimeout(() => setSuccess(''), 1500);
        setStep(4);
      } else {
        setError(result.error || 'Invalid OTP.');
      }
    } catch (err) {
      setError('Error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 4: User Credentials & Final Submission ---
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
        // Check Username availability first
        const userCheck = await checkUsername(formData.username);
        if (userCheck.exists) {
            setError('Username is already taken. Please choose another.');
            setLoading(false);
            return;
        }

        const finalPayload = new FormData();
        Object.keys(formData).forEach(key => {
            finalPayload.append(key, formData[key]);
        });

        // --- NEW: Add Plan ID to payload ---
        if (planId) {
            finalPayload.append('planId', planId);
        } else {
            console.warn("No Plan ID provided to CompanyForm");
            finalPayload.append('planId', 2); // Fallback to Pro if needed, or handle error
        }

        // --- NEW: Call submitSubscriptionRequest (Request Only) ---
        const result = await submitSubscriptionRequest(finalPayload);
        
        if (result.success) {
            // Update success message for Pending state
            setSuccess('Request submitted successfully! Our team will review your application shortly.');
            // Redirect to Home instead of Login
            setTimeout(() => router.push('/'), 3000);
        } else {
            setError(result.error || 'Failed to submit request.');
        }
    } catch (err) {
      console.error(err);
      setError('Critical error during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscribersignupContainer">
      <div className="subscribersignupCard">
        <h1>Growth Form</h1>
        <h1 className="subscribersignupTitle">Subscribe Now</h1>
        
        <p style={{textAlign: 'center', color: '#888', marginBottom: '20px', fontSize: '0.9rem'}}>
          Step {step} of 4
        </p>

        {error && <p style={{color: '#dc2626', marginBottom: '15px', textAlign: 'center', fontWeight: '500'}}>{error}</p>}
        {success && <p style={{color: '#059669', marginBottom: '15px', textAlign: 'center', fontWeight: '500'}}>{success}</p>}

        {/* --- STEP 1: Company Details --- */}
        {step === 1 && (
          <form className="subscribersignupForm" onSubmit={handleStep1Submit}>
            <p className="subscribersignupSubtitle">Company Details</p>
            
            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Company Name *</label>
              <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="subscribersignupInput" placeholder="e.g. Acme Corp" suppressHydrationWarning required />
            </div>
            
            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Company Logo (JPG only)</label>
              <input 
                type="file" 
                name="logo" 
                accept=".jpg, .jpeg, image/jpeg" 
                onChange={handleFileChange} 
                className="subscribersignupInput" 
                style={{padding: '10px'}} 
                suppressHydrationWarning
              />
            </div>

            <button type="submit" className="subscribersignupButton" disabled={loading} suppressHydrationWarning>
              {loading ? 'Checking...' : 'Next'}
            </button>
          </form>
        )}

        {/* --- STEP 2: Employee Details --- */}
        {step === 2 && (
          <form className="subscribersignupForm" onSubmit={handleStep2Submit}>
            <p className="subscribersignupSubtitle">Admin Details</p>

            <div style={{display: 'flex', gap: '15px'}}>
                <div className="subscribersignupInputGroup" style={{flex: 1}}>
                <label className="subscribersignupLabel">First Name *</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="subscribersignupInput" required />
                </div>
                <div className="subscribersignupInputGroup" style={{flex: 1}}>
                <label className="subscribersignupLabel">Last Name *</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="subscribersignupInput" required />
                </div>
            </div>

            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Email Address *</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="subscribersignupInput" placeholder="admin@company.com" required />
            </div>

            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="subscribersignupInput" style={{backgroundColor: '#fff'}}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Mobile Number</label>
              <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} className="subscribersignupInput" placeholder="+1 234 567 8900" />
            </div>

            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Date of Birth</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="subscribersignupInput" />
            </div>

            <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
              <button type="button" onClick={() => setStep(1)} className="subscribersignupButton" style={{background: '#666'}}>Back</button>
              <button type="submit" className="subscribersignupButton" disabled={loading}>{loading ? 'Sending OTP...' : 'Next'}</button>
            </div>
          </form>
        )}

        {/* --- STEP 3: OTP Verification --- */}
        {step === 3 && (
          <form className="subscribersignupForm" onSubmit={handleStep3Submit}>
            <p className="subscribersignupSubtitle">Verify Email</p>
            <p style={{textAlign: 'center', fontSize: '0.9rem', color: '#666', marginTop: '-20px'}}>
              Enter the code sent to <strong>{formData.email}</strong>
            </p>

            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">OTP Code *</label>
              <input type="text" name="otp" value={formData.otp} onChange={handleChange} className="subscribersignupInput" placeholder="123456" maxLength="6" required />
            </div>

            <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
              <button type="button" onClick={() => setStep(2)} className="subscribersignupButton" style={{background: '#666'}}>Back</button>
              <button type="submit" className="subscribersignupButton" disabled={loading}>{loading ? 'Verifying...' : 'Verify'}</button>
            </div>
          </form>
        )}

        {/* --- STEP 4: User Credentials --- */}
        {step === 4 && (
          <form className="subscribersignupForm" onSubmit={handleFinalSubmit}>
            <p className="subscribersignupSubtitle">Set User Credentials</p>

            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Username *</label>
              <input type="text" name="username" value={formData.username} onChange={handleChange} className="subscribersignupInput" placeholder="Create a username" required />
            </div>

            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Password *</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} className="subscribersignupInput" placeholder="Min 6 chars, 1 capital, 1 number, 1 special" required />
            </div>

            <div className="subscribersignupInputGroup">
              <label className="subscribersignupLabel">Confirm Password *</label>
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="subscribersignupInput" required />
            </div>

            <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
              <button type="button" onClick={() => setStep(3)} className="subscribersignupButton" style={{background: '#666'}}>Back</button>
              <button type="submit" className="subscribersignupButton" disabled={loading}>{loading ? 'Submit Request' : 'Complete Signup'}</button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

export default CompanyForm