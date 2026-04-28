const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { recognizePlateBest, isAvailable: isAnprAvailable, normalizePlate } = require('./plateRecognition');
const { recognizeV2 } = require('./plateRecognitionV2');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'settings.json');
const ffmpegPath = path.join(__dirname, '..', '..', '..', '..', 'node_modules/ffmpeg-static/ffmpeg');

// Dataset collection for model distillation
const DATASET_DIR = path.join(__dirname, '..', 'data', 'dataset');
const DATASET_IMAGES = path.join(DATASET_DIR, 'images');
const DATASET_LABELS = path.join(DATASET_DIR, 'labels');

// Ensure dataset dirs exist
for (const dir of [DATASET_IMAGES, DATASET_LABELS]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(str) {
  return str.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_').replace(/_+/g, '_').slice(0, 60);
}

/**
 * Save frame + Claude labels to dataset for future model training.
 * Image: data/dataset/images/{id}.jpg
 * Label: data/dataset/labels/{id}.json
 */
function saveToDataset(jpegBuffer, zoneName, zoneType, claudeResult) {
  // Dataset collection toggle — defaults OFF now that the v2 service is in
  // production. Re-enable by setting `"collectDataset": true` in settings.json
  // when relabeling work or a new training round is needed.
  const settings = loadSettings();
  if (!settings.collectDataset) return;

  try {
    const ts = Date.now();
    const slug = slugify(zoneName);
    const id = `${ts}_${slug}`;

    // Save image
    fs.writeFileSync(path.join(DATASET_IMAGES, `${id}.jpg`), jpegBuffer);

    // Save structured labels — each parameter separate for targeted training
    const label = {
      id,
      timestamp: new Date(ts).toISOString(),
      zone: zoneName,
      zoneType: zoneType || 'unknown',

      // Core classification labels
      occupied: !!claudeResult.occupied,
      confidence: claudeResult.confidence || 'LOW',

      // Vehicle attributes (null if no vehicle)
      vehiclePresent: !!claudeResult.occupied,
      vehicleColor: claudeResult.vehicle?.color || null,
      vehicleMake: claudeResult.vehicle?.make || null,
      vehicleModel: claudeResult.vehicle?.model || null,
      vehicleBody: claudeResult.vehicle?.body || null,

      // Work detection
      worksInProgress: !!claudeResult.worksInProgress,
      worksDescription: claudeResult.worksDescription || null,

      // Scene context
      peopleCount: claudeResult.peopleCount || 0,
      openParts: claudeResult.openParts || [],
      description: claudeResult.description || '',
    };

    fs.writeFileSync(
      path.join(DATASET_LABELS, `${id}.json`),
      JSON.stringify(label, null, 2)
    );

    console.log(`[Dataset] Saved: ${id}.jpg + .json (occupied=${label.occupied}, color=${label.vehicleColor}, make=${label.vehicleMake})`);
  } catch (err) {
    console.warn(`[Dataset] Save failed: ${err.message}`);
  }
}

function loadSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveSettings(settings) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2));
}

/**
 * Crop and enlarge a region from a JPEG buffer using FFmpeg.
 * Returns a new JPEG buffer of the cropped+enlarged area.
 */
function cropAndEnlarge(jpegBuffer, cropX, cropY, cropW, cropH, imgW, imgH) {
  return new Promise((resolve, reject) => {
    // Clamp coordinates
    const x = Math.max(0, Math.round(cropX));
    const y = Math.max(0, Math.round(cropY));
    const w = Math.min(Math.round(cropW), imgW - x);
    const h = Math.min(Math.round(cropH), imgH - y);

    if (w < 5 || h < 5) return reject(new Error('Crop area too small'));

    // Scale up to at least 400px wide for better OCR
    const scaleW = Math.max(400, w * 3);

    const args = [
      '-f', 'image2pipe', '-i', 'pipe:0',
      '-vf', `crop=${w}:${h}:${x}:${y},scale=${scaleW}:-1:flags=lanczos`,
      '-q:v', '1',
      '-f', 'image2', '-vcodec', 'mjpeg',
      'pipe:1'
    ];

    const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];

    proc.stdout.on('data', c => chunks.push(c));
    proc.on('close', () => {
      if (chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error('FFmpeg crop failed'));
    });
    proc.on('error', reject);
    proc.stdin.write(jpegBuffer);
    proc.stdin.end();
  });
}

