# Eventra — REST API Endpoint Specification

## Base URL
`/api/v1`

## Authentication
Headers: `Authorization: Bearer <JWT_TOKEN>`

### Endpoints Summary
- `POST /auth/register` — Register User or Organizer
- `POST /auth/login` — Sign in and retrieve JWT token
- `GET /auth/me` — Fetch active profile & role info
- `GET /events` — Public event discovery with category, city, date, price filters
- `GET /events/:slug` — Event details & ticket types
- `POST /events` — Create new event (Organizer/Admin)
- `POST /bookings/checkout` — Initialize booking & Razorpay order
- `POST /bookings/verify-payment` — Cryptographic signature check & ticket generation
- `POST /checkin/scan-qr` — Organizer check-in scanner
- `GET /admin/stats` — System administration statistics
- `POST /newsletter/subscribe` — Persist newsletter subscriber
