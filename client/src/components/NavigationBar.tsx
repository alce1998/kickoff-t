import { Home, MessageSquare, Bell, ChevronDown, Trophy, Zap, Newspaper } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import { AuthButton } from "./AuthButton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { useTheme } from "@/contexts/ThemeContext";

interface NavigationBarProps {
  onFeedbackClick: () => void;
}

export function NavigationBar({ onFeedbackClick }: NavigationBarProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  
  // Query per sfide in attesa (dove è il turno dell'utente)
  const { data: pendingChallenges } = trpc.challenges.getMyChallenges.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  // Query per richieste amicizia pending
  const { data: friendRequests } = trpc.friends.getPendingRequests.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  // Calcola numero totale notifiche
  const pendingChallengesCount = pendingChallenges?.filter(
    c => c.status === 'active' && c.currentTurn === user?.openId
  ).length || 0;
  
  const friendRequestsCount = friendRequests?.length || 0;
  const totalNotifications = pendingChallengesCount + friendRequestsCount;

  const [hovered, setHovered] = useState(false);
  const { theme, toggleTheme, isModern } = useTheme();

  // Chiudi dropdown lingua cliccando fuori
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) 
    || SUPPORTED_LANGUAGES.find(l => l.code === i18n.language?.split('-')[0])
    || SUPPORTED_LANGUAGES[0];

  const handleLangChange = (code: string) => {
    i18n.changeLanguage(code);
    setLangOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${
        isModern
          ? hovered
            ? "bg-gray-950/95 backdrop-blur-sm border-gray-800 shadow-lg shadow-black/50"
            : "bg-transparent border-transparent shadow-none"
          : hovered
            ? "bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm"
            : "bg-transparent border-transparent shadow-none"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        {/* Pulsante Torna alla Home - Alto Sinistra */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className={`flex items-center gap-2 ${
            isModern
              ? 'text-gray-300 hover:text-green-400 hover:bg-green-500/10'
              : 'text-gray-700 hover:text-pink-600 hover:bg-pink-50'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="font-medium hidden sm:inline">{t('nav.home')}</span>
          <span className="font-medium sm:hidden">Home</span>
        </Button>

        {/* Pulsante Trofei - accanto a Home */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/trofei")}
          className={`flex items-center gap-2 ${
            isModern
              ? 'text-gray-300 hover:text-yellow-400 hover:bg-yellow-500/10'
              : 'text-gray-700 hover:text-yellow-600 hover:bg-yellow-50'
          }`}
          title="Trofei"
        >
          <Trophy className="w-4 h-4" />
          <span className="font-medium hidden sm:inline">{t('nav.trofei', 'Trofei')}</span>
        </Button>

        {/* Pulsanti a destra */}
        <div className="flex items-center gap-2">
          {/* Selettore Lingua */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className={`flex items-center gap-1 w-10 h-10 rounded-full border-2 transition-all duration-200 justify-center text-lg shadow-sm hover:shadow-md ${
                isModern
                  ? 'border-gray-700 hover:border-green-500 bg-gray-900/80 hover:bg-gray-800'
                  : 'border-gray-300 hover:border-pink-500 bg-white/80 hover:bg-white'
              }`}
              title={currentLang.name}
              aria-label="Seleziona lingua"
            >
              <span>{currentLang.flag}</span>
            </button>

            {/* Dropdown lingue */}
            {langOpen && (
              <div className={`absolute right-0 top-12 z-50 min-w-[160px] py-1 ${
                isModern
                  ? 'bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/50'
                  : 'bg-white border-2 border-black shadow-[4px_4px_0px_black] rounded-none'
              }`}>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleLangChange(lang.code)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-bold transition-colors text-left ${
                      isModern
                        ? lang.code === currentLang.code
                          ? 'bg-green-500/20 text-green-400'
                          : 'text-gray-300 hover:bg-gray-800'
                        : lang.code === currentLang.code
                          ? 'bg-pink-50 text-pink-700 hover:bg-pink-100'
                          : 'text-gray-800 hover:bg-pink-100'
                    }`}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span>{lang.name}</span>
                    {lang.code === currentLang.code && (
                      <span className={`ml-auto ${isModern ? 'text-green-400' : 'text-pink-600'}`}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pulsante Feedback */}
          <Button
            variant="outline"
            size="sm"
            onClick={onFeedbackClick}
            className={`flex items-center gap-2 ${
              isModern
                ? 'border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-green-400'
                : 'border-pink-600 text-pink-600 hover:bg-pink-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium hidden sm:inline">{t('nav.feedback')}</span>
            <span className="font-medium sm:hidden">Feedback</span>
          </Button>
          
          {/* Badge Notifiche */}
          {user && totalNotifications > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/sfide')}
              className={`relative flex items-center gap-2 ${
                isModern
                  ? 'text-gray-300 hover:text-green-400 hover:bg-green-500/10'
                  : 'text-gray-700 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                {totalNotifications}
              </span>
            </Button>
          )}

          {/* Toggle Tema */}
          <button
            onClick={toggleTheme}
            title={isModern ? "Passa al tema Retrò" : "Passa al tema Moderno"}
            aria-label="Cambia tema"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
              isModern
                ? "border-green-500 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:shadow-lg hover:shadow-green-500/20"
                : "border-gray-300 bg-white/80 text-gray-600 hover:border-pink-500 hover:text-pink-600 hover:bg-pink-50"
            }`}
          >
            {isModern ? <Newspaper className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          </button>

          {/* Pulsante Autenticazione */}
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
