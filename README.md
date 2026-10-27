# Project Name: CHRONOS LIVE

**ChronosLive** — a real-time appointment booking and dynamic waitlist management platform

[Live Application](https://chronoslive.vercel.app/) ·
[Source Repository](https://github.com/keerthan-saravanakumar/ChronosLive) ·


**Live Application:** https://chronoslive.vercel.app/

**Backend API:** https://chronoslive-api.onrender.com/api/health

**Demo Video:** [Add demo video link before submission]

## Problem Statement

College office hours, labs and consultation sessions have limited capacity. Spreadsheets and chat groups cannot reliably prevent simultaneous bookings, manage a fair queue or tell everyone when a seat becomes available. The core engineering challenge is keeping availability correct under concurrent actions: no overbooking, duplicate reservations or conflicting bookings, with fair promotion and live updates derived from committed database state.

## Target Users

- **Attendees:** find sessions, reserve a seat, cancel within policy or join a waitlist.
- **Organizers:** publish services and schedules, manage capacity and view the people attending or waiting.
- **Administrators:** inspect accounts and deactivate abusive users without silently deleting their reservations.

## Solution

Organizers publish services and slots. Attendees book available seats or join a FIFO waitlist when a slot is full. A cancellation or capacity increase promotes the oldest eligible waiter inside the same MongoDB transaction. Durable notifications and Socket.io updates keep connected clients informed; reconnecting clients fetch the current database state.

## Key Features

| Workflow | What works |
|---|---|
| W1 Authentication and roles | Registration, login, protected routes, organizer ownership checks, all-session logout and account revocation |
| W2 Organizer management | Service creation/edit/archive, single and recurring slots with preview, atomic bulk rejection, roster, capacity changes, slot cancellation and aggregation statistics |
| W3 Browse and book | Keyword/category/organizer search, date and IST clock filters, available-only results, atomic seat claims, booking limits and overlap checks |
| W4 Cancellation and promotion | Cutoff enforcement, organizer removal, FIFO promotion, recorded skip reasons and transactional cascades |
| W5 Waitlist and live status | Join/leave, computed positions, live promotion toast, notifications and upcoming/past/cancelled booking views |

Profile and cover uploads use Cloudinary with file validation. Reminder/completion jobs run every five minutes and at startup. External upload success remains unverified until Cloudinary credentials are configured.

## Tech Stack

| Choice | Purpose |
|---|---|
| Node.js 24 LTS, Express 4 | Small HTTP service with familiar middleware and MVC structure |
| MongoDB Atlas, Mongoose | Persistent data, partial unique indexes, guarded writes and replica-set transactions |
| React, Vite, React Router | Responsive client with route-level lazy loading |
| Context API, Axios | Shared authentication/socket state and one HTTP client with error handling |
| Tailwind CSS, CSS, react-hot-toast, date-fns | Layout, accessible controls, feedback and local date display |
| bcryptjs, jsonwebtoken, Zod | Password hashing, short-lived Bearer sessions and strict request validation |
| Helmet, CORS, express-rate-limit | Backend security headers, origin restriction and abuse limits |
| Socket.io | Authorized rooms and committed availability/promotion updates |
| node-cron | Reminder and slot-completion scheduling |
| multer, Cloudinary | Bounded in-memory image uploads and hosted images |
| Jest, Supertest, MongoMemoryReplSet | Real HTTP/database concurrency and recovery tests |
| GitHub Actions, Render, Vercel | CI and the prescribed deployment targets |

Gemini is deferred. No AI endpoint or Smart Slot Finder is advertised as implemented. There is no Redux, Redis, GraphQL, Docker or microservice dependency.

## Architecture

```text
React client (Vercel)
  | Bearer REST requests       | authenticated Socket.io
  v                           v
Express: routes -> middleware -> controllers -> services -> Mongoose
                                                    |
                                      MongoDB Atlas replica set
                                      users/services/slots/bookings
                                      waitlists/outbox/notifications
                                                    |
                                 leased outbox worker -> Socket.io

Express upload service -> Cloudinary
node-cron -> guarded completion/reminder transactions
Gemini -> deferred (no runtime dependency)
```

A booking transaction writes the service, slot and user guards before checking eligibility. It claims a seat with a conditional `$inc`, inserts a booking and records outbox intent. Partial unique indexes protect confirmed bookings and active queue entries. MongoDB transactions alone would permit write-skew across different slots; writing the shared User document forces competing eligibility checks to retry against a fresh snapshot.

Cancellation decrements the counter and promotes eligible waiters before committing. Promotion checks activity, the service booking limit and overlap using the same eligibility function as direct booking. Queue order is `{createdAt, _id}`; positions are computed from waiting entries, so a stored position cannot become stale.

The outbox worker runs after commit, materializes each notification once and emits stable event IDs. Socket delivery can repeat or be missed. Database reads and reconnect reconciliation provide recovery. Completed slots retain their confirmed booking history; queries reject started slots even if cron is delayed by a sleeping host.

The main models are User, Service, Slot, Booking, WaitlistEntry, Notification and OutboxEvent. [Architecture and concurrency details](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md), and [REST/socket contracts](docs/API.md) describe the invariants and trade-offs.

JWTs use Bearer headers and `handshake.auth.token` because Vercel and Render are different sites and cross-site cookies are unreliable in some browsers. The client stores the token in sessionStorage with a 15-minute default lifetime. This exposes the token to successful XSS, mitigated by escaped React rendering, no `dangerouslySetInnerHTML`, restricted frontend CSP, short expiry and server-side session revocation. **Vercel headers protect the frontend document; backend Helmet cannot do that.**

## Concurrency & Testing

```sh
npm test
npm run build
npm run check:secrets
```

**The central concurrency test sends 20 parallel booking requests through independent Express app instances to a capacity-5 slot: exactly 5 succeed and 15 return `SLOT_FULL`. The database has exactly 5 confirmed bookings and `bookedCount === 5`.**

The suite also covers duplicate requests, per-user cross-slot limits, overlapping bookings across services, deterministic held-guard races, simultaneous promotions, cancellation/capacity cascades, organizer overlap, strict bulk rollback, socket privacy/revocation, outbox crash boundaries, concurrent reminders, uploads and admin authorization. Tests use actual MongoDB replica-set transactions rather than mocked database calls.

Latest local results: **45 regression tests passed**, followed by **3 additional production-security tests passed**; production frontend build passed; npm audit reported **0 vulnerabilities**. See [verification evidence](docs/VERIFICATION.md) for scope and remaining external checks. CI runs the complete suite, build and credential-pattern scan on pushes and pull requests.

## Local Setup

Prerequisites: Git and Node.js 22.12+; Node 24 LTS is recommended. Run commands from the repository root.

```sh
git clone https://github.com/keerthan-saravanakumar/ChronosLive.git
cd ChronosLive
npm ci
npm run local
```

In another terminal:

```sh
npm run dev:client
```

Open **http://localhost:5173**. The API is **http://localhost:4000/api**. `npm run local` downloads a MongoDB binary on its first run, starts a local replica set on port 27018, persists data in `.local/mongodb`, generates private local secrets and runs the idempotent seed. Existing services are not duplicated or overwritten on restart. Stop it with Ctrl+C. The local launcher is a development convenience; production uses Atlas.

To use your own replica set or Atlas instead, copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, then fill the server configuration privately. In PowerShell:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
# Edit server/.env: real replica-set URI, generated JWT secret and optional Cloudinary keys.
npm run seed
npm run dev:server
# In another terminal:
npm run dev:client
```

Supply a dedicated `DEMO_PASSWORD` before `npm run seed`. The seed creates one admin, two organizers, six attendees, three services, weekday slots for the next two weeks, confirmed bookings and full slots with waitlists. It calls the real booking engine. It does not reset existing accounts or regenerate an existing service's schedule; add new slots through the organizer interface when its initial dates have passed.

## Environment Variables

Only `.env.example` files belong in Git. All timestamps are stored in UTC; recurring schedule entry and clock filters explicitly use Asia/Kolkata. Ordinary session display follows the browser's local timezone, with IST as the default project timezone.

| Name | Where | Description | Example placeholder |
|---|---|---|---|
| `NODE_ENV` | Server | development/test/production | `production` |
| `PORT` | Server | HTTP and Socket.io port; Render supplies it | `4000` locally |
| `MONGODB_URI` | Server | Atlas or another replica set | `mongodb+srv://<user>:<password>@<cluster>/chronoslive` |
| `JWT_SECRET` | Server | Generated secret, at least 32 characters | `<generated privately>` |
| `JWT_EXPIRES_IN` | Server | Short token lifetime | `15m` |
| `CLIENT_URL` | Server | One exact frontend origin, no trailing slash; HTTPS in production | `https://<project>.vercel.app` |
| `CLOUDINARY_CLOUD_NAME` | Server | Cloudinary cloud name | `<cloud name>` |
| `CLOUDINARY_API_KEY` | Server | Cloudinary server API key | `<key>` |
| `CLOUDINARY_API_SECRET` | Server | Cloudinary secret | `<secret>` |
| `GEMINI_API_KEY` | Server | Reserved for deferred stretch work; currently unused | Leave unset |
| `DEMO_PASSWORD` | Seed only | Dedicated demo password, 12–72 UTF-8 bytes | `<private demo password>` |
| `VITE_API_URL` | Client | Backend URL including `/api` | `https://<api>.onrender.com/api` |
| `VITE_SOCKET_URL` | Client | Same backend origin without `/api` | `https://<api>.onrender.com` |

Provide all three Cloudinary values together or leave all three unset. Missing upload configuration returns a clear 503; core booking remains available. `env.js` rejects incomplete required settings without echoing secret values.

## Deployment

ChronosLive is deployed using the following architecture:

- **Frontend:** [Vercel](https://chronoslive.vercel.app/)
- **Backend:** Render
- **Database:** MongoDB Atlas

The React frontend communicates with the Express backend through REST APIs
and authenticated Socket.io connections. MongoDB Atlas provides persistent
storage and replica-set transactions for reliable booking and waitlist
operations.

### Production Configuration

- `render.yaml` defines the backend service configuration.
- `vercel.json` configures frontend routing and security headers.
- Production environment variables are configured through the respective
  hosting platforms.
- Database credentials and API secrets are maintained as environment
  variables and are not included in the repository.

For local setup, environment configuration, deployment procedures,
database indexes, and production verification, refer to
[Deployment Instructions](docs/DEPLOYMENT.md).

### Deployment Verification

The deployed application is available at:

**Frontend:** https://chronoslive.vercel.app/

**Backend API:** [https://chronoslive-api.onrender.com]

**Demo Video:** [Add demo video link before submission]

Before submission, verify that the frontend, backend API, database-backed
workflows, and real-time updates operate correctly in the deployed
environment.

Render's free tier may put an inactive service to sleep, resulting in a
delay on its first request. Subsequent requests should work normally once
the service has started.

## Demo Accounts

| Role | Email |
|---|---|
| Organizer | `maya@chronos.example` / `arjun@chronos.example` |
| Attendee | `aditi@chronos.example`, `rohan@chronos.example`, `sara@chronos.example`, `vikram@chronos.example`, `neha@chronos.example`, `kabir@chronos.example` |
| Admin | `admin@chronos.example` |

For `npm run local`, the generated demo password is in the ignored **`.local/demo-password`** file on your machine. For an Atlas seed, use the private `DEMO_PASSWORD` you supplied. Passwords are deliberately not published in source control. Evaluators can also register attendee/organizer accounts themselves. Arrange any shared admin demo credentials separately before submission.

## Known Limitations & Future Work

- Gemini Smart Slot Finder is deferred in favor of completing the five core
  workflows. No generative-AI feature is currently exposed by the application.
- One API process is the supported deployment. Outbox leasing tolerates
  concurrent workers, but cross-process Socket.io fan-out and distributed
  rate limiting would require additional infrastructure.
- Coarse service guards prioritize correctness and explainability over
  throughput. Long queues increase transaction work; production scaling
  would require bounded promotion work and measured contention handling.
- Socket messages are best effort, and notifications are eventually
  materialized from the durable outbox. Email/SMS delivery is not guaranteed.
- Recurrences use same-day IST windows, complete intervals, and at most
  200 slots per request. Overnight windows, appointment rescheduling, and
  refresh tokens are not implemented.
## AI Usage disclosure

OpenAI Codex assisted with design review, implementation, debugging, integration tests, browser verification and documentation. Tests were actually executed; provider access and deployment outcomes are recorded separately from local results. No generative-AI feature runs in the current application. The architecture and concurrency guards are documented for explanation in the viva.

## Acknowledgements/third-party libraries

Uses the open-source libraries listed above and their upstream documentation. Package versions and transitive licenses are available through `package-lock.json` and the installed packages. The application was developed incrementally for this project rather than copied from an existing tutorial application.
