import { useState, useEffect, useRef } from "react";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:        "#040404",
  panel:     "#0a0f0a",
  border:    "#0f2a1e",
  borderHi:  "#0f4547",
  teal:      "#3bbfb2",
  tealDim:   "#1d6b65",
  tealFaint: "#0d3330",
  amber:     "#d97706",
  red:       "#dc2626",
  white:     "#f0faf9",
  muted:     "#4a7a75",
  mutedLo:   "#1e3835",
};

// ── Mapbox ────────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoiZGVsdGFhZ2VudCIsImEiOiJjbW10bnZvOG4yMHMwMm9wd2JwbGdjc3htIn0.c89AJq83cNpfcW8MhIc9Bw";

const LOCATIONS = [
  { name: "Carrollton Gauge · 8761927",    lng: -90.1112, lat: 29.9499, type: "gauge"    },
  { name: "Napoleon Ave Wharf",             lng: -90.0856, lat: 29.9154, type: "terminal" },
  { name: "Algiers Point",                  lng: -90.0534, lat: 29.9271, type: "waypoint" },
  { name: "Globalplex / Assoc. Terminals",  lng: -90.3674, lat: 29.9554, type: "terminal" },
  { name: "Southwest Pass",                 lng: -89.4073, lat: 28.9947, type: "waypoint" },
];

