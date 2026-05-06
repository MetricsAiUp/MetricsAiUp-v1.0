// 6 правил детекции нестыковок между 1С (OneCWorkOrderMerged + OneCStageMerged)
// и CV (VehicleSession + PostStay).
//
// Каждое правило экспортирует функцию check(ctx) → null | DiscrepancyDraft.
// ctx = { order, stages, match, postStay, post, anchor }
//
// DiscrepancyDraft = {
//   type, severity, oneCValue, cvValue, description, descriptionEn,
//   orderNumber, vehicleSessionId, postId, plateNumber, vin
// }

// helpers ---------------------------------------------------------------------

function hours(seconds) {
  return seconds / 3600;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 16).replace('T', ' ');
}

// rule: no_show_in_cv
// 1С говорит что заказ-наряд закрыт/в работе И есть plate/VIN, а CV не нашла сессию
function noShowInCv(ctx) {
  const { order, match } = ctx;
  if (match.matchType !== 'none') return null;
  if (!['Закрыт', 'В работе'].includes(order.state)) return null;
  if (!order.plateNumber && !order.vin) return null;

  return {
    type: 'no_show_in_cv',
    severity: 'critical',
    description: `Заказ-наряд ${order.orderNumber} (${order.plateNumber || order.vin}) в состоянии «${order.state}», но CV не зафиксировала визит автомобиля`,
    descriptionEn: `Work order ${order.orderNumber} (${order.plateNumber || order.vin}) is "${order.state}" but CV recorded no visit`,
    oneCValue: { state: order.state, scheduledStart: order.scheduledStart, plateNumber: order.plateNumber, vin: order.vin },
    cvValue: null,
  };
}

// rule: no_show_in_1c
// CV PostStay > 30 мин на отслеживаемом посту, но в 1С нет current OneCStageMerged
// для этого окна
function noShowIn1C(ctx) {
  const { postStay, post, stages, anchor } = ctx;
  if (!postStay || !post || !post.isTracked) return null;
  const durationSec = (postStay.activeTime || 0) + (postStay.idleTime || 0);
  if (durationSec < 30 * 60) return null;

  // Есть ли стейдж 1С на этом посту в окне ±N часов от postStay.startTime?
  const t = postStay.startTime?.getTime();
  if (!t) return null;
  const win = 4 * 60 * 60 * 1000; // 4 часа окно поиска stage
  const matched = stages.find((s) => {
    if (s.postId !== postStay.postId) return false;
    const sst = new Date(s.scheduledStart).getTime();
    return Math.abs(sst - t) <= win;
  });
  if (matched) return null;

  return {
    type: 'no_show_in_1c',
    severity: 'warning',
    description: `На посту ${post.number || post.name} зафиксирован визит ${fmtDate(postStay.startTime)} (${Math.round(hours(durationSec) * 10) / 10}ч), но в 1С нет соответствующей записи`,
    descriptionEn: `Post ${post.number || post.name} has a visit at ${fmtDate(postStay.startTime)} (${Math.round(hours(durationSec) * 10) / 10}h) but no matching 1C record`,
    cvValue: { postStayId: postStay.id, startTime: postStay.startTime, endTime: postStay.endTime, durationSec },
    oneCValue: null,
    postId: postStay.postId,
  };
}

// rule: wrong_post
// CV PostStay.postId ≠ resolved 1С postId
function wrongPost(ctx) {
  const { order, stages, postStay, match } = ctx;
  if (!postStay || match.matchType === 'none') return null;
  // Найдём 1С stage для этого orderNumber в окне postStay
  const t = postStay.startTime?.getTime();
  if (!t) return null;
  const win = 4 * 60 * 60 * 1000;
  const stage = stages.find((s) => {
    if (s.orderNumber !== order.orderNumber) return false;
    const sst = new Date(s.scheduledStart).getTime();
    return Math.abs(sst - t) <= win;
  });
  if (!stage || !stage.postId) return null;
  if (stage.postId === postStay.postId) return null;

  return {
    type: 'wrong_post',
    severity: 'warning',
    description: `Заказ ${order.orderNumber}: 1С указывает «${stage.postRawName}», а CV зафиксировала визит на другом посту`,
    descriptionEn: `Order ${order.orderNumber}: 1C says "${stage.postRawName}" but CV recorded visit on a different post`,
    oneCValue: { stagePostId: stage.postId, postRawName: stage.postRawName, scheduledStart: stage.scheduledStart },
    cvValue: { postStayId: postStay.id, postId: postStay.postId, startTime: postStay.startTime },
    postId: stage.postId,
  };
}

