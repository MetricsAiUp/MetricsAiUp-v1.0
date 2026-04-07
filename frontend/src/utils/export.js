import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function autoWidth(ws, data) {
  if (!data.length) return;
  const colWidths = Object.keys(data[0]).map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.map(row => String(row[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;
}

/**
 * Export analytics data to XLSX with 4 sheets
 */
export function exportToXlsx(data, postSummaries, filteredPosts, filteredDaily, isRu) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryHeaders = isRu
    ? { avgOccupancy: 'Ср. занятость (%)', avgEfficiency: 'Ср. эффективность (%)', totalVehicles: 'Всего авто', totalActiveH: 'Активных часов', totalIdleH: 'Часов простоя', totalNoShows: 'No-show' }
    : { avgOccupancy: 'Avg Occupancy (%)', avgEfficiency: 'Avg Efficiency (%)', totalVehicles: 'Total Vehicles', totalActiveH: 'Active Hours', totalIdleH: 'Idle Hours', totalNoShows: 'No-shows' };

  const totals = {
    avgOccupancy: +(postSummaries.reduce((s, p) => s + p.avgOccupancy, 0) / postSummaries.length).toFixed(1),
    avgEfficiency: +(postSummaries.reduce((s, p) => s + p.avgEfficiency, 0) / postSummaries.length).toFixed(1),
    totalVehicles: postSummaries.reduce((s, p) => s + p.totalVehicles, 0),
    totalActiveH: +(postSummaries.reduce((s, p) => s + p.totalActiveH, 0)).toFixed(1),
    totalIdleH: +(postSummaries.reduce((s, p) => s + p.totalIdleH, 0)).toFixed(1),
    totalNoShows: postSummaries.reduce((s, p) => s + p.totalNoShows, 0),
  };

  const summaryRow = {};
  for (const [key, label] of Object.entries(summaryHeaders)) {
    summaryRow[label] = totals[key];
  }
  const ws1 = XLSX.utils.json_to_sheet([summaryRow]);
  autoWidth(ws1, [summaryRow]);
  XLSX.utils.book_append_sheet(wb, ws1, isRu ? 'Сводка' : 'Summary');

  // Sheet 2: Posts
  const postHeaders = isRu
    ? ['Пост', 'Тип', 'Занятость (%)', 'Эффективность (%)', 'Всего авто', 'Авто/день', 'Ср. время (мин)', 'Ожидание (мин)', 'Активных ч', 'Простой ч', 'Работник (%)', 'Планов', 'Выполнено', 'No-show', 'План (ч)', 'Факт (ч)']
    : ['Post', 'Type', 'Occupancy (%)', 'Efficiency (%)', 'Total Vehicles', 'Vehicles/Day', 'Avg Time (min)', 'Wait Time (min)', 'Active Hours', 'Idle Hours', 'Worker (%)', 'Planned', 'Completed', 'No-shows', 'Planned (h)', 'Actual (h)'];

  const postRows = postSummaries.map(p => {
    const vals = [p.name, p.type, p.avgOccupancy, p.avgEfficiency, p.totalVehicles, p.avgVehiclesPerDay, p.avgTimePerVehicle, p.avgWaitTime, p.totalActiveH, p.totalIdleH, p.avgWorkerPresence, p.totalPlanned, p.totalCompleted, p.totalNoShows, p.plannedH, p.actualH];
    const row = {};
    postHeaders.forEach((h, i) => { row[h] = vals[i]; });
    return row;
  });
  const ws2 = XLSX.utils.json_to_sheet(postRows);
  autoWidth(ws2, postRows);
  XLSX.utils.book_append_sheet(wb, ws2, isRu ? 'Посты' : 'Posts');

  // Sheet 3: Daily
  const dailyHeaders = isRu
    ? ['Дата', 'Ср. занятость', 'Ср. эффективность', 'Всего авто', 'Активных мин', 'Простой мин', 'No-show']
    : ['Date', 'Avg Occupancy', 'Avg Efficiency', 'Total Vehicles', 'Active Minutes', 'Idle Minutes', 'No-shows'];

  const dailyRows = filteredDaily.map(d => {
    const vals = [d.date, +(d.avgOccupancy * 100).toFixed(1), +(d.avgEfficiency * 100).toFixed(1), d.totalVehicles, d.totalActiveMinutes, d.totalIdleMinutes, d.totalNoShows];
    const row = {};
    dailyHeaders.forEach((h, i) => { row[h] = vals[i]; });
    return row;
  });
  const ws3 = XLSX.utils.json_to_sheet(dailyRows);
  autoWidth(ws3, dailyRows);
  XLSX.utils.book_append_sheet(wb, ws3, isRu ? 'По дням' : 'Daily');

  // Sheet 4: Details (per-post daily breakdown)
  const detailHeaders = isRu
    ? ['Пост', 'Дата', 'Занятость', 'Эффективность', 'Авто', 'Ср. время', 'Ожидание', 'Активных мин', 'Простой мин', 'Работник', 'План', 'Выполнено', 'No-show', 'План (ч)', 'Факт (ч)']
    : ['Post', 'Date', 'Occupancy', 'Efficiency', 'Vehicles', 'Avg Time', 'Wait Time', 'Active Min', 'Idle Min', 'Worker', 'Planned', 'Completed', 'No-shows', 'Planned (h)', 'Actual (h)'];

  const detailRows = [];
  filteredPosts.forEach(post => {
    const postName = isRu ? post.name : (post.nameEn || post.name);
    post.days.forEach(d => {
      const vals = [postName, d.date, +(d.occupancyRate * 100).toFixed(1), +(d.efficiency * 100).toFixed(1), d.vehicleCount, d.avgTimePerVehicle, d.avgWaitTime, d.activeMinutes, d.idleMinutes, +(d.workerPresence * 100).toFixed(1), d.plannedOrders, d.completedOrders, d.noShows, d.plannedHours, d.actualHours];
      const row = {};
      detailHeaders.forEach((h, i) => { row[h] = vals[i]; });
      detailRows.push(row);
    });
  });
  const ws4 = XLSX.utils.json_to_sheet(detailRows);
  autoWidth(ws4, detailRows.length ? detailRows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws4, isRu ? 'Детали' : 'Details');

  const filename = `analytics-${getDateStr()}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * Export analytics container as PDF (A4 landscape)
 */
export async function exportToPdf(containerRef, isRu) {
  if (!containerRef.current) throw new Error('Container ref is empty');

  const canvas = await html2canvas(containerRef.current, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Header
  const title = isRu ? 'Аналитика постов' : 'Post Analytics';
  const dateStr = getDateStr();
  pdf.setFontSize(14);
  pdf.text(title, 14, 15);
  pdf.setFontSize(9);
  pdf.text(dateStr, pageW - 14, 15, { align: 'right' });

  // Image below header
  const marginTop = 22;
  const marginX = 10;
  const availW = pageW - marginX * 2;
  const availH = pageH - marginTop - 10;

  const imgW = canvas.width;
  const imgH = canvas.height;
  const ratio = Math.min(availW / imgW, availH / imgH);
  const drawW = imgW * ratio;
  const drawH = imgH * ratio;

  // If image is taller than one page, split across pages
  if (drawH > availH) {
    const pagesNeeded = Math.ceil(imgH / (availH / ratio));
    const sliceH = Math.floor(canvas.height / pagesNeeded);

    for (let i = 0; i < pagesNeeded; i++) {
      if (i > 0) pdf.addPage();

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.min(sliceH, canvas.height - i * sliceH);
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, -i * sliceH);

      const sliceData = sliceCanvas.toDataURL('image/png');
      const sliceRatio = Math.min(availW / sliceCanvas.width, availH / sliceCanvas.height);
      pdf.addImage(sliceData, 'PNG', marginX, i === 0 ? marginTop : 10, sliceCanvas.width * sliceRatio, sliceCanvas.height * sliceRatio);
    }
  } else {
    pdf.addImage(imgData, 'PNG', marginX, marginTop, drawW, drawH);
  }

  const filename = `analytics-${dateStr}.pdf`;
  pdf.save(filename);
  return filename;
}

/**
 * Download a chart container as PNG
 */
export async function downloadChartAsPng(chartEl, filename) {
  if (!chartEl) throw new Error('Chart element is empty');

  const canvas = await html2canvas(chartEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
    logging: false,
  });

  const link = document.createElement('a');
  link.download = filename || `chart-${getDateStr()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
