import { useState, useEffect, useRef } from "react";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:        "#040404",
  panel:     "#08100e",
  panelHi:   "#0d1a17",
  border:    "#0f2a1e",
  borderHi:  "#1a4a38",
  teal:      "#3bbfb2",
  tealDim:   "#1d6b65",
  tealFaint: "#0d2e2b",
  amber:     "#d97706",
  amberFaint:"#1f1200",
  red:       "#dc2626",
  redFaint:  "#1f0808",
  green:     "#16a34a",
  greenFaint:"#0a1f0f",
  white:     "#f0faf9",
  muted:     "#4a7a75",
  mutedLo:   "#1e3835",
  mono:      "'JetBrains Mono', monospace",
  sans:      "'Plus Jakarta Sans', sans-serif",
};

// ── NOAA ──────────────────────────────────────────────────────────────────────
const NOAA_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
  "?station=8761927&product=water_level&datum=MLLW" +
  "&time_zone=lst_ldt&units=english&format=json&range=2";

// ── Scenario engine ───────────────────────────────────────────────────────────
function buildScenario(ft) {
  const rising   = ft > 5.5;
  const critical = ft > 8.0;
  const status      = critical ? "CRITICAL" : rising ? "ELEVATED" : "NOMINAL";
  const statusColor = critical ? C.red      : rising ? C.amber    : C.teal;
  const risk        = critical ? "HIGH RISK" : rising ? "ELEVATED RISK" : "NOMINAL";
  const riskColor   = critical ? C.red : rising ? C.amber : C.teal;

  const decisions = critical ? [
    {
      id: "d1",
      severity: "critical",
      title: "HOLD — Delay Berthing 6 Hours",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft exceeds Algiers Point vessel restriction threshold. MV Delta Voyager draft (9.2m) incompatible with current stage.",
      costAvoided: 38000,
      costIfIgnored: 38000,
      advanceWarning: "4h 23m",
      agents: ["RW", "BM", "IS"],
      actions: [
        "MV Delta Voyager re-queued at Southwest Pass anchorage",
        "22 drayage trucks rerouted to Globalplex — gate delay 6 hrs",
        "CN/KCS rail departure window held pending stage drop",
        "SMS alert dispatched to Port Director + Pilot Station",
      ],
      confirmed: null,
    },
    {
      id: "d2",
      severity: "warning",
      title: "STANDBY — Monitor Stage Trend",
      reason: "River stage rising 0.3ft/hr. If trend continues, secondary berth conflict projected at Berth 4 within 90 minutes.",
      costAvoided: 12000,
      costIfIgnored: 12000,
      advanceWarning: "1h 31m",
      agents: ["RW"],
      actions: [
        "Berth 4 flagged for precautionary hold",
        "Crane gang notified of possible schedule shift",
      ],
      confirmed: null,
    },
  ] : rising ? [
    {
      id: "d1",
      severity: "warning",
      title: "RE-SEQUENCE — Swap Berth 2 → Berth 4",
      reason: "Stage rising trend detected. Draft margin for Berth 2 shrinking. Berth 4 preferred at current " + ft.toFixed(1) + "ft stage.",
      costAvoided: 14200,
      costIfIgnored: 14200,
      advanceWarning: "2h 11m",
      agents: ["RW", "BM"],
      actions: [
        "Berth assignment updated: Berth 2 → Berth 4",
        "CN rail departure window shifted 08:45 → 10:15",
        "Truck gate ETA adjusted +90 min",
        "Crane gang reassigned to Berth 4",
      ],
      confirmed: null,
    },
  ] : [];

  // Gauge sparkline trend (mock last 8 readings)
  const trend = critical
    ? [3.1, 4.2, 5.5, 6.8, 7.4, 8.0, 8.2, ft]
    : rising
    ? [3.8, 4.1, 4.4, 4.8, 5.1, 5.4, 5.6, ft]
    : [4.6, 4.5, 4.4, 4.3, 4.4, 4.5, 4.6, ft];

  return { ft, status, statusColor, risk, riskColor, decisions, trend };
}

