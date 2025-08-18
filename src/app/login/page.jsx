'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from './logn.module.css';
import { loginaction } from '../serverActions/loginAction';

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
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
        console.log('Form data sent to loginaction:', logindetails);
        const { success, roleid, orgid, rolename, token } = await loginaction(logindetails);
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
          setError(result.error || 'Login failed. Please try again.');
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
        console.error('Login error:', err);
      }
    });
  };

  return (
    <div className={styles.contentWrapper} suppressHydrationWarning>
      <div className={styles.mainContainer}>
        <div className={`${styles.textSection} ${isSignup ? styles.order2 : ''}`}>
          <div className={styles.textContent}>
            <h2>{isSignup ? 'Welcome Back!' : 'New Here?'}</h2>
            <p>{isSignup ? 'Log in to access your dashboard.' : 'Sign up to get started.'}</p>
            <button className={styles.switchBtn} onClick={() => setIsSignup(!isSignup)}>
              {isSignup ? 'Go to Login' : 'Go to Sign Up'}
            </button>
          </div>
        </div>
        <div className={`${styles.authContainer} ${isSignup ? styles.order1 : ''}`}>
          {isSignup ? (
            <div id="signupForm" className={styles.formWrapper}>
              <h2>Sign Up</h2>
              <form action="/api/signup" method="POST">
                <input className={styles.input} type="text" name="user_id" placeholder="User ID" required />
                <input className={styles.input} type="email" name="email" placeholder="Email" required />
                <input className={styles.input} type="password" name="password" placeholder="Password" required />
                <input className={styles.input} type="password" name="confirm_password" placeholder="Confirm Password" required />
                <button className={`${styles.button} button`} type="submit" disabled={isPending}>
                  Sign Up
                </button>
              </form>
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