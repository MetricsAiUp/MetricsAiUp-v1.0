const { z } = require('zod');

const createMapLayoutSchema = z.object({
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bgImage: z.string().optional(),
  elements: z.array(z.object({}).passthrough()),
  isActive: z.boolean().optional(),
});

const updateMapLayoutSchema = createMapLayoutSchema.partial();

module.exports = { createMapLayoutSchema, updateMapLayoutSchema };
