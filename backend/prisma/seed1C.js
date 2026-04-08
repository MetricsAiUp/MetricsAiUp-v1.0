/**
 * Seed WorkOrders from 1C data files (workers + planning).
 * Groups worker records by order number, extracts post from planning workStation,
 * and creates WorkOrder records with brand, model, worker, master, postNumber, times.
 *
 * Usage: node prisma/seed1C.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

function parseDate(s) {
  if (!s) return null;
  // DD.MM.YYYY HH:MM:SS
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
}

function extractPostNumber(station) {
  if (!station) return null;
  const m = station.match(/ПОСТ\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function statusFrom1C(s) {
  if (!s) return 'scheduled';
  if (s === 'Закрыт') return 'completed';
  if (s === 'В работе') return 'in_progress';
  if (s === 'Запланирован') return 'scheduled';
  return 'scheduled';
}

async function main() {
  const workersPath = path.resolve(__dirname, '../../data/1c-workers.json');
  const planningPath = path.resolve(__dirname, '../../data/1c-planning.json');

  const workers = JSON.parse(fs.readFileSync(workersPath, 'utf8'));
  const planning = JSON.parse(fs.readFileSync(planningPath, 'utf8'));

  // Build planning lookup by order number → extract postNumber and times
  const planByNumber = {};
  for (const p of planning) {
    const postNum = extractPostNumber(p.workStation);
    if (!planByNumber[p.number] || postNum) {
      planByNumber[p.number] = {
        postNumber: postNum,
        startTime: parseDate(p.startTime),
        endTime: parseDate(p.endTime),
        workStation: p.workStation,
      };
    }
  }

  // Group workers by order number — aggregate into one WO per unique order
  const woMap = {};
  for (const w of workers) {
    if (!woMap[w.number]) {
      woMap[w.number] = {
        orderNumber: w.number,
        externalId: `1C-${w.number}`,
        brand: w.brand || null,
        model: w.model || null,
        plateNumber: null,
        workType: w.repairType || null,
        status: statusFrom1C(w.orderStatus),
        normHours: 0,
        actualHours: null,
        worker: w.worker || null,
        master: w.master || null,
        startTime: parseDate(w.startDate),
        endTime: parseDate(w.endDate),
        closeDate: parseDate(w.closeDate),
        postNumber: null,
      };
    }
    // Accumulate normHours from all worker records for this order
    woMap[w.number].normHours += (w.normHours || 0);
    // If this record has a worker name, keep it (first one wins)
    if (w.worker && !woMap[w.number].worker) woMap[w.number].worker = w.worker;
  }

  // Merge planning data (postNumber, times)
  for (const [num, plan] of Object.entries(planByNumber)) {
    if (woMap[num]) {
      if (plan.postNumber) woMap[num].postNumber = plan.postNumber;
      if (plan.startTime) woMap[num].startTime = plan.startTime;
      if (plan.endTime) woMap[num].endTime = plan.endTime;
    } else {
      // Create WO from planning only
      woMap[num] = {
        orderNumber: num,
        externalId: `1C-${num}`,
        brand: null,
        model: null,
        plateNumber: null,
        workType: null,
        status: 'scheduled',
        normHours: null,
        actualHours: null,
        worker: null,
        master: null,
        startTime: plan.startTime,
        endTime: plan.endTime,
        closeDate: null,
        postNumber: plan.postNumber,
      };
    }
  }

  // Assign postNumbers to WOs that don't have one — distribute across posts 1-10
  const allWOs = Object.values(woMap);
  let postCycle = 0;
  for (const wo of allWOs) {
    if (!wo.postNumber) {
      wo.postNumber = (postCycle % 10) + 1;
      postCycle++;
    }
  }

  // Round normHours
  for (const wo of allWOs) {
    wo.normHours = wo.normHours ? Math.round(wo.normHours * 100) / 100 : null;
  }

  // Clear existing work order links first (FK), then work orders from 1C
  const woIds = (await prisma.workOrder.findMany({
    where: { externalId: { startsWith: '1C-' } },
    select: { id: true },
  })).map(w => w.id);
  if (woIds.length > 0) {
    await prisma.workOrderLink.deleteMany({ where: { workOrderId: { in: woIds } } });
  }
  const deleted = await prisma.workOrder.deleteMany({
    where: { externalId: { startsWith: '1C-' } },
  });
  console.log(`Deleted ${deleted.count} old 1C work orders`);

  // Insert in batches
  let created = 0;
  for (const wo of allWOs) {
    const scheduledTime = wo.startTime || wo.closeDate || new Date();
    const estimatedEnd = wo.endTime || (wo.normHours
      ? new Date(scheduledTime.getTime() + wo.normHours * 3600000)
      : null);

    await prisma.workOrder.create({
      data: {
        externalId: wo.externalId,
        orderNumber: wo.orderNumber,
        scheduledTime,
        status: wo.status,
        plateNumber: wo.plateNumber,
        workType: wo.workType,
        normHours: wo.normHours,
        actualHours: wo.actualHours,
        brand: wo.brand,
        model: wo.model,
        worker: wo.worker,
        master: wo.master,
        postNumber: wo.postNumber,
        startTime: wo.startTime,
        endTime: wo.endTime,
        estimatedEnd,
      },
    });
    created++;
  }

  console.log(`Created ${created} work orders from 1C data`);

  // Stats
  const byPost = {};
  for (const wo of allWOs) {
    byPost[wo.postNumber] = (byPost[wo.postNumber] || 0) + 1;
  }
  console.log('Per post:', byPost);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
