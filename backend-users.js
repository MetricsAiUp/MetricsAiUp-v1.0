const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;
const DATA_FILE = path.join(__dirname, 'api', 'users.json');

app.use(cors());
app.use(express.json());

// Helper: read users data from JSON file
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // Auto-create with default structure if missing
    const defaultData = {
      users: [],
      roles: [
        { id: 'admin', name: { ru: 'Администратор', en: 'Administrator' }, color: '#6366f1' },
        { id: 'manager', name: { ru: 'Менеджер', en: 'Manager' }, color: '#22c55e' },
        { id: 'viewer', name: { ru: 'Наблюдатель', en: 'Viewer' }, color: '#3b82f6' },
        { id: 'mechanic', name: { ru: 'Механик', en: 'Mechanic' }, color: '#f59e0b' },
      ],
      availablePages: [],
    };
    writeData(defaultData);
    return defaultData;
  }
}

// Helper: write users data to JSON file
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET /api/users — return all data (users with passwords, roles, availablePages)
app.get('/api/users', (req, res) => {
  const data = readData();
  res.json(data);
});

// POST /api/users — create new user
app.post('/api/users', (req, res) => {
  const data = readData();
  const body = req.body;

  const newUser = {
    id: `user-${Date.now()}`,
    email: body.email || '',
    password: body.password || 'demo123',
    firstName: body.firstName || '',
    lastName: body.lastName || '',
    role: body.role || 'viewer',
    isActive: body.isActive !== undefined ? body.isActive : true,
    createdAt: new Date().toISOString().slice(0, 10),
    pages: body.pages || ['dashboard'],
  };

  data.users.push(newUser);
  writeData(data);
  res.json(newUser);
});

// PUT /api/users/:id — update user
app.put('/api/users/:id', (req, res) => {
  const data = readData();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const existing = data.users[idx];
  const body = req.body;

  const updated = {
    ...existing,
    ...body,
    id: existing.id, // prevent ID change
  };

  // Keep old password if not provided
  if (!body.password || body.password.trim() === '') {
    updated.password = existing.password || 'demo123';
  }

  data.users[idx] = updated;
  writeData(data);
  res.json(updated);
});

// DELETE /api/users/:id — delete user
app.delete('/api/users/:id', (req, res) => {
  const data = readData();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  data.users.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// GET /api/users/action/create — create user via GET (proxy compat)
app.get('/api/users/action/create', (req, res) => {
  const data = readData();
  const body = JSON.parse(req.query.data || '{}');
  const newUser = {
    id: `user-${Date.now()}`,
    email: body.email || '', password: body.password || 'demo123',
    firstName: body.firstName || '', lastName: body.lastName || '',
    role: body.role || 'viewer', isActive: body.isActive !== undefined ? body.isActive : true,
    createdAt: new Date().toISOString().slice(0, 10), pages: body.pages || ['dashboard'],
  };
  data.users.push(newUser);
  writeData(data);
  res.json(newUser);
});

// GET /api/users/action/update — update user via GET (proxy compat)
app.get('/api/users/action/update', (req, res) => {
  const data = readData();
  const body = JSON.parse(req.query.data || '{}');
  const id = req.query.id;
  const idx = data.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const existing = data.users[idx];
  const updated = { ...existing, ...body, id: existing.id };
  if (!body.password || body.password.trim() === '') updated.password = existing.password || 'demo123';
  data.users[idx] = updated;
  writeData(data);
  res.json(updated);
});

// GET /api/users/action/delete — delete user via GET (proxy compat)
app.get('/api/users/action/delete', (req, res) => {
  const data = readData();
  const id = req.query.id;
  const idx = data.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  data.users.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// POST /api/users/:id/update — alternative to PUT (for proxies that block PUT)
app.post('/api/users/:id/update', (req, res) => {
  const data = readData();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const existing = data.users[idx];
  const body = req.body;
  const updated = { ...existing, ...body, id: existing.id };
  if (!body.password || body.password.trim() === '') {
    updated.password = existing.password || 'demo123';
  }
  data.users[idx] = updated;
  writeData(data);
  res.json(updated);
});

// POST /api/users/:id/delete — alternative to DELETE (for proxies that block DELETE)
app.post('/api/users/:id/delete', (req, res) => {
  const data = readData();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  data.users.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// GET /api/auth/login — authenticate user (GET for proxy compatibility)
app.get('/api/auth/login', (req, res) => {
  const { email, password } = req.query;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const data = readData();
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) return res.status(401).json({ error: 'User not found' });
  if (!user.isActive) return res.status(403).json({ error: 'User is disabled' });
  if (user.password !== password) return res.status(401).json({ error: 'Wrong password' });

  const token = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64');
  res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, pages: user.pages, isActive: user.isActive } });
});

// POST /api/auth/login — authenticate user (direct access)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const data = readData();
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) return res.status(401).json({ error: 'User not found' });
  if (!user.isActive) return res.status(403).json({ error: 'User is disabled' });
  if (user.password !== password) return res.status(401).json({ error: 'Wrong password' });

  const token = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64');

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      pages: user.pages,
      isActive: user.isActive,
    },
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend-users] Running on port ${PORT}`);
  console.log(`[backend-users] Data file: ${DATA_FILE}`);
});
