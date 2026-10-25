# Verification evidence

Local verification date: 25 October 2026. Node v24.13.0, Jest/Supertest and MongoMemoryReplSet 7.0.24. Results below describe executed checks, not intended outcomes.

## Automated checks

| Check | Result |
|---|---|
| Complete backend regression suite | 45/45 passed across 7 suites after jobs/index/slot-event changes |
| Additional production-security suite | 3/3 passed: CORS/Helmet, auth throttle, safe validation/body-size errors |
| GitHub Actions on published implementation `26f045a` | [Run 40211895050](https://github.com/keerthan-saravanakumar/ChronosLive/actions/runs/40211895050) passed: 48 tests across 8 suites, frontend build and credential scan |
| Production Vite build | Passed after organizer layout and authentication UI fixes |
| Dependency audit | 0 vulnerabilities across installed dependencies |
| Credential-pattern scan | Passed for 162 historical text blobs and non-ignored working files in the published CI run |
| Vercel configuration rejection check | An insecure localhost production API configuration was rejected as expected |
| Local persistent restart | API connected; existing seed preserved; 0 duplicate services created |
| Production-mode startup smoke | Real local replica set, separate smoke database: health connected and required partial unique indexes present before accepting requests; process then closed |

An initial sandboxed test attempt could not download MongoDB. It was rerun with permitted network/process access and passed. The first credential scan flagged empty example variables because whitespace parsing crossed line breaks; the parser was corrected and the scan passed. These failures were diagnosed; they are not recorded as successful test runs.

## Concurrency and recovery evidence

| Scenario | Assertions |
|---|---|
| 20 users / capacity 5 | Exactly 5 × 201 and 15 × 409 SLOT_FULL; 5 confirmed rows and counter 5, through independent app instances |
| 5 duplicate requests | Exactly one confirmed booking |
| Cross-slot limit and overlap | Same-user races cannot exceed a service limit or commit overlapping reservations across services |
| Forced guard contention | MongoDB command barriers hold a conflicting write so fresh-snapshot behavior is tested deliberately |
| Organizer cross-service creation | One overlapping creation wins; strict bulk rollback leaves no partial batch |
| Cancellation, direct booking and promotion | No free-seat bypass of an eligible waiter; double cancellation changes counters once |
| Concurrent promotions | A user cannot be promoted into overlapping slots; skips contain eligibility reasons |
| Lifecycle/permissions | Cutoff, own-slot restriction, archive semantics, slot cascade and roster/ownership checks |
| Outbox process crashes | Before/after materialization and after emit boundaries recover one Notification; repeat processing preserves read state |
| Sockets | Private recipient filtering, validated rooms, invalid token rejection, logout and expiry |
| Concurrent reminders/completion | One reminder intent/notification; one completion; cancellation guard race rechecks committed booking state |
| Cron not running | Started slots still reject bookings/waitlists and do not appear as available |

Tests are in `server/tests`. They exercise real MongoDB transactions rather than replacing the booking service with mocks. A passing suite supports the implemented guard protocol; it does not imply unbounded throughput or distributed Socket.io support.

## Browser checks

Chrome exercised actual local API data:

- Attendee registration, booking, confirmed cancellation, waitlist join/position/leave, My Bookings and mobile browse were verified in Phase 5.
- Organizer login/dashboard statistics, service creation and a 12-slot recurring batch worked. Repeating the batch showed specific overlap details and still exactly 12 roster links.
- Capacity changed from 2 to 4 on a seeded full slot. Both waiters were promoted; the roster had four confirmed attendees and zero waiting. A separate attendee session displayed the new booking and live promotion toast.
- Notification mark-all-read persisted, profile save succeeded and the admin account list loaded with protected-admin controls.
- Short-screen sidebar overflow initially hid sign-out. Scrolling/height behavior was fixed and sign-out completed through the UI. Form-control accessible names were corrected during testing.
- The attendee browser session reported no console errors during the final notification/profile checks. An earlier organizer request hit a stale pre-Phase-6 API process; the API was restarted and the current dashboard verified.
- Phase 5 mobile browse was verified at 390×844 without horizontal overflow. Final profile, organizer roster and recurring-slot forms also fit a 390px viewport (document width 375px with the scrollbar). Table scrolling stays inside its container. The fresh organizer session had no console errors. Temporary viewport overrides were reset.

Screenshots are in [screenshots](screenshots/), including the live promotion, roster and bulk-conflict evidence. They are local demonstration data, not proof of a production deployment.

## External verification still required

- [x] Published implementation `26f045a` passes GitHub Actions. Verify the latest deployment commit again before submission.
- [ ] Atlas is configured and deployed API health reports connected.
- [ ] Vercel frontend connects to that API with correct CSP/CORS and secure WebSockets.
- [ ] All five workflows pass on deployed URLs using two browsers.
- [ ] A valid avatar and cover upload succeed against Cloudinary.
- [ ] Final live links work in private/incognito windows.
- [ ] Demo video is recorded and accessible; official submission form is completed.
