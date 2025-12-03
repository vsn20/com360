'use client'
import React, { useEffect, useRef, useState } from 'react';
import './pricing.css';
import Link from 'next/link';
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

const AnimatedTable = ({ children }) => {
  const [ref, isInView] = useInView({ threshold: 0.1 });
  return (
    <div ref={ref} className={`pricingTableContainer ${isInView ? 'animateIn' : ''}`}>
      {children}
    </div>
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

  return (
    <div className="pricingPageContainer">
      {/* Pricing Section */}
      <section className="pricingSection">
        <div className="container">
          <h1 className="pricingHeroTitle">Pricing Plans</h1>
          <p className="pricingHeroDescription">
            Choose the perfect plan for your team. All plans include unlimited projects and support.
          </p>
          <AnimatedTable>
            <table className="pricingTable">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Monthly Price</th>
                  <th>Per User (After 25)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="pricingRow">
                  <td className="planName">Starter</td>
                  <td className="planPrice">$49/mo</td>
                  <td className="planDetails">($1.99/month/user)</td>
                  <td><Link className="selectPlanButton" href="/FeePayment">Select Plan</Link></td>
                </tr>
                <tr className="pricingRow">
                  <td className="planName">Pro</td>
                  <td className="planPrice">$99/mo</td>
                  <td className="planDetails">($3.99/month/user)</td>
                  <td><Link className="selectPlanButton" href="/FeePayment">Select Plan</Link></td>
                </tr>
                <tr className="pricingRow">
                  <td className="planName">Growth</td>
                  <td className="planPrice">$199/mo</td>
                  <td className="planDetails">($7.99/month/user)</td>
                  <td><Link className="selectPlanButton" href="/FeePayment">Select Plan</Link></td>
                </tr>
                <tr className="pricingRow">
                  <td className="planName">Enterprise</td>
                  <td className="planPrice">$299+</td>
                  <td className="planDetails">($9.99/month/user)</td>
                 <td><Link className="selectPlanButton" href="/FeePayment">Select Plan</Link></td>
                </tr>
              </tbody>
            </table>
          </AnimatedTable>
        </div>
      </section>
    </div>
  );
};

export default Page;