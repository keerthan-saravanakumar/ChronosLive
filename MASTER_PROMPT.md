# MASTER PROMPT — ChronosLive (End-Term MERN Project)

## 0. Your Role and Ground Rules

You are a senior full-stack engineer pair-programming with me on my end-term project, ChronosLive. Before writing any code:

1. Read GUIDELINES.md in this folder completely. It is the official grading document. Every requirement in it is mandatory. If anything in this prompt seems to conflict with GUIDELINES.md, follow GUIDELINES.md and tell me about the conflict.
2. Read this whole prompt, then reply with a short plan confirming the phases before you start Phase 0.

Working rules (follow these the whole time):
- Work phase by phase (Section 12). At the end of each phase: run the code, run the tests, fix any failures, give me a short summary plus manual steps to verify, then make Git commits. Wait for my "continue" before starting the next phase.
- Make small, meaningful commits using Conventional Commit messages (feat:, fix:, test:, docs:, refactor:, chore:). Several commits per phase, never one giant commit. Never rewrite history.
- Never commit secrets. Create .gitignore (node_modules, .env, dist, coverage) in the very first commit. Only .env.example files go into Git.
- No stubs, no fake/mock data in the UI, no "TODO: implement later" in core workflows. Every feature you build must work end to end. If time is short, cut scope (stretch items first), never quality.
- Keep docs/PROGRESS.md updated: a checklist of phases, what's done, known issues, and next steps. This lets us resume if the session resets.
- Prefer clarity over cleverness. I must be able to explain every file in a viva. Add brief comments on non-obvious logic, especially the concurrency code.
- Ask me before installing anything outside the approved stack, or before any destructive operation.

Hard deadline: 27 October 2026, 11:59 PM IST. Prioritize accordingly.

## 1. Product Definition (Problem & Product Understanding — 10%)

Problem: Organizations offering limited-capacity sessions (college office hours, labs, clinics, service centers) manage bookings through spreadsheets, forms, or chat groups. This leads to double-booking, overbooking, no fair waitlist, freed seats going unused when someone cancels, and nobody knowing current availability.

Target users:
- Attendee: a student, patient, or customer who wants to find and book a slot, or wait fairly for one.
- Organizer: a professor, lab in-charge, clinic staff member, or service manager who publishes and manages slots.
- Admin (minimal): seeded account that can view all users and deactivate abusive accounts.

Solution: A real-time scheduling platform. Organizers publish services and time slots. Attendees book slots or join a FIFO waitlist. When a seat frees up, the system automatically promotes the next eligible waitlisted person inside a transaction, and every connected client sees updated availability and waitlist positions instantly through Socket.io.

Core engineering challenge (state this in the README): keeping availability correct under concurrent actions. That means no overbooking, no duplicate bookings, fair and consistent waitlist promotion, role-based permissions, and live updates that never disagree with the database.

## 2. The 5 Core Workflows (Depth > Feature Count)

Build these 5 properly. Everything else is secondary.

W1. Authentication & Roles: register (attendee or organizer), login, logout, protected routes, role-based UI and API authorization.

W2. Organizer Slot Management: create a service; create single slots, or bulk recurring slots (e.g., "Mon & Wed, 15:00–17:00, 20-minute slots, capacity 3, for 4 weeks"), with validation and overlap detection; edit capacity (an increase auto-promotes from the waitlist, a decrease below bookedCount is rejected); cancel a slot (all attendees and waitlisted users get notified); view the attendee list and waitlist for each slot.

W3. Browse & Book: search and filter services (keyword, category, organizer) and slots (date range, time of day, available-only); see live seat counts; book atomically, with policy checks.

W4. Cancel → Automatic Waitlist Promotion: an attendee cancels (or an organizer removes an attendee). The seat goes to the next eligible waitlisted user in FIFO order, ineligible users are skipped with a recorded reason, and everyone affected is notified in real time.

W5. Waitlist & Live Status: join or leave a waitlist for a full slot; see your live position ("You are #3"); get an instant in-app notification and toast when promoted; a My Bookings dashboard shows upcoming, past, and waitlisted entries.

## 3. Tech Stack (matches course lectures)

