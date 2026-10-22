# BowlingHub 🎳

Unified bowling center software system: high-performance backend, USBC scoring engine, ESP32 MQTT hardware integration, operator control center, and VIDIBI interactive lane kiosk display.

---

## 🏛️ Architecture & Routing

BowlingHub combines backend services and universal frontend in a single codebase:
- `/operator` — Reception & Lane Management Dashboard, Order Booking, Score Correction, Device Fleet Telemetry, Pricing, and Shift Reports.
- `/kiosk/:lane` — Interactive VIDIBI Lane Screen for bowlers with 10 themes, 3D/2D Pin Deck visualizer, live ScoreGrid, animations, bowler rotation, and between-games stats.

---

## ⚡ Frozen Contracts Compliance

### 1. WebSocket Flat Event Format (Variant 2)
All event fields reside on the top level without a `payload` wrapper envelope:
```json
{
  "type": "phase_changed",
  "lane_id": 1,
  "ts": 1742080000000,
  "phase": "order_active",
  "previous_phase": "idle"
}
```

### 2. MQTT Hardware Topics Contract
- Inbound from ESP32:
  - `lane/{lane_id}/sensor/ball_a`
  - `lane/{lane_id}/sensor/ball_b`
  - `lane/{lane_id}/sensor/foul`
  - `lane/{lane_id}/cv/pins`
  - `lane/{lane_id}/pinspotter/cycle_complete`
  - `lane/{lane_id}/bollift/status`
  - `fleet/discovery/response`
  - `fleet/device/{device_id}/telemetry`
- Outbound to Hardware:
  - `lane/{lane_id}/control/command` (sweep, reset, bumper_up, bumper_down)
  - `fleet/discovery/request`
  - `fleet/device/{device_id}/command` (ping, reboot, ota_update)
- LRU deduplication cache with 60-second TTL for `event_id`.
- Type conversion: MQTT string `lane_id` (`"1"`) <-> Backend numeric `lane_id` (`1`).

---

## 🎯 USBC Scoring Engine & Tests
- Official USBC 10-frame scoring algorithm (Strikes, Spares, Open frames, 10th frame 3-ball fill rolls, Split detection, Washouts, Fouls).
- Verified test suite: **8/8 USBC canonical test cases** + **38/38 regression cases** all passing.

```bash
bun run test
```

---

## 🚀 Quickstart & Docker Deployment

```bash
# Build and run with Docker Compose
docker compose build --no-cache bowlinghub
docker compose up -d

# Verify Endpoints:
curl http://localhost:3005/operator
curl http://localhost:3005/kiosk/1
```
