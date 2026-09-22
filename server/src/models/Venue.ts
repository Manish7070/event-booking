import { Schema, model, Document } from 'mongoose';

export interface IVenue extends Document {
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  capacity: number;
  image?: string;
  images: string[];
  amenities: string[];
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VenueSchema = new Schema<IVenue>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    address: { type: String, required: true },
    city: { type: String, required: true, index: true },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' },
    pincode: { type: String, default: '' },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    capacity: { type: Number, required: true, default: 100 },
    image: { type: String, default: '' },
    images: [{ type: String }],
    amenities: [{ type: String }],
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Venue = model<IVenue>('Venue', VenueSchema);