// Exact Mississippi River coordinates from OSM/Overpass API
const VESSEL_ROUTE = [
  [-91.572314, 30.735949],
  [-91.560362, 30.731781],
  [-91.544432, 30.731592],
  [-91.518699, 30.738759],
  [-91.485513, 30.744558],
  [-91.461744, 30.73682],
  [-91.446346, 30.736473],
  [-91.426558, 30.742567],
  [-91.417002, 30.747293],
  [-91.401744, 30.756098],
  [-91.397001, 30.757499],
  [-91.385322, 30.758936],
  [-91.378929, 30.758153],
  [-91.375116, 30.755974],
  [-91.359877, 30.736129],
  [-91.352158, 30.719238],
  [-91.339118, 30.665129],
  [-91.335329, 30.659841],
  [-91.330429, 30.657295],
  [-91.318027, 30.653801],
  [-91.303904, 30.649379],
  [-91.299506, 30.647486],
  [-91.29365, 30.641217],
  [-91.290851, 30.633944],
  [-91.290699, 30.62811],
  [-91.298722, 30.609415],
  [-91.310622, 30.596301],
  [-91.315473, 30.589513],
  [-91.315209, 30.579521],
  [-91.311736, 30.574024],
  [-91.300846, 30.571649],
  [-91.284252, 30.57178],
  [-91.270967, 30.569969],
  [-91.257194, 30.568272],
  [-91.245238, 30.559781],
  [-91.239591, 30.552574],
  [-91.238755, 30.546937],
  [-91.241449, 30.538867],
  [-91.249227, 30.531394],
  [-91.267473, 30.524023],
  [-91.279573, 30.517663],
  [-91.284106, 30.512571],
  [-91.284002, 30.509087],
  [-91.28032, 30.505766],
  [-91.270354, 30.504289],
  [-91.258063, 30.506559],
  [-91.218438, 30.519948],
  [-91.208728, 30.522909],
  [-91.203568, 30.519555],
  [-91.19973, 30.516154],
  [-91.197214, 30.500779],
  [-91.196434, 30.464004],
  [-91.198951, 30.425851],
  [-91.219631, 30.389736],
  [-91.233164, 30.375882],
  [-91.240988, 30.361825],
  [-91.241313, 30.356721],
  [-91.234712, 30.343509],
  [-91.226065, 30.338556],
  [-91.220426, 30.337844],
  [-91.202228, 30.343768],
  [-91.184807, 30.347264],
  [-91.175116, 30.346173],
  [-91.15792, 30.342012],
  [-91.147866, 30.336505],
  [-91.142654, 30.326176],
  [-91.142162, 30.321661],
  [-91.145807, 30.316735],
  [-91.154938, 30.314022],
  [-91.223799, 30.311239],
  [-91.228877, 30.292032],
  [-91.138923, 30.27658],
  [-91.111115, 30.243997],
  [-91.166248, 30.198029],
  [-91.137472, 30.179427],
  [-91.062753, 30.212657],
  [-91.008587, 30.172737],
  [-91.016808, 30.131964],
  [-91.033523, 30.119751],
  [-90.997674, 30.114505],
  [-90.989264, 30.113638],
  [-90.960059, 30.107285],
  [-90.946396, 30.11171],
  [-90.945716, 30.133219],
  [-90.934351, 30.137192],
  [-90.923967, 30.132212],
  [-90.908961, 30.082177],
  [-90.894974, 30.06467],
  [-90.884296, 30.060832],
  [-90.855809, 30.062805],
  [-90.839802, 30.042623],
  [-90.813687, 29.983156],
  [-90.758796, 30.015616],
  [-90.706322, 30.022944],
  [-90.643901, 30.048164],
  [-90.609874, 30.036323],
  [-90.54849, 30.048164],
  [-90.499417, 30.05216],
  [-90.474295, 30.039543],
  [-90.468126, 29.998865],
  [-90.398022, 29.98139],
  [-90.38041, 29.945246],
  [-90.304663, 29.950876],
  [-90.236952, 29.964357],
  [-90.215469, 29.928261],
  [-90.197626, 29.924205],
  [-90.150381, 29.956214],
  [-90.138977, 29.945987],
  [-90.134018, 29.91309],
  [-90.11577, 29.907753],
  [-90.093452, 29.911966],
  [-90.067524, 29.921211],
  [-90.05933, 29.931006],
  [-90.0581, 29.942431],
  [-90.058428, 29.95657],
  [-90.05118, 29.95943],
  [-90.035188, 29.955617],
  [-89.983208, 29.928354],
  [-89.928664, 29.921982],
  [-89.906168, 29.871149],
  [-89.916228, 29.866193],
  [-89.92954, 29.868535],
  [-89.944579, 29.874726],
  [-89.959713, 29.880998],
  [-89.971097, 29.879156],
  [-89.976204, 29.861854],
  [-89.986177, 29.842703],
  [-89.999206, 29.824245],
  [-90.005579, 29.803386],
  [-90.017394, 29.784368],
  [-90.023327, 29.763899],
  [-90.01812, 29.750449],
  [-89.99984, 29.735682],
  [-89.98696, 29.717592],
  [-89.976083, 29.69801],
  [-89.962924, 29.680095],
  [-89.958472, 29.658582],
  [-89.945259, 29.642209],
  [-89.923193, 29.632074],
  [-89.90284, 29.61937],
  [-89.880352, 29.610243],
  [-89.856383, 29.60487],
  [-89.833966, 29.596792],
  [-89.813957, 29.583643],
  [-89.793288, 29.571551],
  [-89.774999, 29.557181],
  [-89.759198, 29.540462],
  [-89.738125, 29.529638],
  [-89.718604, 29.51659],
  [-89.704028, 29.499206],
  [-89.694454, 29.487285],
  [-89.677278, 29.471827],
  [-89.656137, 29.46096],
  [-89.631772, 29.457823],
  [-89.608292, 29.451602],
  [-89.603738, 29.431562],
  [-89.604947, 29.410096],
  [-89.592524, 29.391887],
  [-89.573472, 29.378],
  [-89.55154, 29.368104],
  [-89.527613, 29.362138],
  [-89.505596, 29.351987],
  [-89.483171, 29.342922],
  [-89.464147, 29.355415],
  [-89.442637, 29.361971],
  [-89.420868, 29.352681],
  [-89.401496, 29.339699],
  [-89.385447, 29.32318],
  [-89.37092, 29.305516],
  [-89.356991, 29.287371],
  [-89.346766, 29.27599],
  [-89.32911, 29.261242],
  [-89.310682, 29.246115],
  [-89.295301, 29.229136],
  [-89.283163, 29.210169],
  [-89.272862, 29.193299],
  [-89.263888, 29.177911],
  [-89.254849, 29.157922],
];



// ── NOAA ──────────────────────────────────────────────────────────────────────
const NOAA_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
  "?station=8761927&product=water_level&datum=MLLW" +
  "&time_zone=lst_ldt&units=english&format=json&range=1";

