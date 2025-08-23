'use client';
import React, { useEffect, useState } from 'react';
import styles from './page.module.css';

const Home = () => {
  const [countersVisible, setCountersVisible] = useState(false);

  useEffect(() => {
    // Add global styles
    document.body.style.fontFamily = "'Inter', 'Helvetica Neue', Arial, sans-serif";
    document.body.style.lineHeight = '1.6';
    document.body.style.color = '#333';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflowX = 'hidden';
    
    const handleScroll = () => {
      // Counter animation trigger
      const showcaseSection = document.querySelector(`.${styles.showcaseSection}`);
      if (showcaseSection) {
        const rect = showcaseSection.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.8 && !countersVisible) {
          setCountersVisible(true);
        }
      }

      // Animate sections on scroll
      const sections = document.querySelectorAll(`.${styles.animateOnScroll}`);
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.8) {
          section.classList.add(styles.animateIn);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [countersVisible]);

  const Counter = ({ value, text, duration = 2000 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
      if (countersVisible) {
        let start = 0;
        const increment = value / (duration / 16);
        const timer = setInterval(() => {
          start += increment;
          if (start >= value) {
            setCount(value);
            clearInterval(timer);
          } else {
            setCount(Math.floor(start));
          }
        }, 16);
        return () => clearInterval(timer);
      }
    }, [countersVisible, value, duration]);

    return (
      <div className={styles.counter}>
        <h3>{count}+</h3>
        <p>{text}</p>
      </div>
    );
  };

  return (
    <div className={styles.homepageContainer}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroBackground}>
          <div className={styles.floatingShapes}>
            <div className={`${styles.shape} ${styles.shape1}`}></div>
            <div className={`${styles.shape} ${styles.shape2}`}></div>
            <div className={`${styles.shape} ${styles.shape3}`}></div>
          </div>
        </div>
        <div className={`${styles.heroContent} ${styles.animateOnScroll}`}>
          <div className={styles.heroText}>
            <h1>Manage Your People, Projects, and Processes – All in One Place.</h1>
            <p>
              Com360View helps consultancies, startups, and companies manage employees, post jobs,
              assign interviews, send offer letters, track leaves, timesheets, projects, payroll, and much more.
            </p>
            <div className={styles.heroButtons}>
              <a href="/signup" className={styles.btnPrimary}>Get Started</a>
              <a href="/demo" className={styles.btnSecondary}>Watch Demo</a>
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
      <section className={`${styles.featuresSection} ${styles.animateOnScroll}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Powerful Features</h2>
          <div className={styles.featuresGrid}>
            {[
              {
                title: 'Employee & Role Management',
                desc: 'Add, manage, and track employee records. Define custom roles, configure leave types, and set role-based access to screens and actions.',
                icon: '👥',
              },
              {
                title: 'Jobs & Recruitment',
                desc: 'Post jobs, assign interviews, and send offer letters digitally for seamless onboarding.',
                icon: '💼',
              },
              {
                title: 'Projects & Timesheets',
                desc: 'Assign projects, track progress, and monitor timesheets for real-time productivity insights.',
                icon: '📊',
              },
              {
                title: 'Leave & Attendance Management',
                desc: 'Track leaves, holidays, and attendance. Customize policies and generate leave reports automatically.',
                icon: '📅',
              },
              {
                title: 'Payroll & Finance',
                desc: 'Calculate salaries, deductions, and bonuses automatically. Generate pay slips and integrate payroll with timesheets and leaves.',
                icon: '💸',
              },
              {
                title: 'Service Requests & Support',
                desc: 'Employees can raise service requests (IT, HR, Admin). Track, prioritize, and resolve requests with customizable workflows.',
                icon: '🛠️',
              },
              {
                title: 'Configuration & Customization',
                desc: 'Tailor the platform to your needs. Create custom modules, forms, workflows, and role-based rules.',
                icon: '⚙️',
              },
            ].map((feature, index) => (
              <div key={index} className={styles.featureCard} style={{ animationDelay: `${index * 0.1}s` }}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className={`${styles.showcaseSection} ${styles.animateOnScroll}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our Impact</h2>
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
              <Counter value={500} text="Employees Managed" />
              <Counter value={300} text="Projects Delivered" />
              <Counter value={1000} text="Payrolls Processed" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className={`${styles.benefitsSection} ${styles.animateOnScroll}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Why Choose Com360View</h2>
          <div className={styles.benefitsGrid}>
            {[
              { title: 'Collaboration', desc: 'Enhance teamwork with centralized communication and task assignment.', icon: '🤝' },
              { title: 'Accuracy', desc: 'Reduce errors with automated payroll, leaves, and reporting.', icon: '✅' },
              { title: 'Easy Setup', desc: 'Get started quickly with simple onboarding and configuration.', icon: '🚀' },
              { title: '24/7 Support', desc: 'Our support team is always available to help.', icon: '🧑‍💼' },
            ].map((benefit, index) => (
              <div key={index} className={styles.benefitCard} style={{ animationDelay: `${index * 0.1}s` }}>
                <div className={styles.benefitIcon}>{benefit.icon}</div>
                <h3>{benefit.title}</h3>
                <p>{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className={`${styles.testimonialsSection} ${styles.animateOnScroll}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What Our Users Say</h2>
          <div className={styles.testimonialsGrid}>
            {[
              {
                quote: 'Com360View has transformed how we manage employees and projects.',
                author: 'Startup Founder',
              },
              {
                quote: 'Payroll and leave management are now completely automated.',
                author: 'HR Manager',
              },
              {
                quote: 'The role-based access and customization make this tool perfect for us.',
                author: 'Operations Lead',
              },
            ].map((testimonial, index) => (
              <div key={index} className={styles.testimonialCard} style={{ animationDelay: `${index * 0.1}s` }}>
                <div className={styles.testimonialQuote}>
                  <p>&ldquo;{testimonial.quote}&rdquo;</p>
                </div>
                <div className={styles.testimonialAuthor}>
                  <h4>— {testimonial.author}</h4>
                </div>
              </div>
              
            ))}
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className={`${styles.ctaSection} ${styles.animateOnScroll}`}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2>Ready to Transform How You Work?</h2>
            <p>Start using Com360View today and streamline your business operations.</p>
            <div className={styles.ctaButtons}>
              <a href="/signup" className={styles.btnPrimary}>Start Free Trial</a>
              <a href="/demo" className={styles.btnSecondary}>Request Demo</a>
            </div>
          </div>
        </div>
      </section>

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