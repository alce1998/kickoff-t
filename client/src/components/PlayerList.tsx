import { cn } from "@/lib/utils";
import { Player } from "@/lib/game-logic";
import { Eye, Flag, Hash } from "lucide-react";
import { useState, useEffect } from "react";
import { getNationalityISO } from '@/lib/countryMapping';
import * as FlagIcons from 'country-flag-icons/react/3x2';

/**
 * Estrae il cognome da un nome completo
 * Es: "Cristiano Ronaldo" -> "Ronaldo"
 * Es: "De Rossi" -> "De Rossi" (mantiene prefissi comuni)
 */
function extractSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  
  // Prefissi comuni nei cognomi italiani/europei
  const prefixes = ['de', 'di', 'da', 'del', 'della', 'van', 'von', 'dos', 'das', 'el', 'al'];
  
  // Se il penultimo elemento è un prefisso, includi anche quello
  if (parts.length >= 2) {
    const secondLast = parts[parts.length - 2].toLowerCase();
    if (prefixes.includes(secondLast)) {
      return parts.slice(-2).join(' ');
    }
  }
  
  // Altrimenti restituisci solo l'ultimo elemento (cognome)
  return parts[parts.length - 1];
}

interface PlayerListProps {
  formation: Player[];
  teamName: string;
  revealedPlayers: boolean[];
  align: 'left' | 'right';
  onRevealPlayer?: (index: number) => void;
  onUseHint?: (index: number, hintType: 'number' | 'nationality') => void;
  hintsUsed?: { number: boolean; nationality: boolean }[];
  canUseHint?: boolean;
}

