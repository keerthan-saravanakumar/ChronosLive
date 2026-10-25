# Demo recording script (about 4½ minutes)

Record the final working application after deployment smoke tests. Until then, label any rehearsal as **local**. Show the product, not a slide deck of promised features. Keep credentials, provider dashboards, tokens and connection strings out of the recording.

## Prepare

- Open organizer, attendee A and attendee B in separate browser sessions. Use a future slot far enough beyond its cancellation cutoff.
- Prepare a capacity-1 slot with an empty queue and another full slot suitable for demonstrating a capacity increase. Ensure attendee B has no overlapping reservation or exhausted booking limit.
- Keep a terminal ready at the repository root to run the concurrency test. Keep README, GitHub Actions and the final live URL ready.
- Choose a new non-overlapping recurring window. Do not overwrite or delete existing demonstrations as a shortcut.

## 0:00–0:30 — Problem and users

“ChronosLive helps college office hours, labs and consultation sessions manage limited seats. Attendees reserve a time, organizers publish schedules, and a fair waitlist fills cancellations automatically. The hard part is keeping those decisions correct when people act together.”

Show the landing page and browse services.

## 0:30–1:15 — Organizer workflow

Create a service, then use recurring slots. Point out the IST label, date bounds and count preview. Publish the batch. Submit it again once to show `SLOT_OVERLAP` with concrete conflicts; show the session list did not grow. Explain that bulk creation is all-or-nothing.

## 1:15–2:30 — The core live workflow

Show two attendee windows side by side on the same capacity-1 slot. Attendee A books the final seat; B's availability refreshes to full. B joins the waitlist and sees #1. A confirms cancellation. B receives a live promotion toast, a confirmed booking and an in-app notification. Show the organizer roster and counts agree.

“The cancellation and promotion happen in one guarded transaction. The notification is durable even if the server restarts after the booking commits.”

## 2:30–3:15 — Real failures and permissions

- Show a conflicting-time or per-service-limit error using an eligible prepared case.
- Show the cancellation-cutoff error on a separate near-start session, without changing the system clock.
- Demonstrate an attendee being denied an organizer route or another organizer being denied a private roster. If using an HTTP client for a duplicate request, keep its Authorization header concealed and show only the response.

Do not misrepresent disabled UI buttons as server-side tests; the automated suite demonstrates duplicate HTTP request handling.

## 3:15–3:45 — Concurrency evidence

Run:

```sh
npm test --workspace server -- --runTestsByPath tests/booking.test.js -t "20 parallel users"
```

Explain the actual assertion: twenty requests through independent app instances, five successes, fifteen `SLOT_FULL` responses, and exactly five confirmed database rows. Mention the shared User guard prevents cross-slot write-skew; transactions alone are insufficient.

## 3:45–4:15 — Capacity and recovery

Increase capacity on a prepared full slot and show the oldest eligible waiters appear in the roster. Try a decrease below confirmed seats to show rejection. Mark a notification read and reload; it stays read. Briefly point to the Live/Reconnecting indicator and explain that reconnects fetch database state.

Skip Gemini: it is deferred and not advertised as working.

## 4:15–4:30 — Close

Show the actual live application URL and repository. Mention the complete five workflows, tested concurrency and known free-host cold starts. Link the final accessible video from README and SUBMISSION after recording.

## Recording completion

- [ ] Every demonstration was performed against the stated environment.
- [ ] No secret or private credential is visible.
- [ ] Video is approximately 3–5 minutes and shows outcomes clearly.
- [ ] The link opens in a private browser without a permission request.
- [ ] README and submission block contain that verified link.
