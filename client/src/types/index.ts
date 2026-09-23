export type UserRole = "USER" | "ORGANIZER" | "ADMIN";
export type EventStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type TicketStatus = "VALID" | "USED" | "CANCELLED" | "EXPIRED";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  preferences?: Record<string, unknown>;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  color?: string;
  eventCount?: number;
}

export interface Venue {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  capacity: number;
  image?: string;
  images?: string[];
  amenities?: string[];
}

export interface TicketType {
  _id: string;
  event: string;
  name: string;
  description?: string;
  price: number;
  totalQuantity: number;
  soldQuantity: number;
  maxPerBooking: number;
  benefits?: string[];
}

export interface Event {
  _id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: Category;
  organizer: User;
  venue: Venue;
  city: string;
  coverImage: string;
  images?: string[];
  startDate: string;
  endDate: string;
  timezone?: string;
  status: EventStatus;
  featured?: boolean;
  trending?: boolean;
  minPrice: number;
  maxPrice: number;
  totalTickets?: number;
  soldTickets?: number;
  views?: number;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  schedule?: Array<{ time: string; title: string; description?: string }>;
  highlights?: string[];
  ageRestriction?: string;
  dressCode?: string;
}

export interface Booking {
  _id: string;
  bookingId: string;
  user: string;
  event: Event;
  tickets: Array<{
    ticketType: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  subtotal: number;
  discount: number;
  tax: number;
  platformFee: number;
  total: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentOrderId?: string;
  qrCodeData: string;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  ticketNumber: string;
  qrVerificationId: string;
  booking: string;
  event: Event;
  ticketType: TicketType;
  attendeeName: string;
  attendeeEmail: string;
  price: number;
  status: TicketStatus;
  checkedInAt?: string;
  createdAt: string;
}