// rule: overstated_norm_hours
// 1С normHours > 1.5 × CV PostStay.activeTime (в часах)
function overstatedNormHours(ctx) {
  const { order, postStay } = ctx;
  if (!postStay || !order.normHours) return null;
  const cvHours = hours(postStay.activeTime || 0);
  if (cvHours <= 0) return null;
  if (order.normHours <= 1.5 * cvHours) return null;

  return {
    type: 'overstated_norm_hours',
    severity: 'critical',
    description: `Заказ ${order.orderNumber}: в 1С указано ${order.normHours}ч нормы, фактически CV зафиксировала ${Math.round(cvHours * 10) / 10}ч активной работы`,
    descriptionEn: `Order ${order.orderNumber}: 1C lists ${order.normHours}h norm but CV recorded ${Math.round(cvHours * 10) / 10}h active work`,
    oneCValue: { normHours: order.normHours, executor: order.executor },
    cvValue: { activeHours: cvHours, postStayId: postStay.id },
  };
}

// rule: understated_actual_time
// CV PostStay.activeTime > 1.5 × 1С normHours
function understatedActualTime(ctx) {
  const { order, postStay } = ctx;
  if (!postStay || !order.normHours) return null;
  const cvHours = hours(postStay.activeTime || 0);
  if (cvHours <= 0) return null;
  if (cvHours <= 1.5 * order.normHours) return null;

  return {
    type: 'understated_actual_time',
    severity: 'warning',
    description: `Заказ ${order.orderNumber}: CV зафиксировала ${Math.round(cvHours * 10) / 10}ч активной работы при норме 1С ${order.normHours}ч`,
    descriptionEn: `Order ${order.orderNumber}: CV recorded ${Math.round(cvHours * 10) / 10}h active work but 1C norm is ${order.normHours}h`,
    oneCValue: { normHours: order.normHours },
    cvValue: { activeHours: cvHours, postStayId: postStay.id },
  };
}

// rule: time_mismatch
// abs(1С.closedAt − CV PostStay.endTime) > 60 мин
function timeMismatch(ctx) {
  const { order, postStay } = ctx;
  if (!postStay || !postStay.endTime || !order.closedAt) return null;
  const diffMin = Math.abs(postStay.endTime.getTime() - order.closedAt.getTime()) / 60000;
  if (diffMin <= 60) return null;

  return {
    type: 'time_mismatch',
    severity: 'warning',
    description: `Заказ ${order.orderNumber}: время закрытия в 1С (${fmtDate(order.closedAt)}) отличается от CV (${fmtDate(postStay.endTime)}) на ${Math.round(diffMin)} мин`,
    descriptionEn: `Order ${order.orderNumber}: 1C close time (${fmtDate(order.closedAt)}) differs from CV (${fmtDate(postStay.endTime)}) by ${Math.round(diffMin)} min`,
    oneCValue: { closedAt: order.closedAt },
    cvValue: { postStayEnd: postStay.endTime, postStayId: postStay.id },
  };
}

const RULES = [
  noShowInCv,
  noShowIn1C,
  wrongPost,
  overstatedNormHours,
  understatedActualTime,
  timeMismatch,
];

module.exports = {
  RULES,
  noShowInCv,
  noShowIn1C,
  wrongPost,
  overstatedNormHours,
  understatedActualTime,
  timeMismatch,
};
