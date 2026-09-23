import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Share2,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useData } from "../hooks/useData.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { api } from "../api/axios.js";
import { queryClient } from "../api/queryClient.js";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  Notice,
  Skeleton,
  date,
  message,
  money,
} from "../components/ui.js";
import { MarketCard } from "./Marketplace.js";
export function EventPage() {
  const { slug } = useParams();
  const { data, isLoading, error } = useData(`/events/${slug}`);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [shared, setShared] = useState(false);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const reviews = useData(
    `/reviews/event/${data?.event?._id}`,
    {},
    !!data?.event?._id,
  );
  useEffect(() => {
    if (!data?.event) return;
    const e = data.event;
    document.title = `${e.title} | Eventra`;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", e.shortDescription);
    return () => {
      document.title = "Eventra — Experiences worth remembering";
    };
  }, [data]);
  if (isLoading)
    return (
      <div className="container section">
        <Skeleton />
      </div>
    );
  if (error)
    return (
      <div className="container section">
        <Notice error>{message(error)}</Notice>
      </div>
    );
  if (!data) return null;
  const e = data.event;
  const items = Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
  const subtotal = data.ticketTypes.reduce(
    (s: number, t: any) => s + t.price * (quantities[t._id] || 0),
    0,
  );
  return (
    <>
      <section className="event-hero">
        <img src={e.coverImage} alt={e.title} />
        <div className="container">
          <Link to="/events">← Discover events</Link>
          <Badge>{e.category?.name}</Badge>
          <h1>{e.title}</h1>
          <p>{e.shortDescription}</p>
        </div>
      </section>
      <div className="container event-detail-layout section">
        <div className="event-editorial">
          <div className="facts">
            <div>
              <Calendar />
              <strong>{date(e.startDate)}</strong>
              <span>Times shown in IST</span>
            </div>
            <div>
              <MapPin />
              <Link to={`/venues/${e.venue?.slug}`}>
                <strong>{e.venue?.name}</strong>
              </Link>
              <span>
                {e.venue?.address}, {e.city}
              </span>
            </div>
          </div>
          <div className="section-heading">
            <h2>Be part of the story.</h2>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setShared(true);
                } catch {
                  setShared(false);
                }
              }}
            >
              <Share2 size={16} />
              {shared ? "Link copied" : "Share"}
            </Button>
          </div>
          <p className="preserve-lines">{e.description}</p>
          {e.highlights?.length > 0 && (
            <section>
              <h2>The highlights</h2>
              <ul className="highlights">
                {e.highlights.map((h: string) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </section>
          )}
          {e.images?.length > 0 && (
            <div className="gallery">
              {e.images.map((url: string) => (
                <img
                  key={url}
                  src={url}
                  alt={`${e.title} gallery`}
                  loading="lazy"
                />
              ))}
            </div>
          )}
          {e.schedule?.length > 0 && (
            <section>
              <h2>The running order</h2>
              {e.schedule.map((s: any, i: number) => (
                <div className="schedule-row" key={i}>
                  <strong>{s.time}</strong>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                  </div>
                </div>
              ))}
            </section>
          )}
          <section>
            <h2>Your host</h2>
            <p>{e.organizer?.name}</p>
            <p>Eventra reviews events before they are published.</p>
          </section>
          <section>
            <h2>Good to know</h2>
            <p>
              {e.ageRestriction} · {e.dressCode}
            </p>
            <p>{e.accessibility?.join(" · ")}</p>
            <h3>Cancellation policy</h3>
            <p>{e.cancellationPolicy}</p>
            <h3>Entry terms</h3>
            <p>{e.termsAndConditions}</p>
            {e.faq?.map((f: any) => (
              <details key={f.question}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
            <a
              className="btn secondary"
              target="_blank"
              rel="noreferrer"
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${e.venue?.address}, ${e.city}`)}`}
            >
              Find the venue ↗
            </a>
          </section>
          <section>
            <h2>
              From the crowd{" "}
              <small>
                {e.reviewCount > 0
                  ? `${e.rating.toFixed(1)}/5 · ${e.reviewCount} reviews`
                  : ""}
              </small>
            </h2>
            {reviews.data?.reviews?.length ? (
              reviews.data.reviews.map((r: any) => (
                <blockquote key={r._id}>
                  <strong>
                    {r.title} · {r.rating}/5
                  </strong>
                  <p>{r.content}</p>
                  <span>{r.user?.name} · Verified attendee</span>
                </blockquote>
              ))
            ) : (
              <Empty title="Be the first to share your experience">
                Reviews open after check-in.
              </Empty>
            )}
            <Link to="/dashboard/reviews">Write an attendee review</Link>
          </section>
        </div>
        <aside id="tickets" className="ticket-panel">
          <span className="eyebrow">Your place in the crowd</span>
          <h2>Choose your tickets</h2>
          {data.ticketTypes.map((t: any) => {
            const available = Math.max(
              0,
              t.totalQuantity - t.soldQuantity - (t.reservedQuantity || 0),
            );
            const qty = quantities[t._id] || 0;
            return (
              <div className="ticket-tier" key={t._id}>
                <div>
                  <h3>{t.name}</h3>
                  <p>{t.description}</p>
                  <strong>{money(t.price)}</strong>
                  <small>
                    {available ? `${available} available` : "Sold out"}
                  </small>
                </div>
                <div className="stepper">
                  <button
                    aria-label={`Remove ${t.name}`}
                    disabled={!qty}
                    onClick={() =>
                      setQuantities({ ...quantities, [t._id]: qty - 1 })
                    }
                  >
                    <Minus size={16} />
                  </button>
                  <span>{qty}</span>
                  <button
                    aria-label={`Add ${t.name}`}
                    disabled={qty >= Math.min(t.maxPerBooking, available)}
                    onClick={() =>
                      setQuantities({ ...quantities, [t._id]: qty + 1 })
                    }
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="summary-line">
            <span>Ticket subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <p className="muted">
            Taxes and platform fee are calculated at checkout.
          </p>
          <Button
            disabled={!items.length}
            onClick={() => (user ? setCheckout(true) : navigate("/login"))}
          >
            Continue to checkout
          </Button>
          <p className="icon-line">
            <ShieldCheck size={16} />
            Payment verified by Razorpay
          </p>
        </aside>
      </div>
      <div className="mobile-booking">
        <span>From {money(e.minPrice)}</span>
        <a className="btn primary" href="#tickets">
          Select tickets
        </a>
      </div>
      {data.similar?.length > 0 && (
        <section className="container section">
          <h2>Keep exploring.</h2>
          <div className="three-grid">
            {data.similar.map((event: any) => (
              <MarketCard key={event._id} event={event} />
            ))}
          </div>
        </section>
      )}
      {checkout && (
        <Checkout event={e} items={items} onClose={() => setCheckout(false)} />
      )}
    </>
  );
}
function Checkout({
  event,
  items,
  onClose,
}: {
  event: any;
  items: any[];
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef({ fingerprint: "", key: "" });
  const itemsKey = JSON.stringify(items);

  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    let active = true;
    setSummary(null);
    api
      .post("/bookings/quote", {
        eventId: event._id,
        items: JSON.parse(itemsKey),
        couponCode: coupon || undefined,
      })
      .then((r) => {
        if (active) {
          setSummary(r.data.data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setError(message(e));
          setSummary(null);
        }
      });
    return () => {
      active = false;
    };
  }, [event._id, itemsKey, coupon]);
  return (
    <Modal title="Make it a date." onClose={onClose}>
      <p>{event.title}</p>
      {error && <Notice error>{error}</Notice>}
      <form
        className="checkout-layout"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const fields = Object.fromEntries(new FormData(e.currentTarget));
          try {
            if (summary?.total > 0 && !window.Razorpay)
              throw new Error(
                "Secure payment checkout is still loading. Please try again.",
              );
            const payload = {
              ...fields,
              eventId: event._id,
              items,
              couponCode: coupon || undefined,
            };
            const fingerprint = JSON.stringify(payload);
            if (attempt.current.fingerprint !== fingerprint)
              attempt.current = { fingerprint, key: crypto.randomUUID() };
            const res = await api.post("/bookings/checkout", {
              ...payload,
              idempotencyKey: attempt.current.key,
            });
            const b = res.data.data;
            if (b.confirmed) {
              await queryClient.invalidateQueries();
              onClose();
              navigate("/dashboard/tickets");
              return;
            }
            const rzp = new window.Razorpay({
              key: b.razorpayKeyId,
              amount: Math.round(b.amount * 100),
              currency: "INR",
              name: "Eventra",
              description: event.title,
              order_id: b.razorpayOrderId,
              prefill: {
                name: String(fields.attendeeName),
                email: String(fields.attendeeEmail),
                contact: String(fields.attendeePhone),
              },
              theme: { color: "#6651c8" },
              modal: { ondismiss: () => setBusy(false) },
              handler: async (response: any) => {
                try {
                  await api.post("/bookings/verify-payment", {
                    bookingId: b.bookingId,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  });
                  await queryClient.invalidateQueries();
                  onClose();
                  navigate("/dashboard/tickets");
                } catch (err) {
                  setError(
                    `${message(err)}. Your payment is reconciled independently; check Orders before paying again.`,
                  );
                } finally {
                  setBusy(false);
                }
              },
            });
            rzp.open();
          } catch (err) {
            setError(message(err));
            setBusy(false);
          }
        }}
      >
        <div className="form-stack">
          <Field label="Attendee name">
            <input name="attendeeName" defaultValue={user?.name} required />
          </Field>
          <Field label="Email">
            <input
              name="attendeeEmail"
              type="email"
              defaultValue={user?.email}
              required
            />
          </Field>
          <Field label="Phone">
            <input
              name="attendeePhone"
              type="tel"
              defaultValue={user?.phone}
              minLength={6}
              required
            />
          </Field>
          <Field label="Coupon code">
            <div className="input-action">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={!!coupon}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  coupon ? (setCoupon(""), setCode("")) : setCoupon(code)
                }
              >
                {coupon ? "Remove" : "Apply"}
              </Button>
            </div>
          </Field>
        </div>
        <div className="order-summary">
          <h3>Your order</h3>
          {summary ? (
            <>
              {summary.items.map((t: any) => (
                <div className="summary-line" key={t.ticketType}>
                  <span>
                    {t.name} × {t.quantity}
                  </span>
                  <strong>{money(t.price * t.quantity)}</strong>
                </div>
              ))}
              {[
                ["Subtotal", summary.subtotal],
                ["Discount", -summary.discount],
                ["Tax", summary.tax],
                ["Platform fee", summary.platformFee],
                ["Total", summary.total],
              ].map(([label, value]) => (
                <div className="summary-line" key={label}>
                  <span>{label}</span>
                  <strong>{money(Number(value))}</strong>
                </div>
              ))}
            </>
          ) : (
            <p>Calculating your total…</p>
          )}
          <Button busy={busy} disabled={!summary}>
            {summary?.total === 0
              ? "Confirm free tickets"
              : `Pay securely ${summary ? money(summary.total) : ""}`}
          </Button>
          <small>
            Inventory is reserved for 15 minutes after you continue to payment.
          </small>
        </div>
      </form>
    </Modal>
  );
}
