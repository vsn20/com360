"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from './jobslogin.module.css';
import { job_loginaction } from '../../serverActions/job_loginaction';

export default function JobsLoginPage() {
    const [isSignup, setIsSignup] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [error, setError] = useState(null);
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

    // Note: The signup form uses a standard HTML action.
    // You would create an API route at '/api/jobs/signup' to handle the form data.

    return (
        <div className={styles.jobslogin_contentWrapper} suppressHydrationWarning>
            <div className={styles.jobslogin_mainContainer}>
                {/* Text Section for Toggling */}
                <div className={`${styles.jobslogin_textSection} ${isSignup ? styles.jobslogin_order2 : ''}`}>
                    <div className={styles.jobslogin_textContent}>
                        <h2>{isSignup ? 'Already a Member?' : 'New Here?'}</h2>
                        <p>{isSignup ? 'Log in to access your dashboard and applications.' : 'Sign up to discover job opportunities.'}</p>
                        <button className={styles.jobslogin_switchBtn} onClick={() => setIsSignup(!isSignup)}>
                            {isSignup ? 'Go to Login' : 'Go to Sign Up'}
                        </button>
                    </div>
                </div>

                {/* Auth Container for Forms */}
                <div className={`${styles.jobslogin_authContainer} ${isSignup ? styles.jobslogin_order1 : ''}`}>
                    {isSignup ? (
                        // Signup Form
                        <div id="signupForm" className={styles.jobslogin_formWrapper}>
                            <h2>Create Candidate Account</h2>
                            <form action="/api/jobs/signup" method="POST">
                                <input className={styles.jobslogin_input} type="text" name="first_name" placeholder="First Name" required />
                                <input className={styles.jobslogin_input} type="text" name="last_name" placeholder="Last Name" required />
                                <input className={styles.jobslogin_input} type="email" name="email" placeholder="Email" required />
                                <input className={styles.jobslogin_input} type="password" name="password" placeholder="Password" required />
                                <input className={styles.jobslogin_input} type="password" name="confirm_password" placeholder="Confirm Password" required />
                                <button className={`${styles.jobslogin_button} button`} type="submit">
                                    Sign Up
                                </button>
                            </form>
                        </div>
                    ) : (
                        // Login Form
                        <div id="loginForm" className={styles.jobslogin_formWrapper}>
                            <h2>Candidate Login</h2>
                            <form action={handleLoginSubmit}>
                                {error && <p style={{ color: 'red' }}>{error}</p>}
                                <input className={styles.jobslogin_input} type="email" name="identifier" placeholder="Email" required />
                                <input className={styles.jobslogin_input} type="password" name="password" placeholder="Password" required />
                                <button className={`${styles.jobslogin_button} button`} type="submit" disabled={isPending}>
                                    {isPending ? 'Logging in...' : 'Login'}
                                </button>
                                <div className={styles.jobslogin_linkContainer}>
                                    <a href="/forgot-password">Forgot Password?</a>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}