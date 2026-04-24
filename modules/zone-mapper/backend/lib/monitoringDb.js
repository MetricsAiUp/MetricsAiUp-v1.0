const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'monitoring.db');
let db = null;

function getDb() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS zone_state (
      zone_name TEXT PRIMARY KEY,
      zone_type TEXT DEFAULT 'lift',
      status TEXT DEFAULT 'free',
      plate TEXT,
      car_color TEXT,
      car_model TEXT,
      car_make TEXT,
      car_body TEXT,
      first_seen TEXT,
      works_in_progress INTEGER DEFAULT 0,
      works_description TEXT,
      people_count INTEGER DEFAULT 0,
      open_parts TEXT,
      confidence TEXT,
      last_update TEXT
    );

    CREATE TABLE IF NOT EXISTS zone_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      plate TEXT,
      car_color TEXT,
      car_model TEXT,
      car_make TEXT,
      car_body TEXT,
      works_in_progress INTEGER DEFAULT 0,
      works_description TEXT,
      people_count INTEGER DEFAULT 0,
      open_parts TEXT,
      confidence TEXT,
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_history_zone_time ON zone_history(zone_name, timestamp);

    CREATE TABLE IF NOT EXISTS job_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT 'pending',
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      error TEXT,
      retry_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status ON job_queue(status);
  `);

  return db;
}

// Test room zones — excluded from API responses
const TEST_ZONES = ['Подьемник 1', 'Подьемник 2', 'Подьемник 3', 'Прочие работы', 'Стоянка', 'Пост непонятный с мордой'];
function isTestZone(zoneName) {
  return TEST_ZONES.includes(zoneName);
}

// Validate that a string looks like a real license plate (not Claude garbage)
function isValidPlate(plate) {
  if (!plate || typeof plate !== 'string') return false;
  const s = plate.trim();
  if (s.length < 4 || s.length > 20) return false;
  // Reject known Claude garbage responses
  const garbage = ['none', 'null', 'n/a', 'not visible', 'not readable', 'not clearly',
    'unknown', 'partially', 'unreadable', 'illegible', 'obscured', 'не читаемо',
    'не виден', 'не видно', 'нечитаемо', 'нет', 'невозможно'];
  const lower = s.toLowerCase();
  if (garbage.some(g => lower.includes(g))) return false;
  // Must contain at least one digit and one letter
  if (!/\d/.test(s) || !/[a-zA-Zа-яА-Я]/.test(s)) return false;
  return true;
}

// Sanitize plate: return null if not a valid plate
function sanitizePlate(plate) {
  return isValidPlate(plate) ? plate.trim() : null;
}

// Pick most frequent non-null value from an array
function mostFrequent(arr) {
  const filtered = arr.filter(v => v && v.trim && v.trim() !== '');
  if (filtered.length === 0) return null;
  const counts = {};
  for (const v of filtered) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Detect if a new vehicle has arrived.
 * Rules:
 * - If zone was free (existing.status === 'free') and now occupied → new vehicle
 * - If zone was occupied and now free → vehicle left (handled in upsert)
 * - If zone stays occupied: compare STABLE (consensus) params with incoming consensus
 *   Only declare new vehicle if 2 out of 3 (plate, color, model) differ
 *   AND at least one of the differing params is non-null on both sides
 * - If incoming has no plate/color/model → NOT a new vehicle (can't confirm change)
 */
function isNewVehicle(existing, incomingPlate, incomingColor, incomingModel) {
  if (!existing || existing.status !== 'occupied') return true;
  if (!existing.plate && !existing.car_color && !existing.car_model) return true;

  // If incoming has no identifiable data, can't determine — assume same car
  if (!incomingPlate && !incomingColor && !incomingModel) return false;

  let diffCount = 0;
  let comparisons = 0;

  if (incomingPlate && existing.plate) {
    comparisons++;
    if (incomingPlate !== existing.plate) diffCount++;
  }
  if (incomingColor && existing.car_color) {
    comparisons++;
    if (incomingColor.toLowerCase() !== existing.car_color.toLowerCase()) diffCount++;
  }
  if (incomingModel && existing.car_model) {
    comparisons++;
    if (incomingModel !== existing.car_model) diffCount++;
  }

  // Need at least 2 comparisons possible and 2 differences
  return comparisons >= 2 && diffCount >= 2;
}

function upsertZoneState(zoneName, result) {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM zone_state WHERE zone_name = ?').get(zoneName);

  const now = new Date().toISOString();

  if (result.status === 'free') {
    // Zone is free — clear car data
    d.prepare(`
      INSERT INTO zone_state (zone_name, zone_type, status, plate, car_color, car_model, car_make, car_body,
        first_seen, works_in_progress, works_description, people_count, open_parts, confidence, last_update)
      VALUES (?, ?, 'free', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, '[]', ?, ?)
      ON CONFLICT(zone_name) DO UPDATE SET
        status='free', plate=NULL, car_color=NULL, car_model=NULL, car_make=NULL, car_body=NULL,
        first_seen=NULL, works_in_progress=0, works_description=NULL, people_count=0,
        open_parts='[]', confidence=excluded.confidence, last_update=excluded.last_update
    `).run(zoneName, result.zoneType || 'lift', result.confidence || null, now);
    return;
  }

  // Zone is occupied — apply consensus logic from recent history
  // Get last N occupied records for this zone (within last 2 hours = same car session)
  const recentHistory = d.prepare(`
    SELECT plate, car_color, car_model, car_make, car_body FROM zone_history
    WHERE zone_name = ? AND status = 'occupied' AND timestamp > ?
    ORDER BY timestamp DESC LIMIT 50
  `).all(zoneName, new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

  // Add current result to the pool — sanitize plates
  const allPlates = [...recentHistory.map(h => h.plate), result.plate].map(sanitizePlate).filter(Boolean);
  const allColors = [...recentHistory.map(h => h.car_color), result.vehicle?.color].filter(Boolean);
  const allModels = [...recentHistory.map(h => h.car_model), result.vehicle?.model].filter(v => v && v !== 'Unknown');
  const allMakes = [...recentHistory.map(h => h.car_make), result.vehicle?.make].filter(v => v && v !== 'Unknown');
  const allBodies = [...recentHistory.map(h => h.car_body), result.vehicle?.body].filter(Boolean);

  // Best consensus values
  let bestPlate = mostFrequent(allPlates);
  const bestColor = mostFrequent(allColors);
  const bestModel = mostFrequent(allModels);
  const bestMake = mostFrequent(allMakes);
  const bestBody = mostFrequent(allBodies);

  // If plate not recognized now but exists in history — keep it if color matches (same car, plate just obscured)
  if (!bestPlate && existing && existing.status === 'occupied' && sanitizePlate(existing.plate)) {
    const existingColor = (existing.car_color || '').toLowerCase();
    const currentColor = (bestColor || '').toLowerCase();
    if (existingColor && currentColor && existingColor === currentColor) {
      bestPlate = existing.plate;
      console.log(`[DB] ${zoneName}: plate not visible, keeping historical "${bestPlate}" (color match: ${currentColor})`);
    }
  }

  // Determine first_seen
  let firstSeen = now;
  if (existing && existing.status === 'occupied') {
    if (isNewVehicle(existing, bestPlate, bestColor, bestModel)) {
      firstSeen = now;
      console.log(`[DB] ${zoneName}: NEW vehicle detected (was: ${existing.plate}/${existing.car_color}/${existing.car_model}, now: ${bestPlate}/${bestColor}/${bestModel})`);
    } else {
      firstSeen = existing.first_seen || now;
    }
  }

  d.prepare(`
    INSERT INTO zone_state (zone_name, zone_type, status, plate, car_color, car_model, car_make, car_body,
      first_seen, works_in_progress, works_description, people_count, open_parts, confidence, last_update)
    VALUES (?, ?, 'occupied', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(zone_name) DO UPDATE SET
      zone_type=excluded.zone_type, status='occupied', plate=excluded.plate,
      car_color=excluded.car_color, car_model=excluded.car_model, car_make=excluded.car_make,
      car_body=excluded.car_body, first_seen=excluded.first_seen,
      works_in_progress=excluded.works_in_progress, works_description=excluded.works_description,
      people_count=excluded.people_count, open_parts=excluded.open_parts,
      confidence=excluded.confidence, last_update=excluded.last_update
  `).run(
    zoneName, result.zoneType || 'lift',
    bestPlate, bestColor, bestModel, bestMake, bestBody,
    firstSeen,
    result.worksInProgress ? 1 : 0, result.worksDescription || null,
    result.peopleCount || 0, JSON.stringify(result.openParts || []),
    result.confidence || null, now
  );
}

function insertHistory(zoneName, result) {
  getDb().prepare(`
    INSERT INTO zone_history (zone_name, timestamp, status, plate, car_color, car_model, car_make, car_body,
      works_in_progress, works_description, people_count, open_parts, confidence, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    zoneName, new Date().toISOString(), result.status || 'free',
    sanitizePlate(result.plate), result.vehicle?.color || null,
    (result.vehicle?.model && result.vehicle.model !== 'Unknown') ? result.vehicle.model : null,
    (result.vehicle?.make && result.vehicle.make !== 'Unknown') ? result.vehicle.make : null,
    result.vehicle?.body || null,
    result.worksInProgress ? 1 : 0, result.worksDescription || null,
    result.peopleCount || 0, JSON.stringify(result.openParts || []),
    result.confidence || null, JSON.stringify(result)
  );
}