// ── Agents ────────────────────────────────────────────────────────────────────
const AGENTS = [
  { id: "rw", code: "RW", name: "River Warden",    role: "Environmental Monitor", color: C.teal    },
  { id: "bm", code: "BM", name: "Berth Master",    role: "Dock Scheduler",        color: C.amber   },
  { id: "is", code: "IS", name: "Intermodal Sync", role: "Rail & Truck Coord.",   color: "#a78bfa" },
];

// ── Scenario engine ───────────────────────────────────────────────────────────
function buildScenario(gaugeVal) {
  const ft = gaugeVal ?? 4.4;
  const rising   = ft > 5.5;
  const critical = ft > 8.0;
  const status      = critical ? "CRITICAL" : rising ? "ELEVATED" : "NOMINAL";
  const statusColor = critical ? C.red      : rising ? C.amber    : C.teal;

  const events = [
    { id: 1, agent: "rw", phase: "OBSERVE", delay: 0,
      text: `Carrollton Gauge (8761927) reads ${ft.toFixed(1)} ft — ${critical ? "exceeds Algiers Point vessel restriction threshold." : rising ? "rising trend detected over last 2 hours." : "nominal for Napoleon Ave Wharf operations."}` },
    { id: 2, agent: "rw", phase: "OBSERVE", delay: 1400,
      text: `AIS feed: MV Delta Voyager (LOA 185m, draft 9.2m) inbound — ETA Southwest Pass 04:20 CST. Current: 3.1 knots.` },
    { id: 3, agent: "bm", phase: "ORIENT", delay: 2900,
      text: `Cross-referencing draft against gauge. ${critical ? "9.2m draft incompatible with current river stage. Berth 2 (Napoleon Ave) at risk." : rising ? "Draft margin shrinking — Berth 4 preferred over Berth 2 at current stage." : "Berth 2 (Napoleon Ave Wharf) nominal. Crane availability: 3 of 3."}` },
    { id: 4, agent: "bm", phase: "ORIENT", delay: 4600,
      text: `Simulating 1,024 berth sequences… Optimal plan identified: ${critical ? "HOLD — delay berthing 6 hrs pending stage drop." : rising ? "Re-sequence: Berth 4 → Berth 2. Net gain: $14,200 in avoided idle crane time." : "No re-sequencing required. Berth 2 confirmed optimal. Crane gang notified."}` },
    { id: 5, agent: "is", phase: "DECIDE", delay: 6200,
      text: `CN/KCS rail status: 14 intermodal cars staged at NOPB Yard 3. Truck gate queue: 22 units. ${critical ? "Issuing standby order — gate delay 6 hrs. Drayage rerouted to Globalplex." : rising ? "Adjusting truck gate ETA +90 min. CN rail departure window shifted 08:45 → 10:15." : "Rail hand-off confirmed. Gate opens 06:00 CST. Zero bottleneck projected."}` },
    { id: 6, agent: "rw", phase: "DECIDE", delay: 7800,
      text: `Weather window: Fog advisory lifted at Southwest Pass. Wind 8 kts SE. ${critical ? "Hurricane prep protocol flagged — monitoring 72-hr NWS cone." : "No adverse conditions in 48-hr window. Tidal influence: minor."}` },
  ];

  const recommendation = critical
    ? { label: "HOLD — Delay Berthing 6 Hours",       detail: "River stage exceeds Algiers Point restriction. MV Delta Voyager re-queued at Southwest Pass anchorage. Drayage rerouted. Estimated cost avoidance: $38,000.", severity: "critical" }
    : rising
    ? { label: "RE-SEQUENCE — Swap Berth 2 → Berth 4", detail: "Stage trend warrants precautionary swap. CN/KCS rail window adjusted +90 min. Gate open 06:00. Net savings: $14,200 in idle crane + fuel.",           severity: "warning"  }
    : { label: "NOMINAL — No Action Required",          detail: "All systems optimal. MV Delta Voyager cleared for Berth 2, Napoleon Ave Wharf. Crane gang and NOPB rail confirmed. Gate opens 06:00 CST.",             severity: "ok"       };

  return { ft, status, statusColor, events, recommendation };
}

// ── Small components ──────────────────────────────────────────────────────────
function Badge({ color, children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 3,
      border: `1px solid ${color}55`, background: `${color}15`, color,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    }}>{children}</span>
  );
}

