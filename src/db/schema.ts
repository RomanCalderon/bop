import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PhotoAttribution } from "@/lib/places-types";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const allowedEmails = pgTable(
  "allowed_emails",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("allowed_emails_email_uidx").on(t.email)],
);

export const cities = pgTable(
  "cities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    centerLat: doublePrecision("center_lat"),
    centerLng: doublePrecision("center_lng"),
  },
  (t) => [uniqueIndex("cities_name_uidx").on(sql`lower(${t.name})`)],
);

export const areas = pgTable(
  "areas",
  {
    id: text("id").primaryKey(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [
    uniqueIndex("areas_city_name_uidx").on(t.cityId, sql`lower(${t.name})`),
  ],
);

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id").notNull(),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    formattedAddress: text("formatted_address").notNull(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id),
    areaId: text("area_id").references(() => areas.id),
    type: text("type"),
    extraTags: text("extra_tags").array().notNull().default([]),
    notes: text("notes").notNull().default(""),
    rating: doublePrecision("rating"),
    googleMapsUrl: text("google_maps_url").notNull().default(""),
    photoName: text("photo_name"),
    authorAttributions: jsonb("author_attributions")
      .$type<PhotoAttribution[]>()
      .notNull()
      .default([]),
    seedFeatureCid: text("seed_feature_cid"),
  },
  (t) => [
    uniqueIndex("places_place_id_city_id_uidx").on(t.placeId, t.cityId),
    uniqueIndex("places_seed_feature_cid_uidx")
      .on(t.seedFeatureCid)
      .where(sql`${t.seedFeatureCid} is not null`),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lastCityId: text("last_city_id").references(() => cities.id),
});
