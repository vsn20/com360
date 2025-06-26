"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from './jobslogin.module.css';
import { job_loginaction } from '../../serverActions/job_loginaction';

export default function JobsLoginPage() {
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => setIsClient(true), []);

  if (!isClient) return null;

  const handleSubmit = async (formData) => {
    setError(null);
    startTransition(async () => {
      try {
        const logindetails = { username: formData.get('identifier'), password: formData.get('password') };
        console.log('Form data sent to job_loginaction:', logindetails);
        const { success, cid, email, first_name, token, error: loginError } = await job_loginaction(logindetails);
        console.log('Job login response:', { success, cid, email, first_name });

        if (success) {
          console.log('Redirecting to /jobs');
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

  return (
    <div className={styles.contentWrapper} suppressHydrationWarning>
      <div className={styles.mainContainer}>
        <div className={styles.authContainer}>
          <div id="loginForm" className={styles.formWrapper}>
            <h2>Job Login</h2>
            <form action={handleSubmit}>
              {error && <p style={{ color: 'red' }}>{error}</p>}
              <input className={styles.input} type="email" name="identifier" placeholder="Email" required />
              <input className={styles.input} type="password" name="password" placeholder="Password" required />
              <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                {isPending ? 'Logging in...' : 'Login'}
              </button>
              <div className={styles.linkContainer}>
                <p><a href="/signup" className={styles.link}>Don't have an account? Sign up</a></p>
                <p><a href="/forgot-password" className={styles.link}>Forgot Password?</a></p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}