// Zod-схемы для /api/discrepancies/*
const { z } = require('zod');

const updateStatusSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'resolved', 'dismissed']),
  closeReason: z.string().max(120).optional().nullable(),
  closeComment: z.string().max(2000).optional().nullable(),
});

module.exports = {
  updateStatusSchema,
};
