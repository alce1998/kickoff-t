import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = 'cookie-consent';

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Sempre attivi
    analytics: false, // NON pre-flaggati
    marketing: false, // NON pre-flaggati
  });

  useEffect(() => {
    // Verifica se l'utente ha già dato il consenso
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
    setShowBanner(false);
    setShowPreferences(false);
    
    // Qui puoi integrare Google Analytics, AdSense, ecc. in base alle preferenze
    if (prefs.analytics) {
      // Inizializza Google Analytics
      console.log('Analytics enabled');
    }
    if (prefs.marketing) {
      // Inizializza cookie marketing/AdSense
      console.log('Marketing cookies enabled');
    }
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    savePreferences(allAccepted);
  };

  const handleRejectAll = () => {
    const onlyNecessary: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    savePreferences(onlyNecessary);
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Banner Cookie */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-50 p-6"
        style={{
          fontFamily: 'monospace',
        }}
      >
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Testo informativo */}
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">🍪 Questo sito utilizza i cookie</h3>
              <p className="text-sm text-gray-700">
                Utilizziamo cookie tecnici necessari per il funzionamento del sito e, previo tuo consenso, 
                cookie di statistica e marketing per migliorare la tua esperienza e mostrarti contenuti personalizzati.
                {' '}<a href="/privacy" className="underline text-blue-600 hover:text-blue-800">Privacy Policy</a>
                {' | '}
                <a href="/cookie-policy" className="underline text-blue-600 hover:text-blue-800">Cookie Policy</a>
              </p>
            </div>

            {/* Bottoni azione */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Bottone X / Rifiuta */}
              <button
                onClick={handleRejectAll}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Rifiuta cookie non necessari"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Gestisci preferenze */}
              <Button
                onClick={() => setShowPreferences(true)}
                variant="outline"
                className="border-2 border-black font-bold"
              >
                Gestisci preferenze
              </Button>

              {/* Accetta tutti */}
              <Button
                onClick={handleAcceptAll}
                className="bg-black text-white hover:bg-gray-800 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Accetta tutti
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modale Gestione Preferenze */}
      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="max-w-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-display uppercase">
              Gestisci Preferenze Cookie
            </DialogTitle>
            <DialogDescription>
              Scegli quali cookie attivare. I cookie tecnici sono sempre necessari per il funzionamento del sito.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Cookie Necessari (sempre attivi) */}
            <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border-2 border-black">
              <Checkbox 
                id="necessary" 
                checked={true} 
                disabled 
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="necessary" className="font-bold text-base cursor-default">
                  Cookie Tecnici (Necessari)
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Essenziali per il funzionamento del sito. Non possono essere disattivati.
                  Includono: autenticazione, preferenze, sicurezza.
                </p>
              </div>
            </div>

            {/* Cookie Statistiche/Analytics (NON pre-flaggati) */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-300">
              <Checkbox 
                id="analytics" 
                checked={preferences.analytics}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, analytics: checked as boolean }))
                }
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="analytics" className="font-bold text-base cursor-pointer">
                  Cookie Statistiche
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Ci aiutano a capire come i visitatori interagiscono con il sito raccogliendo 
                  informazioni in forma anonima (es. Google Analytics).
                </p>
              </div>
            </div>

            {/* Cookie Marketing (NON pre-flaggati) */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-300">
              <Checkbox 
                id="marketing" 
                checked={preferences.marketing}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, marketing: checked as boolean }))
                }
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="marketing" className="font-bold text-base cursor-pointer">
                  Cookie Marketing
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Utilizzati per mostrarti pubblicità pertinenti ai tuoi interessi 
                  (es. Google AdSense, Facebook Pixel).
                </p>
              </div>
            </div>
          </div>

          {/* Bottoni azione modale */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-gray-200">
            <Button
              onClick={handleRejectAll}
              variant="outline"
              className="border-2 border-black font-bold"
            >
              Rifiuta tutto
            </Button>
            <Button
              onClick={handleSavePreferences}
              className="bg-black text-white hover:bg-gray-800 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              Salva preferenze
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
