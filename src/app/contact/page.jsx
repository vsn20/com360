'use client'
import React, { useEffect } from 'react';
import './contact.css';

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
    <div className="contactPageContainer">
      <div className="pageBackground">
        <div className="shape shape1"></div>
        <div className="shape shape2"></div>
        <div className="shape shape3"></div>
        <div className="shape shape4"></div>
        <div className="shape shape5"></div>
      </div>
      {/* Contact Section */}
      <section className="contactSection">
        <div className="container">
          <h1 className="contactHeroTitle">Contact Us</h1>
          <div className="contactContent">
            <p className="contactDescription">
              Please contact us at <a href="tel:4023150893" className="contactLink">402 315 0893</a> or email at <a href="mailto:info@cloudworksusa.com" className="contactLink">info@cloudworksusa.com</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Page;