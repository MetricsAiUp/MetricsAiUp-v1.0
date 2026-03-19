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
const cameras = {
    cam06: {
        name: 'CAM 06 — 3.6 СТО',
        rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/AAIy5dnR_m/',
        ffmpeg: null,
        streaming: false,
        restartTimer: null
    }
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
        '-fflags', 'nobuffer',
        '-flags', 'low_delay',
        '-i', cam.rtspUrl,
        '-vf', 'scale=1280:720',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-b:v', '1500k',
        '-maxrate', '1500k',
        '-bufsize', '3000k',
        '-g', '20',
        '-sc_threshold', '0',
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
        if (line.includes('frame=')) {
            process.stdout.write(`\r[${camId}] ${line.substring(0, 70)}`);
        }
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
