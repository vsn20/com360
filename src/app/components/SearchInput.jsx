'use client';
import { useState } from 'react';
import { MdArrowForward } from 'react-icons/md';
import { useRouter, usePathname } from 'next/navigation';
import styles from './SearchInput.module.css';

function SearchInput({ onSearch }) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  const handleSubmit = async () => {
    if (query.trim()) {
      const organizationsRoute = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/userscreens/organizations`;
      
      // Store query in sessionStorage
      sessionStorage.setItem('aiQuery', query);
      
      // If not on organizations page, navigate there
      if (!pathname.includes('/userscreens/organizations')) {
        router.push(organizationsRoute);
      } else {
        // Already on organizations page, trigger the event
        const event = new CustomEvent('aiQuerySubmitted', { detail: query });
        window.dispatchEvent(event);
      }
      
      // Call onSearch callback if provided
      if (onSearch) {
        onSearch(query);
      }
      
      // Clear input
      setQuery('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
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
        placeholder="Ask anything"
        className={styles.searchInput}
      />
      {query.trim() && (
        <button type="button" onClick={handleSubmit} className={styles.searchButton}>
          <MdArrowForward />
        </button>
      )}
    </div>
  );
}

export default SearchInput;