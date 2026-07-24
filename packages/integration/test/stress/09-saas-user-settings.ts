import { z } from "zod/v4";

/** SaaS: User settings/preferences
 * Tests: record for feature flags, boolean toggles, enum for theme/locale,
 * optional nested notification preferences, z.url()/z.email() top-level */

const notificationPreferences = z.object({
  emailDigest: z.enum(["none", "daily", "weekly", "monthly"]),
  pushNotifications: z.boolean(),
  slackIntegration: z.boolean(),
  slackWebhookUrl: z.url().optional(),
  notifyOnMention: z.boolean(),
  notifyOnAssignment: z.boolean(),
  notifyOnDeadline: z.boolean(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

export const userSettingsSchema = z.object({
  displayName: z.string().min(1).max(50),
  email: z.email(),
  avatarUrl: z.url().optional(),
  theme: z.enum(["light", "dark", "system"]),
  locale: z.enum(["en", "es", "fr", "de", "ja", "zh", "ko", "pt", "ar"]),
  timezone: z.string().min(1).max(50).meta({ title: "IANA timezone identifier" }),
  dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]),
  notifications: notificationPreferences,
  featureFlags: z.record(z.string(), z.boolean()),
  itemsPerPage: z.int().min(10).max(100).multipleOf(10),
  defaultView: z.enum(["list", "board", "calendar", "timeline"]),
  sidebarCollapsed: z.boolean(),
  accessibilityMode: z.boolean(),
  twoFactorEnabled: z.boolean(),
  apiKeyPrefix: z
    .string()
    .regex(/^pk_[a-z]+_/)
    .optional()
    .meta({ title: "API key prefix for identification" }),
});
