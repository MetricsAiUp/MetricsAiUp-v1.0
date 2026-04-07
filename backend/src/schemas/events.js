const { z } = require('zod');

const createEventSchema = z.object({
  type: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  zoneId: z.number().int().optional(),
  postId: z.number().int().optional(),
  cameraId: z.number().int().optional(),
  vehicleSessionId: z.number().int().optional(),
});

module.exports = { createEventSchema };
