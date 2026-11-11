import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Wrapper component that redirects to ProgressioneGame with gol-totali mode preselected
 */
export default function ProgressioneGolTotali() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to main Progressione page with query parameter
    setLocation('/progressione?mode=gol-totali&autostart=true');
  }, [setLocation]);

  return null;
}
