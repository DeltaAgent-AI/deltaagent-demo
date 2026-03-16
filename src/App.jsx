import { useState, useEffect, useRef } from "react";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:        "#040404",
  panel:     "#0a0f0a",
  border:    "#0f2a1e",
  borderHi:  "#0f4547",
  green:     "#0f4547",
  teal:      "#3bbfb2",
  tealDim:   "#1d6b65",
  tealFaint: "#0d3330",
  amber:     "#d97706",
  amberDim:  "#92400e",
  red:       "#dc2626",
  redDim:    "#7f1d1d",
  white:     "#f0faf9",
  muted:     "#4a7a75",
  mutedLo:   "#1e3835",
};

// ── NOAA station for Carrollton Gauge ────────────────────────────────────────
const NOAA_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
  "?station=8761927&product=water_level&datum=MLLW" +
  "&time_zone=lst_ldt&units=english&format=json&range=1";

// ── Agent definitions ─────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: "rw",
    code: "RW",
    name: "River Warden",
    role: "Environmental Monitor",
    color: C.teal,
  },
  {
    id: "bm",
    code: "BM",
    name: "Berth Master",
    role: "Dock Scheduler",
    color: C.amber,
  },
  {
    id: "is",
    code: "IS",
    name: "Intermodal Sync",
    role: "Rail & Truck Coord.",
    color: "#a78bfa",
  },
];

// ── Scenario engine ───────────────────────────────────────────────────────────
function buildScenario(gaugeVal) {
  const ft = gaugeVal ?? 4.4;
  const rising = ft > 5.5;
  const critical = ft > 8.0;

  const status = critical ? "CRITICAL" : rising ? "ELEVATED" : "NOMINAL";
  const statusColor = critical ? C.red : rising ? C.amber : C.teal;

  const events = [
    {
      id: 1,
      agent: "rw",
      phase: "OBSERVE",
      delay: 0,
      text: `Carrollton Gauge (8761927) reads ${ft.toFixed(1)} ft — ${
        critical
          ? "exceeds Algiers Point vessel restriction threshold."
          : rising
          ? "rising trend detected over last 2 hours."
          : "nominal for Napoleon Ave Wharf operations."
      }`,
    },
    {
      id: 2,
      agent: "rw",
      phase: "OBSERVE",
      delay: 1400,
      text: `AIS feed: MV Delta Voyager (LOA 185m, draft 9.2m) inbound — ETA Southwest Pass 04:20 CST. Current: 3.1 knots.`,
    },
    {
      id: 3,
      agent: "bm",
      phase: "ORIENT",
      delay: 2900,
      text: `Cross-referencing draft against gauge. ${
        critical
          ? "9.2m draft incompatible with current river stage. Berth 2 (Napoleon Ave) at risk."
          : rising
          ? "Draft margin shrinking — Berth 4 preferred over Berth 2 at current stage."
          : "Berth 2 (Napoleon Ave Wharf) nominal. Crane availability: 3 of 3."
      }`,
    },
    {
      id: 4,
      agent: "bm",
      phase: "ORIENT",
      delay: 4600,
      text: `Simulating 1,024 berth sequences… Optimal plan identified: ${
        critical
          ? "HOLD — delay berthing 6 hrs pending stage drop."
          : rising
          ? "Re-sequence: Berth 4 → Berth 2. Net gain: $14,200 in avoided idle crane time."
          : "No re-sequencing required. Berth 2 confirmed optimal. Crane gang notified."
      }`,
    },
    {
      id: 5,
      agent: "is",
      phase: "DECIDE",
      delay: 6200,
      text: `CN/KCS rail status: 14 intermodal cars staged at NOPB Yard 3. Truck gate queue: 22 units. ${
        critical
          ? "Issuing standby order — gate delay 6 hrs. Drayage rerouted to Globalplex."
          : rising
          ? "Adjusting truck gate ETA +90 min. CN rail departure window shifted 08:45 → 10:15."
          : "Rail hand-off confirmed. Gate opens 06:00 CST. Zero bottleneck projected."
      }`,
    },
    {
      id: 6,
      agent: "rw",
      phase: "DECIDE",
      delay: 7800,
      text: `Weather window: Fog advisory lifted at Southwest Pass. Wind 8 kts SE. ${
        critical
          ? "Hurricane prep protocol flagged — monitoring 72-hr NWS cone."
          : "No adverse conditions in 48-hr window. Tidal influence: minor."
      }`,
    },
  ];

  const recommendation = critical
    ? {
        label: "HOLD — Delay Berthing 6 Hours",
        detail:
          "River stage exceeds Algiers Point restriction. MV Delta Voyager re-queued at Southwest Pass anchorage. Drayage rerouted. Estimated cost avoidance: $38,000.",
        severity: "critical",
      }
    : rising
    ? {
        label: "RE-SEQUENCE — Swap Berth 2 → Berth 4",
        detail:
          "Stage trend warrants precautionary swap. CN/KCS rail window adjusted +90 min. Gate open 06:00. Net savings: $14,200 in idle crane + fuel.",
        severity: "warning",
      }
    : {
        label: "NOMINAL — No Action Required",
        detail:
          "All systems optimal. MV Delta Voyager cleared for Berth 2, Napoleon Ave Wharf. Crane gang and NOPB rail confirmed. Gate opens 06:00 CST.",
        severity: "ok",
      };

  return { ft, status, statusColor, events, recommendation };
}

