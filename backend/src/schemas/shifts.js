const { z } = require('zod');

const workerSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['mechanic', 'master', 'diagnostician']),
  postId: z.string().nullable().optional(),
});

const createShiftSchema = z.object({
  name: z.string().min(1),
  date: z.string().min(1), // "2026-04-07"
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(['planned', 'active', 'completed']).optional(),
  notes: z.string().nullable().optional(),
  workers: z.array(workerSchema).optional(),
});

const updateShiftSchema = z.object({
  name: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.enum(['planned', 'active', 'completed']).optional(),
  notes: z.string().nullable().optional(),
  workers: z.array(workerSchema).optional(),
});

module.exports = { createShiftSchema, updateShiftSchema };
