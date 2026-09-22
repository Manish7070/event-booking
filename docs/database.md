# Eventra — MongoDB Schema & Data Models

## Primary Entities
1. `User`: Account record with role enum (`USER`, `ORGANIZER`, `ADMIN`), hashed password, and preferences.
2. `OrganizerProfile`: Organization bio, social handles, payout bank details, rating metrics.
3. `Category`: Event category taxonomy with slug index, icon name, and color tokens.
4. `Venue`: Physical venue with address, city index, capacity, and amenities.
5. `Event`: Core event entity with slug, status, dates, tags, and category/venue references.
6. `TicketType`: Pricing tier, total quantity, and sold quantity.
7. `Booking`: Financial transaction, ticket selection, payment order ID, and QR payload hash.
8. `Ticket`: Individual ticket pass with unique `ticketNumber` and `qrVerificationId`.
9. `CheckIn`: Log of attendee venue entry with timestamp and organizer ID.
10. `Wishlist`: Saved events with compound unique index on `(user, event)`.
11. `Review`: Verified purchase reviews with rating and content.
12. `Coupon`: Discount codes with limits and expiration dates.
13. `NewsletterSubscriber`: Newsletter subscription record with unique email.
14. `Refund`: Refund requests and approval status tracking.
15. `AuditLog`: Security audit trail for admin actions.
