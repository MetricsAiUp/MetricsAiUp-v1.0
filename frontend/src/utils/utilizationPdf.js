// Многостраничный PDF для отчёта «Занятость и загрузка».
// Подход: рендерим невидимый «print-контейнер» с разметкой A4 portrait
// (794×1123px при 96dpi) в светлой теме, секциями. Каждая секция = одна
// страница PDF. Браузер сам рендерит текст (включая кириллицу), html2canvas
// снимает в PNG, jsPDF собирает многостраничный документ.

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const A4_W_MM = 210;
const A4_H_MM = 297;
const PAGE_W_PX = 794;   // 210mm @ 96dpi
const PAGE_H_PX = 1123;  // 297mm @ 96dpi
const PAGE_PAD = 40;

function isoDate(d) { return d.toISOString().slice(0, 10); }

function fmtNumber(n, digits = 1) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function fmtMoney(n, currency = '₽') {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ' + currency;
}

// Цветовая шкала согласована со страницей:
//   90+ — тёмно-зелёный, 70+ — зелёный, 50+ — янтарь, <50 — серый/красный.
function loadColor(pct) {
  if (pct == null) return '#94a3b8';
  if (pct >= 90) return '#059669';
  if (pct >= 70) return '#16a34a';
  if (pct >= 50) return '#d97706';
  if (pct >= 30) return '#ea580c';
  return '#dc2626';
}

function loadBg(pct) {
  if (pct == null) return '#f1f5f9';
  if (pct >= 90) return '#d1fae5';
  if (pct >= 70) return '#dcfce7';
  if (pct >= 50) return '#fef3c7';
  if (pct >= 30) return '#ffedd5';
  return '#fee2e2';
}

function fmtDateRange(from, to, isRu) {
  const locale = isRu ? 'ru-RU' : 'en-US';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  return from.toLocaleDateString(locale, opts) + ' — ' + to.toLocaleDateString(locale, opts);
}

function typeLabel(type, isRu) {
  if (!type) return '';
  const map = isRu
    ? { heavy: 'Грузовой', light: 'Легковой', special: 'Специальный' }
    : { heavy: 'Heavy', light: 'Light', special: 'Special' };
  return map[type] || type;
}

// Календарная матрица: строки = недели (Пн–Вс), столбцы = дни.
// Заполняем «выпадающие» дни (вне периода) пустышками, чтобы сетка ровная.
function buildHeatmapMatrix(aggregatedByDay, from, to) {
  const byDate = new Map(aggregatedByDay.map(d => [d.date, d]));
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  const startDow = (start.getDay() + 6) % 7; // Mon=0, Sun=6
  start.setDate(start.getDate() - startDow);
  const end = new Date(to); end.setHours(0, 0, 0, 0);
  const endDow = (end.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - endDow));
  const fromYmd = isoDate(from);
  const toYmd = isoDate(to);
  const weeks = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const ymd = isoDate(cur);
      const d = byDate.get(ymd);
      const inPeriod = ymd >= fromYmd && ymd <= toYmd;
      week.push({ date: ymd, day: cur.getDate(), inPeriod, ...(d || {}) });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// ── HTML-блоки ────────────────────────────────────────────────────────────

function pageWrapper(content, { pageNum, totalPages, generatedAt, isRu }) {
  return `
    <div style="
      width:${PAGE_W_PX}px;height:${PAGE_H_PX}px;
      padding:${PAGE_PAD}px;box-sizing:border-box;
      background:#ffffff;color:#0f172a;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      position:relative;overflow:hidden;
    ">
      ${content}
      <div style="
        position:absolute;bottom:${PAGE_PAD / 2}px;left:${PAGE_PAD}px;right:${PAGE_PAD}px;
        display:flex;justify-content:space-between;
        font-size:9px;color:#94a3b8;
        border-top:1px solid #e2e8f0;padding-top:6px;
      ">
        <span>MetricsAiUp · ${generatedAt}</span>
        <span>${isRu ? 'Стр.' : 'Page'} ${pageNum} ${isRu ? 'из' : 'of'} ${totalPages}</span>
      </div>
    </div>
  `;
}