- Backend: Node.js (LTS), Express 4.x, MVC + service layer, Mongoose, MongoDB Atlas (replica set, so transactions work).
- Auth: bcryptjs for password hashing, jsonwebtoken. Send the JWT as a Bearer token in the Authorization header. Socket.io authenticates through handshake.auth.token. Engineering decision to document in the README: Bearer tokens instead of cross-site cookies, because the frontend (Vercel) and backend (Render) are on different sites, and third-party cookies are blocked in Safari and some other browsers. Note the XSS trade-off and mitigations (short expiry, no dangerouslySetInnerHTML, CSP via helmet).
- Validation: zod (shared schemas per route) via a validate middleware.
- Security middleware: helmet, cors (whitelist CLIENT_URL only), express-rate-limit (strict on auth and AI routes), body size limits.
- Real-time: Socket.io (server + client).
- Background jobs: node-cron.
- Uploads (small feature): multer (memory storage) + Cloudinary for user avatars / service cover images.
- AI (stretch, Phase 8): Google Gemini API, server-side only.
- Frontend: React + Vite, React Router, Axios (single instance with interceptors), Context API (AuthContext, SocketContext), Tailwind CSS, react-hot-toast, date-fns. Use React.lazy + Suspense for route-level code splitting.
- Testing: Jest + Supertest + mongodb-memory-server (MongoMemoryReplSet so transactions work in tests).
- CI: GitHub Actions running backend tests on every push and PR.
- Deploy: MongoDB Atlas + Render (backend, WebSockets) + Vercel (frontend, with a vercel.json SPA rewrite).

Do not add Redux, GraphQL, Redis, Docker, or microservices. They aren't needed, and the guidelines say not to add complexity for its own sake.

## 4. Repository Structure

Monorepo root: README.md, GUIDELINES.md, MASTER_PROMPT.md, docs/ (PROGRESS.md, ARCHITECTURE.md, API.md, screenshots/), .github/workflows/ci.yml, server/, client/.

server/src: config/ (db.js, env.js which validates required env vars at startup and fails fast), models/, controllers/ (thin: parse request → call service → send response), services/ (all business logic: bookingService, waitlistService, slotService, notificationService, aiService), routes/, middlewares/ (auth, authorize(roles), validate, errorHandler, notFound, rateLimiters, upload), validators/ (zod schemas), sockets/ (index.js, auth, emitters), jobs/ (cron), utils/ (AppError, asyncHandler, time helpers), app.js, server.js. Also: server/tests/, server/scripts/seed.js, server/.env.example.

client/src: api/ (axios instance + one module per resource), context/, hooks/ (useAuth, useSocket, useSlotLive), components/ (ui primitives, SlotCard, BookingButton, WaitlistBadge, NotificationBell, ProtectedRoute, RoleRoute, ErrorBoundary, Skeletons, EmptyState), pages/, layouts/, utils/. Also client/.env.example.

## 5. Data Model (Mongoose)

Store all timestamps in UTC and display them in the user's local timezone (IST by default).

- User: name, email (unique, lowercase, trimmed), passwordHash (select: false), role enum [attendee, organizer, admin], avatarUrl, isActive (default true), timestamps.
- Service: organizer (ref User), title, description, category, location (text, e.g., "Room 204 / Google Meet link"), coverImageUrl, isActive, policy { maxActiveBookingsPerUser (default 2), cancellationCutoffMinutes (default 30) }, timestamps. Text index on title + description.
- Slot: service, organizer, startTime, endTime, capacity (1–100), bookedCount (default 0, min 0), waitlistCount (default 0), status enum [open, cancelled, completed], timestamps. Indexes: {service, startTime}, {organizer, startTime}. Invariant: 0 ≤ bookedCount ≤ capacity, always.
- Booking: slot, user, service, status enum [confirmed, cancelled, cancelled_by_organizer], source enum [direct, waitlist_promotion], cancelledAt, cancelReason, timestamps. PARTIAL UNIQUE INDEX on {slot, user} where status = "confirmed" (blocks duplicate bookings at the database level).
- WaitlistEntry: slot, user, status enum [waiting, promoted, left, skipped, expired], skipReason, promotedAt, timestamps. PARTIAL UNIQUE INDEX on {slot, user} where status = "waiting". Order is FIFO by {createdAt: 1, _id: 1}. Position is computed, not stored.
- Notification: user, type enum [booking_confirmed, booking_cancelled, promoted, skipped, slot_cancelled, slot_updated, reminder], message, slot, read (default false), timestamps. Index {user, read, createdAt}.

