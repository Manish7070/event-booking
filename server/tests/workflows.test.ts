import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import nock from "nock";

let replica: MongoMemoryReplSet;
let app: any;
let models: any;
let customer: any, organizer: any, outsider: any, adminUser: any;
let customerToken: string,
  organizerToken: string,
  outsiderToken: string,
  adminToken: string;
let event: any, tier: any, coupon: any;
let booking: any;
const gatewaySecret = "test-only-provider-secret-not-for-production";
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
let gatewayCounter = 0;
const mockOrder = () => {
  const orderId = `order_test_${++gatewayCounter}`;
  nock("https://api.razorpay.com")
    .post("/v1/orders")
    .reply(200, (_uri, body: any) => ({
      id: orderId,
      amount: body.amount,
      currency: "INR",
      status: "created",
    }));
  return orderId;
};
const mockPayment = (orderId: string, paymentId: string, amount: number) =>
  nock("https://api.razorpay.com").get(`/v1/payments/${paymentId}`).reply(200, {
    id: paymentId,
    order_id: orderId,
    amount,
    currency: "INR",
    status: "captured",
  });
const signature = (orderId: string, paymentId: string) =>
  crypto
    .createHmac("sha256", gatewaySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.RAZORPAY_KEY_ID = "rzp_test_automated";
  process.env.RAZORPAY_KEY_SECRET = gatewaySecret;
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.EMAIL_HOST = "";
  process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(
    "../node_modules/.cache/mongodb-memory-server",
  );
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.24" },
  });
  process.env.MONGODB_URI = replica.getUri("eventra_isolated_tests");
  app = (await import("../src/app.js")).default;
  const { connectDB } = await import("../src/config/database.js");
  await connectDB();
  const { User } = await import("../src/models/User.js");
  const { OrganizerProfile } =
    await import("../src/models/OrganizerProfile.js");
  const { Category } = await import("../src/models/Category.js");
  const { Venue } = await import("../src/models/Venue.js");
  const { Event } = await import("../src/models/Event.js");
  const { TicketType } = await import("../src/models/TicketType.js");
  const { Booking } = await import("../src/models/Booking.js");
  const { Ticket } = await import("../src/models/Ticket.js");
  const { Coupon } = await import("../src/models/Coupon.js");
  const { Payment } = await import("../src/models/Payment.js");
  const { Notification } = await import("../src/models/Notification.js");
  const { Payout } = await import("../src/models/Payout.js");
  const { Refund } = await import("../src/models/Refund.js");
  models = {
    User,
    OrganizerProfile,
    Category,
    Venue,
    Event,
    TicketType,
    Booking,
    Ticket,
    Coupon,
    Payment,
    Notification,
    Payout,
    Refund,
  };
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  const register = async (name: string, role = "USER") => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name,
        email: `${name.toLowerCase()}@example.test`,
        password: "StrongTest123!",
        role,
        ...(role === "ORGANIZER" ? { organizationName: `${name} Events` } : {}),
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    await User.updateOne({ _id: res.body.data.user._id }, { isVerified: true });
    return res.body.data;
  };
  ({ user: customer, token: customerToken } = await register("Customer"));
  ({ user: organizer, token: organizerToken } = await register(
    "Organizer",
    "ORGANIZER",
  ));
  ({ user: outsider, token: outsiderToken } = await register(
    "Outsider",
    "ORGANIZER",
  ));
  const admin = await register("Admin");
  adminUser = admin.user;
  adminToken = admin.token;
  await User.updateOne({ _id: adminUser._id }, { role: "ADMIN" });
  await OrganizerProfile.updateMany(
    {},
    {
      status: "APPROVED",
      payoutDetails: {
        accountNumber: "1234567890",
        accountHolderName: "Test",
        bankName: "Test Bank",
        ifscCode: "TEST0000001",
      },
    },
  );
  const category = await Category.create({
    name: "Music",
    slug: "music-concerts",
  });
  const venue = await Venue.create({
    name: "Test venue",
    slug: "test-venue",
    address: "Test address",
    city: "Delhi",
    capacity: 100,
  });
  event = await Event.create({
    title: "Test live event",
    slug: "test-live-event",
    shortDescription: "A test experience",
    description: "An isolated integration test event.",
    category: category._id,
    venue: venue._id,
    organizer: organizer._id,
    city: "Delhi",
    coverImage: "https://example.test/event.jpg",
    startDate: new Date(Date.now() + 3600000),
    endDate: new Date(Date.now() + 7200000),
    status: "PUBLISHED",
    totalTickets: 5,
    minPrice: 100,
    maxPrice: 100,
  });
  tier = await TicketType.create({
    event: event._id,
    name: "General",
    price: 100,
    totalQuantity: 5,
    maxPerBooking: 5,
  });
  coupon = await Coupon.create({
    code: "TEST10",
    name: "Test coupon",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minimumOrder: 100,
    perUserLimit: 1,
    usageLimit: 10,
    expiryDate: new Date(Date.now() + 86400000),
  });
  nock.disableNetConnect();
  nock.enableNetConnect(/127\.0\.0\.1|localhost/);
});
after(async () => {
  nock.cleanAll();
  nock.enableNetConnect();
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

test("auth hides password and rejects weak passwords and role escalation", async () => {
  assert.equal(customer.password, undefined);
  assert.equal(customer.id, customer._id);
  const invalid = await request(app).post("/api/v1/auth/register").send({
    name: "Bad",
    email: "bad@example.test",
    password: "123",
    role: "ADMIN",
  });
  assert.equal(invalid.status, 400);
  assert.equal(
    (await request(app).get("/api/v1/admin/stats").set(bearer(customerToken)))
      .status,
    403,
  );
  assert.equal((await request(app).get("/api/v1/tickets")).status, 401);
});
test("public category slug filtering works and private events stay private", async () => {
  const response = await request(app).get(
    "/api/v1/events?category=music-concerts",
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.data.events.length, 1);
  const hidden = await models.Event.create({
    ...event.toObject(),
    _id: new mongoose.Types.ObjectId(),
    slug: "draft-event",
    status: "DRAFT",
  });
  const all = await request(app).get("/api/v1/events?status=ALL");
  assert.equal(
    all.body.data.events.some((e: any) => e._id === hidden._id.toString()),
    false,
  );
  assert.equal(
    (await request(app).get("/api/v1/events/draft-event")).status,
    404,
  );
});
test("event creation, moderation and update ownership are enforced", async () => {
  const payload = {
    title: "Created event",
    shortDescription: "Created by organizer",
    description: "A sufficiently detailed test event description.",
    category: event.category.toString(),
    venue: event.venue.toString(),
    coverImage: "https://example.test/event.jpg",
    startDate: new Date(Date.now() + 86400000).toISOString(),
    endDate: new Date(Date.now() + 90000000).toISOString(),
    tickets: [
      { name: "Entry", price: 100, totalQuantity: 10, maxPerBooking: 2 },
    ],
    status: "DRAFT",
  };
  const created = await request(app)
    .post("/api/v1/events")
    .set(bearer(organizerToken))
    .send(payload);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const eid = created.body.data.event._id;
  assert.equal(
    (
      await request(app)
        .put(`/api/v1/events/${eid}`)
        .set(bearer(outsiderToken))
        .send(payload)
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .put(`/api/v1/events/${eid}`)
        .set(bearer(organizerToken))
        .send({ ...payload, status: "PUBLISHED" })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post(`/api/v1/events/${eid}/submit`)
        .set(bearer(organizerToken))
    ).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .put(`/api/v1/admin/events/${eid}/moderate`)
        .set(bearer(adminToken))
        .send({
          status: "PUBLISHED",
          reason: "Reviewed venue, dates and ticket capacity",
        })
    ).status,
    200,
  );
});
test("checkout validates quantity, duplicates and coupon rules server-side", async () => {
  const cart = {
    eventId: event._id.toString(),
    items: [{ ticketTypeId: tier._id.toString(), quantity: 1 }],
  };
  assert.equal(
    (
      await request(app)
        .post("/api/v1/bookings/quote")
        .set(bearer(customerToken))
        .send({
          ...cart,
          items: [{ ticketTypeId: tier._id.toString(), quantity: 0.5 }],
        })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/v1/bookings/quote")
        .set(bearer(customerToken))
        .send({ ...cart, items: [...cart.items, ...cart.items] })
    ).status,
    400,
  );
  const quote = await request(app)
    .post("/api/v1/bookings/quote")
    .set(bearer(customerToken))
    .send({ ...cart, couponCode: coupon.code });
  assert.equal(quote.status, 200);
  assert.equal(quote.body.data.discount, 10);
  assert.equal(quote.body.data.total, 108.2);
  await models.Coupon.updateOne(
    { _id: coupon._id },
    { expiryDate: new Date(0) },
  );
  assert.equal(
    (
      await request(app)
        .post("/api/v1/bookings/quote")
        .set(bearer(customerToken))
        .send({ ...cart, couponCode: coupon.code })
    ).status,
    400,
  );
});
test("booking reserves stock, handles idempotent retry and creates no premature tickets", async () => {
  const orderId = mockOrder();
  const input = {
    eventId: event._id.toString(),
    items: [{ ticketTypeId: tier._id.toString(), quantity: 2 }],
    attendeeName: "Customer",
    attendeeEmail: "customer@example.test",
    attendeePhone: "9876543210",
    idempotencyKey: crypto.randomUUID(),
  };
  const res = await request(app)
    .post("/api/v1/bookings/checkout")
    .set(bearer(customerToken))
    .send(input);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.razorpayOrderId, orderId);
  booking = await models.Booking.findOne({
    bookingId: res.body.data.bookingId,
  });
  const retry = await request(app)
    .post("/api/v1/bookings/checkout")
    .set(bearer(customerToken))
    .send(input);
  assert.equal(retry.status, 201);
  assert.equal(retry.body.data.bookingId, booking.bookingId);
  assert.equal(
    (await models.TicketType.findById(tier._id)).reservedQuantity,
    2,
  );
  assert.equal(await models.Ticket.countDocuments({ booking: booking._id }), 0);
});
test("verification requires signature, ownership, correct amount and captured status", async () => {
  const payload = {
    bookingId: booking.bookingId,
    razorpayOrderId: booking.paymentOrderId,
    razorpayPaymentId: "pay_valid",
  };
  assert.equal(
    (
      await request(app)
        .post("/api/v1/bookings/verify-payment")
        .set(bearer(customerToken))
        .send(payload)
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/v1/bookings/verify-payment")
        .set(bearer(outsiderToken))
        .send({
          ...payload,
          razorpaySignature: signature(booking.paymentOrderId, "pay_valid"),
        })
    ).status,
    404,
  );
  mockPayment(booking.paymentOrderId, "pay_valid", 1);
  assert.equal(
    (
      await request(app)
        .post("/api/v1/bookings/verify-payment")
        .set(bearer(customerToken))
        .send({
          ...payload,
          razorpaySignature: signature(booking.paymentOrderId, "pay_valid"),
        })
    ).status,
    409,
  );
});
test("payment confirmation is idempotent and tickets have individual tokens", async () => {
  const payload = {
    bookingId: booking.bookingId,
    razorpayOrderId: booking.paymentOrderId,
    razorpayPaymentId: "pay_valid",
    razorpaySignature: signature(booking.paymentOrderId, "pay_valid"),
  };
  for (let i = 0; i < 2; i++) {
    mockPayment(
      booking.paymentOrderId,
      "pay_valid",
      Math.round(booking.total * 100),
    );
    const res = await request(app)
      .post("/api/v1/bookings/verify-payment")
      .set(bearer(customerToken))
      .send(payload);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }
  const tickets = await models.Ticket.find({ booking: booking._id });
  assert.equal(tickets.length, 2);
  assert.equal(new Set(tickets.map((t: any) => t.qrVerificationId)).size, 2);
  assert.equal(
    await models.Payment.countDocuments({ booking: booking._id }),
    1,
  );
  assert.equal((await models.TicketType.findById(tier._id)).soldQuantity, 2);
  const myTickets = await request(app)
    .get("/api/v1/tickets")
    .set(bearer(customerToken));
  assert.equal(myTickets.body.data.tickets.length, 2);
  const otherTickets = await request(app)
    .get("/api/v1/tickets")
    .set(bearer(outsiderToken));
  assert.equal(otherTickets.body.data.tickets.length, 0);
});
test("concurrent last-ticket checkouts cannot oversell", async () => {
  const limited = await models.TicketType.create({
    event: event._id,
    name: "Last seat",
    price: 150,
    totalQuantity: 1,
    maxPerBooking: 1,
  });
  mockOrder();
  const input = {
    eventId: event._id.toString(),
    items: [{ ticketTypeId: limited._id.toString(), quantity: 1 }],
    attendeeName: "Test buyer",
    attendeeEmail: "buyer@example.test",
    attendeePhone: "9876543210",
  };
  const results = await Promise.all(
    [customerToken, outsiderToken].map((token) =>
      request(app)
        .post("/api/v1/bookings/checkout")
        .set(bearer(token))
        .send({ ...input, idempotencyKey: crypto.randomUUID() }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await models.TicketType.findById(limited._id)).reservedQuantity,
    1,
  );
});
test("check-in validates organizer ownership and rejects duplicate concurrent scans", async () => {
  const ticket = await models.Ticket.findOne({ booking: booking._id });
  const input = {
    eventId: event._id.toString(),
    ticketId: ticket.qrVerificationId,
  };
  assert.equal(
    (
      await request(app)
        .post("/api/v1/checkin/scan-qr")
        .set(bearer(outsiderToken))
        .send(input)
    ).status,
    403,
  );
  const results = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post("/api/v1/checkin/scan-qr")
        .set(bearer(organizerToken))
        .send(input),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await models.Booking.findById(booking._id)).checkedIn, false);
});
test("reviews require attendance and preserve unique user-event review", async () => {
  const input = {
    eventId: event._id.toString(),
    rating: 5,
    title: "Great experience",
    content: "A meaningful test review from an attended event.",
  };
  assert.equal(
    (
      await request(app)
        .post("/api/v1/reviews")
        .set(bearer(outsiderToken))
        .send(input)
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/v1/reviews")
        .set(bearer(customerToken))
        .send(input)
    ).status,
    201,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/v1/reviews")
        .set(bearer(customerToken))
        .send(input)
    ).status,
    409,
  );
});
test("refund rejects used tickets; unauthorized notification changes do not persist", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/v1/refunds/request")
        .set(bearer(customerToken))
        .send({
          bookingId: booking._id.toString(),
          reason: "Request refund on attended booking",
        })
    ).status,
    409,
  );
  const notification = await models.Notification.findOne({
    user: customer._id,
  });
  await request(app)
    .put(`/api/v1/notifications/${notification._id}/read`)
    .set(bearer(outsiderToken));
  assert.equal(
    (await models.Notification.findById(notification._id)).read,
    false,
  );
});
test("payout cannot exceed real settled balance", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/v1/organizers/payouts/request")
        .set(bearer(organizerToken))
        .send({ amount: 9999 })
    ).status,
    409,
  );
});
test("free checkout confirms unique tickets without a provider call and retries safely", async () => {
  const freeTier = await models.TicketType.create({
    event: event._id,
    name: "Free entry",
    price: 0,
    totalQuantity: 2,
    maxPerBooking: 2,
  });
  const payload = {
    eventId: event._id.toString(),
    items: [{ ticketTypeId: freeTier._id.toString(), quantity: 2 }],
    attendeeName: "Free Attendee",
    attendeeEmail: "free@example.test",
    attendeePhone: "9999999999",
    idempotencyKey: crypto.randomUUID(),
  };
  const first = await request(app)
    .post("/api/v1/bookings/checkout")
    .set(bearer(customerToken))
    .send(payload);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.data.confirmed, true);
  assert.equal(first.body.data.amount, 0);
  const retry = await request(app)
    .post("/api/v1/bookings/checkout")
    .set(bearer(customerToken))
    .send(payload);
  assert.equal(retry.status, 201);
  assert.equal(retry.body.data.bookingId, first.body.data.bookingId);
  const saved = await models.Booking.findOne({
    bookingId: first.body.data.bookingId,
  });
  assert.equal(await models.Ticket.countDocuments({ booking: saved._id }), 2);
  assert.equal(
    (await models.TicketType.findById(freeTier._id)).reservedQuantity,
    0,
  );
  assert.equal(
    (await models.Payment.findOne({ booking: saved._id })).gateway,
    "free",
  );
});
test("refund blocks entry and requires processed provider confirmation before cancelling tickets", async () => {
  const refundEvent = await models.Event.create({
    ...event.toObject(),
    _id: undefined,
    slug: "refundable-event",
    soldTickets: 0,
    startDate: new Date(Date.now() + 3 * 86400000),
    endDate: new Date(Date.now() + 4 * 86400000),
  });
  const refundTier = await models.TicketType.create({
    event: refundEvent._id,
    name: "Refundable",
    price: 100,
    totalQuantity: 2,
    maxPerBooking: 2,
  });
  const orderId = mockOrder();
  const order = await request(app)
    .post("/api/v1/bookings/checkout")
    .set(bearer(customerToken))
    .send({
      eventId: refundEvent._id.toString(),
      items: [{ ticketTypeId: refundTier._id.toString(), quantity: 1 }],
      attendeeName: "Refund Customer",
      attendeeEmail: "refund@example.test",
      attendeePhone: "9999999999",
      idempotencyKey: crypto.randomUUID(),
    });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  mockPayment(orderId, "pay_refundable", 12000);
  const confirmed = await request(app)
    .post("/api/v1/bookings/verify-payment")
    .set(bearer(customerToken))
    .send({
      bookingId: order.body.data.bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: "pay_refundable",
      razorpaySignature: signature(orderId, "pay_refundable"),
    });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  const saved = await models.Booking.findOne({
    bookingId: order.body.data.bookingId,
  });
  const requested = await request(app)
    .post("/api/v1/refunds/request")
    .set(bearer(customerToken))
    .send({
      bookingId: saved._id.toString(),
      reason: "Unable to attend this event",
    });
  assert.equal(requested.status, 201, JSON.stringify(requested.body));
  const refund = requested.body.data.refund;
  await models.Event.updateOne(
    { _id: refundEvent._id },
    { startDate: new Date(Date.now() + 3600000) },
  );
  const ticket = await models.Ticket.findOne({ booking: saved._id });
  const scan = await request(app)
    .post("/api/v1/checkin/scan-qr")
    .set(bearer(organizerToken))
    .send({
      eventId: refundEvent._id.toString(),
      ticketId: ticket.qrVerificationId,
    });
  assert.equal(scan.status, 409);
  assert.match(scan.body.message, /refund/);
  assert.equal(
    (
      await request(app)
        .put(`/api/v1/admin/refunds/${refund._id}/status`)
        .set(bearer(adminToken))
        .send({ status: "APPROVED", notes: "Eligible unused booking" })
    ).status,
    200,
  );
  const remote = {
    id: "rfnd_test",
    payment_id: "pay_refundable",
    amount: 12000,
    status: "pending",
    notes: { eventraRefund: refund._id },
  };
  nock("https://api.razorpay.com")
    .get("/v1/payments/pay_refundable/refunds")
    .query(true)
    .reply(200, { items: [] });
  nock("https://api.razorpay.com")
    .post("/v1/payments/pay_refundable/refund")
    .reply(200, remote);
  const pending = await request(app)
    .post(`/api/v1/admin/refunds/${refund._id}/process`)
    .set(bearer(adminToken));
  assert.equal(pending.status, 200, JSON.stringify(pending.body));
  assert.equal((await models.Booking.findById(saved._id)).status, "CONFIRMED");
  nock("https://api.razorpay.com")
    .get("/v1/refunds/rfnd_test")
    .reply(200, { ...remote, status: "processed" });
  const processed = await request(app)
    .post(`/api/v1/admin/refunds/${refund._id}/process`)
    .set(bearer(adminToken));
  assert.equal(processed.status, 200, JSON.stringify(processed.body));
  assert.equal((await models.Booking.findById(saved._id)).status, "REFUNDED");
  assert.equal((await models.Ticket.findById(ticket._id)).status, "CANCELLED");
  assert.equal(
    (await models.TicketType.findById(refundTier._id)).soldQuantity,
    0,
  );
  assert.equal(
    (
      await request(app)
        .post(`/api/v1/admin/refunds/${refund._id}/process`)
        .set(bearer(adminToken))
    ).status,
    200,
  );
});
test("catalog initialization provides real editorial content without overwriting operator edits", async () => {
  const { initializeCatalog } = await import("../src/services/catalog.js");
  const { Article } = await import("../src/models/Article.js");
  await initializeCatalog();
  assert.ok(
    await models.Category.exists({ slug: "live-music", isActive: true }),
  );
  const articles = await request(app).get("/api/v1/resources");
  assert.equal(articles.status, 200);
  assert.equal(articles.body.data.articles.length, 3);
  const detail = await request(app).get("/api/v1/resources/design-a-gathering");
  assert.ok(detail.body.data.article.content.length > 1000);
  await Article.updateOne(
    { slug: "design-a-gathering" },
    { title: "Operator edit", published: false },
  );
  await initializeCatalog();
  const preserved = await Article.findOne({ slug: "design-a-gathering" });
  assert.equal(preserved!.title, "Operator edit");
  assert.equal(preserved!.published, false);
  assert.equal(await Article.countDocuments(), 3);
});
test("unfinished event drafts persist and remain isolated to their organizer", async () => {
  const payload = {
    form: { title: "My unfinished event", description: "" },
    step: 1,
  };
  const saved = await request(app)
    .put("/api/v1/organizers/event-draft")
    .set(bearer(organizerToken))
    .send(payload);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const restored = await request(app)
    .get("/api/v1/organizers/event-draft")
    .set(bearer(organizerToken));
  assert.equal(restored.body.data.draft.form.title, payload.form.title);
  assert.equal(restored.body.data.draft.step, 1);
  const other = await request(app)
    .get("/api/v1/organizers/event-draft")
    .set(bearer(outsiderToken));
  assert.equal(other.body.data.draft, null);
  assert.equal(
    (
      await request(app)
        .put("/api/v1/organizers/event-draft")
        .set(bearer(customerToken))
        .send(payload)
    ).status,
    403,
  );
  await request(app)
    .delete("/api/v1/organizers/event-draft")
    .set(bearer(organizerToken));
  assert.equal(
    (
      await request(app)
        .get("/api/v1/organizers/event-draft")
        .set(bearer(organizerToken))
    ).body.data.draft,
    null,
  );
});
test("webhook rejects unsigned data; logout revokes bearer token", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/v1/payments/webhook")
        .send({ event: "payment.captured" })
    ).status,
    400,
  );
  assert.equal(
    (await request(app).post("/api/v1/auth/logout").set(bearer(outsiderToken)))
      .status,
    200,
  );
  assert.equal(
    (await request(app).get("/api/v1/auth/me").set(bearer(outsiderToken)))
      .status,
    401,
  );
});
