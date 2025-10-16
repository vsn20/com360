'use client';
import React, { useEffect, useRef, useState } from 'react';
import './features.css';

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

    const currentRef = ref.current;

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options]);

  return [ref, isInView];
};

const AnimatedSection = ({ children, className }) => {
  const [ref, isInView] = useInView({ threshold: 0.1 });
  return (
    <section ref={ref} className={`${className} ${isInView ? 'animateIn' : 'animateOnScroll'}`}>
      {children}
    </section>
  );
};

const Page = () => {
  useEffect(() => {
    document.body.style.fontFamily = "'Inter', 'Helvetica Neue', Arial, sans-serif";
    document.body.style.lineHeight = '1.6';
    document.body.style.color = '#333';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflowX = 'hidden';
  }, []);

  const features = [
    {
      title: 'Talent Acquisition & Recruiting',
      desc: 'Job posting, candidate tracking, interviews, offer letters, and seamless onboarding.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0112 20.5a12.083 12.083 0 01-6.16-9.922L12 14z" />
        </svg>
      ),
      color: '#4f46e5'
    },
    {
      title: 'Immigration & Compliance',
      desc: 'Manage LCA, H1B, GC, EAD, OPT, PAF, FDNS cases with automated alerts and secure documentation.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: '#10b981'
    },
    {
      title: 'Customer & Project Management',
      desc: 'Manage clients, projects, tasks, and leads with pipeline visibility and milestone tracking.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v4a4 4 0 004 4h4m0 0v4a4 4 0 004 4h4m-12-8h4m4 0h4" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a4 4 0 004 4h4" />
        </svg>
      ),
      color: '#f59e0b'
    },
    {
      title: 'Financial & Billing Operations',
      desc: 'Timesheets, expenses, invoices, and integrations with QuickBooks, ADP, and payroll systems.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: '#ef4444'
    },
    {
      title: 'Service Requests & Support',
      desc: 'Track, assign, and resolve tickets with SLA monitoring and reporting.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      color: '#8b5cf6'
    },
    {
      title: 'E-Verify & DOL Compliance',
      desc: 'Automated E-Verify integration and Department of Labor compliance tracking for all employees.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: '#14b8a6'
    },
    {
      title: 'API Integrations & Automation',
      desc: 'Connect with QuickBooks, ADP, payroll, and ERP systems to automate workflows and data sync.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: '#6366f1'
    },
    {
      title: 'Reporting & Analytics',
      desc: 'Real-time dashboards, KPI tracking, compliance reports, and customizable data analysis.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: '#f59e0b'
    },
    {
      title: 'Security & Governance',
      desc: 'Role-based access, audit trails, and encrypted storage for sensitive HR and financial data.',
      icon: (
        <svg className="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      color: '#ef4444'
    }
  ];

  return (
    <div className="featuresPageContainer">
      <AnimatedSection className="featuresHeroSection">
        <div className="container">
          <h1 className="heroTitle">COM360View Product Features</h1>
          <p className="heroDescription">
            Discover how COM360View empowers your team with comprehensive tools for talent, compliance, projects, and more—all in one seamless platform.
          </p>
        </div>
      </AnimatedSection>

      <AnimatedSection className="featuresSection">
        <div className="container">
          <div className="featuresGrid">
            {features.map((feature, index) => (
              <div
                key={index}
                className="featureCard"
                style={{ transitionDelay: `${index * 0.1}s` }}
              >
                <div className="featureIconContainer" style={{ color: feature.color }}>
                  {feature.icon}
                </div>
                <h3 className="featureTitle">{feature.title}</h3>
                <p className="featureDesc">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
};

export default Page;