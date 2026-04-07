const { z } = require('zod');

const importSchema = z.object({
  filename: z.string().min(1),
  data: z.string().min(1), // base64 encoded xlsx
});

const exportSchema = z.object({
  status: z.string().optional(),
});

module.exports = { importSchema, exportSchema };