// ── Tiny components ───────────────────────────────────────────────────────────
function Badge({ color, children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 3,
        border: `1px solid ${color}55`,
        background: `${color}15`,
        color,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function PulsingDot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: color,
          opacity: 0.4,
          animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
        }}
      />
      <span
        style={{
          position: "relative",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
        }}
      />
    </span>
  );
}

function GaugeBar({ value, max = 12, thresholds = [5.5, 8] }) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    value >= thresholds[1] ? C.red : value >= thresholds[0] ? C.amber : C.teal;
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          height: 6,
          background: C.mutedLo,
          borderRadius: 3,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 1.2s ease, background 0.6s ease",
            boxShadow: `0 0 8px ${color}88`,
          }}
        />
        {thresholds.map((t, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(t / max) * 100}%`,
              top: 0,
              height: "100%",
              width: 1,
              background: i === 0 ? C.amber : C.red,
              opacity: 0.6,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: C.muted,
        }}
      >
        <span>0 ft</span>
        <span style={{ color: C.amber }}>5.5 ▲</span>
        <span style={{ color: C.red }}>8.0 ▲</span>
        <span>12 ft</span>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function DeltaAgentCommandCenter() {
  const [gaugeData, setGaugeData] = useState(null);
  const [gaugeError, setGaugeError] = useState(false);
  const [simGauge, setSimGauge] = useState(4.4);
  const [scenario, setScenario] = useState(() => buildScenario(4.4));
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [recVisible, setRecVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(null); // null | 'confirmed' | 'override'
  const [time, setTime] = useState(new Date());
  const [oodaStep, setOodaStep] = useState(-1);
  const logRef = useRef(null);
  const timersRef = useRef([]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch real NOAA data
  useEffect(() => {
    fetch(NOAA_URL)
      .then((r) => r.json())
      .then((d) => {
        const readings = d?.data;
        if (readings && readings.length) {
          const latest = parseFloat(readings[readings.length - 1].v);
          if (!isNaN(latest)) {
            setGaugeData(latest);
            setSimGauge(latest);
            setScenario(buildScenario(latest));
          }
        }
      })
      .catch(() => setGaugeError(true));
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  // Run the OODA loop
  function runLoop() {
    if (running) return;
    setRunning(true);
    setDone(false);
    setLog([]);
    setRecVisible(false);
    setConfirmed(null);
    setOodaStep(-1);

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const sc = buildScenario(simGauge);
    setScenario(sc);

    const phaseOrder = ["OBSERVE", "ORIENT", "DECIDE", "ACT"];

    sc.events.forEach((ev) => {
      const t = setTimeout(() => {
        setLog((prev) => [...prev, ev]);
        const phaseIdx = phaseOrder.indexOf(ev.phase);
        setOodaStep((prev) => Math.max(prev, phaseIdx));
      }, ev.delay);
      timersRef.current.push(t);
    });

    // Recommendation appears
    const recT = setTimeout(() => {
      setOodaStep(3);
      setRecVisible(true);
    }, sc.events[sc.events.length - 1].delay + 1200);
    timersRef.current.push(recT);

    const doneT = setTimeout(() => {
      setRunning(false);
      setDone(true);
    }, sc.events[sc.events.length - 1].delay + 1400);
    timersRef.current.push(doneT);
  }

  function resetLoop() {
    timersRef.current.forEach(clearTimeout);
    setLog([]);
    setRunning(false);
    setDone(false);
    setRecVisible(false);
    setConfirmed(null);
    setOodaStep(-1);
  }

  const oodaPhases = ["OBSERVE", "ORIENT", "DECIDE", "ACT"];
  const recColors = {
    ok: C.teal,
    warning: C.amber,
    critical: C.red,
  };
  const recColor = recColors[scenario.recommendation.severity];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .log-entry { animation: fadeSlideIn 0.35s ease forwards; }
        .rec-card  { animation: fadeSlideIn 0.5s ease forwards; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.borderHi}; border-radius: 2px; }

        .row1-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }
        .row2-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 16px;
        }
        .nav-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .nav-time { display: block; }
        @media (max-width: 640px) {
          .row1-grid {
            grid-template-columns: 1fr !important;
          }
          .row2-grid {
            grid-template-columns: 1fr !important;
          }
          .nav-time { display: none; }
          .nav-right { gap: 8px; }
          .page-padding { padding: 12px 14px !important; }
          .log-height { height: 240px !important; }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .row1-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .row2-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.white,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundImage: `
              linear-gradient(${C.border}55 1px, transparent 1px),
              linear-gradient(90deg, ${C.border}55 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Scanline */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 120,
            background: `linear-gradient(to bottom, transparent, ${C.teal}06, transparent)`,
            pointerEvents: "none",
            zIndex: 1,
            animation: "scanline 8s linear infinite",
          }}
        />

        <div style={{ position: "relative", zIndex: 2, padding: "0 0 40px" }}>

          {/* ── Top Nav ── */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 28px",
              borderBottom: `1px solid ${C.border}`,
              background: `${C.panel}ee`,
              backdropFilter: "blur(12px)",
              position: "sticky",
              top: 0,
              zIndex: 50,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Delta logo mark */}
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <polygon
                  points="16,3 30,28 2,28"
                  fill="none"
                  stroke={C.teal}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <line
                  x1="9" y1="28" x2="23" y2="28"
                  stroke={C.teal}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="18" r="2.5" fill={C.teal} />
              </svg>
              <div>
                <div
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: "0.05em",
                    color: C.white,
                  }}
                >
                  DELTAAGENT
                  <span style={{ color: C.teal }}> AI</span>
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: C.muted,
                    letterSpacing: "0.12em",
                  }}
                >
                  COMMAND CENTER · BETA
                </div>
              </div>
            </div>

            <div className="nav-right">
              <Badge color={scenario.statusColor}>{scenario.status}</Badge>
              <div
                className="nav-time"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: C.muted,
                }}
              >
                {time.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                  timeZone: "America/Chicago",
                })}{" "}
                CST
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PulsingDot color={C.teal} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.teal }}>
                  LIVE
                </span>
              </div>
            </div>
          </header>

          <div className="page-padding" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Row 1: Gauge + Agent Status + OODA ── */}
            <div className="row1-grid">

              {/* Carrollton Gauge */}
              <div
                style={{
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "18px 20px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: C.muted,
                    letterSpacing: "0.1em",
                    marginBottom: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>CARROLLTON GAUGE · 8761927</span>
                  {gaugeData ? (
                    <Badge color={C.teal}>NOAA LIVE</Badge>
                  ) : (
                    <Badge color={C.muted}>SIMULATED</Badge>
                  )}
                </div>

                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 48,
                    fontWeight: 700,
                    color: scenario.statusColor,
                    lineHeight: 1,
                    marginBottom: 4,
                    textShadow: `0 0 24px ${scenario.statusColor}55`,
                  }}
                >
                  {simGauge.toFixed(1)}
                  <span style={{ fontSize: 16, color: C.muted, marginLeft: 4 }}>ft</span>
                </div>

                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: C.muted,
                    marginBottom: 14,
                  }}
                >
                  {gaugeData
                    ? `Live reading · ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" })} CST`
                    : "Simulated · adjust slider below"}
                </div>

                <GaugeBar value={simGauge} />

                {/* Simulator slider */}
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: C.muted,
                      marginBottom: 6,
                      letterSpacing: "0.08em",
                    }}
                  >
                    SCENARIO SIMULATOR
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.1}
                    value={simGauge}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setSimGauge(v);
                      setScenario(buildScenario(v));
                      resetLoop();
                    }}
                    style={{
                      width: "100%",
                      accentColor: C.teal,
                      cursor: "pointer",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: C.muted,
                      marginTop: 2,
                    }}
                  >
                    <span>1 ft</span>
                    <span style={{ color: C.amber }}>5.5 ELEVATED</span>
                    <span style={{ color: C.red }}>8.0 CRITICAL</span>
                    <span>10 ft</span>
                  </div>
                </div>
              </div>

              {/* Agent Status */}
              <div
                style={{
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "18px 20px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: C.muted,
                    letterSpacing: "0.1em",
                    marginBottom: 16,
                  }}
                >
                  AGENT NETWORK · 3 ACTIVE
                </div>
                {AGENTS.map((ag) => {
                  const hasActivity = log.some((l) => l.agent === ag.id);
                  return (
                    <div
                      key={ag.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: `1px solid ${hasActivity ? ag.color + "55" : C.border}`,
                        background: hasActivity ? `${ag.color}0d` : "transparent",
                        marginBottom: 8,
                        transition: "all 0.4s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: `${ag.color}20`,
                          border: `1px solid ${ag.color}44`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: 700,
                          color: ag.color,
                        }}
                      >
                        {ag.code}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>
                          {ag.name}
                        </div>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9,
                            color: C.muted,
                          }}
                        >
                          {ag.role}
                        </div>
                      </div>
                      <div>
                        {hasActivity ? (
                          <PulsingDot color={ag.color} />
                        ) : (
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: C.mutedLo,
                              border: `1px solid ${C.muted}44`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Vessel */}
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: C.tealFaint,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: C.muted,
                      marginBottom: 4,
                    }}
                  >
                    AIS · INBOUND VESSEL
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>
                    MV Delta Voyager
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: C.muted,
                    }}
                  >
                    LOA 185m · Draft 9.2m · ETA 04:20 CST
                  </div>
                </div>
              </div>

              {/* OODA Loop */}
              <div
                style={{
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "18px 20px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: C.muted,
                    letterSpacing: "0.1em",
                    marginBottom: 16,
                  }}
                >
                  OODA LOOP · CURRENT CYCLE
                </div>
                {oodaPhases.map((phase, i) => {
                  const active = oodaStep === i;
                  const complete = oodaStep > i;
                  const color = complete || active ? C.teal : C.muted;
                  return (
                    <div
                      key={phase}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: i < 3 ? 0 : 0,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: `2px solid ${active ? C.teal : complete ? C.tealDim : C.border}`,
                            background: complete ? C.tealDim : active ? `${C.teal}22` : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            fontWeight: 700,
                            color: active ? C.teal : complete ? C.teal : C.muted,
                            transition: "all 0.4s ease",
                            boxShadow: active ? `0 0 12px ${C.teal}55` : "none",
                          }}
                        >
                          {complete ? "✓" : phase[0]}
                        </div>
                        {i < 3 && (
                          <div
                            style={{
                              width: 2,
                              height: 24,
                              background: complete ? C.tealDim : C.border,
                              transition: "background 0.4s ease",
                            }}
                          />
                        )}
                      </div>
                      <div style={{ paddingTop: 4, paddingBottom: i < 3 ? 0 : 0 }}>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            fontWeight: 700,
                            color,
                            letterSpacing: "0.08em",
                          }}
                        >
                          {phase}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: C.muted,
                            lineHeight: 1.4,
                            marginBottom: i < 3 ? 6 : 0,
                          }}
                        >
                          {phase === "OBSERVE" && "NOAA · AIS · NOPB data"}
                          {phase === "ORIENT" && "River-Logic analysis"}
                          {phase === "DECIDE" && "1,024 simulations run"}
                          {phase === "ACT" && "SMS · API · Dashboard"}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Run button */}
                <button
                  onClick={running ? undefined : runLoop}
                  style={{
                    width: "100%",
                    marginTop: 18,
                    padding: "10px 0",
                    borderRadius: 6,
                    border: `1px solid ${running ? C.tealDim : C.teal}`,
                    background: running ? C.tealFaint : `${C.teal}22`,
                    color: running ? C.muted : C.teal,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    cursor: running ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {running
                    ? "▶ RUNNING CYCLE…"
                    : done
                    ? "↺ RUN NEW CYCLE"
                    : "▶ RUN OODA CYCLE"}
                </button>
                {done && (
                  <button
                    onClick={resetLoop}
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "8px 0",
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: "transparent",
                      color: C.muted,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                    }}
                  >
                    RESET
                  </button>
                )}
              </div>
            </div>

            {/* ── Row 2: Agent Log + Recommendation ── */}
            <div className="row2-grid">

              {/* Agent Activity Log */}
              <div
                style={{
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: C.muted,
                      letterSpacing: "0.1em",
                    }}
                  >
                    AGENT ACTIVITY LOG
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {running && <PulsingDot color={C.teal} />}
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        color: C.muted,
                      }}
                    >
                      {log.length} EVENTS
                    </span>
                  </div>
                </div>

                <div
                  ref={logRef}
                  className="log-height"
                  style={{
                    height: 320,
                    overflowY: "auto",
                    padding: "12px 16px",
                  }}
                >
                  {log.length === 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        color: C.muted,
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 28, opacity: 0.3 }}>◈</div>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          letterSpacing: "0.08em",
                        }}
                      >
                        AWAITING CYCLE INITIATION
                      </div>
                      <div style={{ fontSize: 12 }}>
                        Press RUN OODA CYCLE to activate agents
                      </div>
                    </div>
                  )}
                  {log.map((entry) => {
                    const ag = AGENTS.find((a) => a.id === entry.agent);
                    return (
                      <div
                        key={entry.id}
                        className="log-entry"
                        style={{
                          display: "flex",
                          gap: 10,
                          marginBottom: 12,
                          paddingBottom: 12,
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        <div style={{ flexShrink: 0, paddingTop: 2 }}>
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 4,
                              background: `${ag.color}18`,
                              border: `1px solid ${ag.color}44`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 9,
                              fontWeight: 700,
                              color: ag.color,
                            }}
                          >
                            {ag.code}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: ag.color,
                              }}
                            >
                              {ag.name}
                            </span>
                            <Badge color={ag.color}>{entry.phase}</Badge>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#c0d8d6",
                              lineHeight: 1.55,
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                            }}
                          >
                            {entry.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recommendation Panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Current Recommendation */}
                <div
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    overflow: "hidden",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      padding: "14px 20px",
                      borderBottom: `1px solid ${C.border}`,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: C.muted,
                      letterSpacing: "0.1em",
                    }}
                  >
                    AI RECOMMENDATION
                  </div>

                  <div style={{ padding: "16px 20px" }}>
                    {!recVisible ? (
                      <div
                        style={{
                          color: C.muted,
                          fontSize: 12,
                          textAlign: "center",
                          padding: "24px 0",
                        }}
                      >
                        <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>⊡</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                          PENDING ANALYSIS
                        </div>
                      </div>
                    ) : (
                      <div className="rec-card">
                        <div
                          style={{
                            padding: "12px 14px",
                            borderRadius: 6,
                            border: `1px solid ${recColor}44`,
                            background: `${recColor}10`,
                            marginBottom: 14,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              color: recColor,
                              letterSpacing: "0.08em",
                              marginBottom: 6,
                            }}
                          >
                            {scenario.recommendation.severity.toUpperCase()} · AGENT CONSENSUS
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: C.white,
                              marginBottom: 8,
                            }}
                          >
                            {scenario.recommendation.label}
                          </div>
                          <div style={{ fontSize: 11, color: "#a0c4c0", lineHeight: 1.5 }}>
                            {scenario.recommendation.detail}
                          </div>
                        </div>

                        {confirmed ? (
                          <div
                            style={{
                              padding: "10px 14px",
                              borderRadius: 6,
                              border: `1px solid ${confirmed === "confirmed" ? C.teal : C.amber}44`,
                              background: `${confirmed === "confirmed" ? C.teal : C.amber}10`,
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 11,
                              color: confirmed === "confirmed" ? C.teal : C.amber,
                              textAlign: "center",
                              letterSpacing: "0.06em",
                            }}
                          >
                            {confirmed === "confirmed"
                              ? "✓ CONFIRMED — Executing via SMS + API"
                              : "⚠ OVERRIDE LOGGED — Manual action required"}
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => setConfirmed("confirmed")}
                              style={{
                                flex: 1,
                                padding: "9px 0",
                                borderRadius: 6,
                                border: `1px solid ${C.teal}`,
                                background: `${C.teal}20`,
                                color: C.teal,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                cursor: "pointer",
                              }}
                            >
                              ✓ CONFIRM
                            </button>
                            <button
                              onClick={() => setConfirmed("override")}
                              style={{
                                flex: 1,
                                padding: "9px 0",
                                borderRadius: 6,
                                border: `1px solid ${C.amber}`,
                                background: `${C.amber}10`,
                                color: C.amber,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                cursor: "pointer",
                              }}
                            >
                              ⚠ OVERRIDE
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* System Status */}
                <div
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "14px 18px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: C.muted,
                      letterSpacing: "0.1em",
                      marginBottom: 12,
                    }}
                  >
                    SYSTEM STATUS
                  </div>
                  {[
                    { label: "NOAA Feed", ok: !gaugeError },
                    { label: "AIS Vessel Track", ok: true },
                    { label: "Agent Orchestrator", ok: true },
                    { label: "SMS Gateway (Twilio)", ok: true },
                    { label: "NOPB Rail API", ok: true },
                  ].map(({ label, ok }) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
                      <Badge color={ok ? C.teal : C.amber}>
                        {ok ? "ONLINE" : "SIMULATED"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 12,
                borderTop: `1px solid ${C.border}`,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                <Badge color={C.teal}>TWIC-CLEARED FOUNDERS</Badge>
                <Badge color={C.tealDim}>MTSA ALIGNED</Badge>
                <Badge color={C.muted}>NEWLAB NEW ORLEANS</Badge>
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: C.muted,
                }}
              >
                © 2026 DELTAAGENT AI, LLC · deltaagent.ai · BETA
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
