'use client';
import { useState } from 'react';
import { MdArrowForward } from 'react-icons/md';
import { useRouter, usePathname } from 'next/navigation';
import { gptPageRouter } from '@/app/serverActions/gptPageRouter';
import styles from './SearchInput.module.css';

function SearchInput({ onSearch }) {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleSubmit = async () => {
    if (query.trim()) {
      setIsProcessing(true);
      
      try {
        // Get routing decision from GPT
        const routingDecision = await gptPageRouter(query);
        
        const targetRoute = `${process.env.NEXT_PUBLIC_BASE_URL || ''}${routingDecision.route}`;
        
        // Store query in sessionStorage for the target page to consume
        sessionStorage.setItem('aiQuery', query);
        sessionStorage.setItem('aiRoutingInfo', JSON.stringify(routingDecision));
        
        // Check if we need to navigate
        if (!pathname.includes(routingDecision.route)) {
          // Navigate to the determined page
          router.push(targetRoute);
        } else {
          // Already on the correct page, trigger the event
          const event = new CustomEvent('aiQuerySubmitted', { detail: query });
          window.dispatchEvent(event);
        }
        
        // Call onSearch callback if provided
        if (onSearch) {
          onSearch(query);
        }
        
      } catch (error) {
        console.error('Error processing AI query:', error);
        // Fallback to contactus on error
        router.push(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/userscreens/contactus`);
      } finally {
        setIsProcessing(false);
        // Clear input
        setQuery('');
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isProcessing) {
      handleSubmit();
    }
  };

  return (
    <div className={styles.searchContainer}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={isProcessing ? "Processing..." : "Ask anything"}
        className={styles.searchInput}
        disabled={isProcessing}
      />
      {query.trim() && !isProcessing && (
        <button type="button" onClick={handleSubmit} className={styles.searchButton}>
          <MdArrowForward />
        </button>
      )}
      {isProcessing && (
        <div className={styles.searchButton} style={{ opacity: 0.6 }}>
          <div className={styles.spinner}></div>
        </div>
      )}
    </div>
  );
}

export default SearchInput;