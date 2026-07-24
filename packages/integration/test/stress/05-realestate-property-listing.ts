import { z } from "zod/v4";

/** Real Estate: Property listing
 * Tests: intersection (.and()), array of strings (amenities), multipleOf for price,
 * nested object (address), number ranges */

const baseListing = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  price: z.number().min(0).multipleOf(1000).meta({ title: "Listing price in USD" }),
  propertyType: z.enum(["house", "condo", "townhouse", "land", "commercial"]),
  status: z.enum(["active", "pending", "sold", "withdrawn"]),
  listedDate: z.date(),
});

const locationDetails = z.object({
  address: z.object({
    street: z.string().min(1).max(200),
    unit: z.string().max(20).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(2),
    zip: z.string().regex(/^\d{5}$/),
  }),
  county: z.string().max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  schoolDistrict: z.string().max(100).optional(),
});

const propertyDetails = z.object({
  bedrooms: z.int().min(0).max(20),
  bathrooms: z.number().min(0).max(20).multipleOf(0.5),
  squareFeet: z.int().min(0),
  lotSize: z.number().min(0).optional().meta({ title: "Lot size in acres" }),
  yearBuilt: z.int().min(1800).max(2026),
  garage: z.enum(["none", "1_car", "2_car", "3_car"]),
  amenities: z.array(z.string().min(1).max(50)),
  hoaFee: z.number().min(0).optional().meta({ title: "Monthly HOA fee" }),
});

export const propertyListingSchema = baseListing.and(locationDetails).and(propertyDetails);
