# REST and Socket.io API

Base URL: `http://localhost:4000/api` locally; the deployed Render origin plus `/api` in production. Send JSON unless an endpoint explicitly accepts multipart form data. Protected routes require `Authorization: Bearer <token>`. Public GET routes accept optional authentication for personal booking state; a supplied token must still be valid.

## Response format

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 12, "total": 24, "pages": 2 } }
```

`meta` is present on paginated lists; other responses contain only `success` and `data`.

```json
{ "success": false, "error": { "code": "SLOT_FULL", "message": "This slot has just filled up. Join the waitlist.", "details": { "canJoinWaitlist": true } } }
```

Errors use 400 for validation, 401 for authentication/revocation, 403 for ownership/role, 404 for missing resources, 409 for business conflicts, 413 for oversized JSON, 429 for throttling and 500 for unexpected errors. Upload provider failure/unavailability uses 502/503; database readiness failure uses 503. Production errors never include stack traces or credential values. Unrecognized body/query keys are rejected. Resource IDs must be 24-character hexadecimal ObjectIds.

Pagination defaults to `page=1&limit=12`; limit is 1–100. JSON bodies are limited to 32 KiB. Auth registration/login is limited to 10 requests per 15 minutes/IP; the general API limit is 300 requests per minute/IP. Test mode skips these limits except explicit production-mode tests.

## Authentication and accounts

| Method and route | Authorization | Input / result |
|---|---|---|
| `POST /auth/register` | Public | `{name,email,password,role?}` -> 201 `{user,token}`; role attendee (default) or organizer only |
| `POST /auth/login` | Public | `{email,password}` -> 200 `{user,token}` |
| `GET /auth/me` | Signed in | Current public User |
| `POST /auth/logout` | Signed in | Empty body; revoke every token for this user and disconnect sockets |
| `PATCH /users/me` | Signed in | JSON `{name?}` or multipart `name?` and one `avatar` file -> public User |
| `GET /admin/users` | Admin | `page,limit,search?` (name/email substring, max 100 chars) -> public users |
| `PATCH /admin/users/:id/status` | Admin | `{isActive:boolean}` -> updated user; admin accounts are protected |

Registration names are trimmed, 2–80 characters. Emails are normalized, unique and at most 254 characters. Passwords must be 8–72 characters and no more than 72 UTF-8 bytes. Password hashes, authVersion and guard counters are never part of public User responses. Deactivated users and revoked tokens receive 401. Reactivation requires a new login. No refresh-token endpoint exists.

## Services

| Method and route | Authorization | Input / result |
|---|---|---|
| `GET /services` | Public | `search?,category?,organizer?,page?,limit?`; active services only |
| `GET /services/:id` | Public | Service including organizer name/avatar; archived services remain addressable |
| `POST /services` | Organizer | Service fields below -> 201 service |
| `PATCH /services/:id` | Owning organizer | Whitelisted service fields/policy or `isActive`; at least one field |
| `DELETE /services/:id` | Owning organizer | Soft archive (`isActive=false`); returns service |
| `POST /services/:id/cover` | Owning organizer | Multipart with one `cover` file -> updated service |

Service fields: `title` (3–120 characters), `description` (10–3000), `category` (2–40), `location` (2–300) and optional `policy`. Policy supports `maxActiveBookingsPerUser` (integer 1–100, default 2) and `cancellationCutoffMinutes` (integer 0–10080, default 30). Text search covers title/description; category is an exact filter. Organizer is an ObjectId. Only an organizer listing their own ID may set `includeInactive=true`.

**Creation is `POST /services`**. The specification's combined `POST/PATCH/DELETE /services/:id` line was corrected for creation; no conflicting `POST /services/:id` contract was added.

Archive blocks discovery, new slots, direct bookings and queue joins. Existing reservations and queue promotions continue. Cancel individual slots to end those reservations.

## Slots

| Method and route | Authorization | Input / result |
|---|---|---|
| `GET /services/:id/slots` | Public | Filters below -> paginated slots, with `myBooking`/`myWaitlist` for a signed-in viewer |
| `GET /slots/:id` | Public | Populated service plus personal booking/waitlist state |
| `POST /services/:id/slots` | Owning organizer | `{startTime,endTime,capacity}` -> 201 slot |
| `POST /services/:id/slots/bulk` | Owning organizer | Recurrence below -> 201 `{count,slots}` |
| `PATCH /slots/:id` | Owning organizer | `{capacity}` -> updated slot; increases promote eligible waiters |
| `POST /slots/:id/cancel` | Owning organizer | `{reason?}` (max 300 characters) -> cancelled slot and atomic reservation/queue cascade |
| `GET /slots/:id/roster` | Owning organizer | `{slot,attendees,waitlist}` with participant name/email/avatar/activity and FIFO positions |

Single-slot instants must be ISO 8601 datetimes with `Z` or an explicit UTC offset. Start must be in the future; end must follow start by 5–240 minutes. Capacity is an integer 1–100. Start/end/service/organizer cannot be edited later. Adjacent intervals are allowed: `[start,end)` overlap detection checks all of the organizer's non-cancelled slots across services.

Listing filters:

| Query | Meaning |
|---|---|
| `from` | Inclusive ISO instant; defaults to now |
| `to` | Exclusive ISO instant; must be after from when both supplied |
| `timeFrom` | Inclusive IST `HH:mm` applied to slot start time |
| `timeTo` | Exclusive IST `HH:mm`; must follow timeFrom |
| `availableOnly` | Literal `true`/`false`; true requires future open slots with free seats |
| `page`, `limit` | Standard pagination |

The UI converts date-picker boundaries to ISO instants. Date filters follow the user's local calendar; the explicitly labelled time-of-day filters and recurrence windows use IST.

Bulk recurrence example (replace with future dates before running):

```json
{
  "daysOfWeek": [1, 3],
  "startTime": "15:00",
  "endTime": "17:00",
  "slotMinutes": 20,
  "capacity": 3,
  "fromDate": "2030-01-01",
  "toDate": "2030-01-28"
}
```

Sunday is 0 and Saturday 6. Weekdays must be unique. Date bounds are inclusive in Asia/Kolkata. Windows cannot cross midnight and must divide into complete intervals. Empty results and more than 200 generated slots are rejected. Every requested interval is checked before any commit.

**Any existing or internal overlap rejects the entire batch.** A 409 `SLOT_OVERLAP` contains `error.details.conflicts`, where each item has a zero-based `index`, `startTime`, `endTime` and either an existing `slotId` or an earlier batch `otherIndex`. There is no skipped-conflicts success result. Concurrent organizer creation is serialized through the organizer's User guard.

## Booking and waitlists

| Method and route | Authorization | Input / result |
|---|---|---|
| `POST /slots/:id/book` | Signed in, eligible | Empty body -> 201 Booking |
| `DELETE /bookings/:id` | Booking owner, slot's organizer or admin | `{reason?}` -> cancelled Booking; promotion is committed atomically |
| `GET /bookings/me` | Signed in | `status=upcoming` (default), `past` (started included), or `cancelled`; returns populated entries, not a paginated result |
| `POST /slots/:id/waitlist` | Signed in | Empty body -> 201 waiting entry plus computed `position` |
| `DELETE /slots/:id/waitlist` | Signed in, own entry | Empty body -> left entry |
| `GET /waitlist/me` | Signed in | Upcoming open waiting entries with populated slots/services and current positions |

Organizers may book other organizers' slots, but cannot book or waitlist their own. Direct booking checks an active user/service, a future open slot, duplicate booking, the per-service upcoming booking limit, overlap with confirmed unended bookings in any service, and capacity. Partial unique indexes remain a final database safeguard.

Waitlist joins require a genuinely full future open slot. Eligibility for eventual promotion is checked again when a seat opens. Promotion is FIFO, records skip reasons and updates all counters in the same transaction. Owners cannot cancel at or inside the cutoff; the owning organizer/admin bypasses it. A repeated cancellation returns 409 `ALREADY_CANCELLED` without changing counters again.

Common 409 codes: `SLOT_CLOSED`, `SLOT_IN_PAST`, `SLOT_FULL`, `ALREADY_BOOKED`, `BOOKING_LIMIT_REACHED`, `TIME_CONFLICT`, `ALREADY_ON_WAITLIST`, `SLOT_HAS_SEATS`, `NOT_ON_WAITLIST`, `CANCELLATION_WINDOW_CLOSED`, `CAPACITY_BELOW_BOOKED`, `SERVICE_INACTIVE`, `SLOT_OVERLAP`. Own-slot participation returns 403 `OWN_SLOT`. A cancelled slot changes all confirmed bookings to `cancelled_by_organizer` and waiting entries to `expired`; an individual removal uses `cancelled`.

## Notifications, statistics and health

| Method and route | Authorization | Result |
|---|---|---|
| `GET /notifications` | Signed in | Paginated own notifications, with additional `meta.unread` |
| `PATCH /notifications/:id/read` | Recipient | Mark one notification read, idempotently; someone else's ID returns 404 |
| `PATCH /notifications/read-all` | Signed in | Mark all own unread notifications read |
| `GET /organizer/stats` | Organizer | Owner-scoped aggregation metrics below |
| `GET /health` | Public | `{status:"ok"|"degraded",database:"connected"|"disconnected"|"connecting"|"disconnecting"}` |

Statistics include `upcomingSlots`, `totalSeats`, `bookedSeats`, `waitlistDemand`, `fillRate` (percent), `activeServices`, all-time `cancellations`/`promotions`, the next six `nextSlots`, and seven-day IST `daily` counts. Notifications are persisted asynchronously from a durable outbox; their read state survives reconnects and event retries.

The health route returns HTTP 200 only while MongoDB is connected. Otherwise it returns HTTP 503 with `success:false`, `error.code:"DATABASE_UNAVAILABLE"` and the diagnostic `data` connection state. Health responses use `Cache-Control: no-store` and are excluded from user request quotas so hosting probes remain reliable under load. Deployment checks verify both HTTP status and `data.status === "ok"` / `data.database === "connected"`.

## Upload contract

Only multipart `avatar` on `/users/me` and `cover` on `/services/:id/cover` are accepted. Use JPEG, PNG or WebP, one file, at most 2 MiB. MIME and signature validation run before Cloudinary. The server resizes to fit within 1200×1200, preserves hosted secure URLs and never returns Cloudinary credentials.

Errors: `IMAGE_REQUIRED`, `INVALID_IMAGE` or `INVALID_UPLOAD` (400), `UPLOAD_UNAVAILABLE` (503 when keys are absent), `UPLOAD_FAILED` (502 on provider failure/timeout). Profile name updates work without an image provider. Live upload verification is pending credentials.

## Socket.io

Connect to the API origin with `{auth:{token}}`. JWTs are never sent in URL query strings. Unauthorized handshakes fail with `error.data.code`. Automatic room: `user:<userId>`. Client subscriptions:

```js
socket.emit('room:join', { kind: 'service', id: serviceId }, acknowledgement);
socket.emit('room:leave', { kind: 'service', id: serviceId }, acknowledgement);
// kind can also be 'slot'. Arbitrary user room joins are rejected.
```

IDs must exist; subscription changes are limited to 60 per minute/socket. Acknowledgements use `{success:true}` or `{success:false,error:{code,message}}`.

| Event | Audience | Payload |
|---|---|---|
| `slot:updated` | Slot and service rooms | `slotId,serviceId,bookedCount,capacity,waitlistCount,status,version,eventId` |
| `waitlist:changed` | Slot and service rooms | `slotId,serviceId,version,eventId`; refetch own position |
| `slot:cancelled` | Slot and service rooms | `slotId,serviceId,version,eventId` |
| `notification:new` | Valid recipient sockets | `{notification,eventId}` |
| `booking:promoted` | Valid recipient sockets | `bookingId,slotId,eventId` |
| `session:ended` | Revoked/expired socket | `{code}` then disconnect |

Room events come from committed outbox rows. Delivery can be repeated, delayed or missed; clients must deduplicate toasts, refetch on reconnect and use REST/database state as authoritative. There is no event replay API or Socket.io booking mutation endpoint.

`POST /ai/slot-search` is intentionally not implemented because Phase 8 is deferred. Manual service/slot filters provide the complete core browsing workflow.
