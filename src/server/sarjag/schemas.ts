import { z } from "zod";

/**
 * Şarjağ API v1 (ev-charging/v1) yanıt şemaları.
 * Kaynak: github.com/SarjAgCOM/sarjag-console-example → lib/types.ts
 * Alanlar API tarafında eklenebileceği için nesneler "loose" tanımlanır, opsiyonel alanlar nullish'tir.
 */

export const powerTypeSchema = z.enum(["AC", "DC"]);
export const connectorStatusSchema = z
  .enum(["AVAILABLE", "OCCUPIED", "RESERVED", "OUT_OF_ORDER", "UNAVAILABLE", "OFFLINE", "UNKNOWN"])
  .catch("UNKNOWN");

export const providerSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  website: z.string().nullish(),
  logoUrl: z.string().nullish(),
  description: z.string().nullish(),
});

export const providerInfoSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  country: z.string().nullish(),
  source: z.string().nullish(),
  via: z.string().nullish(),
});

export const priceSchema = z.looseObject({
  currency: z.string().default("TRY"),
  powerType: powerTypeSchema.nullish(),
  energyPerKwh: z.number().nullish(),
  timePerMinute: z.number().nullish(),
  parkingPerMinute: z.number().nullish(),
  sessionFee: z.number().nullish(),
  vatIncluded: z.boolean().nullish(),
  audience: z.string().nullish(),
  label: z.string().nullish(),
  tariffId: z.string().nullish(),
});

export const connectorSchema = z.looseObject({
  uid: z.string(),
  externalId: z.string().nullish(),
  evseId: z.string().nullish(),
  code: z.string().nullish(),
  standard: z.string().default("UNKNOWN"),
  standardRaw: z.string().nullish(),
  powerType: powerTypeSchema.nullish(),
  maxPowerKw: z.number().nullish(),
  status: connectorStatusSchema,
  ocppStatus: z.string().nullish(),
  providerStatus: z.string().nullish(),
  price: priceSchema.nullish(),
});

export const locationSchema = z.looseObject({
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  address: z.string().nullish(),
  district: z.string().nullish(),
  city: z.string().nullish(),
  postalCode: z.string().nullish(),
  country: z.string().nullish(),
});

export const stationSchema = z.looseObject({
  uid: z.string(),
  provider: z.string(),
  externalId: z.string(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  operator: z.string().nullish(),
  access: z.string().nullish(),
  isRoaming: z.boolean().nullish(),
  location: locationSchema,
  summary: z
    .looseObject({
      totalConnectors: z.number().default(0),
      availableConnectors: z.number().nullish(),
      occupiedConnectors: z.number().nullish(),
      outOfServiceConnectors: z.number().nullish(),
      maxPowerKw: z.number().nullish(),
      powerTypes: z.array(powerTypeSchema.catch("AC")).default([]),
      standards: z.array(z.string()).default([]),
    })
    .default({ totalConnectors: 0, powerTypes: [], standards: [] }),
  connectors: z.array(connectorSchema).default([]),
  prices: z.array(priceSchema).default([]),
  updatedAt: z.string().nullish(),
});

export const providersResponseSchema = z.looseObject({
  count: z.number().optional(),
  data: z.array(providerSchema),
});

export const stationsResponseSchema = z.looseObject({
  provider: providerInfoSchema.optional(),
  fetchedAt: z.string().optional(),
  count: z.number().optional(),
  data: z.array(stationSchema),
});

export const stationResponseSchema = z.looseObject({
  provider: providerInfoSchema.optional(),
  fetchedAt: z.string().optional(),
  data: stationSchema,
});

export const stationStatusSchema = z.looseObject({
  uid: z.string(),
  provider: z.string().optional(),
  externalId: z.string(),
  fetchedAt: z.string().optional(),
  available: z.number().default(0),
  total: z.number().default(0),
  connectors: z
    .array(
      z.looseObject({
        uid: z.string(),
        evseId: z.string().nullish(),
        powerType: powerTypeSchema.nullish(),
        maxPowerKw: z.number().nullish(),
        status: connectorStatusSchema,
      }),
    )
    .default([]),
});

export const statusResponseSchema = z.looseObject({
  provider: z.string().optional(),
  fetchedAt: z.string().optional(),
  count: z.number().optional(),
  data: z.array(stationStatusSchema),
  errors: z.array(z.looseObject({ ref: z.string().nullish(), code: z.string(), message: z.string() })).default([]),
});

export const meResponseSchema = z.looseObject({
  project: z.looseObject({ id: z.string(), name: z.string() }),
  tokens: z.looseObject({ balance: z.number() }),
  rateLimit: z.looseObject({ perMinute: z.number() }).optional(),
  pricing: z.record(z.string(), z.number()).optional(),
  usage30d: z.looseObject({ requests: z.number(), tokens: z.number() }).optional(),
});

export type SarjagProvider = z.infer<typeof providerSchema>;
export type SarjagStation = z.infer<typeof stationSchema>;
export type SarjagConnector = z.infer<typeof connectorSchema>;
export type SarjagPrice = z.infer<typeof priceSchema>;
export type SarjagStationStatus = z.infer<typeof stationStatusSchema>;
export type SarjagMe = z.infer<typeof meResponseSchema>;