/**
 * Claude Vision + ANPR-v1 analyzer (legacy path).
 * Kept under the explicit name `analyzeZoneImageClaude`; the public
 * `analyzeZoneImage` further down is a router that picks v2 vs claude
 * based on settings.visionProvider.
 *
 * Two-pass approach:
 *   Pass 1: General analysis (car, color, model, approximate plate location)
 *   Pass 2: If plate not confidently read, crop+enlarge plate area and re-read
 */
async function analyzeZoneImageClaude(jpegBuffer, zoneName, zoneType) {
  const settings = loadSettings();
  const apiKey = settings.anthropicApiKey;

  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Set it in Settings.');
  }

  const client = new Anthropic({ apiKey });
  const modelUsed = settings.visionModel || 'claude-sonnet-4-20250514';
  const base64 = jpegBuffer.toString('base64');
  const typeLabel = zoneType === 'lift' ? 'подъёмник (vehicle lift/bay)' : 'рабочая зона (work area)';
  let totalTokens = 0;

  // === Run Claude Vision + ANPR in parallel ===
  // Claude: general analysis (occupied, vehicle, works, people)
  // ANPR: plate recognition via GPU (nomeroff-net, more accurate)

  const claudePromise = client.messages.create({
    model: modelUsed,
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: `Это кадр с камеры видеонаблюдения, зона "${zoneName}" (тип: ${typeLabel}) на автосервисе (СТО) в Беларуси.

Проанализируй изображение и ответь:
1. Есть ли АВТОМОБИЛЬ на посту/в зоне? ДА или НЕТ.
   КРИТИЧЕСКИ ВАЖНО: occupied = true если ты видишь АВТОМОБИЛЬ — крупный объект с кузовом, узнаваемый как легковой, грузовой, фургон, каблук или микроавтобус.
   Авто может быть виден с ЛЮБОГО ракурса: спереди, сзади, сбоку, под углом. Задняя часть фургона, багажник седана, бок кроссовера — всё это автомобиль = occupied: true.
   occupied = false (НЕ авто!) только если видишь:
   - пустой подъёмник (красные/жёлтые стойки, рамы, направляющие) без машины на нём
   - доски, деревянные балки, поддоны, палеты БЕЗ автомобиля
   - отдельные мелкие запчасти без целой машины рядом
   - металлоконструкции, трубы, стеллажи, ящики
   - инструменты, домкраты, стойки без авто
   - колёса/шины отдельно от машины
   - только людей без машины
   - пустое пространство гаража
   Подъёмник с досками или мелкими предметами БЕЗ автомобиля — это ПУСТОЙ пост.
   Если видишь крупный объект похожий на машину (даже частично, даже задом) — это occupied: true.
2. Уверенность: HIGH, MEDIUM или LOW.
3. Если авто есть: марка, модель, цвет (на русском).
   ОБЯЗАТЕЛЬНО укажи тип кузова (body) — одно из: sedan, SUV, hatchback, wagon, van, pickup, truck, minibus, coupe, cabriolet. Поле body должно быть ВСЕГДА заполнено если есть авто.
4. Гос. номер — все номера белорусские или российские:
   - Беларусь: 4 цифры + 2 буквы + дефис + цифра региона, пример: "2350 LH-7", "6109 КР-2"
   - Россия: буква + 3 цифры + 2 буквы + регион, пример: "А123ВС77"
   - Возвращай ТОЛЬКО строку номера или null. НИКОГДА не возвращай описания типа "не читаемо".
5. Открытые/снятые элементы авто: капот, двери, колёса, бампер, багажник — перечисли на английском (hood, doors, wheels, bumper, trunk).
6. worksInProgress — ставь true ТОЛЬКО если на посту/в зоне стоит АВТОМОБИЛЬ И видны признаки ремонтных работ (открыт капот, снято колесо, рядом инструмент). Если автомобиля НЕТ — worksInProgress = false.
7. Описание работ (на русском) или null.
8. Количество людей рядом.
9. Краткое описание (1-2 предложения, на русском языке).

ВСЕ текстовые поля (description, worksDescription, vehicle.color) — ПИШИ НА РУССКОМ ЯЗЫКЕ.

Ответь в формате JSON:
{"occupied": true/false, "confidence": "HIGH/MEDIUM/LOW", "vehicle": {"make": "...", "model": "...", "body": "...", "color": "белый/чёрный/серый/..."}, "plate": "2350 LH-7" or null, "openParts": ["hood"] or [], "worksInProgress": true/false, "worksDescription": "Замена масла, открыт капот" or null, "peopleCount": 0, "description": "На подъёмнике стоит чёрный кроссовер Nissan Qashqai с открытым капотом."}` },
      ],
    }],
  });

  // ANPR: send same image for plate recognition (parallel, non-blocking)
  const anprPromise = recognizePlateBest(jpegBuffer, 45000).catch(err => {
    console.warn(`[Vision] ANPR failed for "${zoneName}": ${err.message}`);
    return { plate: null, confidence: 0, processingMs: 0 };
  });

  // Wait for both
  const [pass1, anprResult] = await Promise.all([claudePromise, anprPromise]);

  totalTokens += (pass1.usage?.input_tokens || 0) + (pass1.usage?.output_tokens || 0);
  const text1 = pass1.content[0]?.text || '';

  let result;
  try {
    const jsonMatch = text1.match(/\{[\s\S]*\}/);
    result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {}

  if (!result) {
    // Still save frame to dataset even if Claude failed to parse — label as "unparsed"
    saveToDataset(jpegBuffer, zoneName, zoneType, { occupied: false, confidence: 'LOW' });
    return {
      occupied: false, confidence: 'LOW', vehicle: null,
      plate: anprResult.plate || null,
      openParts: [], worksInProgress: false, worksDescription: null,
      peopleCount: 0, description: text1.slice(0, 200),
      model: modelUsed, tokensUsed: totalTokens,
      plateSource: anprResult.plate ? 'anpr' : null,
    };
  }

  // === Merge plate results ===
  // ANPR takes priority (GPU neural net > LLM for OCR)
  // Fall back to Claude's plate if ANPR returned nothing
  // Validate: min 4 chars, must have digit+letter (BY/RU plates are 7-9 chars)
  const isValidPlate = (p) => p && p.length >= 4 && /\d/.test(p) && /[a-zA-Zа-яА-Я]/.test(p);

  const claudePlate = isValidPlate(result.plate) ? result.plate : null;
  let finalPlate = claudePlate;
  let plateSource = claudePlate ? 'claude' : null;

  if (anprResult.plate && anprResult.confidence > 0.5) {
    const rawInfo = anprResult.plateRaw && anprResult.plateRaw !== anprResult.plate ? ` (raw: ${anprResult.plateRaw})` : '';
    console.log(`[Vision] ANPR plate: "${anprResult.plate}"${rawInfo} (${(anprResult.confidence * 100).toFixed(0)}%, ${anprResult.processingMs}ms) | Claude plate: "${claudePlate || 'null'}"`);
    finalPlate = anprResult.plate;
    plateSource = 'anpr';
  } else if (anprResult.plate) {
    // Low confidence ANPR — use only if Claude has nothing
    if (!claudePlate) {
      finalPlate = anprResult.plate;
      plateSource = 'anpr-low';
    }
  }

  // Save to dataset for model distillation
  saveToDataset(jpegBuffer, zoneName, zoneType, result);

  return {
    occupied: !!result.occupied,
    confidence: result.confidence || 'MEDIUM',
    vehicle: result.vehicle || null,
    plate: finalPlate,
    openParts: result.openParts || [],
    worksInProgress: !!result.worksInProgress,
    worksDescription: result.worksDescription || null,
    peopleCount: result.peopleCount || 0,
    description: result.description || '',
    model: modelUsed,
    tokensUsed: totalTokens,
    plateSource,
  };
}

