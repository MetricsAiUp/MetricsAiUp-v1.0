const { z } = require('zod');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  roleIds: z.array(z.string()).optional(),
  roleName: z.string().optional(),
  pages: z.array(z.string()).optional(),
  hiddenElements: z.array(z.string()).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  roleIds: z.array(z.string()).optional(),
  roleName: z.string().optional(),
  isActive: z.boolean().optional(),
  hiddenElements: z.array(z.string()).optional(),
  pages: z.array(z.string()).optional(),
});

module.exports = { createUserSchema, updateUserSchema };
