// api/ais.js - DeltaAgent AIS Vessel Tracking
// Fetches real-time vessel positions on the Lower Mississippi River
// via aisstream.io WebSocket API, returns latest snapshot as JSON REST endpoint
//
// aisstream.io bounding box: Lower Mississippi corridor
// SW: 28.8°N, -90.5°W (below Southwest Pass)
// NE: 30.5°N, -88.5°W (above Baton Rouge)
//
// Sign up for free API key at: https://aisstream.io/
// Add AISSTREAM_API_KEY to Vercel environment variables

import { WebSocket } from "ws";

// Cache vessels in memory between requests (Vercel functions are short-lived,
// so this acts as a per-instance cache — good enough for demo purposes)
let vesselCache = [];
let cacheTime   = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

// Bounding box for Lower Mississippi River corridor
const BOUNDING_BOX = [[28.8, -90.5], [30.5, -88.5]];

// Ship type codes that are operationally relevant for the demo
const RELEVANT_TYPES = new Set([
  70, 71, 72, 73, 74, 75, 76, 77, 78, 79, // Cargo
  80, 81, 82, 83, 84, 85, 86, 87, 88, 89, // Tanker
  30, 31, 32, 33, 34, 35,                  // Fishing / special
  52,                                       // Tug
  90, 91, 92, 93, 94, 95, 96, 97, 98, 99, // Other
]);

function fetchVesselsFromStream(apiKey) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    const vessels = new Map();
    let timeout;

    ws.on("open", () => {
      ws.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [BOUNDING_BOX],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      }));
      // Collect for 5 seconds then close
      timeout = setTimeout(() => {
        ws.close();
        resolve([...vessels.values()]);
      }, 5000);
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const meta = msg.MetaData;
        if (!meta) return;

        const mmsi = String(meta.MMSI);
        const existing = vessels.get(mmsi) || {};

        if (msg.MessageType === "PositionReport") {
          const pos = msg.Message?.PositionReport;
          vessels.set(mmsi, {
            ...existing,
            mmsi,
            name: meta.ShipName?.trim() || existing.name || `VESSEL ${mmsi}`,
            lat: meta.latitude,
            lon: meta.longitude,
            sog: pos?.Sog || 0,         // Speed over ground (knots)
            cog: pos?.Cog || 0,         // Course over ground (degrees)
            heading: pos?.TrueHeading || pos?.Cog || 0,
            navStatus: pos?.NavigationalStatus || 0,
            timestamp: meta.time_utc,
          });
        }

        if (msg.MessageType === "ShipStaticData") {
          const static_ = msg.Message?.ShipStaticData;
          vessels.set(mmsi, {
            ...existing,
            mmsi,
            name: static_?.Name?.trim() || existing.name || `VESSEL ${mmsi}`,
            type: static_?.Type || existing.type || 0,
            draught: static_?.MaximumStaticDraught || existing.draught || 0,
            destination: static_?.Destination?.trim() || existing.destination || "",
            callsign: static_?.CallSign?.trim() || existing.callsign || "",
            lat: existing.lat,
            lon: existing.lon,
            sog: existing.sog || 0,
            cog: existing.cog || 0,
            heading: existing.heading || 0,
            timestamp: existing.timestamp,
          });
        }
      } catch (_) {}
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
      resolve([...vessels.values()]);
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) {
    // Return mock data if no API key configured
    return res.json({
      ok: true,
      simulated: true,
      vessels: [
        { mmsi: "368207620", name: "MV DELTA VOYAGER",    lat: 28.93, lon: -89.41, sog: 8.2, cog: 355, heading: 355, type: 70, draught: 9.1, destination: "NEW ORLEANS", navStatus: 0, timestamp: new Date().toISOString() },
        { mmsi: "367719770", name: "MV LOUISIANA STAR",   lat: 29.51, lon: -90.01, sog: 0.0, cog: 180, heading: 180, type: 80, draught: 11.4, destination: "PORT SULPHUR", navStatus: 1, timestamp: new Date().toISOString() },
        { mmsi: "338234891", name: "TUG CRESCENT FORCE",  lat: 29.93, lon: -90.03, sog: 4.1, cog: 10,  heading: 10,  type: 52, draught: 3.2, destination: "ALGIERS POINT", navStatus: 0, timestamp: new Date().toISOString() },
        { mmsi: "367452109", name: "MV ATCHAFALAYA",      lat: 30.21, lon: -90.15, sog: 6.8, cog: 170, heading: 170, type: 71, draught: 8.7, destination: "BATON ROUGE",  navStatus: 0, timestamp: new Date().toISOString() },
      ],
    });
  }

  // Return cached data if fresh
  if (vesselCache.length > 0 && Date.now() - cacheTime < CACHE_TTL) {
    return res.json({ ok: true, simulated: false, vessels: vesselCache, cachedAt: new Date(cacheTime).toISOString() });
  }

  try {
    const vessels = await fetchVesselsFromStream(apiKey);
    vesselCache = vessels.filter(v => v.lat && v.lon); // Only vessels with position
    cacheTime = Date.now();
    return res.json({ ok: true, simulated: false, vessels: vesselCache });
  } catch (err) {
    // Fall back to cache even if stale
    if (vesselCache.length > 0) {
      return res.json({ ok: true, simulated: false, vessels: vesselCache, stale: true });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}
