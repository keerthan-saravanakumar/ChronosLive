# Deployment runbook

## Current state

- GitHub repository: https://github.com/keerthan-saravanakumar/ChronosLive. Implementation commit `26f045a` is published; [CI run 40211895050](https://github.com/keerthan-saravanakumar/ChronosLive/actions/runs/40211895050) passed all 48 tests, frontend build and credential scan.
- Render: account setup succeeded. The public-repository web-service form is prepared for `chronoslive-api`, free compute, Singapore, the commands below and `/api/health`. Required production environment values remain incomplete; no service has been deployed.
- Atlas: signed in again on 26 October and restored the saved Free/M0 AWS Singapore draft, name `ChronosLive`, with automatic security setup and sample data disabled. Provisioning again failed with `reCAPTCHA Timeout`; the cluster list was checked afterward and remained empty. No cluster or production URI exists yet.
- Vercel: existing Hobby account access was verified and the `chronoslive` import draft now selects the repository root and Vite. Deployment awaits a working backend and matching configuration.
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

Resume the saved Free/M0 AWS Singapore draft in the dedicated ChronosLive project. The current blocker is `Could not connect to the reCAPTCHA service`; a retry also failed, and the cluster list was verified empty. Resolve the provider challenge connectivity before submitting again. Keep the free tier selected: a fresh form defaults to paid M10.

Once the cluster exists, create `chronoslive_app` with `readWrite` on the `chronoslive` database. Configure network access for the Render service's documented outbound addresses; add a temporary development address only if needed for seeding. Obtain the driver connection URI with the database name `chronoslive` and URL-encoded credentials.

Credentials and account security actions must be completed in the provider UI. Paste the URI into Render's `MONGODB_URI` setting or an ignored local server environment file. Never paste it into an issue, README or screenshot. The API verifies that the database supports transactions; a standalone MongoDB instance is rejected.

## 3. Render backend

The prepared form uses **Public Git Repository** with `https://github.com/keerthan-saravanakumar/ChronosLive`. This path is available without connecting a Git provider. Use the repository's `render.yaml` Blueprint where supported, or finish the **Node web service** form with:

| Setting | Value |
|---|---|
| Repository/branch | ChronosLive / main |
| Service name/region | `chronoslive-api` / Singapore |
| Root directory | Repository root (leave blank) |
| Runtime | Node 24 LTS |
| Build | `npm ci --omit=dev --workspace server` |
| Start | `npm start` |
| Health path | `/api/health` |
| Instance count | One; choose the available free plan if appropriate |

Required environment values: `NODE_ENV=production`, generated `JWT_SECRET`, `JWT_EXPIRES_IN=15m`, `MONGODB_URI`, and the exact HTTPS Vercel origin as `CLIENT_URL` (no trailing slash). Render provides the port. Configure all three Cloudinary values together when available. Do not set any secret using a `VITE_` prefix.

The open form already contains `NODE_ENV=production`, `NODE_VERSION=24.13.0` and `JWT_EXPIRES_IN=15m`; the three remaining required values are blank. Generate a dedicated production JWT secret. Public-repository deployments may require manual deploys unless configured through a Blueprint; verify the chosen update mechanism in Render.

Startup awaits additive index creation before listening. It does not drop production indexes. If startup reports duplicate/index conflicts, inspect the data and resolve them deliberately; do not delete records or reset production as a deployment shortcut. The seed is also additive and uses the booking engine.

Check the actual assigned Render URL, not an assumed service-name URL. The `/api/health` JSON must say `status: ok` and `database: connected`. An unavailable database returns HTTP 503 with `DATABASE_UNAVAILABLE`; probes are uncached and excluded from user rate limits. If it reports degraded, diagnose Atlas access and server settings. Backend Helmet does not supply the frontend document's CSP.

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

From a checkout with `npm ci` installed, run the read-only deployment check with the actual assigned origins (no trailing slash):

```sh
npm run smoke:deployment -- --api https://ACTUAL-API.onrender.com --app https://ACTUAL-APP.vercel.app --report .local/deployment-readiness.json
```

It verifies connected database readiness, CORS preflight, protected routes, frontend security headers, the JavaScript entry asset and SPA deep links. The first health request allows up to 60 seconds for a Render cold start. HTTPS is required; a local check must explicitly use `--local` with loopback HTTP origins. Reports contain results and resource IDs, never credentials, and may only be written inside ignored `.local/`.

Then exercise the core workflows:

```sh
npm run smoke:deployment -- --api https://ACTUAL-API.onrender.com --app https://ACTUAL-APP.vercel.app --workflows --report .local/deployment-workflows.json
```

`--workflows` creates five uniquely named verification accounts, one service and four slots through the real API. It uses two authenticated WebSocket clients to verify last-seat updates, FIFO promotion, notifications and logout revocation, plus role/ownership checks, duplicate rejection, recurring-batch rollback, capacity changes, personal state after reconnect and slot cancellation. Cleanup only cancels this run's slots, archives its service and revokes its sessions; audit records and test accounts remain. Existing accounts and schedules are preserved. Six registration/login requests fit within the production auth quota; avoid repeatedly rerunning within its 15-minute window. If cleanup fails, retain the report's run/resource IDs for targeted follow-up.

The workflow runner is itself tested against a real isolated replica set and production middleware, including preservation of a pre-existing schedule. This automation supports the browser checks below; it does not prove rendered toasts, Cloudinary success, scheduled jobs or a second browser's UI behavior.

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
