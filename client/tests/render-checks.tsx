import React from "react";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePage, VenuesPage, ResourcesPage } from "../src/pages/Marketplace.js";
import { AnalyticsPage } from "../src/pages/Management.js";
import { ResourceEmpty } from "../src/components/Experience.js";

export function checkRendering() {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const seed = (path: string, data: unknown, params = {}) => query.setQueryData([path, params, "public"], data);
  const render = (element: React.ReactNode) => renderToString(<QueryClientProvider client={query}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);
  seed("/discovery", { featured: [], trending: [], upcoming: [], cities: [], categories: [], reviews: [] });
  seed("/resources", { articles: [] }, { limit: 3 });
  const home = render(<HomePage/>);
  assert.ok(home.includes("/images/editorial-night.svg"));
  assert.ok(home.includes("After the lights go down"));
  assert.ok(!home.includes("The next experience is on its way"));
  seed("/organizers/stats", { stats: {totalEvents:0,totalRevenue:0}, daily:[],recentEvents:[] });
  seed("/organizers/profile", {profile:{status:"PENDING"}});
  const overview = render(<AnalyticsPage overview/>);
  assert.ok(overview.includes("Your launch checklist"));
  assert.ok(overview.includes("Create your first event"));
  assert.ok(!overview.includes("Revenue over time"));
  const events = render(<ResourceEmpty resource="events"/>);
  assert.ok(events.includes('href="/organizer/events/create"'));
  seed("/venues", {venues:[]}, {page:1});
  assert.ok(render(<VenuesPage/>).includes("Create an event &amp; add a venue"));
  seed("/resources", {articles:[{_id:"guide",slug:"design-a-gathering",title:"Design a gathering",image:"/images/editorial-space.svg",excerpt:"A guide for hosts",category:"Hosting",readingMinutes:3}]}, {page:1});
  assert.ok(render(<ResourcesPage/>).includes('href="/resources/blog/design-a-gathering"'));
  query.clear();
  console.log("PASS: homepage artwork/collections, organizer onboarding, event action, venue onboarding and journal rendering (5 checks).");
}
