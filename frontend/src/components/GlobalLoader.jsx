import React, { useState, useEffect, useRef } from 'react';

// Safety-net: no legitimate request should ever take longer than this.
// Guards against the loader getting stuck forever if a start/end pair
// somehow desyncs (e.g. a request that never settles).
const MAX_LOADING_MS = 35000;

const GlobalLoader = () => {
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const clearSafetyTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handleStart = () => {
      setIsLoading(true);
      clearSafetyTimeout();
      timeoutRef.current = setTimeout(() => setIsLoading(false), MAX_LOADING_MS);
    };
    const handleEnd = () => {
      setIsLoading(false);
      clearSafetyTimeout();
    };

    window.addEventListener('api-request-start', handleStart);
    window.addEventListener('api-request-end', handleEnd);

    return () => {
      window.removeEventListener('api-request-start', handleStart);
      window.removeEventListener('api-request-end', handleEnd);
      clearSafetyTimeout();
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300">
      <div className="flex flex-col items-center p-6 bg-white/10 rounded-xl shadow-2xl backdrop-blur-md border border-white/20">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg"></div>
        <p className="mt-4 text-white font-medium tracking-wide text-lg drop-shadow-md">Please wait...</p>
      </div>
    </div>
  );
};

export default GlobalLoader;
