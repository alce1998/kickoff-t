import { cn } from "@/lib/utils";
import { Player } from "@/lib/game-logic";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SoccerFieldProps {
  formation: Player[];
  module: string;
  teamName: string;
  onPlayerClick: (index: number) => void;
  revealedPlayers: boolean[]; // Array di booleani per tracciare quali giocatori sono stati indovinati
  currentPlayerIndex: number | null;
}

export function SoccerField({ formation, module, teamName, onPlayerClick, revealedPlayers, currentPlayerIndex }: SoccerFieldProps) {
  
  // Mappa posizioni CSS basata sul modulo (semplificata per ora)
  // In futuro si può rendere più precisa per ogni modulo
  const getPositionStyle = (index: number, totalPlayers: number, role: string) => {
    // Logica posizionale di base per un campo verticale
    // Portiere sempre in basso (o in alto a seconda della vista, qui facciamo dal basso verso l'alto)
    
    if (role === 'GK') return { bottom: '5%', left: '50%', transform: 'translateX(-50%)' };
    
    // Semplificazione: distribuisce i giocatori in righe in base al loro indice nell'array
    // L'array formation deve essere ordinato: GK, Difensori, Centrocampisti, Attaccanti
    
    // Esempio per 4-4-2 (GK + 4 + 4 + 2)
    // GK: index 0
    // DEF: index 1-4
    // MID: index 5-8
    // FWD: index 9-10
    
    // Logica generica "a righe"
    let bottom = '20%';
    let left = '50%';
    
    if (index >= 1 && index <= 4) { // Difesa
      bottom = '25%';
      left = `${20 + (index - 1) * 20}%`;
    } else if (index >= 5 && index <= 8) { // Centrocampo
      bottom = '55%';
      left = `${20 + (index - 5) * 20}%`;
    } else if (index >= 9) { // Attacco
      bottom = '85%';
      left = `${35 + (index - 9) * 30}%`;
    }
    
    // Override specifici per moduli diversi se necessario
    if (module === '3-5-2' || module === '3-4-1-2') {
       if (index >= 1 && index <= 3) { // 3 Difensori
          bottom = '25%';
          left = `${30 + (index - 1) * 20}%`;
       }
       // ... altri aggiustamenti
    }

    return { bottom, left, transform: 'translateX(-50%)' };
  };

  return (
    <div className="relative w-full aspect-[2/3] bg-green-800 border-4 border-white/20 rounded-lg overflow-hidden shadow-inner">
      {/* Field Markings */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[10%] border-b-2 border-x-2 border-white"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[10%] border-t-2 border-x-2 border-white"></div>
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white -translate-y-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-1/4 aspect-square border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded font-display text-sm uppercase tracking-widest border border-white/20">
        {teamName} ({module})
      </div>

      {formation.map((player, index) => {
        const isRevealed = revealedPlayers[index];
        const isCurrent = currentPlayerIndex === index;
        const style = getPositionStyle(index, formation.length, player.role);

        return (
          <button
            key={index}
            className={cn(
              "absolute w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2 shadow-lg",
              isRevealed 
                ? "bg-white text-black border-black" 
                : isCurrent 
                  ? "bg-yellow-400 text-black border-white animate-pulse scale-110" 
                  : "bg-black/60 text-white/50 border-white/30 hover:bg-black/80"
            )}
            style={style}
            onClick={() => {}}
            disabled={true}
          >
            {isRevealed ? (
              <div className="flex flex-col items-center leading-none w-full">
                <span className="text-[8px] opacity-70 font-mono">{player.role}</span>
                <span className="font-display text-[9px] leading-tight truncate w-full text-center px-1" title={player.name}>
                  {player.name}
                </span>
              </div>
            ) : (
              <span className="text-xs font-mono opacity-50">{player.role}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
