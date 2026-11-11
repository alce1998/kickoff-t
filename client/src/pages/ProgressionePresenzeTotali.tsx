import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Wrapper component that redirects to ProgressioneGame with presenze-totali mode preselected
 */
export default function ProgressionePresenzeTotali() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to main Progressione page with query parameter
    setLocation('/progressione?mode=presenze-totali&autostart=true');
  }, [setLocation]);

  return null;
}