// ── Small components ──────────────────────────────────────────────────────────
function Badge({ color, children, small }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: small ? "1px 6px" : "2px 8px",
      borderRadius: 3,
      border: `1px solid ${color}55`,
      background: `${color}15`,
      color,
      fontFamily: C.mono,
      fontSize: small ? 9 : 10,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    }}>{children}</span>
  );
}

function PulsingDot({ color, size = 8 }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.35, animation: "ping 1.6s ease-in-out infinite" }} />
      <span style={{ position: "relative", width: size, height: size, borderRadius: "50%", background: color }} />
    </span>
  );
}

function Sparkline({ data, color, width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
      <circle cx={pts.split(" ").pop().split(",")[0]} cy={pts.split(" ").pop().split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

function GaugeBar({ value, max = 12 }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 8 ? C.red : value >= 5.5 ? C.amber : C.teal;
  return (
    <div style={{ width: "100%", marginTop: 8 }}>
      <div style={{ height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: color, transition: "width 1.2s ease, background 0.6s ease", boxShadow: `0 0 6px ${color}66` }} />
        {[5.5, 8].map((t, i) => (
          <div key={i} style={{ position: "absolute", left: `${(t / max) * 100}%`, top: 0, height: "100%", width: 1, background: i === 0 ? C.amber : C.red, opacity: 0.5 }} />
        ))}
      </div>
    </div>
  );
}

// ── SMS Notification Modal ────────────────────────────────────────────────────
function SMSNotification({ decision, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
    setTimeout(() => { setVisible(false); setTimeout(onClose, 400); }, 4000);
  }, []);

  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" });

  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 1000,
      transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      transform: visible ? "translateX(0) scale(1)" : "translateX(120%) scale(0.8)",
      opacity: visible ? 1 : 0,
    }}>
      <div style={{
        width: 300,
        background: "#1a1a1a",
        borderRadius: 16,
        padding: "12px 16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)",
        fontFamily: C.sans,
      }}>
        {/* Phone header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0f4547, #3bbfb2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <polygon points="8,2 14,14 8,10 2,14" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>DeltaAgent AI</div>
            <div style={{ fontSize: 10, color: "#888" }}>now · {time} CST</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#888" }}>⚠️ ALERT</div>
        </div>

        {/* Message */}
        <div style={{
          background: "#2a2a2a",
          borderRadius: 12,
          borderTopLeftRadius: 4,
          padding: "10px 12px",
          fontSize: 12,
          color: "#f0f0f0",
          lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, color: decision.severity === "critical" ? "#dc2626" : "#d97706", marginBottom: 4 }}>
            ⚠ {decision.title}
          </div>
          <div style={{ color: "#ccc", fontSize: 11 }}>
            Gauge: {decision.ft?.toFixed(1) || "8.4"}ft · Est. cost avoidance: ${decision.costAvoided?.toLocaleString()}
          </div>
          <div style={{ color: "#888", fontSize: 10, marginTop: 4 }}>
            Action confirmed by {decision.confirmedBy || "Jordan Liuzza"} — executing now.
          </div>
        </div>

        {/* Recipient */}
        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "#555" }}>Sent to: Port Director · Pilot Station · CN/KCS</div>
          <div style={{ fontSize: 10, color: "#3bbfb2" }}>✓ Delivered</div>
        </div>
      </div>
    </div>
  );
}

