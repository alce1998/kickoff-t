import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Game from "@/pages/Game";
import GameSelection from "@/pages/GameSelection";
import CarriereSetup from "@/pages/CarriereSetup";
import CarriereAllenamento from "@/pages/CarriereAllenamento";
import CarriereSfida from "@/pages/CarriereSfida";
import LinkGame from "@/pages/LinkGame";
import ProgressioneGame from "@/pages/ProgressioneGame";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import CookiePolicy from "@/pages/CookiePolicy";
import Profilo from "@/pages/Profilo";
import Amici from "@/pages/Amici";
import Sfide from "@/pages/Sfide";
import ChallengeGame from "@/pages/ChallengeGame";
import Matchmaking from "@/pages/Matchmaking";
import Leaderboard from "@/pages/Leaderboard";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CookieBanner } from "./components/CookieBanner";
import { UsernameOnboardingModal } from "./components/UsernameOnboardingModal";
import ConfermaUsername from "@/pages/ConfermaUsername";
import AaronsZurkowskiSetup from "@/pages/AaronsZurkowskiSetup";
import AaronsZurkowskiGame from "@/pages/AaronsZurkowskiGame";
import CartolinesAlbum from "@/pages/CartolinesAlbum";
import CartolinesGame from "@/pages/CartolinesGame";
import FootsterSetup from "@/pages/FootsterSetup";
import FootsterGame from "@/pages/FootsterGame";
import DreamTeamGame from "@/pages/DreamTeamGame";
import DreamTeamMultiplayer from "@/pages/DreamTeamMultiplayer";
import Trofei from "@/pages/Trofei";
import { useEffect, useState } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "./lib/trpc";

function Router() {
  const [location] = useLocation();
  
  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return (
    <Switch>
      <Route path={"/"} component={GameSelection} />
      <Route path={"/formazioni"} component={Game} />
      <Route path={"/carriere"} component={CarriereSetup} />
      <Route path={"/carriere/maratona"} component={CarriereAllenamento} />
      <Route path={"/carriere/sfida"} component={CarriereSfida} />
      <Route path={"/link"} component={LinkGame} />
      <Route path={"/progressione"} component={ProgressioneGame} />
      <Route path={"/progressione/gol-totali"} component={() => { if (typeof window !== 'undefined') window.location.replace('/progressione?mode=gol-totali'); return null; }} />
      <Route path={"/progressione/presenze-totali"} component={() => { if (typeof window !== 'undefined') window.location.replace('/progressione?mode=presenze-totali'); return null; }} />
      <Route path={"/privacy"} component={PrivacyPolicy} />
      <Route path={"/cookie-policy"} component={CookiePolicy} />
      <Route path={"/profilo"} component={Profilo} />
      <Route path={"/amici"} component={Amici} />
      <Route path={"/sfide"} component={Sfide} />
      <Route path={"/sfida/:id"} component={ChallengeGame} />
      <Route path={"/matchmaking"} component={Matchmaking} />
      <Route path={"/classifiche"} component={Leaderboard} />
      <Route path={"/conferma-username/:token"} component={ConfermaUsername} />
      <Route path={"/aarons-zurkowski"} component={AaronsZurkowskiSetup} />
      <Route path={"/aarons-zurkowski/gioco"} component={AaronsZurkowskiGame} />
      <Route path={"/cartoline"} component={CartolinesAlbum} />
      <Route path={"/cartoline/:id"} component={CartolinesGame} />
      <Route path={"/footster"} component={FootsterSetup} />
      <Route path={"/footster/game"} component={FootsterGame} />
      <Route path={"/dream-team"} component={DreamTeamGame} />
      <Route path={"/dream-team/multiplayer"} component={DreamTeamMultiplayer} />
      <Route path={"/trofei"} component={Trofei} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function InstagramButton() {
  return (
    <a
      href="https://www.instagram.com/kickoff_trivia/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Seguici su Instagram"
      className="fixed bottom-6 left-6 z-50 flex items-center justify-center w-12 h-12 rounded-full shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] border-2 border-black transition-transform hover:scale-110 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5"
      style={{
        background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="white"
        className="w-6 h-6"
      >
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    </a>
  );
}

function UsernameGuard() {
  const { user, isAuthenticated } = useAuth({});
  const utils = trpc.useUtils();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const recordDailyLogin = trpc.achievements.recordDailyLogin.useMutation();

  useEffect(() => {
    if (isAuthenticated && user && !user.username) {
      setShowOnboarding(true);
    }
    // Record daily login for Habitué achievement
    if (isAuthenticated && user) {
      recordDailyLogin.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const handleUsernameSet = async () => {
    await utils.auth.me.invalidate();
    setShowOnboarding(false);
  };

  return (
    <UsernameOnboardingModal
      isOpen={showOnboarding}
      onComplete={handleUsernameSet}
    />
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <CookieBanner />
          <InstagramButton />
          <UsernameGuard />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
