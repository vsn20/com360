"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from './jobslogin.module.css';
import { job_loginaction } from '../../serverActions/job_loginaction';
import { signupaction } from '../../serverActions/Outside_Jobs/job_signupaction';
import { forgotpasswordaction } from '../../serverActions/Outside_Jobs/job_forgotpasswordaction';

export default function JobsLoginPage() {
    const [isSignup, setIsSignup] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [error, setError] = useState(null);
    const [signupError, setSignupError] = useState(null);
    const [signupSuccess, setSignupSuccess] = useState(null);
    const [forgotError, setForgotError] = useState(null);
    const [forgotSuccess, setForgotSuccess] = useState(null);
    const [signupStep, setSignupStep] = useState('email'); // 'email', 'otp', 'details'
    const [signupEmail, setSignupEmail] = useState('');
    const [forgotStep, setForgotStep] = useState('identifier'); // 'identifier', 'otp', 'reset'
    const [forgotEmail, setForgotEmail] = useState('');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    useEffect(() => setIsClient(true), []);

    if (!isClient) return null;

    const handleLoginSubmit = async (formData) => {
        setError(null);
        startTransition(async () => {
            try {
                const logindetails = { username: formData.get('identifier'), password: formData.get('password') };
                const { success, error: loginError } = await job_loginaction(logindetails);

                if (success) {
                    // ✅ Added router.refresh() to update the UI (logo/header) with the new cookie
                    router.refresh(); 
                    router.push('/jobs');
                } else {
                    setError(loginError || 'Login failed. Please try again.');
                }
            } catch (err) {
                setError('An unexpected error occurred. Please try again.');
                console.error('Job login error:', err);
            }
        });
    };

    const handleSendOTP = async (formData) => {
        setSignupError(null);
        startTransition(async () => {
            formData.append('step', 'email');
            const { success, error, email } = await signupaction(formData);
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
            formData.append('step', 'otp');
            formData.append('email', signupEmail);
            const { success, error } = await signupaction(formData);
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
            formData.append('step', 'details');
            formData.append('email', signupEmail);
            const { success, error } = await signupaction(formData);
            if (success) {
                setSignupSuccess('Signup successful! Please log in.');
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
            formData.append('step', 'identifier');
            const { success, error, email } = await forgotpasswordaction(formData);
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
            formData.append('step', 'otp');
            formData.append('email', forgotEmail);
            const { success, error } = await forgotpasswordaction(formData);
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
            formData.append('step', 'reset');
            formData.append('email', forgotEmail);
            const { success, error } = await forgotpasswordaction(formData);
            if (success) {
                setForgotSuccess('Password reset successful! Please log in.');
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

    const isAuthMode = isSignup || isForgotPassword;

    return (
        <div className={styles.jobslogin_contentWrapper} suppressHydrationWarning>
            <div className={styles.jobslogin_mainContainer}>
                {/* Text Section for Toggling */}
                <div className={`${styles.jobslogin_textSection} ${isAuthMode ? styles.jobslogin_order2 : ''}`}>
                    <div className={styles.jobslogin_textContent}>
                        <h2>
                            {isSignup ? 'Already a Member?' : isForgotPassword ? 'Reset Your Password' : 'New Here?'}
                        </h2>
                        <p>
                            {isSignup
                                ? 'Log in to access your dashboard and applications.'
                                : isForgotPassword
                                ? 'Reset your password to regain access.'
                                : 'Sign up to discover job opportunities.'}
                        </p>
                        <button
                            className={styles.jobslogin_switchBtn}
                            onClick={() => {
                                if (isSignup) {
                                    setIsSignup(false);
                                } else if (isForgotPassword) {
                                    handleBackToLogin();
                                } else {
                                    setIsSignup(true);
                                }
                            }}
                        >
                            {isAuthMode ? 'Go to Login' : 'Go to Sign Up'}
                        </button>
                    </div>
                </div>

                {/* Auth Container for Forms */}
                <div className={`${styles.jobslogin_authContainer} ${isAuthMode ? styles.jobslogin_order1 : ''}`}>
                    {isSignup ? (
                        // Signup Form
                        <div id="signupForm" className={styles.jobslogin_formWrapper}>
                            <h2>Create Candidate Account</h2>
                            {signupError && <p style={{ color: 'red' }}>{signupError}</p>}
                            {signupSuccess && <p style={{ color: 'green' }}>{signupSuccess}</p>}
                            {signupStep === 'email' && (
                                <form action={handleSendOTP}>
                                    <input
                                        className={styles.jobslogin_input}
                                        type="email"
                                        name="email"
                                        placeholder="Email"
                                        required
                                    />
                                    <button
                                        className={`${styles.jobslogin_button} button`}
                                        type="submit"
                                        disabled={isPending}
                                    >
                                        {isPending ? 'Sending...' : 'Send OTP'}
                                    </button>
                                </form>
                            )}
                            {signupStep === 'otp' && (
                                <div>
                                    <form action={handleVerifyOTP}>
                                        <input
                                            className={styles.jobslogin_input}
                                            type="text"
                                            name="otp"
                                            placeholder="Enter OTP"
                                            required
                                        />
                                        <button
                                            className={`${styles.jobslogin_button} button`}
                                            type="submit"
                                            disabled={isPending}
                                        >
                                            {isPending ? 'Verifying...' : 'Verify OTP'}
                                        </button>
                                    </form>
                                    <p style={{ marginTop: '10px' }}>
                                        <a
                                            href="#"
                                            onClick={handleTryAnotherEmail}
                                            className={styles.jobslogin_link}
                                        >
                                            Try using another email?
                                        </a>
                                    </p>
                                </div>
                            )}
                            {signupStep === 'details' && (
                                <div>
                                    <form action={handleFinalSignup}>
                                        <input
                                            className={styles.jobslogin_input}
                                            type="text"
                                            name="first_name"
                                            placeholder="First Name"
                                            required
                                        />
                                        <input
                                            className={styles.jobslogin_input}
                                            type="text"
                                            name="last_name"
                                            placeholder="Last Name"
                                            required
                                        />
                                        <input
                                            className={styles.jobslogin_input}
                                            type="password"
                                            name="password"
                                            placeholder="Password (min 6 chars, 1 letter, 1 number, 1 capital, 1 special)"
                                            required
                                        />
                                        <input
                                            className={styles.jobslogin_input}
                                            type="password"
                                            name="confirm_password"
                                            placeholder="Confirm Password"
                                            required
                                        />
                                        <button
                                            className={`${styles.jobslogin_button} button`}
                                            type="submit"
                                            disabled={isPending}
                                        >
                                            {isPending ? 'Completing...' : 'Complete Signup'}
                                        </button>
                                    </form>
                                    <p style={{ marginTop: '10px' }}>
                                        <a
                                            href="#"
                                            onClick={handleTryAnotherEmail}
                                            className={styles.jobslogin_link}
                                        >
                                            Try using another email?
                                        </a>
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : isForgotPassword ? (
                        // Forgot Password Form
                        <div id="forgotForm" className={styles.jobslogin_formWrapper}>
                            <h2>Forgot Password</h2>
                            {forgotError && <p style={{ color: 'red' }}>{forgotError}</p>}
                            {forgotSuccess && <p style={{ color: 'green' }}>{forgotSuccess}</p>}
                            {forgotStep === 'identifier' && (
                                <form action={handleSendForgotOTP}>
                                    <input
                                        className={styles.jobslogin_input}
                                        type="email"
                                        name="email"
                                        placeholder="Email"
                                        required
                                    />
                                    <button
                                        className={`${styles.jobslogin_button} button`}
                                        type="submit"
                                        disabled={isPending}
                                    >
                                        {isPending ? 'Sending...' : 'Send OTP'}
                                    </button>
                                </form>
                            )}
                            {forgotStep === 'otp' && (
                                <div>
                                    <form action={handleVerifyForgotOTP}>
                                        <input
                                            className={styles.jobslogin_input}
                                            type="text"
                                            name="otp"
                                            placeholder="Enter OTP"
                                            required
                                        />
                                        <button
                                            className={`${styles.jobslogin_button} button`}
                                            type="submit"
                                            disabled={isPending}
                                        >
                                            {isPending ? 'Verifying...' : 'Verify OTP'}
                                        </button>
                                    </form>
                                    <p style={{ marginTop: '10px' }}>
                                        <a
                                            href="#"
                                            onClick={handleTryAnotherIdentifier}
                                            className={styles.jobslogin_link}
                                        >
                                            Try using another email?
                                        </a>
                                    </p>
                                </div>
                            )}
                            {forgotStep === 'reset' && (
                                <div>
                                    <form action={handleResetPassword}>
                                        <input
                                            className={styles.jobslogin_input}
                                            type="password"
                                            name="password"
                                            placeholder="New Password (min 6 chars, 1 letter, 1 number, 1 capital, 1 special)"
                                            required
                                        />
                                        <input
                                            className={styles.jobslogin_input}
                                            type="password"
                                            name="confirm_password"
                                            placeholder="Confirm New Password"
                                            required
                                        />
                                        <button
                                            className={`${styles.jobslogin_button} button`}
                                            type="submit"
                                            disabled={isPending}
                                        >
                                            {isPending ? 'Resetting...' : 'Reset Password'}
                                        </button>
                                    </form>
                                    <p style={{ marginTop: '10px' }}>
                                        <a
                                            href="#"
                                            onClick={handleTryAnotherIdentifier}
                                            className={styles.jobslogin_link}
                                        >
                                            Try using another email?
                                        </a>
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Login Form
                        <div id="loginForm" className={styles.jobslogin_formWrapper}>
                            <h2>Candidate Login</h2>
                            <form action={handleLoginSubmit}>
                                {error && <p style={{ color: 'red' }}>{error}</p>}
                                <input
                                    className={styles.jobslogin_input}
                                    type="email"
                                    name="identifier"
                                    placeholder="Email"
                                    required
                                />
                                <input
                                    className={styles.jobslogin_input}
                                    type="password"
                                    name="password"
                                    placeholder="Password"
                                    required
                                />
                                <button
                                    className={`${styles.jobslogin_button} button`}
                                    type="submit"
                                    disabled={isPending}
                                >
                                    {isPending ? 'Logging in...' : 'Login'}
                                </button>
                                <div className={styles.jobslogin_linkContainer}>
                                    <a
                                        href="#"
                                        onClick={() => setIsForgotPassword(true)}
                                        className={styles.jobslogin_link}
                                    >
                                        Forgot Password?
                                    </a>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}