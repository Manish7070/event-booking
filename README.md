# Eventra

Event discovery, ticket booking and operations in a React/Vite + Express/Mongoose workspace. Customer, organizer and admin routes share a validated API. Payments, uploads and email require operator-owned credentials; unavailable integrations never report simulated success.

## Local setup

Requires Node.js 22+, npm and a MongoDB replica set (Atlas works). Transactions cannot run on standalone MongoDB.

1. Run `npm ci` at the repository root.
2. Copy `server/.env.example` to `server/.env`, and `client/.env.example` to `client/.env`.
3. Set `MONGODB_URI` and a random `JWT_SECRET` of at least 32 characters. Use a separate random `JOB_SECRET`.
4. Run `npm run dev`. Client: http://localhost:5173; API: http://localhost:5000/api/v1; readiness: `/api/v1/health`.

Optional demo content requires an **empty development database**, `ALLOW_DEMO_SEED=true` and a unique `SEED_PASSWORD` of at least 10 characters, then `npm run db:seed`. Seed refuses production/populated databases and never deletes existing records. Demo accounts are `admin@eventra.com`, `organizer@eventra.com`, and `user@eventra.com`, using your supplied password. The sample events and articles are development fixtures.

For a production admin, register your own account, verify its email, and have a trusted database operator set that specific user's role to ADMIN. Public registration cannot create admins.

## Structure

- `client/src/pages`: marketplace, authentication, customer account, management, eight-step event wizard and QR scanner.
- `client/src/routes`: lazy-loaded routes and role navigation guards. Backend authorization is authoritative.
- `server/src/routes`: validated endpoints with role/ownership checks.
- `server/src/services`: transactional bookings, payment verification, refunds, balance calculations and notifications.
- `server/src/models`: schemas for inventory, individual tickets, orders, payments, refunds, payouts and email outbox.
- `server/src/jobs/maintenance.ts`: reservation reconciliation, expiry, reminders and email delivery.
- `server/tests/workflows.test.ts`: isolated replica-set integration tests with mocked provider HTTP calls.

## Payments and tickets

The API calculates stored ticket prices, discounts, taxes and fees using integer paise calculations. Checkout reserves stock for 15 minutes with a customer-scoped idempotency key. Retry an identical request with its same key; changed requests require a new key.

Paid tickets are issued only after checking the signature and fetching a captured Razorpay payment matching the order, amount and INR currency. Repeated callbacks cannot issue duplicate tickets. Zero-value bookings confirm without Razorpay. Each ticket has its own random QR token; scanners enforce organizer ownership, entry time, payment state and one successful check-in.

Configure Razorpay keys and webhook secret. Point signed `payment.captured` webhooks to `https://YOUR_API/api/v1/payments/webhook`. Test/live credentials differ; complete a sandbox purchase before enabling live payments. Checkout supplies the public key to the browser.

Refund requests require unused paid tickets and at least 24 hours before the event, except cancelled events. Admins review requests; completion requires a processed provider refund. Ambiguous provider responses require reconciliation rather than blind resubmission.

Payout eligibility excludes unsettled events (seven-day window), refunds and allocated payouts. An operator initiates the transfer in RazorpayX; the admin endpoint verifies a processed provider payout with matching amount/currency and `notes.eventraPayout` before completing it. Automatic bank-transfer initiation is not implemented.

## Email, uploads and jobs

Configure SMTP `EMAIL_*` values for verification, password reset and notification delivery. Configure Cloudinary `CLOUDINARY_*` values for multipart image uploads, limited to 5 MB with MIME and file-signature checks.

Schedule a trusted worker to POST `/api/v1/jobs/run` every minute with `Authorization: Bearer YOUR_JOB_SECRET`. No scheduler starts automatically. Keep secrets out of browser code and avoid overlapping job invocations. The job reconciles captured payments before releasing expired reservations, expires tickets/coupons, queues reminders and delivers email with bounded retries. Monitor failed jobs and email records.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests create and stop an isolated MongoDB 7 replica set; the first run may download its binary. Provider HTTP calls are mocked. Tests do not access Atlas, send real messages or take payments. Coverage includes authorization, moderation, quantity/coupon validation, idempotency, payment checks, inventory contention, tickets, scans, reviews and payout limits. Live-provider acceptance testing is separate.

## Deployment

Deploy the frontend as a static Vite build and the API as a persistent Node service. Root `vercel.json` builds only the frontend with SPA routing, not Express serverless functions.

- Frontend: install `npm ci`, build `npm run build:client`, output `client/dist`. Set `VITE_API_URL=https://YOUR_API/api/v1` before building.
- API: install/build `npm ci && npm run build:server`; start `npm run start --workspace server`.
- Set `NODE_ENV=production`, Atlas `MONGODB_URI`, exact frontend `CLIENT_URL`, unique JWT/job secrets and integration credentials. Set `TRUST_PROXY` to the actual trusted reverse-proxy hop count.
- Run `npm run db:indexes --workspace server` as a controlled release step. Production disables automatic indexes. This command creates declared indexes without dropping indexes/data. Investigate conflicting indexes or duplicate data explicitly before release.
- Configure HTTPS, Atlas access restrictions, backups, monitoring, webhooks and the scheduler. Verify health and a sandbox purchase/refund/check-in.

## Remaining acceptance work and limitations

This implementation is not certified production-ready. Real SMTP, Cloudinary, Razorpay and deployment acceptance tests require your environments. A captured payment after reservation release or event cancellation needs operator reconciliation/refund; no replacement ticket is fabricated. Monitor these errors and webhook retries.

Authentication uses expiring bearer tokens in local storage; logout/password changes revoke sessions through token versions. Cookie-based sessions and a stricter content-security policy remain deployment decisions. Payout details are stored in MongoDB; configure access controls and storage encryption. Generic legal pages need your actual business policies and legal review.

Draft autosave currently requires a complete valid event. Online events still use a venue record. Search uses database filters rather than geospatial recommendations or an external search service. Browser/device acceptance, accessibility and workload testing remain required before launch.
