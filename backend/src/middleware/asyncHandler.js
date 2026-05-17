// Wraps async route handlers to catch errors automatically
// Eliminates repetitive try/catch blocks in routes
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Not found' });
      }
      console.error(`[Route Error] ${req.method} ${req.path}:`, err);
      res.status(500).json({ error: 'Internal server error' });
    });
  };
}

module.exports = { asyncHandler };