// Mappa delle bandiere per nazionalità (inglese e italiano)
const nationalityFlags: Record<string, string> = {
  // A
  'Albania': '🇦🇱',
  'Algeria': '🇩🇿',
  'Angola': '🇦🇴',
  'Argentina': '🇦🇷',
  'Armenia': '🇦🇲',
  'Australia': '🇦🇺',
  'Austria': '🇦🇹',
  'Azerbaijan': '🇦🇿',
  // B
  'Belarus': '🇧🇾',
  'Belgium': '🇧🇪',
  'Belgio': '🇧🇪',
  'Benin': '🇧🇯',
  'Bermuda': '🇧🇲',
  'Bolivia': '🇧🇴',
  'Bosnia-Herzegovina': '🇧🇦',
  'Bosnia and Herzegovina': '🇧🇦',
  'Bosnia-Erzegovina': '🇧🇦',
  'Brazil': '🇧🇷',
  'Brasile': '🇧🇷',
  'Bulgaria': '🇧🇬',
  'Burkina Faso': '🇧🇫',
  // C
  'Cabo Verde': '🇨🇻',
  'Capo Verde': '🇨🇻',
  'Cameroon': '🇨🇲',
  'Camerun': '🇨🇲',
  'Canada': '🇨🇦',
  'Jugoslavia (SFR)': '🇷🇸',
  'URSS': '🇷🇺',
  'Repubblica': '🇨🇿',
  'Costa': '🇨🇮',
  'Stati': '🇺🇸',
  'Macedonia': '🇲🇰',
  'Cape Verde': '🇨🇻',
  'Central African Republic': '🇨🇫',
  'Repubblica Centrafricana': '🇨🇫',
  'Chile': '🇨🇱',
  'Cile': '🇨🇱',
  'China': '🇨🇳',
  'Cina': '🇨🇳',
  'Colombia': '🇨🇴',
  'Comoros': '🇰🇲',
  'Congo': '🇨🇬',
  'Costa Rica': '🇨🇷',
  'Costarica': '🇨🇷',
  "Costa d'Avorio": '🇨🇮',
  "Côte d'Ivoire": '🇨🇮',
  'Croatia': '🇭🇷',
  'Croazia': '🇭🇷',
  'Curacao': '🇨🇼',
  'Curaçao': '🇨🇼',
  'Cipro': '🇨🇾',
  'Cyprus': '🇨🇾',
  'Czech Republic': '🇨🇿',
  'Repubblica Ceca': '🇨🇿',
  'CSSR': '🇨🇿',
  'Czechia': '🇨🇿',
  // D
  'Denmark': '🇩🇰',
  'Danimarca': '🇩🇰',
  'DR Congo': '🇨🇩',
  'RD del Congo': '🇨🇩',
  // E
  'Ecuador': '🇪🇨',
  'Egypt': '🇪🇬',
  'Egitto': '🇪🇬',
  'England': '🇬🇧',
  'Inghilterra': '🇬🇧',
  'Equatorial Guinea': '🇬🇶',
  'Guinea Equatoriale': '🇬🇶',
  'Estonia': '🇪🇪',
  // F
  'Finland': '🇫🇮',
  'Finlandia': '🇫🇮',
  'France': '🇫🇷',
  'Francia': '🇫🇷',
  'French Guiana': '🇬🇫',
  // G
  'Gabon': '🇬🇦',
  'Gambia': '🇬🇲',
  'Georgia': '🇬🇪',
  'Germany': '🇩🇪',
  'Germania': '🇩🇪',
  'Ghana': '🇬🇭',
  'Greece': '🇬🇷',
  'Grecia': '🇬🇷',
  'Guadeloupe': '🇬🇵',
  'Guadalupa': '🇬🇵',
  'Guinea': '🇬🇳',
  'Guinea-Bissau': '🇬🇼',
  'Guyana': '🇬🇾',
  // H
  'Haiti': '🇭🇹',
  'Honduras': '🇭🇳',
  'Hungary': '🇭🇺',
  'Ungheria': '🇭🇺',
  // I
  'Iceland': '🇮🇸',
  'Islanda': '🇮🇸',
  'Iran': '🇮🇷',
  'Ireland': '🇮🇪',
  'Irlanda': '🇮🇪',
  'Israel': '🇮🇱',
  'Israele': '🇮🇱',
  'Italy': '🇮🇹',
  'Italia': '🇮🇹',
  'Ivory Coast': '🇨🇮',
  // J
  'Jamaica': '🇯🇲',
  'Japan': '🇯🇵',
  'Giappone': '🇯🇵',
  // K
  'Kazakhstan': '🇰🇿',
  'Kazakistan': '🇰🇿',
  'Kenia': '🇰🇪',
  'Kenya': '🇰🇪',
  'Kosovo': '🇽🇰',
  'Korea, South': '🇰🇷',
  'Corea del Sud': '🇰🇷',
  'South Korea': '🇰🇷',
  // L
  'Latvia': '🇱🇻',
  'Liberia': '🇱🇷',
  'Libya': '🇱🇾',
  'Libia': '🇱🇾',
  'Liechtenstein': '🇱🇮',
  'Lithuania': '🇱🇹',
  'Lituania': '🇱🇹',
  'Luxembourg': '🇱🇺',
  'Lussemburgo': '🇱🇺',
  // M
  'Macedonia del Nord': '🇲🇰',
  'Madagascar': '🇲🇬',
  'Mali': '🇲🇱',
  'Malta': '🇲🇹',
  'Martinique': '🇲🇶',
  'Mauritania': '🇲🇷',
  'Mauritius': '🇲🇺',
  'Mexico': '🇲🇽',
  'Messico': '🇲🇽',
  'Moldova': '🇲🇩',
  'Montenegro': '🇲🇪',
  'Morocco': '🇲🇦',
  'Marocco': '🇲🇦',
  'Mozambico': '🇲🇿',
  'Mozambique': '🇲🇿',
  // N
  'Netherlands': '🇳🇱',
  'Olanda': '🇳🇱',
  'Paesi Bassi': '🇳🇱',
  'New Caledonia': '🇳🇨',
  'New Zealand': '🇳🇿',
  'Nuova Zelanda': '🇳🇿',
  'Niger': '🇳🇪',
  'Nigeria': '🇳🇬',
  'North Macedonia': '🇲🇰',
  'Northern Ireland': '🇬🇧',
  'Norway': '🇳🇴',
  'Norvegia': '🇳🇴',
  // P
  'Panama': '🇵🇦',
  'Paraguay': '🇵🇾',
  'Peru': '🇵🇪',
  'Perù': '🇵🇪',
  'Poland': '🇵🇱',
  'Polonia': '🇵🇱',
  'Portugal': '🇵🇹',
  'Portogallo': '🇵🇹',
  // R
  'Republic of Ireland': '🇮🇪',
  'Repubblica Dominicana': '🇩🇴',
  'Romania': '🇷🇴',
  'Russia': '🇷🇺',
  'Réunion': '🇷🇪',
  // S
  'Saudi Arabia': '🇸🇦',
  'Scotland': '🇬🇧',
  'Scozia': '🇬🇧',
  'Senegal': '🇸🇳',
  'Serbia': '🇷🇸',
  'Sierra Leone': '🇸🇱',
  'Sierra': '🇸🇱',
  'Slovakia': '🇸🇰',
  'Slovacchia': '🇸🇰',
  'Slovenia': '🇸🇮',
  'South Africa': '🇿🇦',
  'Sud Africa': '🇿🇦',
  'Spain': '🇪🇸',
  'Spagna': '🇪🇸',
  'Sudan': '🇸🇩',
  'Siria': '🇸🇾',
  'Syria': '🇸🇾',
  'Suriname': '🇸🇷',
  'Sweden': '🇸🇪',
  'Svezia': '🇸🇪',
  'Switzerland': '🇨🇭',
  'Svizzera': '🇨🇭',
  // T
  'Togo': '🇹🇬',
  'Trinidad and Tobago': '🇹🇹',
  'Trinidad e Tobago': '🇹🇹',
  'Tunisia': '🇹🇳',
  'Turkey': '🇹🇷',
  'Turchia': '🇹🇷',
  'Türkiye': '🇹🇷',
  // U
  'Ukraine': '🇺🇦',
  'Ucraina': '🇺🇦',
  'United States': '🇺🇸',
  'Stati Uniti': '🇺🇸',
  'Uruguay': '🇺🇾',
  'Uzbekistan': '🇺🇿',
  'Uganda': '🇺🇬',
  // V
  'Venezuela': '🇻🇪',
  // W
  'Wales': '🇬🇧',
  'Galles': '🇬🇧',
  // Z
  'Zambia': '🇿🇲',
  'Zimbabwe': '🇿🇼',
};

