import { User, LogIn, LogOut, Bell, Users, Trophy } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";

export function AuthButton() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { isModern } = useTheme();
  
  // Query per contare sfide pendenti
  const { data: pendingChallenges } = trpc.challenges.getPendingChallenges.useQuery(
    undefined, 
    { enabled: isAuthenticated }
  );
  
  const pendingCount = pendingChallenges?.length || 0;

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled className="flex items-center gap-2">
        <User className="w-4 h-4" />
        <span className="font-medium">Caricamento...</span>
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={() => {
          window.location.href = getLoginUrl();
        }}
        className={`flex items-center gap-2 ${
          isModern
            ? 'bg-green-500 hover:bg-green-600 text-gray-950 rounded-lg'
            : 'bg-pink-600 hover:bg-pink-700 text-white'
        }`}
      >
        <LogIn className="w-4 h-4" />
        <span className="font-medium">Accedi con Google</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-2 relative ${
            isModern
              ? 'border-green-500 text-green-400 hover:bg-green-500/10 rounded-lg'
              : 'border-pink-600 text-pink-600 hover:bg-pink-50'
          }`}
        >
          <User className="w-4 h-4" />
          <span className="font-medium">{user?.name || "Utente"}</span>
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Sfide pendenti */}
        {pendingCount > 0 && (
          <>
            <DropdownMenuItem
              onClick={() => setLocation("/sfide")}
              className={`cursor-pointer ${
                isModern ? 'bg-red-950/50 hover:bg-red-900/50' : 'bg-red-50 hover:bg-red-100'
              }`}
            >
              <Bell className="mr-2 h-4 w-4 text-red-600" />
              <span className="font-bold text-red-600">
                {pendingCount} {pendingCount === 1 ? 'Sfida' : 'Sfide'} in attesa
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem
          onClick={() => setLocation("/profilo")}
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          <span>Profilo</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocation("/amici")}
          className="cursor-pointer"
        >
          <Users className="mr-2 h-4 w-4" />
          <span>I Miei Amici</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocation("/sfide")}
          className="cursor-pointer"
        >
          <Trophy className="mr-2 h-4 w-4" />
          <span>Le Mie Sfide</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Esci</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