Make sure indexes are actually created (Model.syncIndexes() at startup in development, documented for production).

## 6. Consistency & Concurrency Rules (Engineering & Application Logic — 20%)

This is the heart of the project. Implement it exactly like this, inside services/, using session.withTransaction() (it retries transient errors automatically).

BOOK (POST /api/slots/:id/book):
1. Load slot + service. Reject if not found (404 SLOT_NOT_FOUND), status ≠ open (409 SLOT_CLOSED), or startTime ≤ now (409 SLOT_IN_PAST). Organizers cannot book their own slots (403).
2. Eligibility policy checks (shared function isEligible(user, slot, session), reused by promotion): user is active; user has fewer than service.policy.maxActiveBookingsPerUser upcoming confirmed bookings for this service (409 BOOKING_LIMIT_REACHED); user has no other confirmed booking overlapping this time range (409 TIME_CONFLICT).
3. Atomic seat claim: Slot.findOneAndUpdate({ _id, status: "open", startTime: { $gt: now }, $expr: { $lt: ["$bookedCount", "$capacity"] } }, { $inc: { bookedCount: 1 } }, { new: true, session }). If null → 409 SLOT_FULL, with { canJoinWaitlist: true }.
4. Booking.create([...], { session }). On duplicate key error 11000 → abort → 409 ALREADY_BOOKED.
5. If the user had a "waiting" entry for this slot, mark it "left" and decrement waitlistCount.
6. Commit. Only AFTER a successful commit: emit socket events and create notifications. Never emit before commit.

CANCEL (DELETE /api/bookings/:id) — the owner (within the cutoff rule) or the slot's organizer/admin:
1. In one transaction: conditionally update the booking from confirmed → cancelled (if no document matched → 409 ALREADY_CANCELLED, which makes repeated clicks idempotent); decrement bookedCount with the guard bookedCount > 0; then call promoteFromWaitlist(slotId, session).
2. Owners cannot cancel within cancellationCutoffMinutes of start (409 CANCELLATION_WINDOW_CLOSED). Organizers can always remove attendees.

PROMOTE (promoteFromWaitlist(slotId, session, maxSeats = 1)), used by cancel and capacity increase:
- Loop: fetch the oldest "waiting" entry. Run isEligible() for that user. If ineligible → mark "skipped" with skipReason (TIME_CONFLICT / BOOKING_LIMIT_REACHED / INACTIVE_USER), decrement waitlistCount, queue a "skipped" notification, and continue to the next entry. If eligible → atomic seat claim (same guarded $inc as BOOK), create a Booking with source "waitlist_promotion", mark the entry "promoted" with promotedAt, decrement waitlistCount, queue a "promoted" notification. Stop when seats run out or the waitlist is empty.
- Return a list of side effects (notifications + socket events) to run after commit.

JOIN WAITLIST (POST /api/slots/:id/waitlist): allowed only if the slot is open, in the future, and actually full (otherwise 409 SLOT_HAS_SEATS, telling the user to book directly). Reject if already booked (409 ALREADY_BOOKED) or already waiting (unique index → 409 ALREADY_ON_WAITLIST). Increment waitlistCount in the same transaction. Return the position.

LEAVE WAITLIST: waiting → left, decrement waitlistCount, broadcast updated positions.

CAPACITY CHANGE (PATCH /api/slots/:id, organizer only): new capacity < bookedCount → 409 CAPACITY_BELOW_BOOKED. On an increase, run promoteFromWaitlist with maxSeats = delta in the same transaction.

CANCEL SLOT (organizer): status → cancelled, all confirmed bookings → cancelled_by_organizer, all waiting entries → expired, bookedCount/waitlistCount reset, everyone notified. All in one transaction.

SLOT CREATION: validate endTime > startTime, startTime in the future, duration 5–240 minutes, and no overlap with the organizer's existing non-cancelled slots (409 SLOT_OVERLAP, listing the conflicts). Bulk recurring: generate the slots server-side from { daysOfWeek, startTime, endTime, slotMinutes, capacity, fromDate, toDate }, cap at 200 slots per request, validate the whole batch, and insert all-or-nothing in a transaction. Return the created count and any skipped conflicts.

