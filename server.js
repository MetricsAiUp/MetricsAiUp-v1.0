const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const PORT = 8181;
const PROJECT_DIR = __dirname;
const HLS_DIR = path.join(PROJECT_DIR, 'hls');
const ffmpegPath = path.join(PROJECT_DIR, 'node_modules/ffmpeg-static/ffmpeg');

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts': 'video/mp2t'
};

// Camera registry: id -> { rtspUrl, name, ffmpeg process, streaming bool }
function cam(name, rtspUrl) {
    return { name, rtspUrl, ffmpeg: null, streaming: false, restartTimer: null };
}

const cameras = {
    cam00: cam('CAM 00 — Шлагбаум',                  'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/kjhSbewx_m/'),
    cam01: cam('CAM 01 — Стоянка',                    'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/cCjCHzt3_m/'),
    cam02: cam('CAM 02 — Ворота + пост 07,08',        'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/AAIy5dnR_m/'),
    cam03: cam('CAM 03 — Пост 07,08',                 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/xOEOeQZG_m/'),
    cam04: cam('CAM 04 — Пост 09,08,07',              'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/we4rvi8t_m/'),
    cam05: cam('CAM 05 — Пост 10 + с.зона 07',        'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/KRoX0tGZ_m/'),
    cam06: cam('CAM 06 — Склад приёмки',              'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/PxPU26jt_m/'),
    cam07: cam('CAM 07 — Склад деталей',              'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/lIfkh3Zk_m/'),
    cam08: cam('CAM 08 — Пост 06,05 + с.зона 06,05',  'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/k0HNWQDk_m/'),
    cam09: cam('CAM 09 — С.зона 06 + пост 05',        'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/Mn1PZPF0_m/'),
    cam10: cam('CAM 10 — С.зона 05,04,06',            'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/NQ5s26a6_m/'),
    cam11: cam('CAM 11 — Пост 02 + с.зона 04,05',     'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/qvGFujHD_m/'),
    cam12: cam('CAM 12 — Пост 01,02',                 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/t8rFCkD7_m/'),
    cam13: cam('CAM 13 — Пост 05,04',                 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/w9fKX1CE_m/'),
    cam14: cam('CAM 14 — Пост 03,04 + с.зона 03',     'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/SopzkgqV_m/'),
    cam15: cam('CAM 15 — С.зона 01',                  'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/RTHaqqOJ_m/'),
};

function startStream(camId) {
    const cam = cameras[camId];
    if (!cam || cam.streaming) return;

    // Clean old segments for this camera
    const hlsCamDir = path.join(HLS_DIR, camId);
    fs.mkdirSync(hlsCamDir, { recursive: true });
    try {
        fs.readdirSync(hlsCamDir).forEach(f => fs.unlinkSync(path.join(hlsCamDir, f)));
    } catch {}

    const args = [
        '-rtsp_transport', 'tcp',
        '-fflags', '+genpts+discardcorrupt',
        '-err_detect', 'ignore_err',
        '-i', cam.rtspUrl,
        '-c:v', 'copy',
        '-an',
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '6',
        '-hls_flags', 'delete_segments+append_list',
        '-hls_segment_filename', path.join(hlsCamDir, 'seg_%03d.ts'),
        path.join(hlsCamDir, 'stream.m3u8')
    ];

    cam.ffmpeg = spawn(ffmpegPath, args);
    cam.streaming = true;
    console.log(`[${camId}] Stream started`);

    cam.ffmpeg.stderr.on('data', (data) => {
        const line = data.toString().trim();
        if (line) console.log(`[${camId}] ${line}`);
    });

    cam.ffmpeg.on('close', (code) => {
        console.log(`\n[${camId}] FFmpeg exited (code ${code})`);
        cam.ffmpeg = null;
        // Only auto-restart if still marked as streaming (not manually stopped)
        if (cam.streaming) {
            cam.streaming = false;
            cam.restartTimer = setTimeout(() => startStream(camId), 3000);
        }
    });
}

function stopStream(camId) {
    const cam = cameras[camId];
    if (!cam) return;

    if (cam.restartTimer) {
        clearTimeout(cam.restartTimer);
        cam.restartTimer = null;
    }

    cam.streaming = false;

    if (cam.ffmpeg) {
        cam.ffmpeg.kill('SIGTERM');
        cam.ffmpeg = null;
        console.log(`\n[${camId}] Stream stopped`);
    }

    // Clean HLS files
    const hlsCamDir = path.join(HLS_DIR, camId);
    try {
        fs.readdirSync(hlsCamDir).forEach(f => fs.unlinkSync(path.join(hlsCamDir, f)));
    } catch {}
}

// JSON response helper
function jsonResponse(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
}

// HTTP server
const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*'
        });
        res.end();
        return;
    }

    // API: POST /api/stream/start/:camId
    const startMatch = urlPath.match(/^\/api\/stream\/start\/(\w+)$/);
    if (startMatch && req.method === 'POST') {
        const camId = startMatch[1];
        if (!cameras[camId]) return jsonResponse(res, 404, { error: 'Camera not found' });
        startStream(camId);
        return jsonResponse(res, 200, { status: 'started', camId });
    }

    // API: POST /api/stream/stop/:camId
    const stopMatch = urlPath.match(/^\/api\/stream\/stop\/(\w+)$/);
    if (stopMatch && req.method === 'POST') {
        const camId = stopMatch[1];
        if (!cameras[camId]) return jsonResponse(res, 404, { error: 'Camera not found' });
        stopStream(camId);
        return jsonResponse(res, 200, { status: 'stopped', camId });
    }

    // API: GET /api/stream/snapshot/:camId — capture single JPEG frame from RTSP
    const snapMatch = urlPath.match(/^\/api\/stream\/snapshot\/(\w+)$/);
    if (snapMatch && req.method === 'GET') {
        const camId = snapMatch[1];
        const camObj = cameras[camId];
        if (!camObj) return jsonResponse(res, 404, { error: 'Camera not found' });

        const args = [
            '-rtsp_transport', 'tcp',
            '-i', camObj.rtspUrl,
            '-frames:v', '1',
            '-q:v', '2',
            '-f', 'image2',
            '-vcodec', 'mjpeg',
            'pipe:1'
        ];

        const proc = spawn(ffmpegPath, args, { timeout: 15000 });
        const chunks = [];
        let errData = '';

        proc.stdout.on('data', (chunk) => chunks.push(chunk));
        proc.stderr.on('data', (chunk) => { errData += chunk.toString(); });

        proc.on('close', (code) => {
            if (chunks.length > 0) {
                const jpeg = Buffer.concat(chunks);
                res.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': jpeg.length,
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'Surrogate-Control': 'no-store',
                    'X-Accel-Expires': '0',
                    'ETag': `"${Date.now()}-${camId}"`,
                });
                res.end(jpeg);
            } else {
                console.error(`[${camId}] Snapshot failed:`, errData.slice(-200));
                jsonResponse(res, 500, { error: 'Snapshot failed' });
            }
        });

        proc.on('error', (err) => {
            console.error(`[${camId}] Snapshot spawn error:`, err.message);
            jsonResponse(res, 500, { error: 'Snapshot failed: ' + err.message });
        });

        return;
    }

    // API: GET /api/stream/snapshot/:camId/crop?x=&y=&w=&h=&fw=&fh= — crop zone from snapshot
    const cropMatch = urlPath.match(/^\/api\/stream\/snapshot\/(\w+)\/crop$/);
    if (cropMatch && req.method === 'GET') {
        const camId = cropMatch[1];
        const camObj = cameras[camId];
        if (!camObj) return jsonResponse(res, 404, { error: 'Camera not found' });

        const url = new URL(req.url, 'http://localhost');
        const zx = parseFloat(url.searchParams.get('x')) || 0;
        const zy = parseFloat(url.searchParams.get('y')) || 0;
        const zw = parseFloat(url.searchParams.get('w')) || 200;
        const zh = parseFloat(url.searchParams.get('h')) || 200;
        const fw = parseFloat(url.searchParams.get('fw')) || 1920;  // frame width (zone coord space)
        const fh = parseFloat(url.searchParams.get('fh')) || 1080;  // frame height

        // FFmpeg: capture 1 frame, crop the zone area, output JPEG
        // crop filter: crop=out_w:out_h:x:y (in pixels of actual video)
        // We scale zone coords to video resolution using vf scale+crop
        const cropFilter = `crop=iw*${zw/fw}:ih*${zh/fh}:iw*${Math.max(0,zx)/fw}:ih*${Math.max(0,zy)/fh}`;
        const args = [
            '-rtsp_transport', 'tcp',
            '-i', camObj.rtspUrl,
            '-frames:v', '1',
            '-vf', cropFilter,
            '-q:v', '2',
            '-f', 'image2',
            '-vcodec', 'mjpeg',
            'pipe:1'
        ];

        const proc = spawn(ffmpegPath, args, { timeout: 15000 });
        const chunks = [];
        let errData = '';

        proc.stdout.on('data', (chunk) => chunks.push(chunk));
        proc.stderr.on('data', (chunk) => { errData += chunk.toString(); });

        proc.on('close', () => {
            if (chunks.length > 0) {
                const jpeg = Buffer.concat(chunks);
                res.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': jpeg.length,
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'Surrogate-Control': 'no-store',
                    'X-Accel-Expires': '0',
                    'ETag': `"${Date.now()}-${camId}"`,
                });
                res.end(jpeg);
            } else {
                console.error(`[${camId}] Crop failed:`, errData.slice(-200));
                jsonResponse(res, 500, { error: 'Crop failed' });
            }
        });

        proc.on('error', (err) => jsonResponse(res, 500, { error: err.message }));
        return;
    }

    // API: GET /api/stream/status
    if (urlPath === '/api/stream/status') {
        const statuses = {};
        for (const [id, cam] of Object.entries(cameras)) {
            statuses[id] = { name: cam.name, streaming: cam.streaming };
        }
        return jsonResponse(res, 200, statuses);
    }

    // Static files
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(PROJECT_DIR, urlPath);
    const ext = path.extname(filePath);
    const isHLS = urlPath.startsWith('/hls/');

    if (!filePath.startsWith(PROJECT_DIR)) {
        res.writeHead(403);
        res.end();
        return;
    }

    if (isHLS) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store');
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
        if (isHLS) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.setHeader('Content-Type', 'text/html');
            fs.createReadStream(path.join(PROJECT_DIR, 'index.html')).pipe(res);
        }
    });
    stream.on('open', () => {
        res.writeHead(200);
        stream.pipe(res);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});

process.on('SIGINT', () => {
    Object.keys(cameras).forEach(stopStream);
    process.exit();
});
