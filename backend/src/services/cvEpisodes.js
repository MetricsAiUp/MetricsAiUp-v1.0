// Построение CV-эпизодов занятости постов/зон из MonitoringSnapshot и
// сопоставление их с plate из 1С (для эндпоинта /matching/closed-cv).
//
// Модель «эпизода»: непрерывный промежуток времени, в течение которого
// status зоны был не-free (occupied/active_work). По правилу пользователя:
// «пока пост занят, все шумные plate с этого поста — одна и та же машина».
// Граница эпизода — переход в status='free'.
//
// Для каждого эпизода считаем plate-варианты (counts) и consensus.
// При матчинге с 1С-plate берём BEST вариант (max plateScore) — реальный
// номер один из распознанных, выбираем тот, что лучше совпал.

const prisma = require('../config/database');

// --- Нормализация plate ---------------------------------------------------

// Гомоглифы латиница → кириллица (CV-движок часто путает алфавиты).
const HOMO_LAT_TO_CYR = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К',
  M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
};

function normFull(p) {
  if (!p) return null;
  let s = String(p).toUpperCase().replace(/[\s\-_.]/g, '');
  s = s.split('').map((c) => HOMO_LAT_TO_CYR[c] || c).join('');
  return s || null;
}

// Ядро = удалить хвостовые 1-3 цифр (региональный код БЕЛ/РФ),
// но только если ядро остаётся длиной ≥ 4 символов.
function core(normalized) {
  if (!normalized) return null;
  const m = normalized.match(/^(.+?)(\d{1,3})$/);
  if (m && m[1].length >= 4) return m[1];
  return normalized;
}

// Levenshtein с ранним выходом по max.
function levenshtein(a, b, max = 2) {
  if (a === b) return 0;
  if (!a || !b) return Math.max((a || '').length, (b || '').length);
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    let rmin = dp[0];
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
      if (dp[j] < rmin) rmin = dp[j];
    }
    if (rmin > max) return max + 1;
  }
  return dp[n];
}

// Каскад совпадения plate. Возвращает { score, matchType } или null.
//   exact      1.00 — нормализованные равны
//   core       0.85 — равны без региона
//   lev1       0.70 — Lev=1 на нормализованном
//   lev2       0.55 — Lev=2 на нормализованном
//   last4      0.30 — последние 4 символа ядра совпадают
function matchPlate(cvPlate, refPlate) {
  const a = normFull(cvPlate);
  const b = normFull(refPlate);
  if (!a || !b) return { score: 0, matchType: 'none' };
  if (a === b) return { score: 1.00, matchType: 'exact' };
  const ca = core(a);
  const cb = core(b);
  if (ca && cb && ca === cb) return { score: 0.85, matchType: 'core' };
  const d = levenshtein(a, b, 2);
  if (d <= 1) return { score: 0.70, matchType: 'lev1' };
  if (d <= 2) return { score: 0.55, matchType: 'lev2' };
  if (ca && cb && ca.length >= 4 && cb.length >= 4 && ca.slice(-4) === cb.slice(-4)) {
    return { score: 0.30, matchType: 'last4' };
  }
  return { score: 0, matchType: 'none' };
}

// --- Извлечение postNumber из zoneName ------------------------------------

function extractPostNumber(zoneName) {
  if (!zoneName) return null;
  const m = String(zoneName).match(/Пост\s+(\d{1,2})/);
  return m ? parseInt(m[1], 10) : null;
}

// --- Построение эпизодов --------------------------------------------------

// Один эпизод занятости (пока status != 'free').
function buildEpisode(zoneName, postNumber) {
  return {
    zoneName,
    postNumber,
    startTime: null,
    endTime: null,
    durationSec: 0,
    plateVariants: new Map(), // plateRaw → count
    totalPlateReads: 0,
    totalSnapshots: 0,
    worksSeen: false,
  };
}

function finalizeEpisode(ep) {
  // consensus = mode по plateVariants
  let consensusPlate = null;
  let consensusCount = 0;
  for (const [plate, cnt] of ep.plateVariants) {
    if (cnt > consensusCount) {
      consensusPlate = plate;
      consensusCount = cnt;
    }
  }
  const total = ep.totalPlateReads;
  const consensusRatio = total > 0 ? consensusCount / total : 0;
  // Превратим Map в обычный объект для JSON.
  const variantsObj = {};
  for (const [k, v] of ep.plateVariants) variantsObj[k] = v;
  return {
    zoneName: ep.zoneName,
    postNumber: ep.postNumber,
    startTime: ep.startTime ? ep.startTime.toISOString() : null,
    endTime: ep.endTime ? ep.endTime.toISOString() : null,
    durationSec: ep.durationSec,
    plateConsensus: consensusPlate,
    plateConsensusCount: consensusCount,
    plateConsensusRatio: consensusRatio,
    plateVariants: variantsObj,
    totalPlateReads: total,
    totalSnapshots: ep.totalSnapshots,
    worksInProgressSeen: ep.worksSeen,
  };
}

