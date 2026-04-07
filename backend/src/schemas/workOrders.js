const { z } = require('zod');

const importCsvSchema = z.object({
  csvData: z.string().min(1),
});

const assignSchema = z.object({
  postId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

const scheduleSchema = z.object({
  assignments: z.array(z.object({
    workOrderId: z.string().min(1),
    postId: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
  })).min(1),
});

module.exports = { importCsvSchema, assignSchema, scheduleSchema };
