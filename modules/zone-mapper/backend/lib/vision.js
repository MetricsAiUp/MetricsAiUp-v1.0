const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { recognizePlateBest, isAvailable: isAnprAvailable } = require('./plateRecognition');

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
 * Analyze a JPEG image buffer to determine if there's a vehicle.
 * Two-pass approach:
 *   Pass 1: General analysis (car, color, model, approximate plate location)
 *   Pass 2: If plate not confidently read, crop+enlarge plate area and re-read
 */
async function analyzeZoneImage(jpegBuffer, zoneName, zoneType) {
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

module.exports = { analyzeZoneImage, loadSettings, saveSettings };