// ===== v2 service path (replaces Claude Vision) =====================

/** Read JPEG width/height from SOF0/SOF2 marker. */
function jpegDims(buf) {
  for (let i = 0; i < buf.length - 9; i++) {
    if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
      return {
        h: (buf[i + 5] << 8) | buf[i + 6],
        w: (buf[i + 7] << 8) | buf[i + 8],
      };
    }
  }
  return { w: 0, h: 0 };
}

/** Map v2 occupancy_prob into the legacy HIGH/MEDIUM/LOW bucket. */
function probToConfidence(prob, occupied) {
  // Confidence in the *decision*, not in "occupied".
  const decisionProb = occupied ? prob : (1 - prob);
  if (decisionProb >= 0.85) return 'HIGH';
  if (decisionProb >= 0.65) return 'MEDIUM';
  return 'LOW';
}

/** Build a short Russian description from v2 zone result so UI/logs stay compatible. */
function buildDescription(z) {
  if (!z.occupied) return 'Зона свободна.';
  const parts = [];
  if (z.body) parts.push(z.body);
  if (z.color) parts.push(z.color);
  let desc = parts.length ? `В зоне: ${parts.join(', ')}` : 'В зоне автомобиль';
  if (z.make) desc += ` (${z.make}${z.make_prob ? ` ${(z.make_prob * 100).toFixed(0)}%` : ''})`;
  if (z.matched_plate) desc += `, номер ${normalizePlate(z.matched_plate) || z.matched_plate}`;
  if (z.works_in_progress) {
    const open = z.open_parts
      ? Object.entries(z.open_parts).filter(([, v]) => v.open).map(([k]) => k)
      : [];
    desc += `. Идут работы${open.length ? ` (открыто: ${open.join(', ')})` : ''}`;
  }
  desc += '.';
  return desc;
}

