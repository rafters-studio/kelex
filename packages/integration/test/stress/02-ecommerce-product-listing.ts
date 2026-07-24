import { z } from "zod/v4";

/** E-commerce: Product listing
 * Tests: array of strings, nested object (price), discriminated union
 * (physical vs digital), enum, z.url() top-level format */

const priceSchema = z.object({
  amount: z.number().min(0).multipleOf(0.01),
  currency: z.enum(["USD", "EUR", "GBP", "JPY"]),
});

const physicalAttributes = z.object({
  type: z.literal("physical"),
  weight: z.number().min(0).meta({ title: "Weight in kg" }),
  dimensions: z.object({
    length: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0),
  }),
  shippingClass: z.enum(["standard", "oversized", "fragile", "hazmat"]),
});

const digitalAttributes = z.object({
  type: z.literal("digital"),
  fileSize: z.number().min(0).meta({ title: "File size in MB" }),
  downloadUrl: z.url(),
  licenseType: z.enum(["single", "multi", "enterprise"]),
});

export const productListingSchema = z.object({
  title: z.string().min(1).max(200).meta({ title: "Product title" }),
  description: z.string().min(10).max(5000).meta({ title: "Product description" }),
  sku: z
    .string()
    .regex(/^[A-Z]{2,4}-\d{4,8}$/)
    .meta({ title: "Stock keeping unit" }),
  price: priceSchema,
  category: z.enum([
    "electronics",
    "clothing",
    "home",
    "sports",
    "books",
    "toys",
    "food",
    "health",
  ]),
  tags: z.array(z.string().min(1).max(50)).min(1).max(10),
  images: z.array(z.url()).min(1).max(20),
  attributes: z.discriminatedUnion("type", [physicalAttributes, digitalAttributes]),
  isActive: z.boolean(),
});
