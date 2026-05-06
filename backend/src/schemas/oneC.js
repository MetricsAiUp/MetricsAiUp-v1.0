// Zod-схемы для /api/oneC/*
const { z } = require('zod');

const imap1cConfigUpdateSchema = z.object({
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  useSsl: z.boolean().optional(),
  user: z.string().email().optional(),
  // password — необязательное (только если меняем). Пустая строка = не менять.
  password: z.string().optional(),
  fromFilter: z.string().min(1).optional(),
  subjectMask: z.string().optional().nullable(),
  intervalMinutes: z.number().int().min(5).max(1440).optional(),
  matchWindowHours: z.number().int().min(1).max(168).optional(),
  enabled: z.boolean().optional(),
  markAsRead: z.boolean().optional(),
  deleteAfterDays: z.number().int().min(0).optional().nullable(),
});

const testConnectionSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  useSsl: z.boolean(),
  user: z.string().email(),
  password: z.string().min(1),
});

const resolveUnmappedPostSchema = z.object({
  rawName: z.string().min(1),
  postId: z.string().nullable().optional(),
  isTracked: z.boolean().optional(),
});

const uiStatePatchSchema = z.object({
  patch: z.record(z.string(), z.any()),
});

module.exports = {
  imap1cConfigUpdateSchema,
  testConnectionSchema,
  resolveUnmappedPostSchema,
  uiStatePatchSchema,
};