function pageHeader(title, period) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:baseline;
                border-bottom:2px solid #6366f1;padding-bottom:8px;margin-bottom:14px;">
      <h1 style="font-size:17px;font-weight:700;margin:0;color:#0f172a;">${title}</h1>
      <div style="font-size:11px;color:#64748b;">${period}</div>
    </div>
  `;
}

function kpiCard(label, value, unit, color, deltaPct, isRu) {
  const deltaHtml = (deltaPct != null && isFinite(deltaPct))
    ? `<div style="font-size:10px;color:${deltaPct > 0 ? '#059669' : deltaPct < 0 ? '#dc2626' : '#94a3b8'};margin-top:4px;">${deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '•'} ${Math.abs(deltaPct).toFixed(1)}% ${isRu ? 'vs прош.' : 'vs prev.'}</div>`
    : '';
  return `
    <div style="flex:1;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
      <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${label}</div>
      <div style="font-size:22px;font-weight:700;color:${color};line-height:1;">
        ${value}<span style="font-size:11px;color:#94a3b8;font-weight:400;margin-left:4px;">${unit || ''}</span>
      </div>
      ${deltaHtml}
    </div>
  `;
}

function buildCoverContent({
  totals, hourlyRate, currency, errorPct, errorNote, deltaPct,
  isPosts, isRu, heatmapWeeks,
}) {
  const idle = totals && totals.shiftFund != null && totals.busy != null
    ? Math.max(0, totals.shiftFund - totals.busy) : null;

  const kpiRow = `
    <div style="display:flex;gap:10px;margin-bottom:12px;">
      ${kpiCard(isRu ? 'Рабочий фонд' : 'Work Fund', fmtNumber(totals?.shiftFund), isRu ? 'ч' : 'h', '#0f172a', null, isRu)}
      ${kpiCard(isRu ? 'Занятость' : 'Busy', fmtNumber(totals?.busy), isRu ? 'ч' : 'h', '#6366f1', deltaPct ? deltaPct('busy') : null, isRu)}
      ${kpiCard(isRu ? 'Простой' : 'Idle', fmtNumber(idle), isRu ? 'ч' : 'h', '#f59e0b', null, isRu)}
      ${kpiCard(isRu ? 'Загрузка' : 'Load', fmtNumber(totals?.loadPct, 1), '%', loadColor(totals?.loadPct), deltaPct ? deltaPct('loadPct') : null, isRu)}
    </div>
  `;

  const finBlock = (isPosts && hourlyRate != null) ? `
    <div style="display:flex;gap:10px;margin-bottom:12px;">
      ${kpiCard(isRu ? 'Потенциал' : 'Potential', fmtMoney(totals?.potential, currency), '', '#0f172a', null, isRu)}
      ${kpiCard(isRu ? 'Заработано' : 'Earned', fmtMoney(totals?.earned, currency), '', '#059669', deltaPct ? deltaPct('earned') : null, isRu)}
      ${kpiCard(isRu ? 'Потери' : 'Lost', fmtMoney(totals?.lost, currency), '', '#dc2626', deltaPct ? deltaPct('lost') : null, isRu)}
    </div>
  ` : '';

  const errorBlock = (errorPct != null) ? `
    <div style="padding:8px 12px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;
                font-size:11px;color:#78350f;margin-bottom:12px;">
      <strong>${isRu ? 'Погрешность' : 'Margin'}: ±${errorPct}%</strong>${errorNote ? ' — ' + errorNote : ''}
    </div>
  ` : '';

  const labels = isRu ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const cellH = heatmapWeeks.length > 4 ? 46 : 56;

  const heatmap = `
    <div>
      <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:6px;">
        ${isRu ? 'Календарь занятости' : 'Utilization Calendar'}
      </div>
      <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <thead>
          <tr>
            ${labels.map(l => `<th style="font-size:10px;color:#64748b;font-weight:500;padding:4px;text-align:center;">${l}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${heatmapWeeks.map(week => `
            <tr>
              ${week.map(cell => {
                if (!cell.inPeriod) {
                  return `<td style="padding:2px;"><div style="height:${cellH}px;background:#f8fafc;border:1px dashed #e2e8f0;border-radius:6px;"></div></td>`;
                }
                const pct = cell.loadPct;
                const fg = loadColor(pct);
                const bg = loadBg(pct);
                return `
                  <td style="padding:2px;vertical-align:top;">
                    <div style="height:${cellH}px;background:${bg};border:1px solid ${fg};border-radius:6px;
                                padding:4px 6px;display:flex;flex-direction:column;justify-content:space-between;">
                      <div style="font-size:9px;color:#475569;">${cell.day}</div>
                      <div style="font-size:13px;font-weight:700;color:${fg};text-align:right;line-height:1;">
                        ${pct != null ? pct + '%' : '—'}
                      </div>
                    </div>
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top:10px;display:flex;gap:14px;align-items:center;font-size:10px;color:#64748b;">
        <span>${isRu ? 'Шкала:' : 'Scale:'}</span>
        ${[
          { lo: 90, hi: 100, label: '90–100%' },
          { lo: 70, hi: 90,  label: '70–90%' },
          { lo: 50, hi: 70,  label: '50–70%' },
          { lo: 30, hi: 50,  label: '30–50%' },
          { lo: 0,  hi: 30,  label: '<30%' },
        ].map(s => `
          <span style="display:inline-flex;align-items:center;gap:4px;">
            <span style="width:14px;height:10px;background:${loadBg((s.lo + s.hi) / 2)};border:1px solid ${loadColor((s.lo + s.hi) / 2)};border-radius:3px;"></span>
            ${s.label}
          </span>
        `).join('')}
      </div>
    </div>
  `;

  return kpiRow + finBlock + errorBlock + heatmap;
}

function progressCellHtml(pct, big = false) {
  const fg = loadColor(pct);
  const bg = loadBg(pct);
  const bar = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
  const barH = big ? 10 : 8;
  const fs = big ? 12 : 11;
  return `
    <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">
      <div style="flex:1;max-width:90px;height:${barH}px;background:${bg};border-radius:${barH / 2}px;overflow:hidden;">
        <div style="width:${bar}%;height:100%;background:${fg};"></div>
      </div>
      <span style="font-size:${fs}px;font-weight:700;color:${fg};min-width:40px;text-align:right;">
        ${pct != null ? fmtNumber(pct, 1) + '%' : '—'}
      </span>
    </div>
  `;
}

function buildEntityTable({ byEntity, isPosts, hourlyRate, currency, isRu, totals }) {
  const showMoney = isPosts && hourlyRate != null;
  const headers = isRu
    ? ['#', 'Имя', 'Тип', 'Раб. фонд, ч', 'Занят., ч', 'Простой, ч', 'Загрузка']
    : ['#', 'Name', 'Type', 'Fund, h', 'Busy, h', 'Idle, h', 'Load'];
  if (showMoney) headers.push(isRu ? 'Заработано' : 'Earned', isRu ? 'Потери' : 'Lost');

  const rows = byEntity.map((e, idx) => {
    const idle = e.shiftFund != null && e.busy != null ? Math.max(0, e.shiftFund - e.busy) : e.idle;
    return `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:6px 8px;font-size:10px;color:#94a3b8;text-align:center;">${e.number ?? (idx + 1)}</td>
        <td style="padding:6px 8px;font-size:11px;font-weight:600;color:#0f172a;">${e.name}</td>
        <td style="padding:6px 8px;font-size:10px;color:#64748b;">${typeLabel(e.type, isRu)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#0f172a;text-align:right;font-variant-numeric:tabular-nums;">${fmtNumber(e.shiftFund)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#6366f1;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">${fmtNumber(e.busy)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#94a3b8;text-align:right;font-variant-numeric:tabular-nums;">${fmtNumber(idle)}</td>
        <td style="padding:6px 8px;text-align:right;">${progressCellHtml(e.loadPct)}</td>
        ${showMoney ? `
          <td style="padding:6px 8px;font-size:10px;color:#059669;text-align:right;">${fmtMoney(e.earned, currency)}</td>
          <td style="padding:6px 8px;font-size:10px;color:#dc2626;text-align:right;">${fmtMoney(e.lost, currency)}</td>
        ` : ''}
      </tr>
    `;
  });

  const totalIdle = totals && totals.shiftFund != null && totals.busy != null
    ? Math.max(0, totals.shiftFund - totals.busy) : null;

  const totalRow = `
    <tr style="background:#eef2ff;border-top:2px solid #6366f1;">
      <td style="padding:8px;font-size:11px;color:#4338ca;text-align:center;font-weight:700;">Σ</td>
      <td style="padding:8px;font-size:11px;color:#4338ca;font-weight:700;">${isRu ? 'ИТОГО' : 'TOTAL'}</td>
      <td></td>
      <td style="padding:8px;font-size:11px;color:#0f172a;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">${fmtNumber(totals?.shiftFund)}</td>
      <td style="padding:8px;font-size:11px;color:#6366f1;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">${fmtNumber(totals?.busy)}</td>
      <td style="padding:8px;font-size:11px;color:#475569;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">${fmtNumber(totalIdle)}</td>
      <td style="padding:8px;text-align:right;">${progressCellHtml(totals?.loadPct, true)}</td>
      ${showMoney ? `
        <td style="padding:8px;font-size:11px;color:#059669;text-align:right;font-weight:700;">${fmtMoney(totals?.earned, currency)}</td>
        <td style="padding:8px;font-size:11px;color:#dc2626;text-align:right;font-weight:700;">${fmtMoney(totals?.lost, currency)}</td>
      ` : ''}
    </tr>
  `;

  return `
    <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;">
      ${isRu ? 'По ' + (isPosts ? 'постам' : 'зонам') : (isPosts ? 'Per post' : 'Per zone')}
    </div>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;border-bottom:2px solid #6366f1;">
          ${headers.map((l, i) => `<th style="padding:8px;font-size:10px;color:#475569;text-align:${i <= 2 ? 'left' : 'right'};font-weight:600;">${l}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
        ${totalRow}
      </tbody>
    </table>
  `;
}

function buildDailyTable({ rows, isRu }) {
  const headers = isRu
    ? ['Дата', 'Раб. фонд, ч', 'Занят., ч', 'Простой, ч', 'Загрузка']
    : ['Date', 'Fund, h', 'Busy, h', 'Idle, h', 'Load'];
  const dowsRu = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const dowsEn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dows = isRu ? dowsRu : dowsEn;

  const fmtDate = (ymd) => {
    const [y, m, d] = ymd.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    const dow = dows[dt.getDay()];
    return `${d}.${m} <span style="color:#94a3b8;font-size:9px;">${dow}</span>`;
  };

  const html = rows.map((d, idx) => {
    const idle = d.shiftFund != null && d.busy != null ? Math.max(0, d.shiftFund - d.busy) : null;
    return `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:6px 8px;font-size:11px;color:#0f172a;">${fmtDate(d.date)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#0f172a;text-align:right;font-variant-numeric:tabular-nums;">${fmtNumber(d.shiftFund)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#6366f1;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">${fmtNumber(d.busy)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#94a3b8;text-align:right;font-variant-numeric:tabular-nums;">${fmtNumber(idle)}</td>
        <td style="padding:6px 8px;text-align:right;width:170px;">${progressCellHtml(d.loadPct)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;">
      ${isRu ? 'По дням' : 'Per day'}
    </div>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;border-bottom:2px solid #6366f1;">
          ${headers.map((l, i) => `<th style="padding:8px;font-size:10px;color:#475569;text-align:${i === 0 ? 'left' : 'right'};font-weight:600;">${l}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${html}
      </tbody>
    </table>
  `;
}

// ── Главная функция экспорта ─────────────────────────────────────────────

export async function exportUtilizationPdf({
  from, to, entity, isPosts, isRu,
  totals, byEntity, aggregatedByDay,
  hourlyRate, currency, errorPct, errorNote,
  deltaPct,
}) {
  const title = isRu
    ? `Сводный отчёт · ${isPosts ? 'занятость постов' : 'занятость зон'}`
    : `Summary report · ${isPosts ? 'post utilization' : 'zone utilization'}`;
  const period = fmtDateRange(from, to, isRu);
  const generatedAt = new Date().toLocaleString(isRu ? 'ru-RU' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
  const heatmapWeeks = buildHeatmapMatrix(aggregatedByDay, from, to);

  // Собираем контент каждой страницы
  const sections = [];

  // 1) Cover: KPI + Heatmap
  sections.push(
    pageHeader(title, period) +
    buildCoverContent({ totals, hourlyRate, currency, errorPct, errorNote, deltaPct, isPosts, isRu, heatmapWeeks })
  );

  // 2) Таблица по сущностям
  sections.push(
    pageHeader(title, period) +
    buildEntityTable({ byEntity, isPosts, hourlyRate, currency, isRu, totals })
  );

  // 3) Таблица по дням (чанки по 28 строк, чтобы влезть на A4)
  if (aggregatedByDay && aggregatedByDay.length > 0) {
    const chunkSize = 28;
    for (let i = 0; i < aggregatedByDay.length; i += chunkSize) {
      const chunk = aggregatedByDay.slice(i, i + chunkSize);
      sections.push(
        pageHeader(title, period) +
        buildDailyTable({ rows: chunk, isRu })
      );
    }
  }

  const totalPages = sections.length;

  // Off-screen контейнер
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-99999px',
    top: '0',
    zIndex: '-1',
  });

  for (let i = 0; i < sections.length; i++) {
    const tmp = document.createElement('div');
    tmp.innerHTML = pageWrapper(sections[i], { pageNum: i + 1, totalPages, generatedAt, isRu });
    container.appendChild(tmp.firstElementChild);
  }

  document.body.appendChild(container);
  // Ждём пары кадров, чтобы DOM/шрифты успели применить стили
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let i = 0; i < container.children.length; i++) {
      const pageEl = container.children[i];
      // eslint-disable-next-line no-await-in-loop
      const canvas = await html2canvas(pageEl, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        width: PAGE_W_PX,
        height: PAGE_H_PX,
        windowWidth: PAGE_W_PX,
        windowHeight: PAGE_H_PX,
      });
      if (i > 0) pdf.addPage();
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, A4_W_MM, A4_H_MM);
    }
    const filename = `utilization-${entity}-${isoDate(from)}-${isoDate(to)}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
