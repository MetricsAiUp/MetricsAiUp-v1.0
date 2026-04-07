const { z } = require('zod');

const createZoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['repair', 'waiting', 'entry', 'parking', 'free']),
  description: z.string().optional(),
  coordinates: z.object({}).passthrough().optional(),
});

const updateZoneSchema = createZoneSchema.partial();

module.exports = { createZoneSchema, updateZoneSchema };
