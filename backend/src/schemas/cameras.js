const { z } = require('zod');

const createCameraSchema = z.object({
  name: z.string().min(1),
  rtspUrl: z.string().url(),
  isActive: z.boolean().optional(),
});

const updateCameraSchema = createCameraSchema.partial();

const setCameraZonesSchema = z.object({
  zones: z.array(
    z.object({
      zoneId: z.number().int(),
      priority: z.number().int().min(1).max(10),
    })
  ),
});

module.exports = { createCameraSchema, updateCameraSchema, setCameraZonesSchema };
