'use client';
import React, { useEffect, useState, useRef } from 'react';
import styles from './page.module.css';

// A modern, performant hook for detecting when an element is in the viewport
const useInView = (options) => {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, options);

    const currentRef = ref.current; // Capture ref value

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options]); // Remove 'ref' from dependencies

  return [ref, isInView];
};

const Counter = ({ value, text, duration = 2000, startCounting }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (startCounting) {
      let start = 0;
      const end = parseInt(value, 10);
      if (start === end) return;

      const incrementTime = 16;
      const totalIncrements = duration / incrementTime;
      const increment = end / totalIncrements;

      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.ceil(start));
        }
      }, incrementTime);

      return () => clearInterval(timer);
    }
  }, [startCounting, value, duration]);

  return (
    <div className={styles.counter}>
      <h3>{count.toLocaleString()}+</h3>
      <p>{text}</p>
    </div>
  );
};

// A reusable component for animated sections
const AnimatedSection = ({ children, className }) => {
  const [ref, isInView] = useInView({ threshold: 0.1 });
  return (
    <section ref={ref} className={`${className} ${styles.animateOnScroll} ${isInView ? styles.animateIn : ''}`}>
      {children}
    </section>
  );
};


const Home = () => {
  const [showcaseRef, showcaseInView] = useInView({ threshold: 0.2 });

  useEffect(() => {
    document.body.style.fontFamily = "'Inter', 'Helvetica Neue', Arial, sans-serif";
    document.body.style.lineHeight = '1.6';
    document.body.style.color = '#333';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflowX = 'hidden';
  }, []);
  
  return (
    <div className={styles.homepageContainer}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroBackground}>
          <div className={`${styles.shape} ${styles.shape1}`}></div>
          <div className={`${styles.shape} ${styles.shape2}`}></div>
          <div className={`${styles.shape} ${styles.shape3}`}></div>
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1>Streamline Your Workflow, Unleash Your Team&apos;s Potential.</h1>
            <p>
              Com360View is the all-in-one platform that empowers consultancies and startups to manage their entire operation—from onboarding to payroll—effortlessly.
            </p>
            <div className={styles.heroButtons}>
              <a href="/signup" className={styles.btnPrimary}>Start Your Free Trial</a>
              <a href="/demo" className={styles.btnSecondary}>Watch a Demo</a>
            </div>
          </div>
          <div className={styles.heroImage}>
             <div className={styles.dashboardPreview}>
               <div className={styles.dashboardHeader}></div>
               <div className={styles.dashboardContent}>
                 <div className={styles.dashboardCard}></div>
                 <div className={styles.dashboardCard}></div>
                 <div className={styles.dashboardChart}></div>
               </div>
             </div>
           </div>
        </div>
      </section>

      {/* Features Section */}
      <AnimatedSection className={styles.featuresSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Everything You Need, All in One Place</h2>
          <div className={styles.featuresGrid}>
            {[
              { title: 'People Management', desc: 'Define custom roles, manage employee records, and configure role-based access to screens and actions.', icon: '👥' },
              { title: 'Recruitment Lifecycle', desc: 'Post jobs, schedule interviews, and send digital offer letters for a seamless onboarding experience.', icon: '💼' },
              { title: 'Project Tracking', desc: 'Assign projects, monitor progress with detailed timesheets, and gain real-time productivity insights.', icon: '📊' },
              { title: 'Automated Leave & Attendance', desc: 'Track leaves, holidays, and attendance with customized policies and automated report generation.', icon: '📅' },
              { title: 'Effortless Payroll', desc: 'Automatically calculate salaries, deductions, and bonuses. Generate pay slips in just a few clicks.', icon: '💸' },
              { title: 'Integrated Service Desk', desc: 'Allow employees to raise IT, HR, or Admin requests. Track, prioritize, and resolve issues with custom workflows.', icon: '🛠️' },
            ].map((feature, index) => (
              <div key={index} className={styles.featureCard} style={{ transitionDelay: `${index * 0.1}s` }}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Showcase Section */}
      <section ref={showcaseRef} className={`${styles.showcaseSection} ${styles.animateOnScroll} ${showcaseInView ? styles.animateIn : ''}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Trusted by Growing Businesses</h2>
          <div className={styles.showcaseContent}>
            <div className={styles.showcaseImage}>
              <div className={styles.showcaseDashboard}>
                <div className={styles.dashboardGrid}>
                  <div className={styles.dashboardItem}></div>
                  <div className={styles.dashboardItem}></div>
                  <div className={styles.dashboardItem}></div>
                  <div className={styles.dashboardItem}></div>
                </div>
              </div>
            </div>
            <div className={styles.counters}>
              <Counter value={500} text="Happy Employees" startCounting={showcaseInView} />
              <Counter value={300} text="Projects Delivered" startCounting={showcaseInView} />
              <Counter value={10000} text="Tasks Managed" startCounting={showcaseInView} />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <AnimatedSection className={styles.benefitsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Why Choose Com360View?</h2>
          <div className={styles.benefitsGrid}>
            {[
              { title: 'Unified Platform', desc: 'Eliminate app-switching with a single source of truth for all your operations.', icon: '🤝' },
              { title: 'Data-Driven Accuracy', desc: 'Reduce human error with automated payroll, leave tracking, and financial reporting.', icon: '✅' },
              { title: 'Rapid Setup', desc: 'Get your team onboarded and running in minutes, not weeks, with our intuitive interface.', icon: '🚀' },
              { title: 'Dedicated Support', desc: 'Our expert support team is always available to help you succeed.', icon: '🧑‍💼' },
            ].map((benefit, index) => (
              <div key={index} className={styles.benefitCard} style={{ transitionDelay: `${index * 0.1}s` }}>
                <div className={styles.benefitIcon}>{benefit.icon}</div>
                <h3>{benefit.title}</h3>
                <p>{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Testimonials Section */}
      <AnimatedSection className={styles.testimonialsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What Our Users Say</h2>
          <div className={styles.testimonialsGrid}>
            {[
              { quote: 'Com360View has transformed how we manage employees and projects. It&apos;s intuitive, powerful, and has saved us countless hours.', author: 'Alex Carter, Founder at Innovate Co.' },
              { quote: 'Payroll and leave management are now completely automated. What used to take days now takes minutes. A total game-changer for our HR team.', author: 'Maria Garcia, HR Manager' },
              { quote: 'The role-based access and customization features make this tool perfect for our complex operational needs. Highly recommended!', author: 'David Chen, Operations Lead' },
            ].map((testimonial, index) => (
              <div key={index} className={styles.testimonialCard} style={{ transitionDelay: `${index * 0.1}s` }}>
                <div className={styles.testimonialQuote}><p>&ldquo;{testimonial.quote}&rdquo;</p></div>
                <div className={styles.testimonialAuthor}><h4>— {testimonial.author}</h4></div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Call-to-Action Section */}
      <AnimatedSection className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2>Ready to Transform How You Work?</h2>
            <p>Join hundreds of successful companies. Start your 14-day free trial today.</p>
            <div className={styles.ctaButtons}>
              <a href="/signup" className={styles.btnPrimary}>Sign Up for Free</a>
              <a href="/demo" className={styles.btnSecondary}>Request a Demo</a>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Footer Section */}
      <footer className={styles.footerSection}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <div className={styles.footerLinks}>
              <a href="/about">About</a>
              <a href="/careers">Careers</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/help">Help Center</a>
            </div>
            <div className={styles.footerSocial}>
              <a href="https://linkedin.com" className={styles.socialIcon}>LinkedIn</a>
              <a href="https://twitter.com" className={styles.socialIcon}>Twitter</a>
              <a href="https://facebook.com" className={styles.socialIcon}>Facebook</a>
            </div>
            <div className={styles.footerDetails}>
              <p>Com360View © 2025. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;