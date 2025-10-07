'use client'
import React, { useEffect } from 'react';
import './aboutus.css';

const Page = () => {
  useEffect(() => {
    document.body.style.fontFamily = "'Inter', 'Helvetica Neue', Arial, sans-serif";
    document.body.style.lineHeight = '1.6';
    document.body.style.color = '#333';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflowX = 'hidden';
  }, []);

  return (
    <div className="aboutPageContainer">
      {/* Hero Section */}
      <section className="aboutHeroSection">
        <div className="aboutHeroBackground">
          <div className="shape shape1"></div>
          <div className="shape shape2"></div>
          <div className="shape shape3"></div>
        </div>
        <div className="aboutHeroContent">
          <div className="container">
            <h1 className="aboutHeroTitle">About Us</h1>
            <p className="aboutHeroDescription">
              CloudWorks Inc is one of America's best cloud-based IT Services and consulting companies. CloudWorks team is experienced in delivering the best cloud-based solutions for various kinds of industries and win their highest satisfaction. We provide the highest level of solutions with a vision of 5-10 years sustainability with any upgrade or changes once we deliver the solution.
            </p>
          </div>
        </div>
      </section>

      {/* Com360View Section */}
      <section className="aboutPlatformSection">
        <div className="container">
          <h2 className="sectionTitle">Com360View: Our All-in-One Platform</h2>
          <p className="platformDescription">
            Com360View is the all-in-one platform that empowers consultancies and startups to manage their entire operation from onboarding to payroll effortlessly.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Page;