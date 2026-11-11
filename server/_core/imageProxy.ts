import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { IMAGE_MAP } from "./imageMap";

export function registerImageProxyRoutes(app: Express) {
  app.get("/api/img", async (req: Request, res: Response) => {
    try {
      const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
      if (!id) {
        res.status(400).send("Missing id");
        return;
      }

      const targetUrl = IMAGE_MAP[id];
      if (!targetUrl) {
        res.status(404).send("Not found");
        return;
      }

      // Set aggressive caching & anti-leak headers
      res.setHeader(
        "Cache-Control",
        "public, max-age=31536000, s-maxage=31536000, immutable"
      );
      res.setHeader("Content-Disposition", 'inline; filename="card.jpg"');
      res.setHeader("X-Content-Type-Options", "nosniff");

      // Handle local static paths (e.g. /stadi/xxx.jpg)
      if (targetUrl.startsWith("/")) {
        const localCandidates = [
          path.join(process.cwd(), "client", "public", targetUrl),
          path.join(process.cwd(), "dist", "public", targetUrl),
          path.join(process.cwd(), "public", targetUrl),
        ];
        for (const candidate of localCandidates) {
          if (fs.existsSync(candidate)) {
            const ext = path.extname(candidate).toLowerCase();
            const mime =
              ext === ".png"
                ? "image/png"
                : ext === ".webp"
                  ? "image/webp"
                  : "image/jpeg";
            res.setHeader("Content-Type", mime);
            res.send(fs.readFileSync(candidate));
            return;
          }
        }

        // Fallback on Vercel Serverless: fetch from origin static CDN
        const proto =
          (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
        const host = req.get("host") || "www.kickoff-trivia.com";
        const originUrl = `${proto}://${host}${targetUrl}`;
        const upstream = await fetch(originUrl);
        if (!upstream.ok) {
          res.status(upstream.status).end();
          return;
        }
        const contentType =
          upstream.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.send(buf);
        return;
      }

      // Remote URL (Wikimedia Commons, etc.)
      const upstream = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "KickOffTrivia/1.0 (https://www.kickoff-trivia.com; info@kickoff-trivia.com) Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });

      if (!upstream.ok) {
        res.status(upstream.status).end();
        return;
      }

      const contentType = upstream.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (error) {
      console.error("[ImageProxy] Error serving image:", error);
      res.status(500).end();
    }
  });
}
