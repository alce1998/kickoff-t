import React, { useEffect, useRef } from "react";

const OBF_KEY = "KOT2026";

export function decodeObfuscatedUrl(input: string): string {
  if (!input || !input.startsWith("obf:")) return input;
  try {
    const b64 = input.slice(4);
    const bin = window.atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return input;
  }
}

interface ProtectedImageProps {
  src: string;
  objectPosition?: "top" | "center";
  canvasWidth?: number;
  canvasHeight?: number;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Renders an image onto a <canvas> element so that no <img> tag or Wikipedia URL
 * ever exists in the DOM (preventing right-click -> Inspect URL spoilers),
 * while loading directly in the user's browser for 100% image availability.
 */
export function ProtectedImage({
  src,
  objectPosition = "top",
  canvasWidth = 450,
  canvasHeight = 600,
  className = "",
  onLoad,
  onError,
}: ProtectedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const realUrl = decodeObfuscatedUrl(src);

    const img = new window.Image();
    img.referrerPolicy = "no-referrer";

    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const cw = canvas.width;
          const ch = canvas.height;
          const iw = img.naturalWidth || cw;
          const ih = img.naturalHeight || ch;

          const canvasRatio = cw / ch;
          const imgRatio = iw / ih;

          let sx = 0;
          let sy = 0;
          let sw = iw;
          let sh = ih;

          if (imgRatio > canvasRatio) {
            sw = ih * canvasRatio;
            sx = (iw - sw) / 2;
            sy = 0;
          } else {
            sh = iw / canvasRatio;
            sx = 0;
            sy = objectPosition === "top" ? 0 : (ih - sh) / 2;
          }

          ctx.clearRect(0, 0, cw, ch);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
        }
      }
      // Clear src from in-memory Image object immediately after drawing
      img.src = "";
      onLoad?.();
    };

    img.onerror = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#e5e7eb";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#6b7280";
          ctx.font = "bold 28px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", canvas.width / 2, canvas.height / 2);
        }
      }
      onLoad?.();
      onError?.();
    };

    img.src = realUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  }, [src, objectPosition]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className={`block select-none pointer-events-none ${className}`}
    />
  );
}
