const XLSX = require('xlsx');
const prisma = require('../config/database');

async function generateReportXlsx(periodDays = 1) {
  const since = new Date(); since.setDate(since.getDate() - periodDays); since.setHours(0,0,0,0);
  const orders = await prisma.workOrder.findMany({ where: { scheduledTime: { gte: since } }, orderBy: { scheduledTime: 'desc' } });

  const wb = XLSX.utils.book_new();

  // Summary sheet
  const completed = orders.filter(o => o.status === 'completed');
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Orders', orders.length],
    ['Completed', completed.length],
    ['Total Norm Hours', +orders.reduce((s, o) => s + (o.normHours || 0), 0).toFixed(1)],
    ['Total Actual Hours', +completed.reduce((s, o) => s + (o.actualHours || 0), 0).toFixed(1)],
    ['Period (days)', periodDays],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

  // Orders sheet
  const ordersData = [['Order #', 'Plate', 'Work Type', 'Status', 'Norm Hours', 'Actual Hours', 'Scheduled', 'Post']];
  orders.forEach(o => ordersData.push([o.orderNumber, o.plateNumber, o.workType, o.status, o.normHours, o.actualHours, o.scheduledTime?.toISOString()?.slice(0, 10), o.postNumber]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ordersData), 'Orders');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { buffer, filename };
}

module.exports = { generateReportXlsx };
