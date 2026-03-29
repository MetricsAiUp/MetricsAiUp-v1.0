const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

function read() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const initial = { rooms: [] };
    write(initial);
    return initial;
  }
}

function write(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function update(fn) {
  const data = read();
  const result = fn(data);
  write(data);
  return result;
}

module.exports = { read, write, update };