function FlagIcon({ nationality }: { nationality: string | undefined }) {
  if (!nationality) return <span className="text-base">🏳️</span>;
  
  const isoCode = getNationalityISO(nationality);
  if (!isoCode) return <span className="text-base">{nationalityFlags[nationality] || '🏳️'}</span>;
  
  // @ts-ignore - Dynamic import
  const FlagComponent = FlagIcons[isoCode];
  if (!FlagComponent) return <span className="text-base">{nationalityFlags[nationality] || '🏳️'}</span>;
  
  return <FlagComponent className="w-6 h-4" title={nationality} />;
}

export function PlayerList({ 
  formation, 
  teamName, 
  revealedPlayers, 
  align, 
  onRevealPlayer,
  onUseHint,
  hintsUsed = [],
  canUseHint = true
}: PlayerListProps) {
  const [localHints, setLocalHints] = useState<{ number: boolean; nationality: boolean }[]>(
    formation.map(() => ({ number: false, nationality: false }))
  );

  // Reset hints when formation changes (new match)
  useEffect(() => {
    setLocalHints(formation.map(() => ({ number: false, nationality: false })));
  }, [formation]);

  const handleHint = (index: number, hintType: 'number' | 'nationality') => {
    const newHints = [...localHints];
    newHints[index] = { ...newHints[index], [hintType]: true };
    setLocalHints(newHints);
    onUseHint?.(index, hintType);
  };

  return (
    <div className="w-[155px] md:w-full bg-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 md:p-4">
      <h3 className={cn(
        "text-lg md:text-xl font-display font-bold uppercase mb-2 border-b-2 border-black pb-1",
        align === 'right' ? "text-right" : "text-left"
      )}>
        {teamName}
      </h3>
      
      <ul className="space-y-1">
        {formation.map((player, index) => {
          const isRevealed = revealedPlayers[index];
          const hints = hintsUsed[index] || localHints[index] || { number: false, nationality: false };
          const hasNumber = player.number !== undefined && player.number !== null;
          const hasNationality = player.nationality !== undefined && player.nationality !== null;
          
          return (
            <li 
              key={index} 
              className={cn(
                "flex items-center gap-1 p-1 border border-black/10 transition-all",
                isRevealed ? "bg-green-50 border-green-200" : "bg-gray-50",
                align === 'right' ? "flex-row-reverse text-right" : "flex-row text-left"
              )}
            >
              {/* Role Badge */}
              <span className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold font-mono border border-black shrink-0",
                isRevealed ? "bg-black text-white" : "bg-gray-200 text-gray-500"
              )}>
                {player.role || 'CM'}
              </span>
              
              {/* Player Name or Placeholder */}
              <span className={cn(
                "font-display text-sm md:text-base uppercase tracking-wide grow truncate",
                isRevealed ? "text-black font-bold" : "text-gray-300"
              )}>
                {isRevealed ? (
                  <>
                    {/* Mobile: solo cognome */}
                    <span className="md:hidden">{extractSurname(player.name)}</span>
                    {/* Desktop: nome completo */}
                    <span className="hidden md:inline">{player.name}</span>
                  </>
                ) : "???????????"}
              </span>
              
              {/* Hint Badges - Show when hint is used and player not revealed */}
              {!isRevealed && (
                <div className={cn(
                  "flex gap-1 shrink-0",
                  align === 'right' ? "flex-row-reverse" : "flex-row"
                )}>
                  {/* Number Hint Badge */}
                  {hints.number && hasNumber && (
                    <span className="flex items-center justify-center w-6 h-6 rounded bg-blue-100 border border-blue-300 text-blue-700 text-xs font-bold">
                      {player.number}
                    </span>
                  )}
                  
                  {/* Nationality Hint Badge */}
                  {hints.nationality && hasNationality && (
                    <span className="flex items-center justify-center w-8 h-6 rounded bg-yellow-100 border border-yellow-300" title={player.nationality}>
                      <FlagIcon nationality={player.nationality} />
                    </span>
                  )}
                </div>
              )}
              
              {/* Hint Buttons - only show if not revealed and hints not used */}
              {!isRevealed && (
                <div className={cn(
                  "flex gap-1 shrink-0",
                  align === 'right' ? "flex-row-reverse" : "flex-row"
                )}>
                  {/* Number Hint Button */}
                  {hasNumber && !hints.number && (
                    <button
                      onClick={() => canUseHint && handleHint(index, 'number')}
                      disabled={!canUseHint}
                      className={cn(
                        "flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded border transition-all shrink-0",
                        canUseHint 
                          ? "border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 text-blue-400 hover:text-blue-600 cursor-pointer"
                          : "border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed"
                      )}
                      title={canUseHint ? "Mostra numero maglia" : "Indizi esauriti"}
                    >
                      <Hash className="w-3 h-3" />
                    </button>
                  )}
                  
                  {/* Nationality Hint Button */}
                  {hasNationality && !hints.nationality && (
                    <button
                      onClick={() => canUseHint && handleHint(index, 'nationality')}
                      disabled={!canUseHint}
                      className={cn(
                        "flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded border transition-all shrink-0",
                        canUseHint
                          ? "border-yellow-300 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-400 text-yellow-500 hover:text-yellow-600 cursor-pointer"
                          : "border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed"
                      )}
                      title={canUseHint ? "Mostra nazionalità" : "Indizi esauriti"}
                    >
                      <Flag className="w-3 h-3" />
                    </button>
                  )}
                  
                  {/* Reveal Button */}
                  {onRevealPlayer && (
                    <button
                      onClick={() => canUseHint && onRevealPlayer(index)}
                      disabled={!canUseHint}
                      className={cn(
                        "flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded border transition-all shrink-0",
                        canUseHint
                          ? "border-gray-300 bg-white hover:bg-red-100 hover:border-red-400 text-gray-400 hover:text-red-600 cursor-pointer"
                          : "border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed"
                      )}
                      title={canUseHint ? "Mostra soluzione (0 punti)" : "Indizi esauriti"}
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
