import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import axios from "axios";
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

export function registerOAuthRoutes(app: Express) {
  // Direct Google OAuth 2.0 entry point (independent from Manus)
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId) {
      res.status(500).send("GOOGLE_CLIENT_ID non configurato nelle variabili d'ambiente del server.");
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

