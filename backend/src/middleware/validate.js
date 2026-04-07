const { ZodError } = require('zod');

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On failure returns 400 with { error, details: [{ field, message }] }.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({ error: 'Validation failed', details });
      }
      next(err);
    }
  };
}

module.exports = { validate };