BACKGROUND JOB (node-cron, every 5 minutes): mark slots whose endTime has passed as completed and expire their waiting entries. Send a reminder notification for confirmed bookings starting within the next 60 minutes (only once — track this with a reminderSent flag on Booking). Because Render's free tier sleeps, ALSO treat startTime ≤ now as closed in all booking/waitlist queries, so correctness never depends on the cron job running.

## 7. Real-Time Design (Socket.io)

- Socket auth middleware verifies the JWT from socket.handshake.auth.token. Reject invalid tokens.
- Rooms: user:<userId> (joined automatically on connect), slot:<slotId> and service:<serviceId> (client joins/leaves while viewing; the server validates that the IDs exist).
- Server → client events (emitted only after commit, from sockets/emitters.js): slot:updated { slotId, bookedCount, capacity, waitlistCount, status }; waitlist:changed { slotId } (clients in the room refetch their own position); notification:new { notification } to the user room; booking:promoted { bookingId, slotId } to the user room (show a prominent toast); slot:cancelled { slotId }.
- The server is the single source of truth. Clients never update counts optimistically from their own guesses. On socket reconnect, the client refetches the current page's data to reconcile anything it missed.
- Show a small connection-status indicator (Live / Reconnecting) in the navbar.

## 8. REST API (document all of it in docs/API.md)

Response envelope: success → { success: true, data, meta? }; error → { success: false, error: { code, message, details? } }. Use proper status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict/business rule, 429 rate limited, 500 internal (never leak stack traces in production).

- Auth: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, PATCH /api/users/me (name, avatar upload).
- Services: GET /api/services (search, category, organizer, pagination), GET /api/services/:id, POST/PATCH/DELETE /api/services/:id (owner organizer only; soft-delete via isActive), POST /api/services/:id/cover (Cloudinary).
- Slots: GET /api/services/:id/slots (from, to, availableOnly, pagination), GET /api/slots/:id, POST /api/services/:id/slots, POST /api/services/:id/slots/bulk, PATCH /api/slots/:id, POST /api/slots/:id/cancel, GET /api/slots/:id/roster (owner organizer: attendees + waitlist in order).
- Bookings: POST /api/slots/:id/book, DELETE /api/bookings/:id, GET /api/bookings/me?status=upcoming|past|cancelled.
- Waitlist: POST /api/slots/:id/waitlist, DELETE /api/slots/:id/waitlist, GET /api/waitlist/me (with live positions).
- Notifications: GET /api/notifications, PATCH /api/notifications/:id/read, PATCH /api/notifications/read-all.
- Organizer stats: GET /api/organizer/stats (upcoming slots, fill rate, waitlist demand, cancellations, promotions — computed with aggregation pipelines).
- Admin: GET /api/admin/users, PATCH /api/admin/users/:id/status.
- AI (stretch): POST /api/ai/slot-search.
- Health: GET /api/health (returns DB connection state).

Authorization must check resource ownership, not just role. An organizer can only modify their own services/slots. An attendee can only cancel their own bookings. Add a test for this.

## 9. Frontend (User Experience & Reliability — 10%)

Pages: Landing (explains the product + CTA), Login, Register (role choice), Browse Services (search + filters + pagination), Service Detail (slots grouped by day, live seat counts "2/3 booked", waitlist count, Book / Join Waitlist / Leave Waitlist / Cancel button chosen by state), My Bookings (tabs: Upcoming, Waitlisted with live "#position", Past/Cancelled), Notifications, Profile (avatar upload), Organizer Dashboard (stats cards, my services), Service Manager (create/edit service, single + bulk slot creation form with a preview of slots before submitting), Slot Roster (attendees, ordered waitlist, remove attendee, edit capacity, cancel slot with a confirmation modal), Admin Users (minimal), 404 page.