function PulsingDot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4, animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "relative", width: 10, height: 10, borderRadius: "50%", background: color }} />
    </span>
  );
}

function GaugeBar({ value, max = 12, thresholds = [5.5, 8] }) {
  const pct   = Math.min((value / max) * 100, 100);
  const color = value >= thresholds[1] ? C.red : value >= thresholds[0] ? C.amber : C.teal;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ height: 6, background: C.mutedLo, borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 1.2s ease, background 0.6s ease", boxShadow: `0 0 8px ${color}88` }} />
        {thresholds.map((t, i) => (
          <div key={i} style={{ position: "absolute", left: `${(t / max) * 100}%`, top: 0, height: "100%", width: 1, background: i === 0 ? C.amber : C.red, opacity: 0.6 }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted }}>
        <span>0 ft</span><span style={{ color: C.amber }}>5.5 ▲</span><span style={{ color: C.red }}>8.0 ▲</span><span>12 ft</span>
      </div>
    </div>
  );
}

// ── River Map ─────────────────────────────────────────────────────────────────
function RiverMap({ gaugeVal, statusColor, log }) {
  const mapRef           = useRef(null);
  const mapInstanceRef   = useRef(null);
  const vesselMarkerRef  = useRef(null);
  const animFrameRef     = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (window.mapboxgl) { initMap(); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = initMap;
    document.head.appendChild(script);
  }, []);

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return;
    window.mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new window.mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-90.1, 29.92],
      zoom: 8.2,
      interactive: true,
    });
    mapInstanceRef.current = map;
    map.on("load", () => {
      // Fetch actual Mississippi River centerline from OSM
      fetch("https://nominatim.openstreetmap.org/search?q=Mississippi+River&format=geojson&polygon_geojson=1&limit=1")
        .then(r => r.json())
        .then(data => {
          if (data?.features?.[0]) {
            const feature = data.features[0];
            map.addSource("corridor", { type: "geojson", data: feature });
            map.addLayer({
              id: "corridor-line", type: "line", source: "corridor",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#3bbfb2", "line-width": 3, "line-opacity": 0.8 },
            });

            // Extract coordinates and use them for vessel route
            let coords = null;
            if (feature.geometry.type === "LineString") {
              coords = feature.geometry.coordinates;
            } else if (feature.geometry.type === "MultiLineString") {
              // Find the longest segment (the main channel)
              coords = feature.geometry.coordinates.reduce((a, b) => a.length > b.length ? a : b);
            } else if (feature.geometry.type === "Polygon") {
              coords = feature.geometry.coordinates[0];
            } else if (feature.geometry.type === "MultiPolygon") {
              coords = feature.geometry.coordinates[0][0];
            }

            if (coords && coords.length > 1) {
              // Filter to just the Louisiana section (lng between -91.5 and -89.0, lat between 28.5 and 31.0)
              const filtered = coords.filter(([lng, lat]) =>
                lng >= -91.5 && lng <= -89.0 && lat >= 28.5 && lat <= 31.0
              );
              if (filtered.length > 1) {
                // Sort from Baton Rouge (west) to Gulf (east/south)
                const sorted = filtered.sort((a, b) => b[0] - a[0]);
                // Override the vessel route with real coordinates
                window._deltaAgentRiverCoords = sorted;
              }
            }
          }
        })
        .catch(() => {});

      LOCATIONS.forEach((loc) => {
        const el = document.createElement("div");
        const dotColor = loc.type === "gauge" ? "#3bbfb2" : loc.type === "terminal" ? "#d97706" : "#4a7a75";
        el.style.cssText = `width:${loc.type==="gauge"?14:10}px;height:${loc.type==="gauge"?14:10}px;border-radius:50%;background:${dotColor};border:2px solid ${dotColor}44;box-shadow:0 0 ${loc.type==="gauge"?12:6}px ${dotColor}44;cursor:pointer;`;
        if (loc.type === "gauge") el.className = "gauge-marker";
        const popup = new window.mapboxgl.Popup({ offset: 15, closeButton: false })
          .setHTML(`<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#3bbfb2;background:#0a0f0a;padding:6px 10px;border-radius:4px;border:1px solid #0f4547;">${loc.name}</div>`);
        new window.mapboxgl.Marker({ element: el }).setLngLat([loc.lng, loc.lat]).setPopup(popup).addTo(map);
      });

      const vesselEl = document.createElement("div");
      vesselEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polygon points="10,2 18,18 10,14 2,18" fill="#3bbfb2" stroke="#0a0f0a" stroke-width="1"/></svg>`;
      vesselEl.style.cssText = "cursor:pointer;filter:drop-shadow(0 0 6px #3bbfb2);";
      const vesselPopup = new window.mapboxgl.Popup({ offset: 15, closeButton: false })
        .setHTML(`<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#3bbfb2;background:#0a0f0a;padding:6px 10px;border-radius:4px;border:1px solid #0f4547;">MV Delta Voyager<br/>LOA 185m · Draft 9.2m</div>`);
      vesselMarkerRef.current = new window.mapboxgl.Marker({ element: vesselEl })
        .setLngLat(VESSEL_ROUTE[0]).setPopup(vesselPopup).addTo(map);

      let t = 0.45;
      function animateVessel() {
        // Always use the clean hardcoded route (Baton Rouge to Napoleon Ave only)
        const route = VESSEL_ROUTE;
        t += 0.0002;
        if (t > 1) t = 0;
        const total = route.length - 1;
        const st = t * total;
        const si = Math.min(Math.floor(st), total - 1);
        const lt = st - si;
        const from = route[si], to = route[si + 1];
        vesselMarkerRef.current.setLngLat([from[0]+(to[0]-from[0])*lt, from[1]+(to[1]-from[1])*lt]);
        animFrameRef.current = requestAnimationFrame(animateVessel);
      }
      animateVessel();
      setMapLoaded(true);
    });
  }

  useEffect(() => {
    if (!vesselMarkerRef.current) return;
    const el = vesselMarkerRef.current.getElement();
    const color = gaugeVal >= 8 ? "#dc2626" : gaugeVal >= 5.5 ? "#d97706" : "#3bbfb2";
    el.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polygon points="10,2 18,18 10,14 2,18" fill="${color}" stroke="#0a0f0a" stroke-width="1"/></svg>`;
    el.style.filter = `drop-shadow(0 0 6px ${color})`;
  }, [gaugeVal]);

  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mapInstanceRef.current) mapInstanceRef.current.remove();
  }, []);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>
          MISSISSIPPI RIVER CORRIDOR · BATON ROUGE → GULF
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[{ color: C.teal, label: "Gauge Station" }, { color: C.amber, label: "Terminal" }, { color: C.muted, label: "Waypoint" }, { color: statusColor, label: "MV Delta Voyager" }].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", height: 280 }}>
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {!mapLoaded && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.panel, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>
            LOADING CORRIDOR MAP…
          </div>
        )}
        {/* Agent overlay — top of map to avoid Mapbox attribution */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "linear-gradient(to bottom, #040404f0 0%, #040404aa 70%, transparent 100%)", padding: "10px 16px 20px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginRight: 4 }}>AGENTS</span>
          {AGENTS.map((ag) => {
            const active = log.some(l => l.agent === ag.id);
            return (
              <div key={ag.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 4, border: `1px solid ${active ? ag.color + "66" : C.border}`, background: active ? `${ag.color}15` : `${C.panel}cc`, transition: "all 0.4s ease" }}>
                <div style={{ width: 18, height: 18, borderRadius: 3, background: `${ag.color}20`, border: `1px solid ${ag.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700, color: ag.color }}>{ag.code}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.white : C.muted }}>{ag.name}</span>
                {active ? <PulsingDot color={ag.color} /> : <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.mutedLo }} />}
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 4, border: `1px solid ${C.tealDim}`, background: C.tealFaint, marginLeft: "auto" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted }}>AIS</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.white }}>MV Delta Voyager</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted }}>LOA 185m · 9.2m draft</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gaugePulse { 0%{box-shadow:0 0 0 0 #3bbfb266}70%{box-shadow:0 0 0 8px #3bbfb200}100%{box-shadow:0 0 0 0 #3bbfb200} }
        .gauge-marker { animation: gaugePulse 1.8s ease-out infinite; }
        .mapboxgl-popup-content{background:transparent!important;padding:0!important;box-shadow:none!important;}
        .mapboxgl-popup-tip{display:none!important;}
      `}</style>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function DeltaAgentCommandCenter() {
  const [gaugeData, setGaugeData]   = useState(null);
  const [gaugeError, setGaugeError] = useState(false);
  const [simGauge, setSimGauge]     = useState(4.4);
  const [scenario, setScenario]     = useState(() => buildScenario(4.4));
  const [log, setLog]               = useState([]);
  const [running, setRunning]       = useState(false);
  const [done, setDone]             = useState(false);
  const [recVisible, setRecVisible] = useState(false);
  const [confirmed, setConfirmed]   = useState(null);
  const [time, setTime]             = useState(new Date());
  const [oodaStep, setOodaStep]     = useState(-1);
  const logRef                      = useRef(null);
  const timersRef                   = useRef([]);

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    fetch(NOAA_URL).then(r => r.json()).then(d => {
      const readings = d?.data;
      if (readings?.length) {
        const latest = parseFloat(readings[readings.length - 1].v);
        if (!isNaN(latest)) { setGaugeData(latest); setSimGauge(latest); setScenario(buildScenario(latest)); }
      }
    }).catch(() => setGaugeError(true));
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  function runLoop() {
    if (running) return;
    setRunning(true); setDone(false); setLog([]);
    setRecVisible(false); setConfirmed(null); setOodaStep(-1);
    timersRef.current.forEach(clearTimeout); timersRef.current = [];
    const sc = buildScenario(simGauge);
    setScenario(sc);
    const phaseOrder = ["OBSERVE", "ORIENT", "DECIDE", "ACT"];
    sc.events.forEach(ev => {
      const t = setTimeout(() => {
        setLog(prev => [...prev, ev]);
        setOodaStep(prev => Math.max(prev, phaseOrder.indexOf(ev.phase)));
      }, ev.delay);
      timersRef.current.push(t);
    });
    const last = sc.events[sc.events.length - 1].delay;
    timersRef.current.push(setTimeout(() => { setOodaStep(3); setRecVisible(true); }, last + 1200));
    timersRef.current.push(setTimeout(() => { setRunning(false); setDone(true); }, last + 1400));
  }

  function resetLoop() {
    timersRef.current.forEach(clearTimeout);
    setLog([]); setRunning(false); setDone(false);
    setRecVisible(false); setConfirmed(null); setOodaStep(-1);
  }

  const oodaPhases = ["OBSERVE", "ORIENT", "DECIDE", "ACT"];
  const recColors  = { ok: C.teal, warning: C.amber, critical: C.red };
  const recColor   = recColors[scenario.recommendation.severity];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${C.bg};}
        @keyframes ping{75%,100%{transform:scale(2);opacity:0;}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        @keyframes scanline{0%{transform:translateY(-100%);}100%{transform:translateY(100vh);}}
        .log-entry{animation:fadeSlideIn 0.35s ease forwards;}
        .rec-card{animation:fadeSlideIn 0.5s ease forwards;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:${C.bg};}
        ::-webkit-scrollbar-thumb{background:${C.borderHi};border-radius:2px;}
        .row1-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .row3-grid{display:grid;grid-template-columns:1fr 1fr 260px;gap:12px;}
        @media(max-width:900px){
          .row1-grid{grid-template-columns:1fr!important;}
          .row3-grid{grid-template-columns:1fr!important;}
          .hide-mobile{display:none!important;}
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg, color: C.white, fontFamily: "'Plus Jakarta Sans', sans-serif", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(${C.border}55 1px,transparent 1px),linear-gradient(90deg,${C.border}55 1px,transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 120, background: `linear-gradient(to bottom,transparent,${C.teal}06,transparent)`, pointerEvents: "none", zIndex: 1, animation: "scanline 8s linear infinite" }} />

        <div style={{ position: "relative", zIndex: 2, paddingBottom: 40 }}>

          {/* NAV */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: `1px solid ${C.border}`, background: `${C.panel}ee`, backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <polygon points="16,3 30,28 2,28" fill="none" stroke={C.teal} strokeWidth="2" strokeLinejoin="round"/>
                <line x1="9" y1="28" x2="23" y2="28" stroke={C.teal} strokeWidth="2" strokeLinecap="round"/>
                <circle cx="16" cy="18" r="2.5" fill={C.teal}/>
              </svg>
              <div>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", color: C.white }}>DELTAAGENT<span style={{ color: C.teal }}> AI</span></div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: "0.12em" }}>COMMAND CENTER · BETA</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Badge color={scenario.statusColor}>{scenario.status}</Badge>
              <div className="hide-mobile" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.muted }}>
                {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" })} CST
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PulsingDot color={C.teal} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.teal }}>LIVE</span>
              </div>
            </div>
          </header>

          <div style={{ padding: "16px 28px", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* ROW 1: Gauge + OODA */}
            <div className="row1-grid">

              {/* Gauge */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 20px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>CARROLLTON GAUGE · 8761927</span>
                  {gaugeData ? <Badge color={C.teal}>NOAA LIVE</Badge> : <Badge color={C.muted}>SIMULATED</Badge>}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 48, fontWeight: 700, color: scenario.statusColor, lineHeight: 1, marginBottom: 4, textShadow: `0 0 24px ${scenario.statusColor}55` }}>
                  {simGauge.toFixed(1)}<span style={{ fontSize: 16, color: C.muted, marginLeft: 4 }}>ft</span>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted, marginBottom: 10 }}>
                  {gaugeData ? `Live reading · ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" })} CST` : "Simulated · adjust slider below"}
                </div>
                <GaugeBar value={simGauge} />
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.muted, marginBottom: 6, letterSpacing: "0.08em" }}>
                    SCENARIO SIMULATOR — drag to simulate river stage events
                  </div>
                  <input type="range" min={1} max={10} step={0.1} value={simGauge}
                    onChange={e => { const v = parseFloat(e.target.value); setSimGauge(v); setScenario(buildScenario(v)); resetLoop(); }}
                    style={{ width: "100%", accentColor: C.teal, cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.muted, marginTop: 2 }}>
                    <span>1 ft</span><span style={{ color: C.amber }}>5.5 ELEVATED</span><span style={{ color: C.red }}>8.0 CRITICAL</span><span>10 ft</span>
                  </div>
                </div>
              </div>

              {/* OODA */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 20px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginBottom: 12 }}>OODA LOOP · CURRENT CYCLE</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {oodaPhases.map((phase, i) => {
                    const active   = oodaStep === i;
                    const complete = oodaStep > i;
                    const color    = complete || active ? C.teal : C.muted;
                    return (
                      <div key={phase} style={{ padding: "12px 14px", borderRadius: 6, border: `1px solid ${active ? C.teal+"88" : complete ? C.tealDim : C.border}`, background: complete ? `${C.teal}0d` : active ? `${C.teal}15` : "transparent", transition: "all 0.4s ease" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${active ? C.teal : complete ? C.tealDim : C.border}`, background: complete ? C.tealDim : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color, boxShadow: active ? `0 0 10px ${C.teal}55` : "none", transition: "all 0.4s ease" }}>
                            {complete ? "✓" : phase[0]}
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color, letterSpacing: "0.08em" }}>{phase}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
                          {phase === "OBSERVE" && "NOAA · AIS · NOPB data"}
                          {phase === "ORIENT"  && "River-Logic analysis"}
                          {phase === "DECIDE"  && "1,024 simulations run"}
                          {phase === "ACT"     && "SMS · API · Dashboard"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={running ? undefined : runLoop} style={{ width: "100%", padding: "11px 0", borderRadius: 6, border: `1px solid ${running ? C.tealDim : C.teal}`, background: running ? C.tealFaint : `${C.teal}22`, color: running ? C.muted : C.teal, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: running ? "not-allowed" : "pointer", transition: "all 0.2s ease" }}>
                  {running ? "▶ RUNNING CYCLE…" : done ? "↺ RUN NEW CYCLE" : "▶ RUN OODA CYCLE"}
                </button>
                {done && (
                  <button onClick={resetLoop} style={{ width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer" }}>RESET</button>
                )}
              </div>
            </div>

            {/* ROW 2: River Map */}
            <RiverMap gaugeVal={simGauge} statusColor={scenario.statusColor} log={log} />

            {/* ROW 3: Log + Recommendation + System Status */}
            <div className="row3-grid">

              {/* Agent Log */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>AGENT ACTIVITY LOG</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {running && <PulsingDot color={C.teal} />}
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.muted }}>{log.length} EVENTS</span>
                  </div>
                </div>
                <div ref={logRef} style={{ height: 200, overflowY: "auto", padding: "12px 16px" }}>
                  {log.length === 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: C.muted, gap: 8 }}>
                      <div style={{ fontSize: 28, opacity: 0.3 }}>◈</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.08em" }}>AWAITING CYCLE INITIATION</div>
                      <div style={{ fontSize: 12 }}>Press RUN OODA CYCLE to activate agents</div>
                    </div>
                  )}
                  {log.map(entry => {
                    const ag = AGENTS.find(a => a.id === entry.agent);
                    return (
                      <div key={entry.id} className="log-entry" style={{ display: "flex", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ flexShrink: 0, paddingTop: 2 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 4, background: `${ag.color}18`, border: `1px solid ${ag.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700, color: ag.color }}>{ag.code}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: ag.color }}>{ag.name}</span>
                            <Badge color={ag.color}>{entry.phase}</Badge>
                          </div>
                          <div style={{ fontSize: 12, color: "#c0d8d6", lineHeight: 1.55 }}>{entry.text}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Recommendation */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>AI RECOMMENDATION</div>
                <div style={{ padding: "16px 18px" }}>
                  {!recVisible ? (
                    <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "40px 0" }}>
                      <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>⊡</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>PENDING ANALYSIS</div>
                    </div>
                  ) : (
                    <div className="rec-card">
                      <div style={{ padding: "12px 14px", borderRadius: 6, border: `1px solid ${recColor}44`, background: `${recColor}10`, marginBottom: 14 }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: recColor, letterSpacing: "0.08em", marginBottom: 6 }}>
                          {scenario.recommendation.severity.toUpperCase()} · AGENT CONSENSUS
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 8 }}>{scenario.recommendation.label}</div>
                        <div style={{ fontSize: 12, color: "#a0c4c0", lineHeight: 1.5 }}>{scenario.recommendation.detail}</div>
                      </div>
                      {confirmed ? (
                        <div style={{ padding: "10px 14px", borderRadius: 6, border: `1px solid ${confirmed==="confirmed"?C.teal:C.amber}44`, background: `${confirmed==="confirmed"?C.teal:C.amber}10`, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: confirmed==="confirmed"?C.teal:C.amber, textAlign: "center", letterSpacing: "0.06em" }}>
                          {confirmed === "confirmed" ? "✓ CONFIRMED — Executing via SMS + API" : "⚠ OVERRIDE LOGGED — Manual action required"}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setConfirmed("confirmed")} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: `1px solid ${C.teal}`, background: `${C.teal}20`, color: C.teal, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>✓ CONFIRM</button>
                          <button onClick={() => setConfirmed("override")} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: `1px solid ${C.amber}`, background: `${C.amber}10`, color: C.amber, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>⚠ OVERRIDE</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* System Status */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 18px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>SYSTEM STATUS</div>
                {[
                  { label: "NOAA Feed",           ok: !gaugeError },
                  { label: "AIS Vessel Track",     ok: true },
                  { label: "Agent Orchestrator",   ok: true },
                  { label: "SMS Gateway (Twilio)", ok: true },
                  { label: "NOPB Rail API",        ok: true },
                ].map(({ label, ok }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
                    <Badge color={ok ? C.teal : C.amber}>{ok ? "ONLINE" : "SIM"}</Badge>
                  </div>
                ))}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginBottom: 10 }}>AIS · INBOUND VESSEL</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.white, marginBottom: 2 }}>MV Delta Voyager</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.muted }}>LOA 185m · Draft 9.2m</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.muted, marginTop: 2 }}>ETA Southwest Pass 04:20 CST</div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Badge color={C.teal}>TWIC-CLEARED FOUNDERS</Badge>
                <Badge color={C.tealDim}>MTSA ALIGNED</Badge>
                <Badge color={C.muted}>NEWLAB NEW ORLEANS</Badge>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.muted }}>© 2026 DELTAAGENT AI, LLC · deltaagent.ai · BETA</div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
