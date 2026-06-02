# ATLAS OS — RuView Presence-Sensing Integration

> **Disclaimer:** vital-signs sensing (breathing rate, heart rate) in residential dwellings
> must be deployed with explicit informed resident consent and reviewed against applicable
> privacy legislation (Ontario PHIPA, PIPEDA / Law 25, GDPR where relevant) before
> production activation. This integration is hardware-optional and off by default.

---

## 1. What is RuView?

[RuView](https://github.com/ruvnet/RuView) (MIT license, © ruvnet contributors) is a
**WiFi Channel State Information (CSI) spatial-intelligence system** that turns low-cost
ESP32-S3 microcontroller nodes (~$8 USD per node) into room-scale presence sensors — with
no cameras, no wearables, and no passive infrared (PIR) elements.

Each node transmits a standard 802.11n probe frame and analyses the multipath distortions
in the reflected signal. Because the human body absorbs, reflects, and scatters 2.4 GHz
energy in ways that differ from static objects, the signal phase and amplitude changes
encode occupancy, person count, movement trajectory, and — with sufficient signal quality —
respiratory and cardiac waveforms.

**Key capabilities surfaced by RuView:**

| Signal | Description | Typical accuracy |
|---|---|---|
| Presence | At least one person in the monitored volume | >98 % in tested rooms |
| Person count | Estimated number of occupants | ±1 person in medium rooms |
| Movement | Motion magnitude / direction | Qualitative |
| Breathing rate | Respiratory cycles per minute | ±2 bpm at rest |
| Heart rate | Cardiac cycles per minute | ±5 bpm at rest |

RuView exposes its inference engine over a **REST API** and optionally an **MQTT broker**,
making it straightforward to integrate into any building-operations stack.

---

## 2. Why RuView fits ATLAS

### 2.1 Privacy-by-design occupancy

ATLAS-01 houses two occupancy types where conventional sensing is legally or ethically
problematic:

- **Residences (OccupancyGroup C, `useScope: "residential"`):** tenants have a reasonable
  expectation of privacy. Cameras inside or pointed at dwelling units are impermissible
  under PIPEDA / PHIPA and most standard-form lease agreements. PIR sensors are lower risk
  but produce no person count and no vital data.
- **Commons clinic (`useScope: "amenity"`, telehealth / first-aid):** health-related spaces
  have heightened sensitivity under Ontario PHIPA. Cameras that could capture patient faces
  require explicit consent and PHIPA-compliant data governance. WiFi-CSI produces no
  biometric images; the sensor node never stores a frame.

RuView solves this directly: **there is no image to capture, no face to identify, and no
footage to leak.** The output is a numerical inference — occupied: true, count: 2,
breathing: 14 bpm — with no linkage to any individual's identity.

### 2.2 Comparison with alternatives

| Sensing modality | Presence | Count | Vitals | No camera | No wearable | Notes |
|---|---|---|---|---|---|---|
| **WiFi-CSI (RuView)** | Yes | Yes | Yes | Yes | Yes | Through-wall, dark-capable |
| PIR | Yes | No | No | Yes | Yes | Motion only; blind when still |
| Camera + CV | Yes | Yes | Partial | **No** | Yes | Privacy risk; requires consent |
| Wearable (BLE/UWB) | Yes | Yes | Yes | Yes | **No** | Opt-in friction; battery |
| Radar (mmWave) | Yes | Yes | Yes | Yes | Yes | More expensive; regulatory per region |

### 2.3 Alignment with the ATLAS de-risking plan

The [de-risking plan](./ATLAS-derisking-plan.md) defines the clinic floor as
`OccupancyGroup D` telehealth/first-aid only (avoiding Group B) to stay clear of
heightened health-facility licensing. Deploying a camera-free sensing layer that never
stores imagery is consistent with that conservative posture and reduces the
privacy-risk surface area during the approvals process.

---

## 3. How ATLAS integrates RuView

### 3.1 The `FloorPresence` type

`src/lib/types.ts` carries the domain type:

```ts
interface FloorPresence {
  floorKey:       string;        // matches Floor.id (e.g. "commons-clinic")
  occupied:       boolean;       // at least one person detected
  personCount:    number;        // estimated occupant count (0 when unoccupied)
  confidencePct:  number;        // 0–100 inference confidence
  breathingBpm?:  number;        // respiratory rate — present when signal quality permits
  heartBpm?:      number;        // cardiac rate    — present when signal quality permits
  source:         "ruview" | "seed";  // data provenance
  ts:             string;        // ISO-8601 timestamp of the inference
}
```

Vital-sign fields (`breathingBpm`, `heartBpm`) are optional so that floors without
sufficient node coverage or signal quality report clean presence data without noise.

### 3.2 `src/lib/ruview.ts` — the adapter

The adapter is the single point of contact between ATLAS OS and the RuView hardware layer.
It implements three exported symbols:

| Export | Signature | Description |
|---|---|---|
| `isRuViewConfigured` | `boolean` | `true` when `RUVIEW_API_URL` env var is set |
| `getPresence` | `(floorKey?: string) => Promise<FloorPresence[]>` | Fetches live data from RuView REST (when configured) or returns seed-derived data; **never throws** |
| `ruviewToSensorPoints` | `(presence: FloorPresence) => NewSensorPoint[]` | Maps a single presence record to Brick-tagged F11 `SensorPoint` objects |

**Fallback behaviour:** when `RUVIEW_API_URL` is unset, `getPresence()` derives plausible
presence data from each floor's seed occupancy metrics so the full ATLAS OS UI renders and
all presence APIs return real-shaped data. This mirrors the project-wide principle that
hardware is an optimization, never a dependency.

**Error safety:** network failures against the RuView endpoint are caught internally;
`getPresence()` falls back to seed data silently rather than propagating
the error to callers or the Next.js edge runtime.

### 3.3 `/api/presence` endpoint

```
GET /api/presence          → { presence: FloorPresence[] }
GET /api/presence?floor=<key> → { presence: [FloorPresence] }
```

The route (`src/app/api/presence/route.ts`) is `force-dynamic` and always returns `200`
with a valid JSON body — seed-derived when hardware is absent. It delegates entirely to
`getPresence()` in `src/lib/ruview.ts`.

### 3.4 F11 Brick-tagged sensor points

`ruviewToSensorPoints()` translates each `FloorPresence` into one or more `SensorPoint`
objects with Brick/Haystack-style tags. The tag vocabulary:

| `SensorPoint.type` | `SensorPoint.tags` | Source field |
|---|---|---|
| `"sensor.presence.count"` | `{ floor, source: "ruview" }` | `personCount` |
| `"sensor.presence.occupied"` | `{ floor, source: "ruview" }` | `occupied` (0/1) |
| `"sensor.vital.breathing"` | `{ floor, source: "ruview" }` | `breathingBpm` |
| `"sensor.vital.heart"` | `{ floor, source: "ruview" }` | `heartBpm` |

These points flow into the F11 sensor ingestion layer (`src/lib/sensors.ts`) and are
queryable via `/api/sensors` using the same tag filters as any other sensor class.

### 3.5 Seed sensor points

The seed data provides representative presence and vital `SensorPoint`s for three floors:

| Floor | Seeded points |
|---|---|
| `commons-clinic` | `sensor.presence.count`, `sensor.vital.breathing`, `sensor.vital.heart` |
| `residences-a` | `sensor.presence.count`, `sensor.presence.occupied` |
| `the-lung` | `sensor.presence.count` |

This gives the FloorPanel and the F11 sensor query sufficient data to render meaningfully
with no hardware attached.

### 3.6 Console / FloorPanel surface — PresenceBadge

`Console.tsx` polls `/api/presence` on an interval (aligned with the incident feed poll)
and passes the resulting `FloorPresence` array into `FloorPanel`. When a selected floor has
a matching presence record, `FloorPanel` renders a **PresenceBadge** that shows:

- WiFi sensing attribution line: "WiFi sensing · RuView"
- Occupied / vacant status with person count
- Inference confidence percentage
- Vital signs (when present): breathing bpm · heart bpm
- Privacy note: "no cameras"

The badge is hidden when no presence record exists for the floor (e.g. unmonitored
mechanical floors).

---

## 4. Local-first / hardware-optional philosophy

> "Hardware is an optimization, never a dependency."

ATLAS OS renders the complete presence layer — UI, API, sensor points — on seed data with
no ESP32 nodes and no `RUVIEW_API_URL` set. This means:

- Developers can work on the full stack without hardware.
- Demo environments produce realistic data without a deployed sensor network.
- Production deployments can enable the live layer floor-by-floor as nodes are installed.

The fallback path is not a stub; it produces the same `FloorPresence` shape as the live
path and exercises the same code paths in the FloorPanel and sensor layer.

---

## 5. Going live

### 5.1 Minimal steps

1. **Flash the ESP32-S3 nodes** following the [RuView hardware setup guide](https://github.com/ruvnet/RuView).
   Mount one node per monitored room or zone; follow RuView's placement guidance (node
   height, distance from reflective surfaces, LOS vs NLOS calibration).

2. **Expose the RuView REST API** on the same private network as the ATLAS OS server,
   or via a secure tunnel (e.g. Cloudflare Tunnel / Tailscale).

3. **Set the environment variable:**
   ```bash
   RUVIEW_API_URL=http://<ruview-host>:<port>
   ```
   ATLAS OS detects this on startup; `isRuViewConfigured` flips to `true` and all
   `getPresence()` calls route to the live endpoint.

4. **Restart the ATLAS OS process.** No code changes or redeployment required.

### 5.2 Optional: MQTT bridge

RuView also publishes presence events over MQTT. You can bridge these to the ATLAS OS
incident feed or sensor layer via Home Assistant, Node-RED, or a custom MQTT→REST adapter.
The `/api/sensors` POST endpoint accepts tagged `SensorPoint` payloads from any source.

### 5.3 Optional: Home Assistant integration

If Home Assistant is already deployed in the building, the RuView MQTT topics can be
consumed as HA entities, which can then call the ATLAS OS `/api/incidents` POST endpoint
via HA automations (e.g. alert when a clinic room has been occupied for > 60 minutes with
no incident acknowledgement).

---

## 6. Attribution

RuView is an open-source project by **ruvnet** and contributors, released under the
[MIT License](https://github.com/ruvnet/RuView/blob/main/LICENSE).

Repository: https://github.com/ruvnet/RuView

ATLAS OS uses RuView's REST API protocol and data model but does not redistribute
RuView source code. The `src/lib/ruview.ts` adapter is original ATLAS OS code.

---

## 7. Privacy and consent

> **The following is a planning note, not legal advice. Engage qualified privacy counsel
> before deploying vital-signs sensing in occupied residential or health-care spaces.**

- **Residences:** deploy with written resident consent. Disclose which floors are
  monitored, what data is collected, how long it is retained, and who has access.
  Canada's PIPEDA and provincial privacy acts (e.g. Ontario's PHIPA for health contexts)
  require meaningful consent.
- **Clinic floor:** any sensing in a space where health information is generated or
  received may engage PHIPA. Obtain a privacy impact assessment (PIA) before deployment.
- **Data minimisation:** `src/lib/ruview.ts` does not persist presence or vital data to
  the database by default. If you add persistence (via Drizzle + Neon), apply appropriate
  retention limits.
- **Presence count ≠ personal data** under most frameworks when no individual is
  identifiable; vital-sign aggregates may be treated differently depending on context.
  Confirm with counsel.
