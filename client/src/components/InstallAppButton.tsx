import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Previeni il prompt automatico
      e.preventDefault();
      // Salva l'evento per usarlo dopo
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Controlla se l'app è già installata
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Mostra il prompt di installazione
    deferredPrompt.prompt();

    // Aspetta la scelta dell'utente
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Utente ha accettato l\'installazione');
    } else {
      console.log('Utente ha rifiutato l\'installazione');
    }

    // Resetta il prompt
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // Non mostrare il pulsante se non è installabile
  if (!isInstallable) {
    return null;
  }

  return (
    <div className="flex justify-center mt-6">
      <Button 
        onClick={handleInstallClick}
        size="lg"
        className="py-6 px-12 text-xl font-display font-bold uppercase bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all"
      >
        <Download className="mr-2 h-6 w-6" />
        📱 Scarica App
      </Button>
    </div>
  );
}