/**
 * v2 analyzer — sends the FULL camera frame plus the zone bbox in original
 * frame coordinates so the service can OCR plates at full resolution and still
 * attribute matches to the right zone.
 *
 * @param {Buffer} jpegBuffer  Full frame from the camera (or a crop, for back-compat).
 * @param {string} zoneName
 * @param {string} zoneType
 * @param {object} [opts]
 * @param {{x:number,y:number,w:number,h:number}} [opts.rect] zone rect in
 *        the camera's calibration frame (cam.resolution coords).
 * @param {Array<{x:number,y:number}>} [opts.points] optional ≥3-point polygon
 *        in calibration coords. When present, polygon is sent to ANPR as a
 *        post-filter (cv2.pointPolygonTest); bbox becomes the AABB of the
 *        polygon so the OCR crop still covers all vertices.
 * @param {{width:number,height:number}} [opts.resolution] calibration resolution.
 *        If omitted/mismatched, bbox falls back to the whole JPEG.
 *
 * Returns the same shape as the Claude path so callers don't change.
 */
async function analyzeZoneImageV2(jpegBuffer, zoneName, zoneType, opts = {}) {
  const { w: jpegW, h: jpegH } = jpegDims(jpegBuffer);
  if (!jpegW || !jpegH) throw new Error('analyzeZoneImageV2: cannot read JPEG dimensions');

  // Build bbox + (optional) polygon in JPEG-pixel coordinates.
  //
  //   1. Polygon path (preferred when cam.points is set): scale every vertex,
  //      derive bbox = AABB(polygon). bbox still drives the OCR crop; polygon
  //      is the tighter outline ANPR uses to reject neighbour-zone matches.
  //   2. Rect path (legacy / new rect zones): scale opts.rect into JPEG pixels.
  //   3. Fallback: whole frame (kept for back-compat with crop-only callers).
  let bbox;
  let polygon = null;
  const haveResolution = opts.resolution && opts.resolution.width > 0 && opts.resolution.height > 0;

  if (haveResolution && Array.isArray(opts.points) && opts.points.length >= 3) {
    const sx = jpegW / opts.resolution.width;
    const sy = jpegH / opts.resolution.height;
    const scaled = opts.points.map(p => [
      Math.max(0, Math.min(jpegW, p.x * sx)),
      Math.max(0, Math.min(jpegH, p.y * sy)),
    ]);
    const xs = scaled.map(p => p[0]);
    const ys = scaled.map(p => p[1]);
    const x1 = Math.max(0, Math.floor(Math.min(...xs)));
    const y1 = Math.max(0, Math.floor(Math.min(...ys)));
    const x2 = Math.min(jpegW, Math.ceil(Math.max(...xs)));
    const y2 = Math.min(jpegH, Math.ceil(Math.max(...ys)));
    bbox = (x2 > x1 && y2 > y1) ? [x1, y1, x2, y2] : [0, 0, jpegW, jpegH];
    polygon = scaled;
  } else if (opts.rect && haveResolution) {
    const sx = jpegW / opts.resolution.width;
    const sy = jpegH / opts.resolution.height;
    const x1 = Math.max(0, Math.round(opts.rect.x * sx));
    const y1 = Math.max(0, Math.round(opts.rect.y * sy));
    const x2 = Math.min(jpegW, Math.round((opts.rect.x + opts.rect.w) * sx));
    const y2 = Math.min(jpegH, Math.round((opts.rect.y + opts.rect.h) * sy));
    bbox = (x2 > x1 && y2 > y1) ? [x1, y1, x2, y2] : [0, 0, jpegW, jpegH];
  } else {
    bbox = [0, 0, jpegW, jpegH];
  }

  const t0 = Date.now();
  const zoneReq = { zone_id: 'crop', bbox };
  if (polygon) zoneReq.polygon = polygon;
  const res = await recognizeV2(jpegBuffer, [zoneReq], { timeout: 60000 });

  if (res.error) {
    throw new Error(`v2 service error: ${res.error}`);
  }

  const z = (res.zones || [])[0];
  if (!z) {
    // Service returned nothing — treat as low-confidence empty.
    return {
      occupied: false, confidence: 'LOW', vehicle: null, plate: null,
      openParts: [], worksInProgress: false, worksDescription: null,
      peopleCount: 0, description: '',
      model: 'anpr-v2', tokensUsed: 0, plateSource: null,
      processingMs: Date.now() - t0,
    };
  }

  const occupied = !!z.occupied;
  const vehicle = occupied
    ? {
        make: z.make || null,
        model: null,            // v2 has no separate model field
        body: z.body || null,
        color: z.color || null,
      }
    : null;

  const openParts = z.open_parts
    ? Object.entries(z.open_parts).filter(([, v]) => v && v.open).map(([k]) => k)
    : [];

  // Plate selection — preference order:
  //   1) z.matched_plate    — geometrically matched into our zone bbox by the service.
  //   2) result.plates[best] — service detected a plate on the frame but didn't
  //      match it to the zone (e.g. its IoU/centroid threshold rejected the match).
  //      We now send the full frame with the zone bbox in original coords, so
  //      a frame plate that didn't match into our bbox is most likely from a
  //      neighbouring zone — but on a single-zone request the only plate on the
  //      frame *is* this zone's, so the fallback stays useful.
  //   3) null — no plate detected at all.
  const allPlates = Array.isArray(res.plates) ? res.plates : [];
  let rawPlate = z.matched_plate || null;
  let plateSource = rawPlate ? 'anpr-v2' : null;
  if (!rawPlate && allPlates.length > 0) {
    const best = allPlates.reduce((a, b) => ((b.confidence || 0) > (a.confidence || 0) ? b : a), allPlates[0]);
    if (best && best.text) {
      rawPlate = best.text;
      plateSource = 'anpr-v2-unmatched';
    }
  }
  const plate = rawPlate ? (normalizePlate(rawPlate) || rawPlate) : null;

  // Diagnostic — make plate path visible in zone-mapper.log so we can tell
  // "service didn't see the plate" from "service saw it but didn't match it".
  if (occupied) {
    const topConf = allPlates[0]?.confidence != null ? `${(allPlates[0].confidence * 100).toFixed(0)}%` : '—';
    const topText = allPlates[0]?.text || '—';
    console.log(
      `[ANPRv2] "${zoneName}": fid=${res.frame_id} frame=${jpegW}x${jpegH} bbox=[${bbox.join(',')}]` +
      (polygon ? ` poly=${polygon.length}pt` : '') +
      ` plates=${allPlates.length} (top "${topText}" ${topConf})` +
      `, matched=${z.matched_plate || 'null'}` +
      `, source=${plateSource || 'none'}` +
      (plate ? ` → "${plate}"` : '')
    );
  }

  const peopleCount = (() => {
    const v = z.people_count;
    if (v === null || v === undefined) return 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  })();

  const result = {
    occupied,
    confidence: probToConfidence(z.occupancy_prob ?? 0, occupied),
    vehicle,
    plate,
    openParts,
    worksInProgress: !!z.works_in_progress,
    worksDescription: null,     // v2 has no free-text description; kept null for UI compat
    peopleCount,
    description: buildDescription(z),
    model: 'anpr-v2',
    tokensUsed: 0,
    plateSource,
    processingMs: Date.now() - t0,
    serverProcessingMs: res.processing_time_ms || 0,
    // raw v2 probs preserved for diagnostics / future training
    v2: {
      occupancy_prob: z.occupancy_prob,
      body_prob: z.body_prob,
      color_prob: z.color_prob,
      make_prob: z.make_prob,
      works_prob: z.works_prob,
      people_prob: z.people_prob,
    },
  };

  // Save to dataset as before, mapped into Claude-shaped object so saveToDataset works.
  saveToDataset(jpegBuffer, zoneName, zoneType, {
    occupied: result.occupied,
    confidence: result.confidence,
    vehicle: result.vehicle,
    worksInProgress: result.worksInProgress,
    worksDescription: result.worksDescription,
    peopleCount: result.peopleCount,
    openParts: result.openParts,
    description: result.description,
  });

  return result;
}

