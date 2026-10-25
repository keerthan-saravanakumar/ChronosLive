# ChronosLive architecture

## Request and event paths

```text
React / Context / Router
  -> Axios with Bearer JWT -> Express route -> Zod validation + authorization
  -> thin controller -> service transaction -> Mongoose -> MongoDB replica set
                                                |
                                       outbox intent (same commit)
                                                |
                               leased worker -> Notification upsert
                                                |
                               authenticated Socket.io recipient/room
                                                |
                              client invalidates data -> REST refetch
```

Controllers translate HTTP input/output. Services contain policy, ownership, lifecycle and transaction logic. Models define persistence and indexes. The socket layer authenticates and delivers committed events; it is not an alternative booking API. Cloudinary is called by the upload service. Cron calls the same guarded transaction infrastructure. The React UI displays API data and never guesses seat counts after a local action.

## Data model

| Collection | Main fields and indexes |
|---|---|
| User | Unique normalized email, excluded passwordHash, role, isActive, authVersion, bookingRevision and scheduleRevision |
| Service | Organizer, details, cover URL, active flag, booking/cancellation policy and revision; text index on title/description |
| Slot | Immutable service/organizer/start/end, capacity, bookedCount, waitlistCount, status and version; service/start and organizer/start indexes |
| Booking | Slot/user/service, confirmed/cancelled/cancelled_by_organizer, direct/promotion source, cancellation fields and reminderSent; partial unique slot/user index for confirmed rows |
| WaitlistEntry | Slot/user, waiting/promoted/left/skipped/expired, skip reason and promotedAt; partial unique slot/user index for waiting rows; FIFO createdAt/_id index |
| Notification | Recipient, type, message, optional slot and read state; unique eventId/user and user/read/date indexes |
| OutboxEvent | Stable ID, kind, recipient/payload, attempts, lease token/until, next retry and processedAt; pending-delivery index |

Indexes are awaited before the API listens. Development uses `syncIndexes`; production uses additive `createIndexes`, which does not drop existing indexes. Duplicate historical data or conflicting index definitions fail startup rather than silently removing uniqueness protection.

## Invariants and serialization

MongoDB snapshot transactions alone do not prevent write-skew. Two transactions can read that a user has no conflicting booking and insert separate Booking documents. ChronosLive deliberately makes competing operations **write a common document before relying on that decision**. Updates increment a revision; they are real writes, not no-op assignments. A stale transaction gets a write conflict, and `withTransaction` retries the entire callback with a new snapshot. Only durable effects are produced within the callback; sockets and Cloudinary are never called inside a retried booking transaction.

| Invariant / competitor | Shared documents written | Additional enforcement |
|---|---|---|
| Slot seats and queue counts | Service.revision, Slot.version | Conditional `bookedCount < capacity` increment; guarded positive decrements; capacity decrease cannot undercut bookings |
| Duplicate confirmed booking / waiting entry | Slot and User guards | Partial unique indexes on slot/user with the active status |
| User booking limit across slots | Service guard and User.bookingRevision | Count upcoming confirmed bookings for that service after the guards |
| User time overlap across services | Same User.bookingRevision in every direct booking, cancellation and promotion | Half-open overlap check against other confirmed, unended sessions |
| Concurrent organizer creation across services | Organizer User.scheduleRevision (and actor User write) | Query all organizer non-cancelled intervals, check entire batch, then insert atomically |
| Policy/archive changes racing with bookings | Same Service.revision | Recheck current policy and active state inside the transaction |
| Account deactivation/logout racing with writes | Same User document; authVersion increments | Guarded actor validation; old tokens remain revoked after reactivation |
| Promotion vs direct booking, queue departure, capacity or cancellation | Same Service/Slot guards; candidate User guard | FIFO eligibility is rechecked before a conditional seat claim |
| Completion/reminder vs cancellation/promotion | Same Service/Slot guards | Conditional confirmed/reminderSent update and durable reminder intent in the same commit |

The usual write order is Service -> Slot -> involved Users. Creation/cancellation also writes the organizer schedule guard; promotion discovers and guards queue users dynamically. Contention can still abort a transaction. It is retried, never converted into an eligibility skip. Sorted user writes are used where a set is known beforehand. Coarse service serialization is an intentional, explainable trade-off for project-scale workloads.

`Slot` times and ownership are immutable; editing means changing capacity. This keeps the slot-to-service identity read in `guardSlot` safe before locking. All API writers, seed bookings and lifecycle jobs follow this protocol. Direct manual database writes are outside the supported mutation interface.

## Booking and promotion

1. Write the service/slot/user guards; require an active authenticated user, future open slot and allowed organizer relationship.
2. Reject an inactive service or duplicate reservation. Check the service's upcoming-booking limit and overlap across every service.
3. Claim capacity with a guarded atomic `$inc`; insert the Booking and remove any same-slot waiting entry consistently.
4. Enqueue notification and versioned slot/queue updates. Commit with snapshot reads and majority writes.

Cancellation changes a confirmed booking once, guards a positive decrement and runs promotion before committing. A repeat returns `ALREADY_CANCELLED` and does not decrement again. The owner obeys the cutoff; the owning organizer/admin can remove attendees regardless of cutoff. Individual removals use `cancelled`; whole-slot cancellation uses `cancelled_by_organizer`, expires waiting entries, resets both counters and notifies all affected users atomically.

