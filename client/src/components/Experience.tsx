import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  CalendarDays,
  Ticket,
  ScanLine,
  Sparkles,
  Building2,
} from "lucide-react";
import { useData } from "../hooks/useData.js";
import { useAuthStore } from "../store/useAuthStore.js";

export function Collections() {
  return (
    <section className="container section collections">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Follow your curiosity</span>
          <h2>
            A different kind of <em>going out.</em>
          </h2>
        </div>
        <Link to="/events">
          Explore the collection <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="collection-grid">
        {[
          [
            "01",
            "After the lights go down",
            "Live music",
            "live-music",
            "night",
          ],
          [
            "02",
            "A little closer to culture",
            "Art & culture",
            "art-culture",
            "space",
          ],
          ["03", "Make room for a first", "Workshops", "workshops", "play"],
        ].map(([n, title, label, slug, art]) => (
          <Link
            key={slug}
            className="collection-card"
            to={`/events?category=${slug}`}
          >
            <img src={`/images/editorial-${art}.svg`} alt="" />
            <div>
              <span className="collection-number">{n} / THE EDIT</span>
              <span className="collection-caption">
                <small>{label}</small>
                <h3>{title}</h3>
                <span className="circle-arrow">
                  <ArrowUpRight />
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function LaunchGuide() {
  const { user } = useAuthStore();
  const { data } = useData("/organizers/profile");
  const profile = data?.profile;
  const steps = [
    {
      icon: Building2,
      title: "Introduce your brand",
      text: "Complete your organizer profile so guests know who is behind the experience.",
      link: "/organizer/profile",
      action: "Edit profile",
      done: !!profile?.bio,
    },
    {
      icon: CalendarDays,
      title: "Shape your first event",
      text: "Add your story, venue, date and ticket types. Review everything before you submit.",
      link: "/organizer/events/create",
      action: "Create an event",
      done: false,
    },
    {
      icon: Ticket,
      title: "Get ready to welcome",
      text: "After approval, your event appears in discovery and guests can reserve their places.",
      link: "/organizer/events",
      action: "Manage events",
      done: false,
    },
  ];
  return (
    <section className="launch-guide">
      <div className="launch-banner">
        <div>
          <span className="eyebrow">Your next chapter starts here</span>
          <h2>
            {user?.name.split(" ")[0]}, make something
            <br />
            <em>worth showing up for.</em>
          </h2>
          <p>
            Your workspace brings your event, guests and ticket sales together.
            Start with one great idea.
          </p>
          <Link className="btn primary" to="/organizer/events/create">
            Create your first event <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="launch-art" aria-hidden="true">
          <Sparkles size={42} />
          <span>
            THE NEXT
            <br />
            GREAT
            <br />
            <em>gathering.</em>
          </span>
          <small>CREATED BY YOU / EVENTRA</small>
        </div>
      </div>
      <div className="setup-heading">
        <h3>Your launch checklist</h3>
        <span className="status-pill">
          {profile?.status === "APPROVED"
            ? "Organizer approved"
            : "Organizer approval pending"}
        </span>
      </div>
      <div className="setup-grid">
        {steps.map((s, i) => (
          <Link key={s.title} to={s.link} className="setup-card">
            <div className="setup-icon">
              {s.done ? <Check size={22} /> : <s.icon size={22} />}
              <span>0{i + 1}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <strong>
              {s.action} <ArrowUpRight size={16} />
            </strong>
          </Link>
        ))}
      </div>
      <div className="workspace-tip">
        <ScanLine size={26} />
        <div>
          <strong>Every guest. One individual pass.</strong>
          <p>
            Confirmed bookings create individual QR tickets. Your event scanner
            validates each guest once.
          </p>
        </div>
        <Link to="/organizer/check-in">
          Open check-in <ArrowUpRight size={16} />
        </Link>
      </div>
    </section>
  );
}

export function ResourceEmpty({
  resource,
  admin = false,
}: {
  resource: string;
  admin?: boolean;
}) {
  const copy: Record<string, [string, string, string, string]> = {
    events: [
      "Your next great event starts here.",
      "Build your event page, set your ticket options and submit it for review. Published events become discoverable to guests.",
      admin ? "/admin/categories" : "/organizer/events/create",
      admin ? "Manage categories" : "Create an event",
    ],
    orders: [
      "A clear view of every reservation.",
      "Orders appear here when guests reserve tickets. You will be able to see payment state and booking details in one place.",
      admin ? "/admin/events" : "/organizer/events",
      "View events",
    ],
    attendees: [
      "A warm welcome starts with knowing your guests.",
      "Your confirmed attendees will appear here, with the ticket and check-in information you need on the day.",
      "/organizer/events",
      "Manage your events",
    ],
    coupons: [
      "Give people a reason to join.",
      "Create a discount with clear dates, usage limits and an offer that works for your event.",
      "/organizer/events",
      "Review your events",
    ],
    reviews: [
      "Good experiences start conversations.",
      "Verified attendees can leave reviews after check-in. Their feedback will appear here.",
      admin ? "/admin/events" : "/organizer/events",
      "View events",
    ],
  };
  const [title, text, to, label] = copy[resource] || [
    "Your workspace is ready.",
    `There are no ${resource.replaceAll("-", " ")} matching this view yet. New records will appear here as activity begins.`,
    admin ? "/admin" : "/organizer/dashboard",
    "Back to overview",
  ];
  return (
    <div className="resource-empty">
      <div className="empty-emblem">
        <Ticket size={30} />
      </div>
      <span className="eyebrow">{resource.replaceAll("-", " ")}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="btn primary" to={to}>
        {label} <ArrowUpRight size={16} />
      </Link>
      <div className="empty-footnote">
        Designed for the details. Ready when you are.
      </div>
    </div>
  );
}