/**
 * Router: pick between v2 service and Claude Vision based on settings.visionProvider.
 *  - 'v2'      → ANPR-v2 only (no Claude calls, no token spend) — DEFAULT
 *  - 'claude'  → original Claude Vision + ANPR-v1 path
 *  - 'auto'    → try v2 first, fall back to Claude on error
 *
 * Keeping `analyzeZoneImage` as the public entry so autoPoll.js stays untouched.
 */
async function analyzeZoneImage(jpegBuffer, zoneName, zoneType, opts = {}) {
  const settings = loadSettings();
  const provider = settings.visionProvider || 'v2';

  if (provider === 'v2') {
    return analyzeZoneImageV2(jpegBuffer, zoneName, zoneType, opts);
  }

  if (provider === 'auto') {
    try {
      return await analyzeZoneImageV2(jpegBuffer, zoneName, zoneType, opts);
    } catch (err) {
      console.warn(`[Vision] v2 failed (${err.message}), falling back to Claude`);
      return analyzeZoneImageClaude(jpegBuffer, zoneName, zoneType);
    }
  }

  return analyzeZoneImageClaude(jpegBuffer, zoneName, zoneType);
}

module.exports = {
  analyzeZoneImage,
  analyzeZoneImageV2,
  analyzeZoneImageClaude,
  loadSettings,
  saveSettings,
};