Promotion picks the oldest `{createdAt: 1, _id: 1}` waiting row. It writes the candidate User guard and reuses eligibility checks. `TIME_CONFLICT`, `BOOKING_LIMIT_REACHED` and `INACTIVE_USER` are recorded as skip reasons, with a notification. It continues until an eligible person receives the seat or the queue is exhausted. Capacity growth permits up to the increase's number of promotions. A direct booking cannot take a freed seat midway through this transaction.

## Notifications, crashes and reconnects

The business transaction records OutboxEvent intent. After a successful commit, a worker claims pending events with an atomic lease token (30 seconds by default). Polling also runs every second, so delivery does not depend on the request process reaching its post-commit callback.

For a notification event the worker upserts Notification using a unique `{eventId, user}` pair, then emits `notification:new`. It never resets an existing notification's `read` flag. Other events keep the stable outbox ID in their payload. The worker acknowledges only its own lease token; a failed delivery backs off up to 60 seconds. A crash leaves the lease for a later worker to reclaim.

| Failure point | Recovery |
|---|---|
| Before business commit | All business changes and outbox rows roll back; nothing is delivered |
| After commit, before worker | Pending event remains in MongoDB |
| After notification upsert, before emit | Replay reuses the existing Notification; no duplicate row |
| After emit, before acknowledgement | Delivery may repeat with the same event ID |
| Client offline or reconnecting | REST notifications and current booking/slot queries recover database state |

This is **at-least-once event processing, not exactly-once Socket.io delivery**. Clients deduplicate promotion toasts using recent stable IDs, ignore older slot versions and fetch current data after events/reconnects. No optimistic counter arithmetic is used. Notification `reminderSent` means the reminder intent committed, not that a person saw it.

## Authentication, authorization and uploads

Passwords are hashed with bcrypt cost 12. JWTs expire after 15 minutes by default. Bearer tokens live in sessionStorage and AuthContext; the server uses the current User role, active flag and authVersion for every protected request. Logout revokes all sessions. Reactivating an account increments the version again and does not resurrect old tokens.

Sockets authenticate through `handshake.auth.token`, automatically join their user room, and may join validated existing slot/service IDs. They cannot subscribe to arbitrary user rooms. Private delivery checks current database authorization. Expiry timers, periodic revalidation, immediate local disconnect and a durable revocation event cover logout/deactivation and process restart. Public availability events contain no recipient identity. The supported host runs one socket process; horizontal fan-out would need an adapter that is intentionally outside scope.

Organizers can book another organizer's slots, subject to normal limits/cutoffs. They cannot book or waitlist their own. Only the owning organizer edits a service/slot or reads its private roster. Admins inspect/deactivate users and can remove bookings; they do not gain general organizer ownership.

Service archive hides discovery and blocks new slots/bookings/queue joins, while existing reservations and queues remain valid, including promotions. Account deactivation revokes access and future eligibility without silently cancelling bookings or archiving owned services. Inactive waiters are skipped when promotion evaluates them. Administrative accounts are protected from deactivation in the minimal admin interface.

Multer accepts one JPEG/PNG/WebP file up to 2 MiB, checks MIME and file signatures, and bounds fields. Cloudinary enforces allowed image formats, limits dimensions and has a request timeout. The upload happens outside the DB transaction; an authorization/commit failure triggers best-effort cleanup of the new asset. Older replaced images are not automatically garbage-collected. No successful provider upload is claimed without real credentials.

## Time and lifecycle

- Persist ISO instants in UTC. The browser displays ordinary session times in its local timezone; IST is the project default. Recurrence entry/preview and clock filters explicitly say IST (Asia/Kolkata).
- Recurrence `fromDate` and `toDate` are inclusive calendar dates; weekday numbering is Sunday 0 through Saturday 6. Windows must be same-day and divide exactly into complete 5–240 minute slots. Reject empty selections and batches over 200.
- Slots use `[start, end)`: overlap is `startA < endB && endA > startB`, so adjacent sessions are permitted. Existing non-cancelled slots of the same organizer are checked across services.
- Slot listing accepts an inclusive `from` instant and exclusive `to` instant; offset timestamps are compared as instants, not lexicographically. `timeFrom/timeTo` are inclusive/exclusive IST clocks filtering slot start times.
- Jobs run every five minutes and immediately after startup. Completion expires waiting entries and preserves confirmed historical bookings/counters. Reminders cover confirmed bookings starting in `(now, now + 60 minutes]` once.
- Booking, waitlist and available-only queries check time directly. Cron delay never makes a started slot bookable. Users can still view historical reservations.

## Security and operational boundaries

Zod strictly validates body/params/query and whitelists updates. IDs, durations, capacities and upload bounds are enforced server-side. Auth routes allow 10 attempts per 15 minutes/IP; general API traffic allows 300/minute/IP. Test mode disables those limits except the dedicated tests using production mode. CORS permits one configured origin. Render uses one trusted proxy hop.

Backend Helmet protects API responses. Frontend Vercel headers independently apply CSP, anti-framing, nosniff, referrer, permissions and HSTS policies. Script execution is restricted to self; inline styles support React/toast styles. Connect sources must be the exact configured backend HTTP/WebSocket origin. A deployment check rejects missing/mismatched configuration. HTTPS and a non-placeholder secret are required for the production server.

External provider account access, live WebSocket behavior, Cloudinary success and the final video remain separate verification tasks. See [deployment](DEPLOYMENT.md) and [verification](VERIFICATION.md).