// ── Execution Ticker ──────────────────────────────────────────────────────────
function ExecutionTicker({ decision, onComplete }) {
  const [steps, setSteps] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const startTime = useRef(Date.now());

  const executionSteps = [
    { delay: 300,  label: "SMS dispatched → Port Director",     detail: "+1 (504) 555-0147", icon: "📱" },
    { delay: 600,  label: "SMS dispatched → Pilot Station",      detail: "+1 (504) 555-0293", icon: "📱" },
    { delay: 950,  label: "CN/KCS Rail API — window updated",    detail: "08:45 → 10:15 CST", icon: "🚂" },
    { delay: 1300, label: "Drayage fleet notified via Twilio",   detail: "22 trucks rerouted", icon: "🚛" },
    { delay: 1700, label: "Berth schedule updated in TOS",       detail: "Navis N4 API call ✓", icon: "⚓" },
    { delay: 2100, label: "Audit log entry created",             detail: "MTSA compliance record", icon: "📋" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(((Date.now() - startTime.current) / 1000).toFixed(1));
    }, 100);

    executionSteps.forEach((step, i) => {
      setTimeout(() => {
        setSteps(prev => [...prev, { ...step, ts: ((Date.now() - startTime.current) / 1000).toFixed(1) }]);
        if (i === executionSteps.length - 1) {
          setTimeout(() => { setDone(true); clearInterval(timer); }, 300);
        }
      }, step.delay);
    });

    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      borderTop: `1px solid ${C.border}`,
      background: C.panel,
      padding: "16px 20px",
      animation: "fadeSlideIn 0.3s ease",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!done && <PulsingDot color={C.teal} size={8} />}
          {done && <span style={{ color: C.teal, fontSize: 14 }}>✓</span>}
          <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.08em" }}>
            {done ? "EXECUTION COMPLETE" : "EXECUTING…"}
          </span>
        </div>
        <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>
          {elapsed}s elapsed
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {executionSteps.map((step, i) => {
          const fired = steps.find((s, si) => si === i || s.label === step.label);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 5,
              background: fired ? `${C.teal}0a` : "transparent",
              border: `1px solid ${fired ? C.teal + "33" : C.border}`,
              transition: "all 0.3s ease",
              opacity: fired ? 1 : 0.35,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{step.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: fired ? C.white : C.muted, fontWeight: fired ? 600 : 400 }}>
                  {step.label}
                </div>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{step.detail}</div>
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 9, flexShrink: 0 }}>
                {fired ? (
                  <span style={{ color: C.teal }}>✓ {fired.ts}s</span>
                ) : (
                  <span style={{ color: C.mutedLo }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {done && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8, animation: "fadeSlideIn 0.4s ease",
        }}>
          <div style={{ padding: "10px 12px", borderRadius: 6, background: `${C.green}10`, border: `1px solid ${C.green}22`, textAlign: "center" }}>
            <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 3, letterSpacing: "0.08em" }}>COST AVOIDED</div>
            <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: C.green }}>${decision.costAvoided.toLocaleString()}</div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 6, background: `${C.teal}10`, border: `1px solid ${C.teal}22`, textAlign: "center" }}>
            <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 3, letterSpacing: "0.08em" }}>ELAPSED TIME</div>
            <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: C.teal }}>{elapsed}s</div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 6, background: `${C.teal}10`, border: `1px solid ${C.teal}22`, textAlign: "center" }}>
            <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 3, letterSpacing: "0.08em" }}>ALERTS SENT</div>
            <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: C.teal }}>6</div>
          </div>
        </div>
      )}

      {done && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 5, background: `${C.muted}10`, border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.06em" }}>
            ⏱ Human review + confirmation: ~3 sec &nbsp;|&nbsp; Agent execution: {elapsed}s &nbsp;|&nbsp; vs. manual: ~45 min / 20 calls
          </div>
        </div>
      )}
    </div>
  );
}
function DecisionCard({ decision, gaugeVal, onConfirm, onOverride }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  const severityColor = decision.severity === "critical" ? C.red : C.amber;
  const severityBg    = decision.severity === "critical" ? C.redFaint : C.amberFaint;

  function handleConfirm() {
    setConfirmed("confirmed");
    onConfirm(decision);
  }

  function handleOverride() {
    setConfirmed("override");
    onOverride(decision);
  }

  return (
    <div style={{
      border: `1px solid ${severityColor}44`,
      borderLeft: `3px solid ${severityColor}`,
      borderRadius: 8,
      background: severityBg,
      overflow: "hidden",
      transition: "all 0.3s ease",
    }}
    className="decision-card"
    >
      {/* Card header */}
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flexShrink: 0, paddingTop: 2 }}>
            <PulsingDot color={severityColor} size={10} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <Badge color={severityColor}>{decision.severity}</Badge>
              {decision.agents.map(a => (
                <Badge key={a} color={C.muted} small>{a}</Badge>
              ))}
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginLeft: "auto" }}>
                ⏱ {decision.advanceWarning} advance warning
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6, lineHeight: 1.3 }}>
              {decision.title}
            </div>
            <div style={{ fontSize: 12, color: "#a0c4c0", lineHeight: 1.55 }}>
              {decision.reason}
            </div>
          </div>
        </div>

        {/* Cost impact — the headline */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 14,
        }}>
          <div style={{
            background: `${C.green}15`,
            border: `1px solid ${C.green}33`,
            borderRadius: 6,
            padding: "10px 14px",
          }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>
              EST. COST AVOIDED
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.green, letterSpacing: "-0.02em" }}>
              ${decision.costAvoided.toLocaleString()}
            </div>
          </div>
          <div style={{
            background: `${C.red}10`,
            border: `1px solid ${C.red}22`,
            borderRadius: 6,
            padding: "10px 14px",
          }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>
              COST IF IGNORED
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.red, letterSpacing: "-0.02em" }}>
              ${decision.costIfIgnored.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Action buttons or confirmation state */}
        {confirmed === "override" ? (
          <div style={{
            padding: "12px 16px", borderRadius: 6,
            border: `1px solid ${C.amber}44`,
            background: `${C.amber}10`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <PulsingDot color={C.amber} />
            <div>
              <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: "0.06em" }}>
                ⚠ OVERRIDE LOGGED — Manual action required
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Decision recorded for MTSA audit trail
              </div>
            </div>
          </div>
        ) : confirmed === null ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleConfirm} style={{
              flex: 1, padding: "11px 0", borderRadius: 6,
              border: `1px solid ${C.teal}`,
              background: `${C.teal}20`,
              color: C.teal,
              fontFamily: C.mono, fontSize: 12, fontWeight: 700,
              letterSpacing: "0.08em", cursor: "pointer",
              transition: "all 0.15s ease",
            }}>
              ✓ CONFIRM &amp; DISPATCH
            </button>
            <button onClick={handleOverride} style={{
              flex: 1, padding: "11px 0", borderRadius: 6,
              border: `1px solid ${C.amber}`,
              background: `${C.amber}10`,
              color: C.amber,
              fontFamily: C.mono, fontSize: 12, fontWeight: 700,
              letterSpacing: "0.08em", cursor: "pointer",
              transition: "all 0.15s ease",
            }}>
              ⚠ OVERRIDE
            </button>
            <button onClick={() => setExpanded(!expanded)} style={{
              padding: "11px 16px", borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.muted,
              fontFamily: C.mono, fontSize: 11,
              cursor: "pointer",
            }}>
              {expanded ? "▲" : "▼"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Execution ticker — shows after confirm */}
      {confirmed === "confirmed" && (
        <ExecutionTicker decision={decision} />
      )}

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: "14px 20px",
          background: `${C.panel}`,
          animation: "fadeSlideIn 0.25s ease",
        }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 10 }}>
            AGENT ACTIONS QUEUED
          </div>
          {decision.actions.map((action, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              marginBottom: 8, paddingBottom: 8,
              borderBottom: i < decision.actions.length - 1 ? `1px solid ${C.border}` : "none",
            }}>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: severityColor, marginTop: 1, flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 12, color: "#a0c4c0", lineHeight: 1.5 }}>{action}</div>
            </div>
          ))}

          {/* OODA mini */}
          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            {["OBSERVE", "ORIENT", "DECIDE", "ACT"].map((phase, i) => (
              <div key={phase} style={{
                flex: 1, padding: "6px 8px", borderRadius: 4,
                background: `${severityColor}15`,
                border: `1px solid ${severityColor}33`,
                textAlign: "center",
              }}>
                <div style={{ fontFamily: C.mono, fontSize: 8, color: severityColor, fontWeight: 700 }}>{phase}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function DeltaAgentDashboard() {
  const [gaugeData, setGaugeData]     = useState(null);
  const [gaugeError, setGaugeError]   = useState(false);
  const [simGauge, setSimGauge]       = useState(4.4);
  const [scenario, setScenario]       = useState(() => buildScenario(4.4));
  const [time, setTime]               = useState(new Date());
  const [smsQueue, setSmsQueue]       = useState([]);
  const [activeTab, setActiveTab]     = useState("inbox");
  const [agentLog, setAgentLog]       = useState([]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // NOAA fetch
  useEffect(() => {
    fetch(NOAA_URL)
      .then(r => r.json())
      .then(d => {
        const readings = d?.data;
        if (readings?.length) {
          const latest = parseFloat(readings[readings.length - 1].v);
          if (!isNaN(latest)) {
            setGaugeData(latest);
            setSimGauge(latest);
            setScenario(buildScenario(latest));
            // Build trend from last 8 readings
            const trend = readings.slice(-8).map(r => parseFloat(r.v)).filter(v => !isNaN(v));
            setScenario(buildScenario(latest));
          }
        }
      })
      .catch(() => setGaugeError(true));
  }, []);

  function handleConfirm(decision) {
    setSmsQueue(q => [...q, { ...decision, ft: simGauge, id: Date.now() }]);
    setAgentLog(prev => [{
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
      action: `CONFIRMED: ${decision.title}`,
      cost: `$${decision.costAvoided.toLocaleString()} cost avoidance logged`,
      severity: decision.severity,
    }, ...prev]);
  }

  function handleOverride(decision) {
    setAgentLog(prev => [{
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
      action: `OVERRIDE: ${decision.title}`,
      cost: "Manual action required",
      severity: "warning",
    }, ...prev]);
  }

  function removeSms(id) {
    setSmsQueue(q => q.filter(s => s.id !== id));
  }

  const pendingCount = scenario.decisions.length;
  const totalSavings = scenario.decisions.reduce((sum, d) => sum + d.costAvoided, 0);
  const trendDir = scenario.trend[scenario.trend.length - 1] > scenario.trend[scenario.trend.length - 2] ? "↑" : scenario.trend[scenario.trend.length - 1] < scenario.trend[scenario.trend.length - 2] ? "↓" : "→";
  const trendColor = trendDir === "↑" ? C.amber : trendDir === "↓" ? C.teal : C.muted;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        @keyframes ping { 75%,100% { transform: scale(2.2); opacity: 0; } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); } }
        .decision-card { animation: fadeSlideIn 0.4s ease forwards; }
        .decision-card:hover { filter: brightness(1.05); }
        button:hover { filter: brightness(1.15); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.borderHi}; border-radius: 2px; }
        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
          .hide-sm { display: none !important; }
        }
      `}</style>

      {/* SMS notifications */}
      {smsQueue.map(sms => (
        <SMSNotification key={sms.id} decision={sms} onClose={() => removeSms(sms.id)} />
      ))}

      <div style={{ minHeight: "100vh", background: C.bg, color: C.white, fontFamily: C.sans, position: "relative", overflow: "hidden" }}>

        {/* Grid overlay */}
        <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(${C.border}44 1px, transparent 1px), linear-gradient(90deg, ${C.border}44 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0, opacity: 0.6 }} />

        {/* Scanline */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 100, background: `linear-gradient(to bottom, transparent, ${C.teal}05, transparent)`, pointerEvents: "none", zIndex: 1, animation: "scanline 10s linear infinite" }} />

        <div style={{ position: "relative", zIndex: 2, paddingBottom: 40 }}>

          {/* ── NAV ── */}
          <header style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 28px",
            borderBottom: `1px solid ${C.border}`,
            background: `${C.panel}f0`,
            backdropFilter: "blur(16px)",
            position: "sticky", top: 0, zIndex: 50,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                <polygon points="16,3 30,28 2,28" fill="none" stroke={C.teal} strokeWidth="2" strokeLinejoin="round"/>
                <line x1="9" y1="28" x2="23" y2="28" stroke={C.teal} strokeWidth="2" strokeLinecap="round"/>
                <circle cx="16" cy="18" r="2.5" fill={C.teal}/>
              </svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.06em" }}>
                  DELTAAGENT<span style={{ color: C.teal }}> AI</span>
                </div>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.12em" }}>
                  OPERATIONS COMMAND · BETA
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {pendingCount > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 20,
                  background: `${C.red}20`,
                  border: `1px solid ${C.red}44`,
                  animation: "pulseGlow 2s ease-in-out infinite",
                }}>
                  <PulsingDot color={C.red} size={6} />
                  <span style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: "0.06em" }}>
                    {pendingCount} PENDING
                  </span>
                </div>
              )}
              <Badge color={scenario.statusColor}>{scenario.status}</Badge>
              <div className="hide-sm" style={{ fontFamily: C.mono, fontSize: 11, color: C.muted }}>
                {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" })} CST
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <PulsingDot color={C.teal} size={7} />
                <span style={{ fontFamily: C.mono, fontSize: 10, color: C.teal }}>LIVE</span>
              </div>
            </div>
          </header>

          <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── HERO ROW: Three stat cards ── */}
            <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

              {/* Gauge card */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>CARROLLTON GAUGE · 8761927</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: C.mono, fontSize: 36, fontWeight: 700, color: scenario.statusColor, textShadow: `0 0 20px ${scenario.statusColor}44`, lineHeight: 1 }}>
                        {simGauge.toFixed(1)}
                      </span>
                      <span style={{ fontFamily: C.mono, fontSize: 13, color: C.muted }}>ft</span>
                      <span style={{ fontFamily: C.mono, fontSize: 16, color: trendColor, fontWeight: 700 }}>{trendDir}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    {gaugeData ? <Badge color={C.teal} small>NOAA LIVE</Badge> : <Badge color={C.muted} small>SIMULATED</Badge>}
                    <Sparkline data={scenario.trend} color={scenario.statusColor} />
                  </div>
                </div>
                <GaugeBar value={simGauge} />
                {/* Scenario slider */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>SCENARIO SIMULATOR</div>
                  <input type="range" min={1} max={10} step={0.1} value={simGauge}
                    onChange={e => { const v = parseFloat(e.target.value); setSimGauge(v); setScenario(buildScenario(v)); }}
                    style={{ width: "100%", accentColor: C.teal, cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                    <span>1ft</span><span style={{ color: C.amber }}>5.5 ELEVATED</span><span style={{ color: C.red }}>8.0 CRITICAL</span><span>10ft</span>
                  </div>
                </div>
              </div>

              {/* Decisions pending card */}
              <div style={{
                background: pendingCount > 0 ? `${C.red}08` : C.panel,
                border: `1px solid ${pendingCount > 0 ? C.red + "44" : C.border}`,
                borderRadius: 8, padding: "16px 20px",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 8 }}>DECISIONS AWAITING</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: C.mono, fontSize: 52, fontWeight: 700, color: pendingCount > 0 ? C.red : C.muted, lineHeight: 1, textShadow: pendingCount > 0 ? `0 0 30px ${C.red}44` : "none" }}>
                      {pendingCount}
                    </span>
                    <span style={{ fontFamily: C.mono, fontSize: 12, color: C.muted }}>
                      {pendingCount === 1 ? "decision" : "decisions"}
                    </span>
                  </div>
                </div>
                <div>
                  {pendingCount > 0 ? (
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                      {scenario.decisions[0].advanceWarning} advance warning on highest priority item
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: C.muted }}>All systems nominal — no action required</div>
                  )}
                </div>
              </div>

              {/* Next vessel + savings card */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 8 }}>NEXT INBOUND VESSEL</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>MV Delta Voyager</div>
                  <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginBottom: 4 }}>LOA 185m · Draft 9.2m · ETA 04:20 CST</div>
                  <Badge color={scenario.riskColor} small>{scenario.risk}</Badge>
                </div>
                {totalSavings > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6, background: `${C.green}10`, border: `1px solid ${C.green}22` }}>
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 2, letterSpacing: "0.08em" }}>POTENTIAL SAVINGS TODAY</div>
                    <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 700, color: C.green }}>${totalSavings.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            {/* ── TABS ── */}
            <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}` }}>
              {[
                { id: "inbox", label: `DECISION INBOX${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
                { id: "log",   label: "AGENT LOG" },
                { id: "status", label: "SYSTEM STATUS" },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  padding: "10px 18px",
                  border: "none",
                  borderBottom: activeTab === tab.id ? `2px solid ${C.teal}` : "2px solid transparent",
                  background: "transparent",
                  color: activeTab === tab.id ? C.teal : C.muted,
                  fontFamily: C.mono, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.08em", cursor: "pointer",
                  transition: "all 0.2s ease",
                  marginBottom: -1,
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── INBOX TAB ── */}
            {activeTab === "inbox" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {scenario.decisions.length === 0 ? (
                  <div style={{
                    background: C.panel, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "48px 24px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                    color: C.muted, textAlign: "center",
                  }}>
                    <div style={{ fontSize: 32, opacity: 0.3 }}>✓</div>
                    <div style={{ fontFamily: C.mono, fontSize: 12, letterSpacing: "0.08em" }}>INBOX CLEAR</div>
                    <div style={{ fontSize: 13 }}>All agent recommendations confirmed. No pending decisions.</div>
                    <div style={{ fontSize: 12, color: C.mutedLo, marginTop: 4 }}>
                      Drag the scenario slider above to simulate river stage events
                    </div>
                  </div>
                ) : (
                  scenario.decisions.map(d => (
                    <DecisionCard
                      key={d.id}
                      decision={d}
                      gaugeVal={simGauge}
                      onConfirm={handleConfirm}
                      onOverride={handleOverride}
                    />
                  ))
                )}
              </div>
            )}

            {/* ── AGENT LOG TAB ── */}
            {activeTab === "log" && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                {agentLog.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted }}>
                    <div style={{ fontFamily: C.mono, fontSize: 11, letterSpacing: "0.08em", marginBottom: 8 }}>NO ACTIVITY YET</div>
                    <div style={{ fontSize: 12 }}>Confirmed and overridden decisions will appear here</div>
                  </div>
                ) : (
                  agentLog.map((entry, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 16, alignItems: "flex-start",
                      padding: "14px 20px",
                      borderBottom: i < agentLog.length - 1 ? `1px solid ${C.border}` : "none",
                      animation: i === 0 ? "fadeSlideIn 0.3s ease" : "none",
                    }}>
                      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, flexShrink: 0, paddingTop: 2 }}>{entry.time}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: entry.severity === "critical" ? C.red : entry.severity === "warning" ? C.amber : C.teal, marginBottom: 2 }}>
                          {entry.action}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>{entry.cost}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── SYSTEM STATUS TAB ── */}
            {activeTab === "status" && (
              <div className="bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>DATA FEEDS</div>
                  {[
                    { label: "NOAA Carrollton Gauge", ok: !gaugeError, detail: gaugeData ? `${gaugeData.toFixed(2)}ft live` : "simulated" },
                    { label: "AIS Vessel Track", ok: true, detail: "MV Delta Voyager inbound" },
                    { label: "NOPB Rail API", ok: true, detail: "14 cars staged · Yard 3" },
                    { label: "SMS Gateway (Twilio)", ok: true, detail: "Ready to dispatch" },
                    { label: "Agent Orchestrator", ok: true, detail: "3 agents active" },
                  ].map(({ label, ok, detail }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.white }}>{label}</div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{detail}</div>
                      </div>
                      <Badge color={ok ? C.teal : C.amber} small>{ok ? "ONLINE" : "SIM"}</Badge>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>AGENT NETWORK</div>
                  {[
                    { code: "RW", name: "River Warden", role: "Environmental Monitor", color: C.teal, status: "Monitoring gauge · 15min cycle" },
                    { code: "BM", name: "Berth Master", role: "Dock Scheduler", color: C.amber, status: "Berth sequence optimized" },
                    { code: "IS", name: "Intermodal Sync", role: "Rail & Truck Coord.", color: "#a78bfa", status: "Rail handoff confirmed" },
                  ].map(ag => (
                    <div key={ag.code} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 6,
                      border: `1px solid ${ag.color}22`,
                      background: `${ag.color}08`,
                      marginBottom: 8,
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: `${ag.color}20`, border: `1px solid ${ag.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: ag.color, flexShrink: 0 }}>{ag.code}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.white }}>{ag.name}</div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{ag.status}</div>
                      </div>
                      <PulsingDot color={ag.color} size={7} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── FOOTER ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Badge color={C.teal}>TWIC-CLEARED FOUNDERS</Badge>
                <Badge color={C.tealDim}>MTSA ALIGNED</Badge>
                <Badge color={C.muted}>NEWLAB NEW ORLEANS</Badge>
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>© 2026 DELTAAGENT AI, LLC · deltaagent.ai · BETA</div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