UX requirements, applied everywhere:
- Loading states (skeletons), empty states with guidance ("No slots this week — try another date range"), success toasts, and specific error toasts that map backend error codes to friendly messages (e.g., SLOT_FULL → "Just filled up — join the waitlist?" with an inline action button).
- Disable action buttons while a request is pending (prevents double submits; the backend is still the real guard).
- Confirmation modals for destructive actions.
- Global ErrorBoundary. The Axios interceptor handles 401 by logging out and redirecting to login with a message.
- Client-side validation mirroring the server's rules (server remains authoritative).
- ProtectedRoute and RoleRoute guards. Hide UI the user isn't allowed to use.
- Responsive layout (usable on mobile). Accessible labels and focus states.
- Route-level lazy loading with Suspense fallbacks (performance lecture).

## 10. Security Checklist (must all be true)

bcrypt with ≥10 salt rounds; passwordHash never returned; JWT secret from env with expiry; helmet; CORS restricted to CLIENT_URL; rate limits on auth (e.g., 10 requests / 15 min per IP) and AI routes; zod validation on every body/params/query, with ObjectId params validated; whitelist allowed update fields (no mass assignment of role/bookedCount); upload limits (images only, ≤2 MB, MIME check); no secrets in client code (only VITE_API_URL and VITE_SOCKET_URL); .env.example files with placeholder values only; env.js fails fast on missing vars; the Gemini key and Cloudinary secret live only on the server. Before every commit, check that git status shows no .env file.

## 11. Testing (prove the concurrency claims)

Backend tests (Jest + Supertest + MongoMemoryReplSet):
1. Auth: register/login, duplicate email → 409, wrong password → 401, protected route without token → 401.
2. RBAC: an attendee cannot create slots (403); organizer A cannot edit organizer B's slot (403).
3. CONCURRENCY (key test): a slot with capacity 5 gets 20 different users booking in parallel via Promise.all → exactly 5 × 201 and 15 × 409 SLOT_FULL; final bookedCount === 5; exactly 5 confirmed bookings in the DB.
4. The same user sending 5 parallel booking requests for one slot → exactly 1 success.
5. Cancel promotes the oldest eligible waitlisted user (FIFO); an ineligible user (time conflict) is skipped with a reason and the next one is promoted.
6. A capacity increase of 2 promotes 2 users; a decrease below bookedCount → 409.
7. Slot overlap detection and the bulk-creation all-or-nothing behavior.
8. Cancelling a slot cascades to bookings and the waitlist.

Add an npm test script and a GitHub Actions workflow (.github/workflows/ci.yml) running the server tests on push/PR. Mention the concurrency test prominently in the README; it's the strongest evidence for the core engineering claim.

## 12. Build Phases (commit at the end of each one; wait for my "continue")

- Phase 0 — Setup: git init, .gitignore, monorepo folders, server + client scaffolding, .env.example files, docs/PROGRESS.md, a first README skeleton. Verify both apps start.
- Phase 1 — Backend foundation & Auth (W1): env validation, DB connection, AppError/asyncHandler/errorHandler/notFound, helmet/cors/rate limits, User model, register/login/me, auth + authorize middleware, health route, auth tests.
- Phase 2 — Services & Slots (W2 backend): models, ownership checks, single + bulk slot creation with overlap validation, listing with filters/pagination, roster, seed script (1 admin, 2 organizers, 6 attendees, 3 services, slots across the next 2 weeks, some full with waitlists). Tests.
- Phase 3 — Booking & Waitlist Engine (W3, W4, W5 backend): Section 6 implemented exactly, including transactions, the guarded $inc, partial unique indexes, promotion with skip logic, capacity change, slot cancel, notifications persisted. Full test suite from Section 11, including the concurrency tests. Do not continue until all tests pass.
- Phase 4 — Real-time: Socket.io server with JWT auth, rooms, emitters called after commit, integration into the services.
- Phase 5 — Frontend core: Vite + Tailwind + Router, AuthContext, Axios instance, layouts, auth pages, browse/service detail with live counts, booking/waitlist actions, My Bookings, SocketContext + useSlotLive hook, toasts, error mapping, connection indicator.
- Phase 6 — Organizer & Notifications UI: dashboard with stats (aggregation), service manager, bulk slot form with preview, roster page, capacity edit, slot cancel, notification bell + page, profile with Cloudinary avatar upload, minimal admin page.
- Phase 7 — Background jobs & hardening: node-cron job, reminders, final pass on every error/empty/loading state, lazy loading, a 404 page, input edge cases, CI workflow.
- Phase 8 — STRETCH (only if Phases 0–7 are fully working): "Smart Slot Finder" with Gemini. The user types natural language (e.g., "DBMS office hours Thursday after 3pm with free seats"). The server asks Gemini for STRICT JSON only (keywords, dateFrom, dateTo, timeFrom, timeTo, availableOnly), relative to the current IST date. The server validates the result with zod, clamps the date range to 30 days, runs a real MongoDB query, and returns real slots plus the interpreted filters shown as editable chips. Timeout ~8s, graceful fallback to manual filters with a clear message on any AI failure, rate-limited, and the input length is capped. This is engineering around the model, not an API wrapper.
- Phase 9 — Deployment: Atlas (network access + DB user), Render web service (build/start commands, env vars, trust proxy), Vercel (VITE_ env vars, vercel.json rewrite), production CORS, check that sockets work over wss, run the seed against production. Smoke-test every workflow on the live URLs in two different browsers.
- Phase 10 — Documentation & submission prep: final README, docs/ARCHITECTURE.md, docs/API.md, screenshots, demo script, final checklist.

