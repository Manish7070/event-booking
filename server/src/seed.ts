import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { connectDB } from "./config/database.js";
import { User } from "./models/User.js";
import { OrganizerProfile } from "./models/OrganizerProfile.js";
import { Category } from "./models/Category.js";
import { Venue } from "./models/Venue.js";
import { Event } from "./models/Event.js";
import { TicketType } from "./models/TicketType.js";
import { Coupon } from "./models/Coupon.js";
import { Article } from "./models/Article.js";
import { PlatformSetting } from "./models/PlatformSetting.js";

const seedDatabase = async () => {
  try {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.ALLOW_DEMO_SEED !== "true"
    )
      throw new Error(
        "Demo seed requires ALLOW_DEMO_SEED=true and a non-production environment.",
      );
    if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 10)
      throw new Error("Set a unique SEED_PASSWORD of at least 10 characters.");
    console.log("Connecting to MongoDB for seeding...");
    await connectDB();

    if (
      (await User.exists({})) ||
      (await Event.exists({})) ||
      (await Venue.exists({})) ||
      (await Category.exists({}))
    )
      throw new Error(
        "Seed only supports an empty database. Existing data is never deleted.",
      );

    console.log("Creating demo users (Admin, Organizer, Customer)...");
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash(process.env.SEED_PASSWORD, salt);

    await User.create({
      name: "System Admin",
      email: "admin@eventra.com",
      password: defaultPassword,
      phone: "+91 9876543210",
      role: "ADMIN",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      isVerified: true,
      isActive: true,
    });

    const organizer = await User.create({
      name: "Sunburn Events India",
      email: "organizer@eventra.com",
      password: defaultPassword,
      phone: "+91 9812345678",
      role: "ORGANIZER",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      isVerified: true,
      isActive: true,
    });

    await User.create({
      name: "Aarav Sharma",
      email: "user@eventra.com",
      password: defaultPassword,
      phone: "+91 9988776655",
      role: "USER",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      isVerified: true,
      isActive: true,
    });

    await OrganizerProfile.create({
      user: organizer._id,
      organizationName: "Sunburn Asia Live",
      bio: "Asia’s premier electronic dance music brand hosting world-class festivals, stadium tours, and arena shows.",
      website: "https://sunburn.in",
      logo: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
      status: "APPROVED",
      totalEvents: 0,
      totalTicketsSold: 0,
      totalRevenue: 0,
      rating: 0,
      reviewCount: 0,
    });

    console.log("Seeding categories...");
    const categories = await Category.insertMany([
      {
        name: "Music Concerts",
        slug: "music-concerts",
        icon: "Music",
        color: "#8b5cf6",
        image:
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",
      },
      {
        name: "Nightlife & Parties",
        slug: "nightlife-parties",
        icon: "PartyPopper",
        color: "#ec4899",
        image:
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800",
      },
      {
        name: "Tech Conferences",
        slug: "tech-conferences",
        icon: "Cpu",
        color: "#3b82f6",
        image:
          "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
      },
      {
        name: "Comedy Shows",
        slug: "comedy-shows",
        icon: "Smile",
        color: "#f59e0b",
        image:
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
      },
      {
        name: "Food & Drinks",
        slug: "food-drinks",
        icon: "Utensils",
        color: "#10b981",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
      },
      {
        name: "Sports & Fitness",
        slug: "sports-fitness",
        icon: "Activity",
        color: "#ef4444",
        image:
          "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800",
      },
    ]);

    console.log("Seeding venues...");
    const venues = await Venue.insertMany([
      {
        name: "JLN Stadium Arena",
        slug: "jln-stadium-arena",
        address: "Jawaharlal Nehru Stadium Complex, Pragati Vihar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        capacity: 15000,
        image:
          "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200",
        amenities: [
          "VIP Lounge",
          "Metro Connectivity",
          "Food Court",
          "Parking",
        ],
      },
      {
        name: "Nesco Center Arena",
        slug: "nesco-center-arena",
        address: "Western Express Highway, Goregaon East",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        capacity: 8000,
        image:
          "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200",
        amenities: ["Air Conditioned", "Valet Parking", "Bar & Dining"],
      },
      {
        name: "Manpho Convention Center",
        slug: "manpho-convention-center",
        address: "Manyata Tech Park Ring Road",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        capacity: 6000,
        image:
          "https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200",
        amenities: ["High Speed WiFi", "Auditorium Seating", "Cafeteria"],
      },
    ]);

    console.log("Seeding events & ticket types...");
    const musicCat = categories[0]._id;
    const techCat = categories[2]._id;
    const comedyCat = categories[3]._id;

    const delhiVenue = venues[0]._id;
    const mumbaiVenue = venues[1]._id;
    const blrVenue = venues[2]._id;

    const event1 = await Event.create({
      title: "Sunburn Arena ft. Alan Walker Live India Tour",
      slug: "sunburn-arena-alan-walker-live-delhi",
      shortDescription:
        "Experience the global electronic sensation Alan Walker live in Delhi with ultra-visual production.",
      description:
        "Prepare for an unforgettable night of high-octane electronic music as world-renowned DJ Alan Walker brings his WalkerWorld India Tour to Delhi! Featuring state-of-the-art visual lasers, massive LED walls, surround sound acoustics, and exclusive guest DJ performances.",
      category: musicCat,
      organizer: organizer._id,
      venue: delhiVenue,
      city: "New Delhi",
      coverImage:
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200",
      images: [
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200",
        "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200",
      ],
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 5 * 3600 * 1000),
      status: "PUBLISHED",
      featured: true,
      trending: true,
      minPrice: 1499,
      maxPrice: 4999,
      totalTickets: 3000,
      soldTickets: 0,
      tags: ["EDM", "Concert", "Sunburn", "Alan Walker"],
      highlights: [
        "Live WalkerWorld Set",
        "Pyro & Laser Light Spectacle",
        "Multiple Food & Beverage Counters",
      ],
      schedule: [
        { time: "05:00 PM", title: "Gates Open & Opening Act" },
        { time: "07:30 PM", title: "Supporting DJ Set" },
        { time: "09:00 PM", title: "Alan Walker Live Performance" },
      ],
    });

    await TicketType.insertMany([
      {
        event: event1._id,
        name: "General Admission",
        price: 1499,
        totalQuantity: 2000,
        soldQuantity: 0,
        maxPerBooking: 6,
      },
      {
        event: event1._id,
        name: "VIP Fan Pit",
        price: 2999,
        totalQuantity: 800,
        soldQuantity: 0,
        maxPerBooking: 4,
      },
      {
        event: event1._id,
        name: "VVIP Lounge Experience",
        price: 4999,
        totalQuantity: 200,
        soldQuantity: 0,
        maxPerBooking: 2,
      },
    ]);

    const event2 = await Event.create({
      title: "Global Tech Summit 2026: AI & Cloud Future",
      slug: "global-tech-summit-2026-mumbai",
      shortDescription:
        "The premier annual conference for engineering leaders, AI researchers, and tech founders.",
      description:
        "Join over 2,000 technology innovators, CTOs, senior engineers, and venture capitalists at Nesco Center Mumbai. Keynotes cover Generative AI, Cloud Infrastructure scaling, Distributed Systems, and Next-Gen Web Architecture.",
      category: techCat,
      organizer: organizer._id,
      venue: mumbaiVenue,
      city: "Mumbai",
      coverImage:
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200",
      images: [
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200",
      ],
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: "PUBLISHED",
      featured: true,
      trending: false,
      minPrice: 2499,
      maxPrice: 7999,
      totalTickets: 1500,
      soldTickets: 0,
      tags: ["Tech", "AI", "Conference", "Startup"],
    });

    await TicketType.insertMany([
      {
        event: event2._id,
        name: "Standard Delegate Pass",
        price: 2499,
        totalQuantity: 1000,
        soldQuantity: 0,
        maxPerBooking: 5,
      },
      {
        event: event2._id,
        name: "VIP All Access Pass",
        price: 7999,
        totalQuantity: 500,
        soldQuantity: 0,
        maxPerBooking: 3,
      },
    ]);

    const event3 = await Event.create({
      title: "Zakir Khan Live - Tathastu Tour Bengaluru",
      slug: "zakir-khan-live-tathastu-bengaluru",
      shortDescription:
        "India’s favorite stand-up comedian Zakir Khan brings his record-breaking show to Bengaluru.",
      description:
        "Get ready for an evening of heartwarming stories, nostalgic humor, and non-stop laughter with Sakht Launda Zakir Khan!",
      category: comedyCat,
      organizer: organizer._id,
      venue: blrVenue,
      city: "Bengaluru",
      coverImage:
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200",
      images: [
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200",
      ],
      startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      endDate: new Date(
        Date.now() + 21 * 24 * 60 * 60 * 1000 + 3 * 3600 * 1000,
      ),
      status: "PUBLISHED",
      featured: false,
      trending: true,
      minPrice: 799,
      maxPrice: 2499,
      totalTickets: 1200,
      soldTickets: 0,
      tags: ["Comedy", "Standup", "Zakir Khan"],
    });

    await TicketType.insertMany([
      {
        event: event3._id,
        name: "Silver Seating",
        price: 799,
        totalQuantity: 600,
        soldQuantity: 0,
        maxPerBooking: 6,
      },
      {
        event: event3._id,
        name: "Gold Front Row",
        price: 2499,
        totalQuantity: 600,
        soldQuantity: 0,
        maxPerBooking: 4,
      },
    ]);

    await PlatformSetting.create({
      key: "pricing",
      value: { taxPercent: 18, platformFeePercent: 2 },
    });
    await Article.insertMany([
      {
        title: "Your first live event: a practical guide",
        slug: "your-first-live-event",
        category: "Attendee guide",
        author: "Eventra editorial",
        excerpt: "A little preparation makes more room for the experience.",
        published: true,
        readingMinutes: 3,
        content:
          "Start with the details: check the venue address, event time, age restrictions and entry policy before booking. Save your individual ticket QR from My Tickets. Every person needs their own pass.\nPlan transport ahead of time, arrive before the advertised start, and keep your ticket private. If you bought tickets together, download each pass separately.\nAfter the event, share your experience through a verified attendee review. It helps other people discover something worth showing up for.",
      },
      {
        title: "A thoughtful checklist for event organizers",
        slug: "organizer-event-checklist",
        category: "Organizer guide",
        author: "Eventra editorial",
        excerpt:
          "From the first draft to the final attendee, build an event with care.",
        published: true,
        readingMinutes: 4,
        content:
          "Begin with a clear promise: who is this event for, and what will they experience? Choose an appropriate venue and confirm capacity, accessibility, entry arrangements and transport.\nBuild ticket tiers with transparent benefits and realistic inventory. Add an accurate schedule, age restrictions and cancellation policy. Preview the event before submitting it for review.\nBefore doors open, select the correct event in the check-in workspace and test the camera on an authorized ticket. Keep a manual ticket lookup available and explain your refund policy clearly.",
      },
    ]);
    console.log("Seeding coupons...");
    await Coupon.create({
      code: "EVENTRA20",
      name: "Welcome 20% Discount",
      description: "Get 20% flat discount on your first event booking.",
      discountType: "PERCENTAGE",
      discountValue: 20,
      maximumDiscount: 500,
      minimumOrder: 500,
      isActive: true,
    });

    console.log("\n✅ Database seeded successfully!");
    console.log("\n--- DEMO LOGIN CREDENTIALS ---");
    console.log(
      "ADMIN: admin@eventra.com; ORGANIZER: organizer@eventra.com; CUSTOMER: user@eventra.com",
    );
    console.log("All demo accounts use your configured SEED_PASSWORD.");
    console.log("-------------------------------\n");

    process.exit(0);
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exit(1);
  }
};

seedDatabase();