// Standard car object — always same shape
function formatCar(plate, color, make, model, body, firstSeen) {
  const cleanPlate = sanitizePlate(plate);
  const cleanMake = (make && make !== 'Unknown') ? make : null;
  const cleanModel = (model && model !== 'Unknown') ? model : null;
  const fullModel = [cleanMake, cleanModel].filter(Boolean).join(' ') || null;
  return {
    plate: cleanPlate,
    color: color || null,
    model: fullModel,
    make: cleanMake,
    body: body || null,
    firstSeen: firstSeen || null,
  };
}

function getFullState() {
  const d = getDb();
  const states = d.prepare('SELECT * FROM zone_state ORDER BY zone_name').all();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  return states.filter(s => !isTestZone(s.zone_name)).map(s => {
    const history = d.prepare(
      'SELECT * FROM zone_history WHERE zone_name = ? AND timestamp > ? ORDER BY timestamp DESC'
    ).all(s.zone_name, cutoff);

    return {
      zone: s.zone_name,
      type: s.zone_type,
      status: s.status,
      car: formatCar(s.plate, s.car_color, s.car_make, s.car_model, s.car_body, s.first_seen),
      worksInProgress: !!s.works_in_progress,
      worksDescription: s.works_description || null,
      peopleCount: s.people_count || 0,
      openParts: JSON.parse(s.open_parts || '[]'),
      confidence: s.confidence || null,
      lastUpdate: s.last_update || null,
      history: history.map(formatHistoryRow),
    };
  });
}