## 13. README.md (must contain exactly these sections, per GUIDELINES.md §13)

Project Name (+ one-line pitch, live demo link, demo video link) · Problem Statement · Target Users · Solution · Key Features (organized by the 5 workflows) · Tech Stack (with a one-line "why" for each choice) · Architecture (a text/ASCII component diagram: React client ↔ REST + Socket.io ↔ Express (routes → middlewares → controllers → services → models) ↔ MongoDB Atlas; plus Cloudinary, Gemini, cron; explanations of the booking transaction and promotion algorithm; data model summary; key engineering decisions and trade-offs: guarded atomic $inc + transactions vs. locks, partial unique indexes, emit-after-commit, Bearer vs. cookies, computed waitlist positions, cron + query-time safety) · Concurrency & Testing (how to run tests, what the concurrency test proves) · Local Setup (prerequisites, clone, install, env, seed, run both apps — copy-paste-able commands) · Environment Variables (a table with name / where / description / example placeholder — server: NODE_ENV, PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, GEMINI_API_KEY; client: VITE_API_URL, VITE_SOCKET_URL) · Deployment (live URLs, hosting details, note that the first request may take ~30–60s on Render's free tier because of cold starts) · Demo Accounts (seeded demo-only credentials for organizer, attendee, admin) · Known Limitations & Future Work · AI Usage disclosure (what AI tools were used for) · Acknowledgements/third-party libraries.

## 14. Demo Video Script (3–5 min) — write this into docs/DEMO_SCRIPT.md

0:00–0:30 the problem and who it's for. 0:30–1:15 organizer creates a service + bulk recurring slots (show the overlap error once). 1:15–2:30 two browser windows side by side (normal + incognito, two attendees): A books the last seat and B's view updates live to "Full"; B joins the waitlist (#1); A cancels → B is auto-promoted with a live toast and notification, and the counts update in both windows. 2:30–3:15 error handling: duplicate booking, cancellation-window error, unauthorized access. 3:15–3:45 show the concurrency test passing (20 parallel requests → exactly 5 bookings). 3:45–4:15 organizer roster + capacity increase auto-promoting; AI search if built. 4:15–4:30 wrap-up with live link. Show the product, not code.

## 15. Definition of Done (check every item before Phase 10 ends)

- All 5 workflows work end to end on the DEPLOYED URLs, not just locally.
- All backend tests pass locally and in GitHub Actions.
- No secrets anywhere in Git history (verify with git log -p | grep -i for secret/key/password patterns).
- Git history shows incremental development across many meaningful commits.
- README has every required section; architecture is documented; .env.example files are complete.
- Every page has loading, empty, success, and error handling.
- Live app, repo, and video all open in an incognito window without permission requests.
- Generate a filled-in submission block for me: Project Name, Student Name (leave placeholder), Problem Statement, GitHub Repository, Deployed Application, Demo Video (placeholder), Tech Stack, Major Features.

Start now: confirm you've read GUIDELINES.md, summarize the plan in under 15 lines, then begin Phase 0.
