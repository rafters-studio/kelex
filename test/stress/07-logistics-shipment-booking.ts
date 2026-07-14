import { z } from "zod/v4";

/** Logistics: Shipment booking
 * Tests: discriminated union (shipping method with different fields),
 * nested object (dimensions), array of package items, number constraints */

const dimensions = z.object({
  length: z.number().min(0.1).max(300).meta({ title: "Length in cm" }),
  width: z.number().min(0.1).max(300).meta({ title: "Width in cm" }),
  height: z.number().min(0.1).max(300).meta({ title: "Height in cm" }),
});

const packageItem = z.object({
  description: z.string().min(1).max(200),
  quantity: z.int().min(1),
  weight: z.number().min(0.01).meta({ title: "Weight in kg" }),
  dimensions: dimensions,
  declaredValue: z.number().min(0).multipleOf(0.01),
  isHazardous: z.boolean(),
  hsCode: z
    .string()
    .regex(/^\d{4}\.\d{2}(\.\d{2})?$/)
    .optional()
    .meta({ title: "Harmonized System code" }),
});

const groundShipping = z.object({
  method: z.literal("ground"),
  carrier: z.enum(["ups", "fedex", "usps", "dhl"]),
  serviceLevel: z.enum(["economy", "standard", "express"]),
  requireSignature: z.boolean(),
});

const airShipping = z.object({
  method: z.literal("air"),
  carrier: z.enum(["fedex", "ups", "dhl"]),
  priority: z.enum(["standard", "priority", "overnight"]),
  customsDeclaration: z.string().min(1).max(1000),
  requireTemperatureControl: z.boolean(),
});

const seaShipping = z.object({
  method: z.literal("sea"),
  containerSize: z.enum(["20ft", "40ft", "40ft_hc"]),
  incoterms: z.enum(["FOB", "CIF", "EXW", "DDP"]),
  portOfLoading: z.string().min(1).max(100),
  portOfDischarge: z.string().min(1).max(100),
});

export const shipmentBookingSchema = z.object({
  bookingReference: z
    .string()
    .regex(/^BK-\d{10}$/)
    .meta({ title: "Booking reference number" }),
  shipperName: z.string().min(1).max(200),
  shipperEmail: z.email(),
  originAddress: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().max(50),
    country: z.string().min(2).max(2),
    postalCode: z.string().min(3).max(10),
  }),
  destinationAddress: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().max(50),
    country: z.string().min(2).max(2),
    postalCode: z.string().min(3).max(10),
  }),
  packages: z.array(packageItem).min(1).max(100),
  shippingMethod: z.discriminatedUnion("method", [groundShipping, airShipping, seaShipping]),
  pickupDate: z.date(),
  insuranceRequired: z.boolean(),
  specialInstructions: z.string().max(2000).optional(),
});
