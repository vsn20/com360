'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from './logn.module.css';
import { loginaction } from '../serverActions/loginAction';
import { sendOTP, verifyOTP, finalSignup } from '../serverActions/SignupAction';
import { sendForgotOTP, verifyForgotOTP, resetPassword } from '../serverActions/ForgotPasswordAction';
import { sign } from 'jsonwebtoken';

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState(null);
  const [signupError, setSignupError] = useState(null);
  const [signupSuccess, setSignupSuccess] = useState(null);
  const [forgotError, setForgotError] = useState(null);
  const [forgotSuccess, setForgotSuccess] = useState(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [signupStep, setSignupStep] = useState('email'); // 'email', 'otp', 'details'
  const [signupEmail, setSignupEmail] = useState('');
  const [forgotStep, setForgotStep] = useState('identifier'); // 'identifier', 'otp', 'reset'
  const [forgotEmail, setForgotEmail] = useState('');

  useEffect(() => setIsClient(true), []);

  if (!isClient) return null;

  const isAuthMode = isSignup || isForgotPassword;

  const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    return usernameRegex.test(username);
  };

  const handleSendOTP = async (formData) => {
    setSignupError(null);
    startTransition(async () => {
      const email = formData.get('email');
      const { success, error } = await sendOTP(formData);
      if (success) {
        setSignupEmail(email);
        setSignupStep('otp');
        setSignupSuccess('OTP sent to your email. Please check your inbox.');
      } else {
        setSignupError(error || 'Failed to send OTP. Please try again.');
      }
    });
  };

  const handleVerifyOTP = async (formData) => {
    setSignupError(null);
    startTransition(async () => {
      formData.append('email', signupEmail); // Pass email along
      const { success, error } = await verifyOTP(formData);
      if (success) {
        setSignupStep('details');
        setSignupSuccess('OTP verified successfully.');
      } else {
        setSignupError(error || 'Invalid or expired OTP. Please try again.');
      }
    });
  };

  const handleFinalSignup = async (formData) => {
    setSignupError(null);
    startTransition(async () => {
      const user_id = formData.get('user_id');
      if (!validateUsername(user_id)) {
        setSignupError('Username must contain only letters and numbers.');
        return;
      }
      formData.append('email', signupEmail); // Pass email along
      const { success, error } = await finalSignup(formData);
      if (success) {
        setSignupError(null);
        setSignupSuccess("Signup successful! Please log in.");
        setTimeout(() => {
          setIsSignup(false);
          setSignupSuccess(null);
          setSignupStep('email');
          setSignupEmail('');
        }, 1000);
      } else {
        setSignupError(error || 'Signup failed. Please try again.');
      }
    });
  };

  const handleSendForgotOTP = async (formData) => {
    setForgotError(null);
    startTransition(async () => {
      const identifier = formData.get('identifier');
      const isEmail = identifier.includes('@') && (identifier.includes('.com') || identifier.includes('.in'));
      formData.append('type', isEmail ? 'email' : 'username');
      const { success, error, email } = await sendForgotOTP(formData);
      if (success) {
        setForgotEmail(email);
        setForgotStep('otp');
        setForgotSuccess('OTP sent to your email. Please check your inbox.');
      } else {
        setForgotError(error || 'Failed to send OTP. Please try again.');
      }
    });
  };

  const handleVerifyForgotOTP = async (formData) => {
    setForgotError(null);
    startTransition(async () => {
      formData.append('email', forgotEmail); // Pass email along
      const { success, error } = await verifyForgotOTP(formData);
      if (success) {
        setForgotStep('reset');
        setForgotSuccess('OTP verified successfully.');
      } else {
        setForgotError(error || 'Invalid or expired OTP. Please try again.');
      }
    });
  };

  const handleResetPassword = async (formData) => {
    setForgotError(null);
    startTransition(async () => {
      formData.append('email', forgotEmail); // Pass email along
      const { success, error } = await resetPassword(formData);
      if (success) {
        setForgotError(null);
        setForgotSuccess("Password reset successful! Please log in.");
        setTimeout(() => {
          setIsForgotPassword(false);
          setForgotSuccess(null);
          setForgotStep('identifier');
          setForgotEmail('');
        }, 1000);
      } else {
        setForgotError(error || 'Password reset failed. Please try again.');
      }
    });
  };

  const handleSubmit = async (formData) => {
    setError(null);
    startTransition(async () => {
      try {
        const logindetails = { username: formData.get('identifier'), password: formData.get('password') };
        console.log('Form data sent to loginaction:', logindetails);
        const { success, roleid, orgid, rolename, token, error: loginError } = await loginaction(logindetails);
        console.log('Login response - orgid:', orgid, 'type:', typeof orgid);

        if (success) {
          // Fetch all accessible features for the role
          const roleMenuResponse = await fetch(`/api/menu?roleid=${roleid}`, {
            headers: { Cookie: `jwt_token=${token}` },
            credentials: 'include',
          });

          if (!roleMenuResponse.ok) throw new Error(`Failed to fetch role C_MENU: ${roleMenuResponse.statusText}`);
          const roleMenuItems = await roleMenuResponse.json();
          console.log('Role C_MENU items fetched:', JSON.stringify(roleMenuItems, null, 2));

          // Fetch all features for the organization
          const orgMenuResponse = await fetch(`/api/menu?orgid=${orgid}`, {
            headers: { Cookie: `jwt_token=${token}` },
            credentials: 'include',
          });

          if (!orgMenuResponse.ok) throw new Error(`Failed to fetch org C_MENU: ${orgMenuResponse.statusText}`);
          const orgMenuItems = await orgMenuResponse.json();
          console.log('Org C_MENU items fetched:', JSON.stringify(orgMenuItems, null, 2));

          // Flatten and map accessible features including submenus
          const accessibleItems = [];
          orgMenuItems.forEach(orgItem => {
            const roleItem = roleMenuItems.find(r => r.title === orgItem.title);
            if (roleItem) {
              accessibleItems.push({ href: orgItem.href, isMenu: true, priority: 0 }); // Placeholder priority for C_MENU
              orgItem.C_SUBMENU.forEach((sub, index) => {
                accessibleItems.push({ href: sub.href, isMenu: false, priority: index + 1 }); // Sequential priority for submenus
              });
            }
          });

          console.log('Accessible items:', JSON.stringify(accessibleItems, null, 2));

          // Sort by priority (C_MENU first, then submenus by order)
          accessibleItems.sort((a, b) => a.priority - b.priority);

          // Redirect to the least priority item or fallback
          const redirectPath = accessibleItems.length > 0 ? accessibleItems[0].href : '/userscreens';
          console.log('Redirecting to:', redirectPath);

          router.push(redirectPath);
        } else {
          setError(loginError || 'Login failed. Please try again.');
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
        console.error('Login error:', err);
      }
    });
  };

  const handleTryAnotherEmail = () => {
    setSignupStep('email');
    setSignupEmail('');
    setSignupError(null);
    setSignupSuccess(null);
  };

  const handleTryAnotherIdentifier = () => {
    setForgotStep('identifier');
    setForgotEmail('');
    setForgotError(null);
    setForgotSuccess(null);
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setForgotStep('identifier');
    setForgotEmail('');
    setForgotError(null);
    setForgotSuccess(null);
  };

  return (
    <div className={styles.contentWrapper} suppressHydrationWarning>
      <div className={styles.mainContainer}>
        <div className={`${styles.textSection} ${isAuthMode ? styles.order2 : ''}`}>
          <div className={styles.textContent}>
            <h2>{isSignup ? 'Welcome Back!' : isForgotPassword ? 'Reset Your Password' : 'New Here?'}</h2>
            <p>
              {isSignup ? 'Log in to access your dashboard.' : isForgotPassword ? 'Reset your password to regain access.' : 'Sign up to get started.'}
            </p>
            <button className={styles.switchBtn} onClick={() => {
              if (isSignup) setIsSignup(false);
              else if (isForgotPassword) setIsForgotPassword(false);
              else setIsSignup(true);
            }}>
              {isAuthMode ? 'Go to Login' : 'Go to Sign Up'}
            </button>
          </div>
        </div>
        <div className={`${styles.authContainer} ${isAuthMode ? styles.order1 : ''}`}>
          {isSignup ? (
            <div id="signupForm" className={styles.formWrapper}>
              <h2>Sign Up</h2>
              {signupError && <p style={{ color: 'red' }}>{signupError}</p>}
              {signupSuccess && <p style={{ color: 'green' }}>{signupSuccess}</p>}
              {signupStep === 'email' && (
                <form action={handleSendOTP}>
                  <input className={styles.input} type="email" name="email" placeholder="Email" required />
                  <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                    Send OTP
                  </button>
                </form>
              )}
              {signupStep === 'otp' && (
                <div>
                  <form action={handleVerifyOTP}>
                    <input className={styles.input} type="text" name="otp" placeholder="Enter OTP" required />
                    <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                      Verify OTP
                    </button>
                  </form>
                  <p style={{ marginTop: '10px' }}>
                    <a href="#" onClick={handleTryAnotherEmail} className={styles.link}>
                      Try using another email?
                    </a>
                  </p>
                </div>
              )}
              {signupStep === 'details' && (
                <div>
                  <form action={handleFinalSignup}>
                    <input className={styles.input} type="text" name="user_id" placeholder="User ID (letters and numbers only)" required />
                    <input className={styles.input} type="password" name="password" placeholder="Password (min 6 chars, 1 letter, 1 number, 1 capital, 1 special)" required />
                    <input className={styles.input} type="password" name="confirm_password" placeholder="Confirm Password" required />
                    <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                      Complete Signup
                    </button>
                  </form>
                  <p style={{ marginTop: '10px' }}>
                    <a href="#" onClick={handleTryAnotherEmail} className={styles.link}>
                      Try using another email?
                    </a>
                  </p>
                </div>
              )}
            </div>
          ) : isForgotPassword ? (
            <div id="forgotForm" className={styles.formWrapper}>
              <h2>Forgot Password</h2>
              {forgotError && <p style={{ color: 'red' }}>{forgotError}</p>}
              {forgotSuccess && <p style={{ color: 'green' }}>{forgotSuccess}</p>}
              {forgotStep === 'identifier' && (
                <form action={handleSendForgotOTP}>
                  <input
                    className={styles.input}
                    type="text"
                    name="identifier"
                    placeholder="Username or Email"
                    required
                  />
                  <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                    Send OTP
                  </button>
                </form>
              )}
              {forgotStep === 'otp' && (
                <div>
                  <form action={handleVerifyForgotOTP}>
                    <input className={styles.input} type="text" name="otp" placeholder="Enter OTP" required />
                    <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                      Verify OTP
                    </button>
                  </form>
                  <p style={{ marginTop: '10px' }}>
                    <a href="#" onClick={handleTryAnotherIdentifier} className={styles.link}>
                      Try using another identifier?
                    </a>
                  </p>
                </div>
              )}
              {forgotStep === 'reset' && (
                <div>
                  <form action={handleResetPassword}>
                    <input className={styles.input} type="password" name="password" placeholder="New Password (min 6 chars, 1 letter, 1 number, 1 capital, 1 special)" required />
                    <input className={styles.input} type="password" name="confirm_password" placeholder="Confirm New Password" required />
                    <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                      Reset Password
                    </button>
                  </form>
                  <p style={{ marginTop: '10px' }}>
                    <a href="#" onClick={handleTryAnotherIdentifier} className={styles.link}>
                      Try using another identifier?
                    </a>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div id="loginForm" className={styles.formWrapper}>
              <h2>Login</h2>
              <form action={handleSubmit}>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <input className={styles.input} type="text" name="identifier" placeholder="User ID or Email" required />
                <input className={styles.input} type="password" name="password" placeholder="Password" required />
                <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                  Login
                </button>
                <div className={styles.linkContainer}>
                  <a href="#" onClick={() => setIsForgotPassword(true)}>Forgot Password?</a>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}