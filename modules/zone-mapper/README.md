# Zone Mapper

Web app for mapping and monitoring service-bay (СТО) parking zones from camera streams.
Backend (Express, port 3100) drives a server-side autopoll loop that fetches camera
crops, runs occupancy/plate recognition, persists state, and streams lifecycle events
over SSE. The frontend (Vite/React) is a thin observer over that loop.

## Vision provider

Recognition runs on the **local v2 ANPR service** reached over the internal VPN
(RabbitMQ broker at `10.12.0.7:5672`). See `backend/lib/plateRecognitionV2.js`.
Claude vision in `backend/lib/vision.js` is only a fallback when `visionProvider`
is not `v2`.

## Analysis modes (`analyzeMode`)

`backend/data/settings.json → analyzeMode` controls when autopoll calls recognition:

| Value       | Behavior                                                                                                                                      | When to use                                                             |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|
| `always`    | Every cycle sends every camera crop to recognition, even if frames are unchanged. Each tile updates with fresh `occupied`/`vehicle`/`plate`. | Default. Fits the local v2 service (free, spare capacity).              |
| `on_change` | Cycle skips a zone when all its crops are JPEG-hash-identical to the previous cycle (`zone_skipped` SSE event). The previous result is preserved on the tile with a "БЕЗ ИЗМ." chip. | Cost-saving for paid/external providers (e.g., if you switch back to Claude). |

UI: **Тестовая обработка → ⚙ Settings → Режим анализа**. Persisted in `settings.json`
and re-applied on backend restart.

API:

```
GET  /api/settings           → { analyzeMode, visionProvider, visionModel, ... }
PUT  /api/settings           ← { analyzeMode: "always" | "on_change", ... }
```

## Autopoll lifecycle (SSE)

`GET /api/autopoll/events` streams `cycle_start`, `zone_start`, `crop_fetched`,
`crop_error`, `camera_call`, `camera_result`, `camera_error`, `zone_skipped`,
`zone_result`, `cycle_end`. The frontend's AnalysisTab subscribes once on mount
and renders state from these events; it does **not** trigger parallel recognition
streams.

`GET /api/autopoll/crop?zone=&camId=` returns the same JPEG bytes the server just
analyzed (in-memory cache `lastCrops`), so the UI shows exactly what the service
sees without re-hitting the camera proxy.

## Settings file

`backend/data/settings.json`:

```json
{
  "anthropicApiKey": "sk-ant-...",
  "visionModel": "claude-haiku-4-5-20251001",
  "visionProvider": "v2",
  "analyzeMode": "always",
  "autopollEnabled": true,
  "autopollIntervalMs": 60000,
  "autopollChangeThreshold": 0.02
}
```
