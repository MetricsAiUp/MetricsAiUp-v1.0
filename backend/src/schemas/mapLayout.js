const { z } = require('zod');

const createMapLayoutSchema = z.object({
  name: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  bgImage: z.string().nullable().optional(),
  elements: z.array(z.object({}).passthrough()),
  isActive: z.boolean().optional(),
});

const updateMapLayoutSchema = createMapLayoutSchema.partial();

module.exports = { createMapLayoutSchema, updateMapLayoutSchema };
