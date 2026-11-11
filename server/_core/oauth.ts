import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import axios from "axios";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getBaseUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host");
  return `${proto}://${host}`;
}

function renderLoginPage(errorMsg?: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accedi — KickOff Italia</title>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fce4ec;
      font-family: 'Space Mono', monospace;
      padding: 16px;
      color: #111;
    }
    .card {
      background: #fff;
      border: 4px solid #000;
      box-shadow: 8px 8px 0px 0px #000;
      max-width: 440px;
      width: 100%;
      padding: 32px 24px;
    }
    h1 {
      font-family: 'Oswald', sans-serif;
      font-size: 2rem;
      text-transform: uppercase;
      text-align: center;
      margin: 0 0 8px 0;
      color: #d81b60;
    }
    p.sub {
      text-align: center;
      font-size: 0.85rem;
      color: #555;
      margin: 0 0 24px 0;
      font-weight: 700;
    }
    .error {
      background: #ffebee;
      border: 2px solid #c62828;
      color: #c62828;
      padding: 10px 12px;
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 3px solid #000;
      font-family: 'Space Mono', monospace;
      font-size: 0.95rem;
      margin-bottom: 18px;
      outline: none;
    }
    input:focus {
      border-color: #d81b60;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #d81b60;
      color: #fff;
      border: 3px solid #000;
      box-shadow: 4px 4px 0px 0px #000;
      font-family: 'Oswald', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
      transition: transform 0.1s;
    }
    button:hover {
      background: #ad1457;
    }
    button:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0px 0px #000;
    }
    .back {
      display: block;
      text-align: center;
      margin-top: 18px;
      font-size: 0.8rem;
      color: #333;
      text-decoration: none;
      font-weight: 700;
    }
    .back:hover {
      color: #d81b60;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>KickOff Italia</h1>
    <p class="sub">Accedi o crea il tuo profilo giocatore</p>
    ${errorMsg ? `<div class="error">${errorMsg}</div>` : ""}
    <form method="POST" action="/api/auth/login">
      <label for="name">Nome / Nickname</label>
      <input id="name" name="name" type="text" required maxlength="30" placeholder="Es. Roberto Baggio" />

      <label for="email">La tua Email</label>
      <input id="email" name="email" type="email" required maxlength="120" placeholder="nome@esempio.it" />

      <button type="submit">⚽ Entra in Campo</button>
    </form>
    <a class="back" href="/">← Torna alla Home</a>
  </div>
</body>
</html>`;
}

export function registerOAuthRoutes(app: Express) {
  // Entry point for login: uses Google OAuth 2.0 if configured, otherwise renders instant login page
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId || req.query.mode === "email") {
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(renderLoginPage());
      return;
    }
    const redirectUri = `${getBaseUrl(req)}/api/oauth/callback`;
    const state = Buffer.from(redirectUri).toString("base64");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    res.redirect(302, url.toString());
  });

  // Direct Email + Name login/registration endpoint backed by TiDB Cloud MySQL
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const rawEmail = String(req.body?.email || "").trim().toLowerCase();
      const rawName = String(req.body?.name || "").trim();

      if (!rawEmail || !rawEmail.includes("@") || !rawName) {
        res
          .status(400)
          .setHeader("Content-Type", "text/html; charset=utf-8")
          .send(renderLoginPage("Inserisci un nome e un indirizzo email validi."));
        return;
      }

      const existingByEmail = await db.getUserByEmail(rawEmail);
      const emailHash = crypto.createHash("sha256").update(rawEmail).digest("hex").slice(0, 24);
      const openId = existingByEmail?.openId || `user_${emailHash}`;
      const displayName = rawName || existingByEmail?.name || "Giocatore";

      await db.upsertUser({
        openId,
        name: displayName,
        email: rawEmail,
        loginMethod: existingByEmail?.loginMethod || "email",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Auth] Direct login failed:", error);
      res
        .status(500)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(renderLoginPage("Errore durante l'accesso. Riprova tra qualche istante."));
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      // 1. Standalone Google OAuth 2.0 flow if GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET are configured
      if (ENV.googleClientId && ENV.googleClientSecret && !ENV.oAuthServerUrl) {
        const redirectUri = state
          ? Buffer.from(state, "base64").toString("utf-8")
          : `${getBaseUrl(req)}/api/oauth/callback`;

        const tokenRes = await axios.post(
          "https://oauth2.googleapis.com/token",
          new URLSearchParams({
            code,
            client_id: ENV.googleClientId,
            client_secret: ENV.googleClientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const accessToken = tokenRes.data.access_token;
        const profileRes = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const googleUser = profileRes.data as { id: string; email?: string; name?: string };
        const existingByEmail = googleUser.email ? await db.getUserByEmail(googleUser.email) : undefined;
        const openId = existingByEmail?.openId || `google_${googleUser.id}`;

        await db.upsertUser({
          openId,
          name: googleUser.name || existingByEmail?.name || "Giocatore",
          email: googleUser.email ?? null,
          loginMethod: "google",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name: googleUser.name || existingByEmail?.name || "Giocatore",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/");
        return;
      }

      // 2. Legacy Manus OAuth flow fallback
      if (!state) {
        res.status(400).json({ error: "state is required" });
        return;
      }
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
