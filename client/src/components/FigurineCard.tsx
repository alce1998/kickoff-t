// FigurineCard.tsx – displays a player figurine with overlay when guessed
import React from "react";
import { ProtectedImage } from "@/components/ProtectedImage";

/**
 * Convert a country name or ISO code to a flag emoji.
 * If the input is a two‑letter ISO code it will be transformed to the
 * corresponding regional indicator symbols. For longer names we try to
 * derive the code by taking the first two alphabetic characters.
 */
function getFlagEmoji(country: string): string {
  const iso = country
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  if (iso.length < 2) return "";
  const offset = 0x1f1e6 - 65; // 'A' => regional indicator offset
  const chars = [...iso].map((c) => String.fromCodePoint(c.charCodeAt(0) + offset)).join("");
  return chars;
}

type FigurineCardProps = {
  src: string; // obfuscated image URL – will be decoded by ProtectedImage
  playerName: string;
  nationality: string; // e.g. "Italia" – will be turned into a flag emoji if possible
  role: string; // e.g. "Portiere"
  guessed: boolean;
};

export const FigurineCard: React.FC<FigurineCardProps> = ({
  src,
  playerName,
  nationality,
  role,
  guessed,
}) => {
  const flag = getFlagEmoji(nationality);

  return (
    <div className="relative w-48 h-64 select-none overflow-hidden rounded" title={playerName}>
      {/* Image drawn on a canvas to avoid right‑click inspection */}
      <ProtectedImage src={src} className="w-full h-full object-cover" />

      {/* Top‑left flag + role – always visible */}
      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded flex items-center gap-1">
        {flag && <span>{flag}</span>}
        <span>{role}</span>
      </div>

      {/* Bottom black band – only when the figurine has been guessed */}
      {guessed && (
        <div
          className="absolute bottom-0 left-0 w-full h-12 bg-black/80 flex items-center justify-center"
          style={{
            backgroundImage: "url('/static/vintage-paper-texture.png')",
            backgroundSize: "cover",
          }}
        >
          <span className="text-white text-sm font-bold drop-shadow">
            {playerName}
          </span>
        </div>
      )}
    </div>
  );
};