function getZoneState(zoneName) {
  const all = getFullState();
  return all.find(z => z.zone === zoneName) || null;
}

function formatHistoryRow(h) {
  return {
    timestamp: h.timestamp || null,
    status: h.status || 'free',
    car: formatCar(h.plate, h.car_color, h.car_make, h.car_model, h.car_body, null),
    worksInProgress: !!h.works_in_progress,
    worksDescription: h.works_description || null,
    peopleCount: h.people_count || 0,
    confidence: h.confidence || null,
  };
}

/**
 * Get history for a period: from..to (ISO strings).
 * Optional zoneName filter.
 */
function getHistoryForPeriod(from, to, zoneName) {
  const d = getDb();
  let rows;
  if (zoneName) {
    rows = d.prepare(
      'SELECT * FROM zone_history WHERE zone_name = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC'
    ).all(zoneName, from, to);
  } else {
    rows = d.prepare(
      'SELECT * FROM zone_history WHERE timestamp >= ? AND timestamp <= ? ORDER BY zone_name, timestamp DESC'
    ).all(from, to);
  }
  return rows.filter(r => !isTestZone(r.zone_name)).map(formatHistoryRow);
}

/**
 * Get full state with history filtered by period.
 */
function getFullStateForPeriod(from, to) {
  const d = getDb();
  const states = d.prepare('SELECT * FROM zone_state ORDER BY zone_name').all();

  return states.filter(s => !isTestZone(s.zone_name)).map(s => {
    const history = d.prepare(
      'SELECT * FROM zone_history WHERE zone_name = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC'
    ).all(s.zone_name, from, to);

    return {
      zone: s.zone_name,
      type: s.zone_type,
      status: s.status,
      car: formatCar(s.plate, s.car_color, s.car_make, s.car_model, s.car_body, s.first_seen),
      worksInProgress: !!s.works_in_progress,
      worksDescription: s.works_description || null,
      peopleCount: s.people_count || 0,
      openParts: JSON.parse(s.open_parts || '[]'),
      confidence: s.confidence || null,
      lastUpdate: s.last_update || null,
      history: history.map(formatHistoryRow),
    };
  });
}

function pruneHistory(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const result = getDb().prepare('DELETE FROM zone_history WHERE timestamp < ?').run(cutoff);
  return result.changes;
}

// Queue operations
function enqueue(payload) {
  getDb().prepare('INSERT INTO job_queue (status, payload, created_at) VALUES (?, ?, ?)')
    .run('pending', JSON.stringify(payload), new Date().toISOString());
}

function dequeue() {
  const d = getDb();
  const row = d.prepare("SELECT * FROM job_queue WHERE status = 'pending' ORDER BY id LIMIT 1").get();
  if (!row) return null;
  d.prepare("UPDATE job_queue SET status = 'processing' WHERE id = ?").run(row.id);
  return { id: row.id, payload: JSON.parse(row.payload) };
}

function markDone(id) {
  getDb().prepare("UPDATE job_queue SET status = 'done', processed_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

function markFailed(id, error) {
  const d = getDb();
  const row = d.prepare('SELECT retry_count FROM job_queue WHERE id = ?').get(id);
  if (row && row.retry_count < 3) {
    d.prepare("UPDATE job_queue SET status = 'pending', retry_count = retry_count + 1, error = ? WHERE id = ?")
      .run(error, id);
  } else {
    d.prepare("UPDATE job_queue SET status = 'failed', processed_at = ?, error = ? WHERE id = ?")
      .run(new Date().toISOString(), error, id);
  }
}

function cleanQueue() {
  getDb().prepare("DELETE FROM job_queue WHERE status IN ('done', 'failed') AND created_at < ?")
    .run(new Date(Date.now() - 60 * 60 * 1000).toISOString());
}

module.exports = {
  getDb, upsertZoneState, insertHistory, getFullState, getZoneState,
  getFullStateForPeriod, getHistoryForPeriod,
  pruneHistory, enqueue, dequeue, markDone, markFailed, cleanQueue,
};
