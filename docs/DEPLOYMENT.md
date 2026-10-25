# Deployment runbook

## Current state

- GitHub repository: https://github.com/keerthan-saravanakumar/ChronosLive (created under the connected account).
- Render: new GitHub authorization is requested; no backend deployment is verified.
- Atlas: account login is required; no production replica-set URI is configured.
- Vercel: an existing Hobby account is signed in; no working ChronosLive deployment is verified.
- Cloudinary: the three server credentials are absent; successful image upload is unverified.
- Gemini: deferred. Its key is not required for the core app.

Do not present placeholder hosts or a frontend without a working API as a complete deployed application. Keep secrets in provider environment settings or ignored local files, never in Git, screenshots or submission prose.

## 1. Verify and publish source

```sh
npm ci
npm test
npm run build
npm run check:secrets
git push -u origin main
```

The GitHub Actions workflow must pass for the submitted commit. It uses Node 24, downloads/caches a real MongoDB test binary, scans history for credential patterns, runs the integration suite and builds the client. No production secrets are needed in CI.

## 2. Atlas

Create/select a project dedicated to ChronosLive and an appropriate free replica-set cluster. Create a database user limited to the application database. Configure network access for the Render service's documented outbound addresses; add a development address only if needed for seeding. Obtain the driver connection URI with the database name `chronoslive` and URL-encoded credentials.

Credentials and account security actions must be completed in the provider UI. Paste the URI into Render's `MONGODB_URI` setting or an ignored local server environment file. Never paste it into an issue, README or screenshot. The API verifies that the database supports transactions; a standalone MongoDB instance is rejected.

## 3. Render backend

Connect the GitHub account and allow access to the ChronosLive repository. Use the repository's `render.yaml` Blueprint or create a **Node web service** with:

| Setting | Value |
|---|---|
| Repository/branch | ChronosLive / main |
| Root directory | Repository root (leave blank) |
| Runtime | Node 24 LTS |
| Build | `npm ci --omit=dev --workspace server` |
| Start | `npm start` |
| Health path | `/api/health` |
| Instance count | One; choose the available free plan if appropriate |

Required environment values: `NODE_ENV=production`, generated `JWT_SECRET`, `JWT_EXPIRES_IN=15m`, `MONGODB_URI`, and the exact HTTPS Vercel origin as `CLIENT_URL` (no trailing slash). Render provides the port. Configure all three Cloudinary values together when available. Do not set any secret using a `VITE_` prefix.

Startup awaits additive index creation before listening. It does not drop production indexes. If startup reports duplicate/index conflicts, inspect the data and resolve them deliberately; do not delete records or reset production as a deployment shortcut. The seed is also additive and uses the booking engine.

Check the actual assigned Render URL, not an assumed service-name URL. The `/api/health` JSON must say `status: ok` and `database: connected`. If it reports degraded, diagnose Atlas access and server settings. Backend Helmet does not supply the frontend document's CSP.

## 4. Vercel frontend and CSP

Import the same repository into the existing Vercel account. Use the repository root, the Vite preset, `npm ci`, build command `npm run build` and output directory `client/dist`. `vercel.json` already supplies the SPA rewrite and response security headers.

Once the actual API origin is known:

```sh
npm run configure:hosting -- https://YOUR-ACTUAL-API.onrender.com
```

Review and commit the resulting CSP change. It permits REST/WebSockets to that exact origin, and Cloudinary images to `res.cloudinary.com`. Scripts remain self-only; inline styles support React/toast styling. No broad `https:` or arbitrary Render wildcard is used for connect sources.

Set Vercel environment variables for the production deployment:

```text
VITE_API_URL=https://YOUR-ACTUAL-API.onrender.com/api
VITE_SOCKET_URL=https://YOUR-ACTUAL-API.onrender.com
```

Use the assigned Vercel HTTPS origin in Render's `CLIENT_URL` and redeploy/restart the API. Vite's deployment check fails if these variables are missing, non-HTTPS, inconsistent or absent from CSP. The initial `.invalid` host in the committed config is deliberately non-deployable until replaced.

Frontend policy includes CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict-origin referrer policy, disabled camera/microphone/geolocation and HSTS. Verify these on the deployed HTML response separately from the API's Helmet headers. Reload `/bookings`, `/services/:id` and an organizer deep link directly to verify SPA fallback.

Preview deployments have different origins. Do not broaden production CORS for all preview hosts. Use a separate development backend or configure a single explicit test origin when needed.

## 5. Production seed

From a trusted local checkout, configure the production connection and a dedicated demo password in an ignored server environment file. Confirm the target database before running:

```sh
npm run seed
```

The script creates missing demo accounts/services and uses real guarded booking/waitlist operations. It will not overwrite an existing account's password or recreate an existing service. Do not run the local launcher against production; it always manages a local development replica set. Store evaluator demo credentials privately; attendee and organizer registration also work without sharing seeded passwords.

## 6. Required live smoke test

Use two separate browsers or isolated login sessions. Record actual results in `VERIFICATION.md`:

1. Health reports a connected database; HTTPS, frontend headers and deep-link rewrites work.
2. Register attendee/organizer, sign in, fetch profile, then logout and verify the old REST token/socket is rejected.
3. Create a service and adjacent slots. Publish a recurring batch, then submit an overlapping batch and confirm no partial creation.
4. In two attendee sessions, book the last seat and see the other client update to full. Join its waitlist and observe position #1.
5. Cancel the original reservation. Confirm automatic promotion, one confirmed booking, correct counts, toast and persisted notification.
6. Increase capacity and check further FIFO promotion. Try a decrease below booked count, an overlapping booking, a duplicate request and an unauthorized roster/edit.
7. Cancel a slot with confirmation; all affected bookings/queues update. Archive another service and verify existing plans remain while new entrants are blocked.
8. Mark notifications read, reload, disconnect/reconnect and confirm state persists. Test an account deactivation and fresh-login requirement after reactivation.
9. Upload a valid small avatar/cover using real Cloudinary credentials. Invalid/oversized images and provider failures must show useful errors.
10. Confirm scheduled completion/expiry and one reminder intent. Cold-start the Render service and verify query-time closure still prevents stale-slot booking.

Free Render instances can sleep and take roughly 30–60 seconds to wake. Keep retry feedback visible; do not claim cron delivery ran on schedule while the host slept. Production seed data and all booking truth live in Atlas.

## Completion and handoff

Update README, PROGRESS and SUBMISSION only with verified live URLs. Open repository, live app and demo video in an incognito/private window. The video and official form submission remain separate requirements. A CI/build success alone does not prove deployment or database connectivity.
