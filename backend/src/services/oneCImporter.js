// Оркестратор импорта одного xlsx-вложения:
//   buffer → detectType → parser → raw rows (insert) → trigger merger
//
// Вход:
//   - importRecord — уже созданная запись OneCImport (status='pending')
//   - attachmentBuffer — Buffer с содержимым xlsx
//   - opts.forceType — 'plan'|'repair'|'performed' для ручной загрузки
//
// На выходе обновляет import: status, detectedType, rowsTotal, rowsInserted, errorMessage.

const prisma = require('../config/database');
const logger = require('../config/logger');
const parser = require('./oneCParser');
const postNameResolver = require('./postNameResolver');
const { contentHash } = require('../utils/contentHash');

let merger = null; // lazy require, чтобы избежать circular
function getMerger() {
  if (!merger) merger = require('./oneCMerger');
  return merger;
}

async function process(importRecord, attachmentBuffer, opts = {}) {
  const importId = importRecord.id;
  const receivedAt = importRecord.receivedAt;

  try {
    const wb = parser.readWorkbook(attachmentBuffer);
    const detected = opts.forceType || parser.detectType(wb);

    if (!['plan', 'repair', 'performed'].includes(detected)) {
      await prisma.oneCImport.update({
        where: { id: importId },
        data: { status: 'error_unknown_format', detectedType: detected, errorMessage: 'Cannot detect xlsx type' },
      });
      return { ok: false, reason: 'unknown_format' };
    }

    let rows;
    if (detected === 'plan') rows = parser.parsePlan(wb, receivedAt);
    else if (detected === 'repair') rows = parser.parseRepair(wb, receivedAt);
    else rows = parser.parsePerformed(wb, receivedAt);

    let inserted = 0;
    const affectedOrderNumbers = new Set();

    if (detected === 'plan') {
      for (const row of rows) {
        const { postId } = await postNameResolver.resolve(row.postRawName);
        const hash = contentHash({
          number: row.number,
          plateNumber: row.plateNumber,
          vin: row.vin,
          scheduledStart: row.scheduledStart,
          scheduledEnd: row.scheduledEnd,
          postRawName: row.postRawName,
          durationSec: row.durationSec,
          isOutdated: row.isOutdated,
          documentText: row.documentText,
        });
        await prisma.oneCPlanRow.create({
          data: { ...row, importId, postId, contentHash: hash },
        });
        inserted++;
        affectedOrderNumbers.add(row.number);
      }
    } else if (detected === 'repair') {
      for (const row of rows) {
        const hash = contentHash({
          orderNumber: row.orderNumber,
          state: row.state,
          workStartedAt: row.workStartedAt,
          workFinishedAt: row.workFinishedAt,
          closedAt: row.closedAt,
          repairKind: row.repairKind,
          mileage: row.mileage,
          basis: row.basis,
          basisStart: row.basisStart,
          basisEnd: row.basisEnd,
          master: row.master,
          dispatcher: row.dispatcher,
          plateNumber1: row.plateNumber1,
          vin: row.vin,
        });
        await prisma.oneCRepairSnapshot.create({
          data: { ...row, importId, contentHash: hash },
        });
        inserted++;
        affectedOrderNumbers.add(row.orderNumber);
      }
    } else {
      for (const row of rows) {
        const hash = contentHash({
          orderNumber: row.orderNumber,
          state: row.state,
          workStartedAt: row.workStartedAt,
          workFinishedAt: row.workFinishedAt,
          closedAt: row.closedAt,
          executor: row.executor,
          master: row.master,
          dispatcher: row.dispatcher,
          normHours: row.normHours,
          plateNumber: row.plateNumber,
          vin: row.vin,
          mileage: row.mileage,
        });
        await prisma.oneCWorkPerformed.create({
          data: { ...row, importId, contentHash: hash },
        });
        inserted++;
        affectedOrderNumbers.add(row.orderNumber);
      }
    }

    await prisma.oneCImport.update({
      where: { id: importId },
      data: {
        status: 'success',
        detectedType: detected,
        rowsTotal: rows.length,
        rowsInserted: inserted,
        processedAt: new Date(),
      },
    });

    // Триггерим merger асинхронно (setImmediate чтобы не блокировать ответ)
    setImmediate(() => {
      getMerger().mergeForImport(importId).catch((err) => {
        logger.error('oneCMerger failed', { importId, err: err.message });
      });
    });

    logger.info('1С import processed', { importId, type: detected, rows: rows.length, inserted });
    return { ok: true, type: detected, rows: rows.length, inserted, affectedOrderNumbers: [...affectedOrderNumbers] };

  } catch (err) {
    logger.error('1С import failed', { importId, err: err.message, stack: err.stack });
    await prisma.oneCImport.update({
      where: { id: importId },
      data: { status: 'error', errorMessage: err.message?.slice(0, 1000) || 'unknown error' },
    }).catch(() => { /* swallow */ });
    return { ok: false, reason: 'error', error: err.message };
  }
}

module.exports = { process };
