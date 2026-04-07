const { z } = require('zod');

const createPostSchema = z.object({
  zoneId: z.number().int(),
  name: z.string().min(1),
  type: z.enum(['light', 'heavy', 'special']),
  coordinates: z.object({}).passthrough().optional(),
});

const updatePostSchema = createPostSchema.partial();

module.exports = { createPostSchema, updatePostSchema };