// Загрузить и сгруппировать MonitoringSnapshot в эпизоды занятости в окне [from, to].
// Возвращает массив эпизодов, отсортированный по startTime.
async function buildEpisodesInWindow(from, to) {
  const where = {};
  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = from;
    if (to) where.timestamp.lte = to;
  }
  // Берём только поля, нужные для построения эпизодов.
  const rows = await prisma.monitoringSnapshot.findMany({
    where,
    select: {
      zoneName: true,
      status: true,
      plateNumber: true,
      worksInProgress: true,
      timestamp: true,
    },
    orderBy: [{ zoneName: 'asc' }, { timestamp: 'asc' }],
  });

  const episodes = [];
  let currentZone = null;
  let currentPost = null;
  let inEpisode = null; // текущий открытый эпизод по этой zone

  function closeEpisode(endTimestamp) {
    if (!inEpisode) return;
    inEpisode.endTime = endTimestamp || inEpisode.endTime || inEpisode.startTime;
    if (inEpisode.startTime && inEpisode.endTime) {
      inEpisode.durationSec = Math.max(0, Math.round((inEpisode.endTime.getTime() - inEpisode.startTime.getTime()) / 1000));
    }
    episodes.push(finalizeEpisode(inEpisode));
    inEpisode = null;
  }

  for (const row of rows) {
    if (row.zoneName !== currentZone) {
      // Закрываем эпизод предыдущей зоны (если был открыт без явного free).
      closeEpisode(null);
      currentZone = row.zoneName;
      currentPost = extractPostNumber(currentZone);
    }
    const isFree = row.status === 'free';
    if (isFree) {
      // free → закрываем открытый эпизод этим timestamp как endTime.
      if (inEpisode) {
        // endTime = timestamp перехода в free (строго до самой записи free).
        inEpisode.endTime = row.timestamp;
        if (inEpisode.startTime) {
          inEpisode.durationSec = Math.max(0, Math.round((inEpisode.endTime.getTime() - inEpisode.startTime.getTime()) / 1000));
        }
        episodes.push(finalizeEpisode(inEpisode));
        inEpisode = null;
      }
      continue;
    }
    // не-free
    if (!inEpisode) {
      inEpisode = buildEpisode(currentZone, currentPost);
      inEpisode.startTime = row.timestamp;
    }
    inEpisode.endTime = row.timestamp;
    inEpisode.totalSnapshots += 1;
    if (row.worksInProgress) inEpisode.worksSeen = true;
    if (row.plateNumber) {
      const cur = inEpisode.plateVariants.get(row.plateNumber) || 0;
      inEpisode.plateVariants.set(row.plateNumber, cur + 1);
      inEpisode.totalPlateReads += 1;
    }
  }
  // Закрыть последний открытый эпизод.
  closeEpisode(null);

  return episodes;
}

// --- Матчинг 1С-plate против списка эпизодов в окне ------------------------

// Для одного 1С-plate и интервала [orderStart, orderEnd]: вернуть набор эпизодов,
// у которых хотя бы один plate-вариант имеет plateScore ≥ minScore, с финальной
// вероятностью, типом матча и метаинформацией.
//
//   probability = plateScore × (0.5 + 0.5 × consensusRatio) × (0.4 + 0.6 × timeOverlap)
//
// timeOverlap = пересечение интервалов / max(длина окон) ∈ [0..1].
// Если интервалы вообще не пересекаются → timeOverlap = 0 (множитель 0.4).
function computeTimeOverlap(orderStart, orderEnd, epStart, epEnd) {
  if (!orderStart || !orderEnd || !epStart || !epEnd) return 0;
  const a0 = new Date(orderStart).getTime();
  const a1 = new Date(orderEnd).getTime();
  const b0 = new Date(epStart).getTime();
  const b1 = new Date(epEnd).getTime();
  if (![a0, a1, b0, b1].every(Number.isFinite)) return 0;
  const overlap = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const denom = Math.max(a1 - a0, b1 - b0);
  if (denom <= 0) return overlap > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, overlap / denom));
}

// matchType ranking — для агрегата выбираем «лучший» тип матча.
const MATCH_TYPE_RANK = { exact: 5, core: 4, lev1: 3, lev2: 2, last4: 1, none: 0 };
function bestMatchType(a, b) {
  return (MATCH_TYPE_RANK[a] || 0) >= (MATCH_TYPE_RANK[b] || 0) ? a : b;
}

// Найти plate-score для эпизода против refPlate: max по всем вариантам.
function scoreEpisodeAgainstRef(episode, refPlate) {
  let bestScore = 0;
  let bestMatchTypeStr = 'none';
  let bestVariant = null;
  for (const variant of Object.keys(episode.plateVariants)) {
    const m = matchPlate(variant, refPlate);
    if (m.score > bestScore) {
      bestScore = m.score;
      bestMatchTypeStr = m.matchType;
      bestVariant = variant;
    }
  }
  return { plateScore: bestScore, matchType: bestMatchTypeStr, bestVariant };
}

module.exports = {
  // публичные:
  buildEpisodesInWindow,
  matchPlate,
  computeTimeOverlap,
  scoreEpisodeAgainstRef,
  bestMatchType,
  extractPostNumber,
  // вспомогательные (для тестов):
  normFull,
  core,
  levenshtein,
  MATCH_TYPE_RANK,
};
