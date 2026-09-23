import { Category } from "../models/Category.js";
import { Article } from "../models/Article.js";

// Product taxonomy and original editorial content, not events or sales fixtures.
// Insert only: operator edits and unpublished articles survive every restart.
export async function initializeCatalog() {
  const categories = [
    [
      "Live music",
      "live-music",
      "Concerts, intimate gigs and listening sessions.",
    ],
    [
      "Art & culture",
      "art-culture",
      "Exhibitions, theatre and creative encounters.",
    ],
    ["Food & drink", "food-drink", "Tastings, supper clubs and shared tables."],
    [
      "Workshops",
      "workshops",
      "Make something. Learn something. Meet someone.",
    ],
    ["Comedy", "comedy", "Stand-up, improv and a very good night out."],
    [
      "Business & ideas",
      "business-ideas",
      "Conversations, conferences and new perspectives.",
    ],
    [
      "Wellness & outdoors",
      "wellness-outdoors",
      "Room to breathe, move and reconnect.",
    ],
  ];
  for (const [name, slug, description] of categories)
    await Category.updateOne(
      { slug },
      { $setOnInsert: { name, slug, description, isActive: true } },
      { upsert: true },
    );
  const articles = [
    {
      title: "A good evening starts before you leave.",
      slug: "make-a-night-of-it",
      category: "The considered guide",
      excerpt:
        "A little preparation leaves more room for the unexpected. Our guide to a better night out.",
      image: "/images/editorial-night.svg",
      content:
        "Start with the experience, not the calendar. Choose something you are curious about: an unfamiliar artist, a small workshop or a conversation outside your usual interests. Read the event description and running order so you know what the ticket actually includes.\nLeave room around the main event. Check the venue address and travel time, then give yourself a buffer for entry. If you are going with friends, agree on a meeting point outside the entrance. It is much easier than finding one another in a crowd.\nRead the details that make the evening work for you. Age restrictions, accessibility, seating and cancellation terms vary between events. Check the event page before booking and ask the organizer about any access needs that are not covered.\nKeep your ticket within reach. Open My Tickets before you arrive, check the date and bring the individual QR pass for each attendee. Keep entry codes private; a screenshot shared publicly can compromise your ticket.\nFinally, leave a little space for discovery. Arrive early enough to explore, put your phone away during the moments that matter, and share a thoughtful review after checking in. Your experience can help someone else choose their next evening.",
    },
    {
      title: "Small gatherings. Lasting connections.",
      slug: "design-a-gathering",
      category: "For the hosts",
      excerpt:
        "Build your first event around a clear promise, a welcoming space and a thoughtful running order.",
      image: "/images/editorial-space.svg",
      content:
        "Write the promise of your event in one sentence. Who is it for, and what should people take away? Use that sentence to guide the venue, ticket description and programme. A clear small idea is easier to deliver than a vague large one.\nChoose a venue for the experience it supports. Think about seating, sound, access, toilets, transport and the practical capacity of the room. Add an accurate address and describe accessibility clearly. A beautiful photograph is useful; reliable arrival information is essential.\nMake the ticket easy to understand. Explain what is included, whether seating is assigned, and any age restrictions. Choose a capacity you can comfortably host. If you offer different ticket tiers, give each a clear purpose and keep the names simple.\nBuild breathing room into the programme. Allow time for arrival, transitions and questions. Add a contact point or clear arrival instructions to the event description so attendees know what to do if plans change.\nBefore submitting, read the event preview as a first-time guest. Check the date, time, venue, image, price and cancellation policy. Complete your organizer profile and submit the event for review. Publication follows approval; a saved draft is not visible in discovery.\nOn the day, open the scanner for the correct event and check each individual ticket once. Afterward, use attendance and booking records to understand what worked. Grow from real feedback rather than assumptions.",
    },
    {
      title: "The art of trying something new.",
      slug: "choose-your-next-experience",
      category: "A different weekend",
      excerpt:
        "From a first workshop to a solo concert, make curiosity part of your plans.",
      image: "/images/editorial-play.svg",
      content:
        "Trying something new does not need a grand plan. Start with a small question: what have you wanted to hear, learn or make? Browse one category outside your normal routine and read a few descriptions without committing straight away.\nLook for a format that suits your energy. A hands-on workshop offers a shared activity; a talk gives you something to think about; live music lets you be part of a crowd without needing to make conversation. There is no single right way to spend your free time.\nGoing alone can make choosing easier. Pick a venue you can reach comfortably, understand the arrival process and give yourself permission to enjoy the experience at your own pace. For social events, a simple question about the activity can be an easy introduction.\nChoose deliberately. Compare the time commitment, full checkout price and what is included. Read the cancellation terms and accessibility information. A free ticket still reserves a place, so only book the quantity you plan to use.\nAfterward, take a moment to notice what stayed with you. You might return to the same artist, try a more advanced workshop or invite a friend next time. Curiosity grows through small, repeatable choices.",
    },
  ];
  for (const article of articles)
    await Article.updateOne(
      { slug: article.slug },
      {
        $setOnInsert: {
          ...article,
          published: true,
          author: "Eventra editorial",
          readingMinutes: 3,
        },
      },
      { upsert: true },
    );
}
