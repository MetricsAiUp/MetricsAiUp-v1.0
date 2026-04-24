const { dequeue, markDone, markFailed, upsertZoneState, insertHistory, pruneHistory, cleanQueue } = require('./monitoringDb');

let running = false;
let pollTimer = null;

function processJob(job) {
  const { zoneName, zoneType, mergedResult, timestamp } = job.payload;

  console.log(`[Worker] Processing: ${zoneName} — ${mergedResult.status}`);

  // Upsert current state
  upsertZoneState(zoneName, { ...mergedResult, zoneType });

  // Insert into history
  insertHistory(zoneName, { ...mergedResult, zoneType });
}

function poll() {
  let job;
  while ((job = dequeue())) {
    try {
      processJob(job);
      markDone(job.id);
    } catch (err) {
      console.error(`[Worker] Job ${job.id} failed:`, err.message);
      markFailed(job.id, err.message);
    }
  }
}

function startWorker(intervalMs = 1000) {
  if (running) return;
  running = true;
  console.log('[Worker] Started (poll interval: ' + intervalMs + 'ms)');

  // Immediate first poll
  poll();

  pollTimer = setInterval(() => {
    poll();
  }, intervalMs);

  // Clean job queue every hour (history is kept forever)
  setInterval(() => {
    cleanQueue();
  }, 60 * 60 * 1000);
}

function stopWorker() {
  if (pollTimer) clearInterval(pollTimer);
  running = false;
  console.log('[Worker] Stopped');
}

// Process immediately (called when new job enqueued)
function nudge() {
  if (running) poll();
}

module.exports = { startWorker, stopWorker, nudge, poll };
