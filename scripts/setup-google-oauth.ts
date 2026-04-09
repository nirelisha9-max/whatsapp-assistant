/**
 * One-time Google OAuth2 setup script.
 * Run: npm run setup-google
 *
 * This will:
 * 1. Print an authorization URL
 * 2. Start a local server to catch the redirect
 * 3. Exchange the code for tokens
 * 4. Print the GOOGLE_REFRESH_TOKEN to add to your .env
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { google } from "googleapis";
import * as http from "http";
import * as url from "url";
import * as readline from "readline";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
];

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\nError: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env\n");
  console.error("Steps:");
  console.error("1. Go to https://console.cloud.google.com");
  console.error("2. Create a new project (or select existing)");
  console.error("3. Enable Gmail API and Google Calendar API");
  console.error("4. Go to Credentials → Create OAuth 2.0 Client ID");
  console.error("5. Application type: Desktop app");
  console.error("6. Copy Client ID and Client Secret to your .env file");
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // force to always get refresh token
});

console.log("\n=== Google OAuth2 Setup ===\n");
console.log("1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n2. Log in with your Google account and approve access.");
console.log("3. You will be redirected to localhost:3001 — the script will capture it automatically.\n");

// Start local server to capture the redirect
const server = http.createServer(async (req, res) => {
  if (!req.url) return;
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== "/oauth2callback") return;

  const code = parsed.query.code as string;
  if (!code) {
    res.end("Error: no code received");
    return;
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);

    res.end("<h1>Success!</h1><p>You can close this tab and check your terminal.</p>");
    server.close();

    console.log("\n✅ Authorization successful!\n");
    console.log("Add this to your .env file:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    if (!tokens.refresh_token) {
      console.log(
        "⚠️  No refresh token received. If you already authorized this app before,\n" +
          "   go to https://myaccount.google.com/permissions and revoke access,\n" +
          "   then run this script again."
      );
    }
  } catch (err) {
    console.error("Error exchanging code for tokens:", err);
    res.end("Error: token exchange failed");
    server.close();
  }
});

const port = parseInt(new URL(REDIRECT_URI).port || "3001", 10);
server.listen(port, () => {
  console.log(`Waiting for callback on port ${port}...`);
});

server.on("error", (err) => {
  console.error(`Could not start local server on port ${port}:`, err.message);
  console.error("Try changing GOOGLE_REDIRECT_URI in .env to use a different port.");
  process.exit(1);
});
