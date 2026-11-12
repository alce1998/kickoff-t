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

// In-memory cache of loaded HTMLImageElement objects so clicking a thumbnail
// or switching tabs redraws onto <canvas> instantaneously without re-requesting.
const loadedImageCache = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 300;

function cacheImage(url: string, img: HTMLImageElement) {
  if (loadedImageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = loadedImageCache.keys().next().value;
    if (firstKey) loadedImageCache.delete(firstKey);
  }
  loadedImageCache.set(url, img);
}

// Concurrency queue to avoid Wikimedia 429 burst rate-limiting when loading grids
const MAX_CONCURRENT = 5;
let activeLoads = 0;
const queue: Array<() => void> = [];

function enqueueLoad(task: () => void): () => void {
  let removed = false;
  const wrapped = () => {
    if (removed) {
      nextInQueue();
      return;
    }
    task();
  };
  if (activeLoads < MAX_CONCURRENT) {
    activeLoads++;
    task();
  } else {
    queue.push(wrapped);
  }
  return () => {
    removed = true;
    const idx = queue.indexOf(wrapped);
    if (idx !== -1) queue.splice(idx, 1);
  };
}

function nextInQueue() {
  activeLoads = Math.max(0, activeLoads - 1);
  while (queue.length > 0 && activeLoads < MAX_CONCURRENT) {
    const next = queue.shift();
    if (next) {
      activeLoads++;
      next();
    }
  }
}

function drawCover(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  objectPosition: "top" | "center"
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
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
 * while using a concurrency queue + automatic retry + in-memory cache for 100% visibility.
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
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const realUrl = decodeObfuscatedUrl(src);

    // Fast path: already cached in memory
    const cached = loadedImageCache.get(realUrl);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      if (canvasRef.current) {
        drawCover(canvasRef.current, cached, objectPosition);
      }
      onLoad?.();
      return;
    }

    let currentImg: HTMLImageElement | null = null;

    const cancelQueue = enqueueLoad(() => {
      if (cancelled) {
        nextInQueue();
        return;
      }

      const attemptLoad = (attempt: number) => {
        if (cancelled) {
          nextInQueue();
          return;
        }

        const img = new window.Image();
        currentImg = img;

        img.onload = () => {
          nextInQueue();
          if (cancelled) return;
          cacheImage(realUrl, img);
          if (canvasRef.current) {
            drawCover(canvasRef.current, img, objectPosition);
          }
          onLoad?.();
        };

        img.onerror = () => {
          if (cancelled) {
            nextInQueue();
            return;
          }
          if (attempt < 3) {
            retryTimer = setTimeout(() => {
              attemptLoad(attempt + 1);
            }, 700 * (attempt + 1));
            return;
          }
          nextInQueue();
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
      };

      attemptLoad(0);
    });

    return () => {
      cancelled = true;
      cancelQueue();
      if (retryTimer) clearTimeout(retryTimer);
      if (currentImg) {
        currentImg.onload = null;
        currentImg.onerror = null;
      }
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
