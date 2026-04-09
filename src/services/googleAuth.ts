import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

let _auth: OAuth2Client | null = null;

export function getGoogleAuth(): OAuth2Client {
  if (_auth) return _auth;

  _auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/oauth2callback"
  );

  _auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  });

  return _auth;
}
