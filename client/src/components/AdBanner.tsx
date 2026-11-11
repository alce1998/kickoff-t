import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  slot?: string;
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function AdBanner({ slot, format = 'auto', className = '' }: AdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAdLoaded = useRef(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Usa IntersectionObserver per rilevare quando il banner è visibile
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Carica l'annuncio solo quando è visibile e ha dimensioni valide
    if (!isVisible || isAdLoaded.current) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Verifica che il contenitore abbia dimensioni valide
    const { offsetWidth, offsetHeight } = container;
    if (offsetWidth === 0 || offsetHeight === 0) {
      return;
    }

    // Piccolo ritardo per assicurarsi che il layout sia stabile
    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && !isAdLoaded.current) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          isAdLoaded.current = true;
        }
      } catch (error) {
        console.error('AdSense error:', error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible]);

  return (
    <div ref={containerRef} className={`ad-container ${className}`}>
      {isVisible && (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '100%' }}
          data-ad-client="ca-pub-8642698222238324"
          data-ad-slot={slot || ''}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}

// Componente placeholder per sviluppo (mostra un box grigio)
export function AdBannerPlaceholder({ className = '', label = 'Pubblicità' }: { className?: string; label?: string }) {
  return (
    <div className={`bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 text-sm font-mono ${className}`}>
      {label}
    </div>
  );
}
