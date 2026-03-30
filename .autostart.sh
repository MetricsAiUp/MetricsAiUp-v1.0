#!/bin/bash
# Autostart servers
cd /project
npm install --silent 2>/dev/null
node server.js > /tmp/server.log 2>&1 &
echo "[autostart] Camera server started on port 8181"
node motion-detector.js > /tmp/motion-detector.log 2>&1 &
echo "[autostart] Motion detector started on port 8182"
cd /project/modules/zone-mapper/backend
node server.js > /tmp/zone-mapper.log 2>&1 &
echo "[autostart] Zone mapper started on port 3100"
