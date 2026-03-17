import { useState, useEffect, useRef } from "react";

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

// ── DATA SOURCES ────────────────────────────────────────────────────────────
const NOAA_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
  "?station=8761927&product=water_level&datum=MLLW" +
  "&time_zone=lst_ldt&units=english&format=json&range=2";

// NDBC BURL1 — Southwest Pass, LA (28.906N 89.429W)
// Provides wind speed, visibility, wave height — real C-MAN station
const NDBC_FOG_URL = "https://www.ndbc.noaa.gov/data/realtime2/BURL1.txt";

// NHC active storms JSON — only populated Jun-Nov hurricane season
const NHC_URL = "https://www.nhc.noaa.gov/CurrentStorms.json";

// ── DISRUPTION TYPE DEFINITIONS ─────────────────────────────────────────────
const DISRUPTION_TYPES = [
  { type: "FLOOD",          label: "High Water",        color: "#dc2626", live: true  },
  { type: "WATER LEVEL",    label: "Water Level",       color: "#d97706", live: true  },
  { type: "FOG",            label: "Fog / Visibility",  color: "#3bbfb2", live: true  },
  { type: "SNOW & ICE",     label: "Snow & Ice",        color: "#93c5fd", live: true  },
  { type: "SEVERE WEATHER", label: "Hurricane / Storm", color: "#a78bfa", live: true  },
  { type: "DROUGHT",        label: "Drought",           color: "#d97706", live: false },
  { type: "SYS FAILURE",    label: "System Failure",    color: "#4a7a75", live: false },
  { type: "MAINTENANCE",    label: "Maintenance",       color: "#4a7a75", live: false },
];

// ── FLOOD / WATER LEVEL SCENARIO ────────────────────────────────────────────
function buildFloodScenario(ft) {
  const rising   = ft > 5.5;
  const critical = ft > 8.0;
  const status      = critical ? "CRITICAL" : rising ? "ELEVATED" : "NOMINAL";
  const statusColor = critical ? C.red : rising ? C.amber : C.teal;
  const risk        = critical ? "HIGH RISK" : rising ? "ELEVATED RISK" : "NOMINAL";
  const riskColor   = critical ? C.red : rising ? C.amber : C.teal;
  const decisions = critical ? [
    {
      id: "d1", severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "HIGH WATER",
      title: "HOLD — Delay Berthing 6 Hours",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft exceeds Algiers Point vessel restriction threshold. MV Delta Voyager draft (9.2m) incompatible with current stage.",
      costAvoided: 38000, costIfIgnored: 38000, advanceWarning: "4h 23m",
      agents: ["RW", "BM", "IS"],
      actions: ["MV Delta Voyager re-queued at Southwest Pass anchorage", "22 drayage trucks rerouted to Globalplex", "CN/KCS rail departure window held pending stage drop", "SMS alert dispatched to Port Director + Pilot Station"],
    },
    {
      id: "d2", severity: "warning",
      disruptionType: "WATER LEVEL", disruptionLabel: "STAGE TREND",
      title: "STANDBY — Monitor Stage Trend",
      reason: "River stage rising 0.3ft/hr. If trend continues, secondary berth conflict projected at Berth 4 within 90 minutes.",
      costAvoided: 12000, costIfIgnored: 12000, advanceWarning: "1h 31m",
      agents: ["RW"],
      actions: ["Berth 4 flagged for precautionary hold", "Crane gang notified of possible schedule shift"],
    },
  ] : rising ? [
    {
      id: "d1", severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "HIGH WATER",
      title: "RE-SEQUENCE — Swap Berth 2 to Berth 4",
      reason: "Stage rising trend detected. Draft margin for Berth 2 shrinking. Berth 4 preferred at current " + ft.toFixed(1) + "ft stage.",
      costAvoided: 14200, costIfIgnored: 14200, advanceWarning: "2h 11m",
      agents: ["RW", "BM"],
      actions: ["Berth assignment updated: Berth 2 to Berth 4", "CN rail departure window shifted 08:45 to 10:15", "Truck gate ETA adjusted +90 min", "Crane gang reassigned to Berth 4"],
    },
  ] : [];
  const trend = critical
    ? [3.1, 4.2, 5.5, 6.8, 7.4, 8.0, 8.2, ft]
    : rising
    ? [3.8, 4.1, 4.4, 4.8, 5.1, 5.4, 5.6, ft]
    : [4.6, 4.5, 4.4, 4.3, 4.4, 4.5, 4.6, ft];
  return { ft, status, statusColor, risk, riskColor, decisions, trend };
}

// ── FOG SCENARIO ─────────────────────────────────────────────────────────────
// visibility in nautical miles. Pilot restriction < 0.5nm. Dense fog < 0.25nm.
function buildFogScenario(visNm) {
  const dense    = visNm < 0.25;
  const restrict = visNm < 0.5;
  const status      = dense ? "CRITICAL" : restrict ? "ELEVATED" : "NOMINAL";
  const statusColor = dense ? C.red : restrict ? C.amber : C.teal;
  const risk        = dense ? "HIGH RISK" : restrict ? "ELEVATED RISK" : "NOMINAL";
  const riskColor   = statusColor;
  const decisions = dense ? [
    {
      id: "f1", severity: "critical",
      disruptionType: "FOG", disruptionLabel: "DENSE FOG",
      title: "HOLD — Suspend All Vessel Movement",
      reason: "Southwest Pass visibility " + visNm.toFixed(2) + "nm — below 0.25nm dense fog threshold. Coast Guard has issued navigation restriction. All inbound vessel movement suspended.",
      costAvoided: 29000, costIfIgnored: 29000, advanceWarning: "2h 10m",
      agents: ["RW", "BM", "IS"],
      actions: ["All inbound vessels held at Southwest Pass anchorage", "Crane gang Berth 1 stood down — redeployed to Berth 3 maintenance", "22 drayage trucks notified: 3h delay window via Twilio SMS", "CN/KCS rail departure held pending visibility improvement"],
    },
    {
      id: "f2", severity: "warning",
      disruptionType: "FOG", disruptionLabel: "PILOT ADVISORY",
      title: "ADVISORY — Notify Pilot Station",
      reason: "Visibility dropping at 0.1nm/hr. Pilot boarding window at risk within 45 minutes at current trend.",
      costAvoided: 8400, costIfIgnored: 8400, advanceWarning: "45m",
      agents: ["RW"],
      actions: ["Pilot Station notified via SMS — boarding advisory issued", "Port Director alerted to potential berthing window shift"],
    },
  ] : restrict ? [
    {
      id: "f1", severity: "warning",
      disruptionType: "FOG", disruptionLabel: "VISIBILITY ALERT",
      title: "DELAY — Hold Pilot Boarding 90 Min",
      reason: "Southwest Pass visibility at " + visNm.toFixed(2) + "nm — below 0.5nm pilot boarding threshold. Standard 90-120 min delay protocol activated.",
      costAvoided: 11200, costIfIgnored: 11200, advanceWarning: "1h 28m",
      agents: ["RW", "BM"],
      actions: ["Pilot boarding window delayed 90 min", "Berth crew notified — crane gang held on standby", "Truck gate ETA adjusted +90 min", "Port Director SMS dispatched"],
    },
  ] : [];
  const trend = dense
    ? [2.1, 1.8, 1.2, 0.8, 0.5, 0.3, 0.22, visNm]
    : restrict
    ? [2.4, 2.1, 1.6, 1.1, 0.8, 0.6, 0.52, visNm]
    : [3.2, 3.5, 4.1, 5.0, 6.2, 7.8, 9.1, visNm];
  return { visNm, status, statusColor, risk, riskColor, decisions, trend };
}

// ── ICE SCENARIO ─────────────────────────────────────────────────────────────
// iceIndex 0-10: severity of upstream ice restriction on Ohio/Upper Mississippi
// Affects barge tow arrival times and draft capacity
function buildIceScenario(iceIndex) {
  const severe   = iceIndex >= 7;
  const moderate = iceIndex >= 4;
  const status      = severe ? "CRITICAL" : moderate ? "ELEVATED" : "NOMINAL";
  const statusColor = severe ? C.red : moderate ? C.amber : C.teal;
  const risk        = severe ? "HIGH RISK" : moderate ? "ELEVATED RISK" : "NOMINAL";
  const riskColor   = statusColor;
  const delayDays   = severe ? Math.round(iceIndex * 3.2) : moderate ? Math.round(iceIndex * 1.8) : 0;
  const decisions = severe ? [
    {
      id: "i1", severity: "critical",
      disruptionType: "SNOW & ICE", disruptionLabel: "ICE RESTRICTION",
      title: "RESEQUENCE — Upstream Ice Delay " + delayDays + " Days",
      reason: "Corps of Engineers ice restriction index " + iceIndex.toFixed(1) + "/10 on Ohio River above Cairo, IL. Barge tow delays of " + delayDays + "+ days projected. Terminal inventory and rail schedule must be resequenced.",
      costAvoided: 44000, costIfIgnored: 44000, advanceWarning: "72h",
      agents: ["RW", "BM", "IS"],
      actions: ["14 barge tows flagged for " + delayDays + "-day delay — ETA revised", "CN/KCS rail departure windows shifted to compensate upstream delay", "Terminal inventory resequenced — priority cargo identified", "Port Director and commodity traders notified via SMS"],
    },
    {
      id: "i2", severity: "warning",
      disruptionType: "SNOW & ICE", disruptionLabel: "DRAFT REDUCTION",
      title: "ADVISORY — Reduce Barge Draft Capacity",
      reason: "Ice floe activity reducing navigable channel width at Locks 52/53. Barge tows must reduce to single-cut configuration below Cairo.",
      costAvoided: 16000, costIfIgnored: 16000, advanceWarning: "48h",
      agents: ["RW", "IS"],
      actions: ["Barge operators notified: single-cut restriction below Cairo, IL", "Commodity load plans adjusted for reduced draft capacity", "Arrival window extended +48h for affected tows"],
    },
  ] : moderate ? [
    {
      id: "i1", severity: "warning",
      disruptionType: "SNOW & ICE", disruptionLabel: "ICE ADVISORY",
      title: "MONITOR — Upstream Ice Advisory Active",
      reason: "Ice restriction index " + iceIndex.toFixed(1) + "/10. Upper Mississippi navigation slowing. Estimated " + delayDays + "-day ripple delay to Lower Mississippi arrivals.",
      costAvoided: 18500, costIfIgnored: 18500, advanceWarning: "36h",
      agents: ["RW", "IS"],
      actions: ["Upstream barge ETAs revised +2 days", "Rail and drayage schedules pre-adjusted", "Terminal inventory reviewed for buffer stock"],
    },
  ] : [];
  const trend = severe
    ? [1.2, 2.4, 3.8, 5.1, 6.4, 7.2, 7.8, iceIndex]
    : moderate
    ? [0.8, 1.4, 2.1, 2.8, 3.4, 3.9, 4.2, iceIndex]
    : [0.2, 0.3, 0.4, 0.3, 0.2, 0.3, 0.2, iceIndex];
  return { iceIndex, status, statusColor, risk, riskColor, decisions, trend };
}

// ── HURRICANE SCENARIO ────────────────────────────────────────────────────────
// distanceMiles: distance of storm center from mouth of Mississippi
// category: 0-5 (0 = tropical storm)
function buildHurricaneScenario(distanceMiles, category) {
  const imminent  = distanceMiles < 200;
  const watch     = distanceMiles < 400;
  const status      = imminent ? "CRITICAL" : watch ? "ELEVATED" : "NOMINAL";
  const statusColor = imminent ? C.red : watch ? C.amber : C.teal;
  const risk        = imminent ? "HIGH RISK" : watch ? "ELEVATED RISK" : "NOMINAL";
  const riskColor   = statusColor;
  const catLabel    = category === 0 ? "Tropical Storm" : "Category " + category;
  const decisions = imminent ? [
    {
      id: "h1", severity: "critical",
      disruptionType: "SEVERE WEATHER", disruptionLabel: "HURRICANE",
      title: "EVACUATE — Clear All Berths Within 24h",
      reason: catLabel + " " + distanceMiles + " miles from Southwest Pass. NHC forecast landfall within 18-24h. All vessels must depart or seek shelter. Port closure imminent.",
      costAvoided: 112000, costIfIgnored: 112000, advanceWarning: "18h",
      agents: ["RW", "BM", "IS"],
      actions: ["All inbound vessels diverted to Mobile, AL or Pascagoula, MS anchorage", "All berths cleared — vessels at dock given 6h departure window", "CN/KCS rail traffic halted — cars staged at inland yards", "Port Director, Coast Guard Sector NOLA, and FEMA notified", "Emergency operation mode activated — MTSA hurricane protocol"],
    },
    {
      id: "h2", severity: "critical",
      disruptionType: "SEVERE WEATHER", disruptionLabel: "STORM SURGE",
      title: "SECURE — Storm Surge Protocol Activated",
      reason: "NHC surge forecast " + (category * 4 + 6) + "-" + (category * 4 + 10) + "ft above normal at Southwest Pass. Terminal equipment must be secured.",
      costAvoided: 68000, costIfIgnored: 68000, advanceWarning: "12h",
      agents: ["BM"],
      actions: ["Crane booms lowered and secured at all berths", "Terminal cargo covered and tie-downs verified", "Equipment moved to elevated staging areas", "Berth infrastructure flood checklist completed"],
    },
  ] : watch ? [
    {
      id: "h1", severity: "warning",
      disruptionType: "SEVERE WEATHER", disruptionLabel: "HURRICANE WATCH",
      title: "PREPARE — Hurricane Watch Protocol",
      reason: catLabel + " tracking toward Gulf Coast — " + distanceMiles + " miles out. 48-72h window for preparation. Vessel sequencing must begin now.",
      costAvoided: 54000, costIfIgnored: 54000, advanceWarning: "48h",
      agents: ["RW", "BM", "IS"],
      actions: ["Inbound vessel queue reviewed — priority cargo expedited", "Berth clearance schedule drafted for potential port closure", "CN/KCS rail pre-positioned for rapid clearance", "Port Director briefed — contingency plan activated"],
    },
  ] : [];
  const trend = imminent
    ? [800, 650, 500, 380, 290, 220, 205, distanceMiles]
    : watch
    ? [900, 820, 720, 600, 500, 430, 410, distanceMiles]
    : [1200, 1100, 980, 850, 700, 550, 420, distanceMiles];
  return { distanceMiles, category, status, statusColor, risk, riskColor, decisions, trend };
}

function Badge({ color, children, small }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: small ? "1px 6px" : "2px 8px", borderRadius: 3,
      border: `1px solid ${color}55`, background: `${color}15`, color,
      fontFamily: C.mono, fontSize: small ? 9 : 10, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
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
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  const last = pts.split(" ").pop().split(",");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
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

function SMSNotification({ decision, onClose, onClick }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
    timerRef.current = setTimeout(() => { setVisible(false); setTimeout(onClose, 400); }, 6000);
    return () => clearTimeout(timerRef.current);
  }, []);
  function handleClick() { clearTimeout(timerRef.current); onClick(); setVisible(false); setTimeout(onClose, 400); }
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" });
  return (
    <div onClick={handleClick} style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)", transform: visible ? "translateX(0) scale(1)" : "translateX(120%) scale(0.8)", opacity: visible ? 1 : 0, cursor: "pointer" }}>
      <div style={{ width: 310, background: "linear-gradient(150deg,#040f0e,#061a17)", borderRadius: 12, overflow: "hidden", boxShadow: `0 24px 64px rgba(0,0,0,0.9),0 0 0 1px ${C.teal}44`, fontFamily: C.sans }}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${C.teal},#0f4547,transparent)` }} />
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg,#0f4547,${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,14 8,10 2,14" fill="white" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.06em" }}>EXECUTION COMPLETE</div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{time} · 6 alerts dispatched</div>
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.teal }}>view record →</div>
          </div>
          <div style={{ background: `${C.teal}0d`, border: `1px solid ${C.teal}22`, borderRadius: 7, padding: "8px 10px", marginBottom: 8 }}>
            <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 2 }}>✓ {decision.title}</div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>Gauge {decision.ft?.toFixed(1)}ft · ${decision.costAvoided?.toLocaleString()} avoided</div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["Port Director","Pilot Station","CN/KCS","Drayage","Berth TOS","Audit"].map((l, i) => (
              <div key={i} style={{ fontFamily: C.mono, fontSize: 8, color: C.teal, background: `${C.teal}10`, border: `1px solid ${C.teal}22`, borderRadius: 3, padding: "2px 5px" }}>✓ {l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverrideNotification({ decision, onClose, onClick }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
    timerRef.current = setTimeout(() => { setVisible(false); setTimeout(onClose, 400); }, 6000);
    return () => clearTimeout(timerRef.current);
  }, []);
  function handleClick() { clearTimeout(timerRef.current); onClick(); setVisible(false); setTimeout(onClose, 400); }
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" });
  return (
    <div onClick={handleClick} style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)", transform: visible ? "translateX(0) scale(1)" : "translateX(120%) scale(0.8)", opacity: visible ? 1 : 0, cursor: "pointer" }}>
      <div style={{ width: 310, background: "linear-gradient(150deg,#0f0a00,#1a1000)", borderRadius: 12, overflow: "hidden", boxShadow: `0 24px 64px rgba(0,0,0,0.9),0 0 0 1px ${C.amber}55`, fontFamily: C.sans }}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${C.amber},#92400e,transparent)` }} />
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,#92400e,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>⚠</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: "0.06em" }}>MANUAL ACTION REQUIRED</div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{time} · override logged</div>
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.amber }}>view →</div>
          </div>
          <div style={{ background: `${C.amber}0d`, border: `1px solid ${C.amber}33`, borderRadius: 7, padding: "8px 10px", marginBottom: 8 }}>
            <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 2 }}>⚠ {decision.title}</div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>Automated dispatch cancelled · Your team must coordinate</div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["Port Director","Pilot Station","CN/KCS","Drayage"].map((l, i) => (
              <div key={i} style={{ fontFamily: C.mono, fontSize: 8, color: C.amber, background: `${C.amber}10`, border: `1px solid ${C.amber}22`, borderRadius: 3, padding: "2px 5px" }}>⚠ {l}</div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontFamily: C.mono, fontSize: 9, color: "#666" }}>~45 min / 20 manual calls required · MTSA audit logged</div>
        </div>
      </div>
    </div>
  );
}

const STEPS_DURATION = 8000;
const EXEC_STEPS = [
  { label: "SMS dispatched to Port Director",   detail: "+1 (504) 555-0147",      icon: "📱" },
  { label: "SMS dispatched to Pilot Station",    detail: "+1 (504) 555-0293",      icon: "📱" },
  { label: "CN/KCS Rail API window updated",     detail: "08:45 to 10:15 CST",     icon: "🚂" },
  { label: "Drayage fleet notified via Twilio",  detail: "22 trucks rerouted",      icon: "🚛" },
  { label: "Berth schedule updated in TOS",      detail: "Navis N4 API call",       icon: "⚓" },
  { label: "Audit log entry created",            detail: "MTSA compliance record",  icon: "📋" },
];

function ExecutionTicker({ decision }) {
  const [firedCount, setFiredCount] = useState(0);
  const [done, setDone]             = useState(false);
  const [elapsed, setElapsed]       = useState("0.0");
  const startRef                    = useRef(Date.now());

  useEffect(() => {
    const clock = setInterval(() => setElapsed(((Date.now() - startRef.current) / 1000).toFixed(1)), 100);
    EXEC_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setFiredCount(i + 1);
        if (i === EXEC_STEPS.length - 1) setTimeout(() => { setDone(true); clearInterval(clock); }, 500);
      }, (i + 1) * 800);
    });
    return () => clearInterval(clock);
  }, []);

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, background: C.panel, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {done ? <span style={{ color: C.teal }}>✓</span> : <PulsingDot color={C.teal} size={8} />}
          <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.08em" }}>{done ? "EXECUTION RECORD" : "EXECUTING..."}</span>
        </div>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>{elapsed}s elapsed</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {EXEC_STEPS.map((step, i) => {
          const fired = i < firedCount;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 5, background: fired ? `${C.teal}0d` : "transparent", border: `1px solid ${fired ? C.teal + "33" : C.border}`, opacity: fired ? 1 : 0.3, transition: "all 0.4s ease" }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{step.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: fired ? C.white : C.muted, fontWeight: fired ? 600 : 400 }}>{step.label}</div>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{step.detail}</div>
              </div>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: fired ? C.teal : C.mutedLo, flexShrink: 0 }}>{fired ? `✓ ${((i + 1) * 0.8).toFixed(1)}s` : "--"}</span>
            </div>
          );
        })}
      </div>
      {done && (
        <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { label: "COST AVOIDED", value: `$${decision.costAvoided.toLocaleString()}`, color: C.green },
              { label: "ELAPSED TIME", value: `${elapsed}s`, color: C.teal },
              { label: "ALERTS SENT",  value: "6", color: C.teal },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "10px 12px", borderRadius: 6, background: `${color}10`, border: `1px solid ${color}22`, textAlign: "center" }}>
                <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 3, letterSpacing: "0.08em" }}>{label}</div>
                <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 5, background: `${C.muted}0d`, border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>
              Human review: ~3 sec | Agent execution: {elapsed}s | vs. manual: ~45 min / 20 calls
            </div>
          </div>
          <div style={{ marginTop: 8, fontFamily: C.mono, fontSize: 9, color: C.muted, textAlign: "center" }}>Full record saved to Agent Log</div>
        </div>
      )}
    </div>
  );
}

function DecisionCard({ decision, onConfirm, onOverride }) {
  const [state, setState]       = useState("pending");
  const [expanded, setExpanded] = useState(false);
  const severityColor = decision.severity === "critical" ? C.red : C.amber;
  const severityBg    = decision.severity === "critical" ? C.redFaint : C.amberFaint;

  function handleConfirm() {
    setState("executing");
    setTimeout(() => { setState("done"); onConfirm(decision); }, STEPS_DURATION);
  }
  function handleOverride() { setState("override"); onOverride(decision); }

  const borderColor = state === "done" ? C.teal : severityColor;
  const bgColor     = state === "done" ? C.tealFaint : severityBg;

  return (
    <div style={{ border: `1px solid ${borderColor}44`, borderLeft: `3px solid ${borderColor}`, borderRadius: 8, background: bgColor, overflow: "hidden", transition: "border-color 0.5s ease, background 0.5s ease" }}>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flexShrink: 0, paddingTop: 2 }}>
            {state === "done" ? <span style={{ color: C.teal, fontSize: 16 }}>✓</span> : <PulsingDot color={severityColor} size={10} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <Badge color={state === "done" ? C.teal : severityColor}>{state === "done" ? "CONFIRMED" : decision.severity}</Badge>
              {decision.disruptionType && (
                <span style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 700, color: C.muted, background: `${C.muted}15`, border: `1px solid ${C.muted}33`, borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em" }}>
                  {decision.disruptionType} &middot; {decision.disruptionLabel}
                </span>
              )}
              {decision.agents.map(a => <Badge key={a} color={C.muted} small>{a}</Badge>)}
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.amber, marginLeft: "auto", fontWeight: 700 }}>⏱ {decision.advanceWarning} advance warning</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6, lineHeight: 1.3 }}>{decision.title}</div>
            <div style={{ fontSize: 12, color: "#a0c4c0", lineHeight: 1.55 }}>{decision.reason}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={{ background: `${C.green}15`, border: `1px solid ${C.green}33`, borderRadius: 6, padding: "10px 14px" }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>EST. COST AVOIDED</div>
            <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.green }}>${decision.costAvoided.toLocaleString()}</div>
          </div>
          <div style={{ background: `${C.red}10`, border: `1px solid ${C.red}22`, borderRadius: 6, padding: "10px 14px" }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>COST IF IGNORED</div>
            <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.red }}>${decision.costIfIgnored.toLocaleString()}</div>
          </div>
        </div>
        {state === "pending" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleConfirm} style={{ flex: 1, padding: "11px 0", borderRadius: 6, border: `1px solid ${C.teal}`, background: `${C.teal}20`, color: C.teal, fontFamily: C.mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>
              ✓ CONFIRM &amp; DISPATCH
            </button>
            <button onClick={handleOverride} style={{ flex: 1, padding: "11px 0", borderRadius: 6, border: `1px solid ${C.amber}`, background: `${C.amber}10`, color: C.amber, fontFamily: C.mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>
              ⚠ OVERRIDE
            </button>
            <button onClick={() => setExpanded(!expanded)} style={{ padding: "11px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontFamily: C.mono, fontSize: 11, cursor: "pointer" }}>
              {expanded ? "▲" : "▼"}
            </button>
          </div>
        )}
        {state === "executing" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <PulsingDot color={C.teal} size={8} />
            <span style={{ fontFamily: C.mono, fontSize: 11, color: C.teal, fontWeight: 700, letterSpacing: "0.06em" }}>DISPATCHING ALERTS...</span>
          </div>
        )}
        {state === "override" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ padding: "12px 16px", borderRadius: 6, border: `1px solid ${C.amber}55`, background: `${C.amber}12`, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: "0.06em", marginBottom: 4 }}>OVERRIDE LOGGED — MANUAL ACTION REQUIRED</div>
                <div style={{ fontSize: 12, color: "#a0c4c0", lineHeight: 1.5 }}>Automated dispatch was cancelled. Your team must manually coordinate with the Port Director, Pilot Station, and CN/KCS rail. This decision has been recorded in the audit trail.</div>
              </div>
            </div>
            <div style={{ padding: "8px 12px", borderRadius: 5, background: `${C.red}08`, border: `1px solid ${C.red}22` }}>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.red }}>Manual coordination typically takes ~45 min / 20 calls vs. 4.8s automated</div>
            </div>
          </div>
        )}
      </div>
      {expanded && state === "pending" && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 20px", background: C.panel, animation: "fadeSlideIn 0.25s ease" }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 10 }}>AGENT ACTIONS QUEUED</div>
          {decision.actions.map((action, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, paddingBottom: 8, borderBottom: i < decision.actions.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: severityColor, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontSize: 12, color: "#a0c4c0", lineHeight: 1.5 }}>{action}</div>
            </div>
          ))}
        </div>
      )}
      {(state === "executing" || state === "done") && <ExecutionTicker decision={decision} />}
    </div>
  );
}

function AgentLogEntry({ entry, isFirst, isLast, autoExpand = false, entryId }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const ref = useRef(null);
  const isConfirmed = entry.action.startsWith("CONFIRMED:");
  const entryColor = entry.severity === "override" ? C.amber : entry.severity === "critical" ? C.red : entry.severity === "warning" ? C.amber : C.teal;

  useEffect(() => {
    if (autoExpand && ref.current) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [autoExpand]);

  return (
    <div id={entryId} ref={ref} style={{ borderBottom: !isLast ? `1px solid ${C.border}` : "none", animation: isFirst ? "fadeSlideIn 0.3s ease" : "none" }}>
      <div onClick={() => isConfirmed && setExpanded(!expanded)} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 20px", cursor: isConfirmed ? "pointer" : "default", background: expanded ? `${C.teal}06` : "transparent", transition: "background 0.2s ease" }}>
        <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, flexShrink: 0, paddingTop: 2 }}>{entry.time}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: entryColor, marginBottom: 2 }}>{entry.action}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{entry.cost}</div>
        </div>
        {isConfirmed && <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, flexShrink: 0, paddingTop: 2 }}>{expanded ? "▲ hide" : "▼ details"}</div>}
      </div>
      {expanded && isConfirmed && (
        <div style={{ padding: "0 20px 16px 20px", animation: "fadeSlideIn 0.2s ease" }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 10 }}>EXECUTION RECORD</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
            {EXEC_STEPS.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 5, background: `${C.teal}0a`, border: `1px solid ${C.teal}22` }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>{step.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.white, fontWeight: 600 }}>{step.label}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{step.detail}</div>
                </div>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: C.teal, flexShrink: 0 }}>✓ {((i + 1) * 0.8).toFixed(1)}s</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 5, background: `${C.muted}0d`, border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>Total elapsed: 4.8s · 6 alerts dispatched · {entry.cost}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeltaAgentDashboard() {
  // ── active disruption type ──
  const [activeDisruption, setActiveDisruption] = useState("FLOOD");

  // ── FLOOD state ──
  const [gaugeData, setGaugeData]   = useState(null);
  const [gaugeError, setGaugeError] = useState(false);
  const [simGauge, setSimGauge]     = useState(4.4);
  const [scenario, setScenario]     = useState(() => buildFloodScenario(4.4));

  // ── FOG state ──
  const [fogData, setFogData]     = useState(null);
  const [fogError, setFogError]   = useState(false);
  const [simVis, setSimVis]       = useState(3.0);
  const [fogScenario, setFogScenario] = useState(() => buildFogScenario(3.0));

  // ── ICE state ──
  const [simIce, setSimIce]       = useState(1.0);
  const [iceScenario, setIceScenario] = useState(() => buildIceScenario(1.0));

  // ── HURRICANE state ──
  const [nhcData, setNhcData]       = useState(null);
  const [simStormDist, setSimStormDist] = useState(800);
  const [simStormCat, setSimStormCat]   = useState(2);
  const [stormScenario, setStormScenario] = useState(() => buildHurricaneScenario(800, 2));

  // ── shared UI state ──
  const [time, setTime]                       = useState(new Date());
  const [smsQueue, setSmsQueue]               = useState([]);
  const [overrideQueue, setOverrideQueue]     = useState([]);
  const [activeTab, setActiveTab]             = useState("inbox");
  const [confirmedIds, setConfirmedIds]       = useState(new Set());
  const [overriddenIds, setOverriddenIds]     = useState(new Set());
  const [autoExpandLogId, setAutoExpandLogId] = useState(null);
  const [scrollToDecisionId, setScrollToDecisionId] = useState(null);
  const [sessionSavings, setSessionSavings]   = useState([]);
  const [agentLog, setAgentLog] = useState([
    { id: "bg1", time: "05:14:22", action: "MONITORING: Carrollton Gauge polled",       cost: "Stage 0.7ft · Nominal · No action required",      severity: "ok" },
    { id: "bg2", time: "05:00:00", action: "MONITORING: AIS vessel position updated",   cost: "MV Delta Voyager · ETA Southwest Pass 04:20 CST", severity: "ok" },
    { id: "bg3", time: "04:45:11", action: "MONITORING: CN/KCS rail status checked",    cost: "14 intermodal cars staged · Yard 3 · On schedule", severity: "ok" },
    { id: "bg4", time: "04:30:00", action: "MONITORING: Berth schedule reviewed",       cost: "Berth 2 nominal · Crane gang confirmed",           severity: "ok" },
  ]);

  // get active scenario based on disruption type
  const activeScenario = activeDisruption === "FOG" ? fogScenario
    : activeDisruption === "SNOW & ICE" ? iceScenario
    : activeDisruption === "SEVERE WEATHER" ? stormScenario
    : scenario;

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // fetch NOAA gauge
  useEffect(() => {
    fetch(NOAA_URL)
      .then(r => r.json())
      .then(d => {
        const readings = d?.data;
        if (readings?.length) {
          const latest = parseFloat(readings[readings.length - 1].v);
          if (!isNaN(latest)) { setGaugeData(latest); setSimGauge(latest); setScenario(buildFloodScenario(latest)); }
        }
      })
      .catch(() => setGaugeError(true));
  }, []);

  // fetch NDBC BURL1 fog/visibility — plain text format
  useEffect(() => {
    fetch("https://www.ndbc.noaa.gov/data/realtime2/BURL1.txt")
      .then(r => r.text())
      .then(txt => {
        const lines = txt.split("\n").filter(l => !l.startsWith("#") && l.trim());
        if (lines.length >= 1) {
          // NDBC format: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
          const parts = lines[0].trim().split(/\s+/);
          // VIS is column index 16 (0-based), in nautical miles
          const vis = parseFloat(parts[16]);
          if (!isNaN(vis) && vis > 0) {
            setFogData(vis);
            setSimVis(vis);
            setFogScenario(buildFogScenario(vis));
          }
        }
      })
      .catch(() => setFogError(true));
  }, []);

  // NHC storms — only active in hurricane season
  useEffect(() => {
    fetch(NHC_URL)
      .then(r => r.json())
      .then(d => {
        if (d?.activeStorms?.length) {
          // find closest storm to Gulf of Mexico (approx center 25N, 90W)
          setNhcData(d.activeStorms[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!scrollToDecisionId) return;
    setTimeout(() => {
      const el = document.getElementById(scrollToDecisionId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setScrollToDecisionId(null);
    }, 150);
  }, [scrollToDecisionId, activeTab]);

  // reset confirmed/overridden when switching disruption type
  function switchDisruption(type) {
    if (!DISRUPTION_TYPES.find(d => d.type === type)?.live) return;
    setActiveDisruption(type);
    setConfirmedIds(new Set());
    setOverriddenIds(new Set());
    setActiveTab("inbox");
  }

  function handleConfirm(decision) {
    const logId = `log-${decision.id}-${Date.now()}`;
    setConfirmedIds(prev => new Set([...prev, decision.id]));
    setSmsQueue(q => [...q, { ...decision, ft: simGauge, id: Date.now(), logId }]);
    const ts = new Date();
    setSessionSavings(prev => [...prev, {
      title: decision.title, amount: decision.costAvoided, severity: decision.severity,
      gauge: simGauge, agents: decision.agents,
      time: ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" }),
    }]);
    setAgentLog(prev => [{
      id: logId,
      time: ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
      action: `CONFIRMED: ${decision.title}`,
      cost: `$${decision.costAvoided.toLocaleString()} cost avoidance logged · 6 alerts dispatched`,
      severity: decision.severity,
    }, ...prev]);
  }

  function handleOverride(decision) {
    const decisionDomId = `decision-${decision.id}`;
    setOverriddenIds(prev => new Set([...prev, decision.id]));
    setOverrideQueue(q => [...q, { ...decision, ft: simGauge, id: Date.now(), decisionDomId }]);
    setAgentLog(prev => [{
      id: `override-${decision.id}`,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
      action: `OVERRIDE: ${decision.title}`,
      cost: "Automated dispatch cancelled · Manual coordination required · Logged for MTSA audit",
      severity: "override",
    }, ...prev]);
  }

  function removeSms(id) { setSmsQueue(q => q.filter(s => s.id !== id)); }

  const pendingCount     = activeScenario.decisions.filter(d => !confirmedIds.has(d.id) && !overriddenIds.has(d.id)).length;
  const confirmedSavings = activeScenario.decisions.filter(d => confirmedIds.has(d.id)).reduce((s, d) => s + d.costAvoided, 0);
  const pendingSavings   = activeScenario.decisions.filter(d => !confirmedIds.has(d.id) && !overriddenIds.has(d.id)).reduce((s, d) => s + d.costAvoided, 0);
  const totalSavings     = confirmedSavings + pendingSavings;
  const sessionTotal     = sessionSavings.reduce((s, x) => s + x.amount, 0);
  const trendDir         = activeScenario.trend[activeScenario.trend.length - 1] > activeScenario.trend[activeScenario.trend.length - 2] ? "up" : activeScenario.trend[activeScenario.trend.length - 1] < activeScenario.trend[activeScenario.trend.length - 2] ? "dn" : "st";
  const trendChar        = activeDisruption === "FOG" || activeDisruption === "SEVERE WEATHER"
    ? (trendDir === "up" ? "↓" : trendDir === "dn" ? "↑" : "→")  // inverted: lower vis/distance = worse
    : (trendDir === "up" ? "↑" : trendDir === "dn" ? "↓" : "→");
  const trendColor       = trendDir === "up" ? C.amber : trendDir === "dn" ? C.teal : C.muted;

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
        button:hover { filter: brightness(1.15); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.borderHi}; border-radius: 2px; }
        @media (max-width: 640px) { .hero-grid { grid-template-columns: 1fr !important; } .hide-sm { display: none !important; } }
      `}</style>

      {smsQueue.map(sms => (
        <SMSNotification key={sms.id} decision={sms} onClose={() => removeSms(sms.id)}
          onClick={() => { setActiveTab("log"); setAutoExpandLogId(sms.logId); }} />
      ))}
      {overrideQueue.map(ov => (
        <OverrideNotification key={ov.id} decision={ov} onClose={() => setOverrideQueue(q => q.filter(o => o.id !== ov.id))}
          onClick={() => { setActiveTab("inbox"); setScrollToDecisionId(ov.decisionDomId); }} />
      ))}

      <div style={{ minHeight: "100vh", background: C.bg, color: C.white, fontFamily: C.sans, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(${C.border}44 1px,transparent 1px),linear-gradient(90deg,${C.border}44 1px,transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0, opacity: 0.6 }} />
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 100, background: `linear-gradient(to bottom,transparent,${C.teal}05,transparent)`, pointerEvents: "none", zIndex: 1, animation: "scanline 10s linear infinite" }} />

        <div style={{ position: "relative", zIndex: 2, paddingBottom: 40 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", borderBottom: `1px solid ${C.border}`, background: `${C.panel}f0`, backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                <polygon points="16,3 30,28 2,28" fill="none" stroke={C.teal} strokeWidth="2" strokeLinejoin="round"/>
                <line x1="9" y1="28" x2="23" y2="28" stroke={C.teal} strokeWidth="2" strokeLinecap="round"/>
                <circle cx="16" cy="18" r="2.5" fill={C.teal}/>
              </svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.06em" }}>DELTAAGENT<span style={{ color: C.teal }}> AI</span></div>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.12em" }}>OPERATIONS COMMAND · BETA</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div onClick={() => pendingCount > 0 && setActiveTab("inbox")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: pendingCount > 0 ? `${activeScenario.statusColor}18` : `${C.teal}10`, border: `1px solid ${pendingCount > 0 ? activeScenario.statusColor + "55" : C.teal + "33"}`, animation: pendingCount > 0 ? "pulseGlow 2s ease-in-out infinite" : "none", cursor: pendingCount > 0 ? "pointer" : "default", transition: "all 0.3s ease" }}>
                <PulsingDot color={pendingCount > 0 ? activeScenario.statusColor : C.teal} size={7} />
                <span style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: pendingCount > 0 ? activeScenario.statusColor : C.teal, letterSpacing: "0.08em" }}>
                  {pendingCount > 0 ? `${activeScenario.status} · ${pendingCount} PENDING` : activeScenario.status}
                </span>
              </div>
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
            <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    {activeDisruption === "FOG" ? (
                      <>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>SW PASS VISIBILITY · BURL1</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontFamily: C.mono, fontSize: 36, fontWeight: 700, color: activeScenario.statusColor, textShadow: `0 0 20px ${activeScenario.statusColor}44`, lineHeight: 1 }}>{simVis.toFixed(1)}</span>
                          <span style={{ fontFamily: C.mono, fontSize: 13, color: C.muted }}>nm</span>
                          <span style={{ fontFamily: C.mono, fontSize: 16, color: trendColor, fontWeight: 700 }}>{trendChar}</span>
                        </div>
                      </>
                    ) : activeDisruption === "SNOW & ICE" ? (
                      <>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>ICE RESTRICTION INDEX · CORPS</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontFamily: C.mono, fontSize: 36, fontWeight: 700, color: activeScenario.statusColor, textShadow: `0 0 20px ${activeScenario.statusColor}44`, lineHeight: 1 }}>{simIce.toFixed(1)}</span>
                          <span style={{ fontFamily: C.mono, fontSize: 13, color: C.muted }}>/10</span>
                          <span style={{ fontFamily: C.mono, fontSize: 16, color: trendColor, fontWeight: 700 }}>{trendChar}</span>
                        </div>
                      </>
                    ) : activeDisruption === "SEVERE WEATHER" ? (
                      <>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>STORM DISTANCE · NHC TRACK</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontFamily: C.mono, fontSize: 36, fontWeight: 700, color: activeScenario.statusColor, textShadow: `0 0 20px ${activeScenario.statusColor}44`, lineHeight: 1 }}>{simStormDist}</span>
                          <span style={{ fontFamily: C.mono, fontSize: 13, color: C.muted }}>mi</span>
                          <span style={{ fontFamily: C.mono, fontSize: 16, color: trendColor, fontWeight: 700 }}>{trendChar}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>CARROLLTON GAUGE · 8761927</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontFamily: C.mono, fontSize: 36, fontWeight: 700, color: activeScenario.statusColor, textShadow: `0 0 20px ${activeScenario.statusColor}44`, lineHeight: 1 }}>{simGauge.toFixed(1)}</span>
                          <span style={{ fontFamily: C.mono, fontSize: 13, color: C.muted }}>ft</span>
                          <span style={{ fontFamily: C.mono, fontSize: 16, color: trendColor, fontWeight: 700 }}>{trendChar}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    {activeDisruption === "FOG"
                      ? (fogData ? <Badge color={C.teal} small>NDBC LIVE</Badge> : <Badge color={C.muted} small>SIMULATED</Badge>)
                      : activeDisruption === "SEVERE WEATHER"
                      ? (nhcData ? <Badge color={C.red} small>NHC LIVE</Badge> : <Badge color={C.muted} small>SIMULATED</Badge>)
                      : activeDisruption === "SNOW & ICE"
                      ? <Badge color={C.muted} small>SIMULATED</Badge>
                      : (gaugeData ? <Badge color={C.teal} small>NOAA LIVE</Badge> : <Badge color={C.muted} small>SIMULATED</Badge>)
                    }
                    <Sparkline data={activeScenario.trend} color={activeScenario.statusColor} />
                  </div>
                </div>
                {activeDisruption === "FOG" ? (
                  <>
                    <div style={{ width: "100%", marginTop: 8 }}>
                      <div style={{ height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min((simVis / 10) * 100, 100)}%`, background: activeScenario.statusColor, transition: "width 1.2s ease", boxShadow: `0 0 6px ${activeScenario.statusColor}66` }} />
                        {[0.25, 0.5].map((t, i) => (
                          <div key={i} style={{ position: "absolute", left: `${(t / 10) * 100}%`, top: 0, height: "100%", width: 1, background: i === 0 ? C.red : C.amber, opacity: 0.6 }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>SCENARIO SIMULATOR</div>
                      <input type="range" min={0.05} max={10} step={0.05} value={simVis}
                        onChange={e => { const v = parseFloat(e.target.value); setSimVis(v); setFogScenario(buildFogScenario(v)); setConfirmedIds(new Set()); setOverriddenIds(new Set()); }}
                        style={{ width: "100%", accentColor: C.teal, cursor: "pointer" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                        <span>0.05nm</span><span style={{ color: C.red }}>0.25 DENSE</span><span style={{ color: C.amber }}>0.5 RESTRICT</span><span>10nm</span>
                      </div>
                    </div>
                  </>
                ) : activeDisruption === "SNOW & ICE" ? (
                  <>
                    <div style={{ width: "100%", marginTop: 8 }}>
                      <div style={{ height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(simIce / 10) * 100}%`, background: activeScenario.statusColor, transition: "width 1.2s ease", boxShadow: `0 0 6px ${activeScenario.statusColor}66` }} />
                        {[4, 7].map((t, i) => (
                          <div key={i} style={{ position: "absolute", left: `${(t / 10) * 100}%`, top: 0, height: "100%", width: 1, background: i === 0 ? C.amber : C.red, opacity: 0.6 }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>SCENARIO SIMULATOR</div>
                      <input type="range" min={0} max={10} step={0.1} value={simIce}
                        onChange={e => { const v = parseFloat(e.target.value); setSimIce(v); setIceScenario(buildIceScenario(v)); setConfirmedIds(new Set()); setOverriddenIds(new Set()); }}
                        style={{ width: "100%", accentColor: "#93c5fd", cursor: "pointer" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                        <span>0</span><span style={{ color: C.amber }}>4 MODERATE</span><span style={{ color: C.red }}>7 SEVERE</span><span>10</span>
                      </div>
                    </div>
                  </>
                ) : activeDisruption === "SEVERE WEATHER" ? (
                  <>
                    <div style={{ width: "100%", marginTop: 8 }}>
                      <div style={{ height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(((1000 - simStormDist) / 1000) * 100, 100)}%`, background: activeScenario.statusColor, transition: "width 1.2s ease", boxShadow: `0 0 6px ${activeScenario.statusColor}66` }} />
                        {[400, 200].map((t, i) => (
                          <div key={i} style={{ position: "absolute", left: `${((1000 - t) / 1000) * 100}%`, top: 0, height: "100%", width: 1, background: i === 0 ? C.amber : C.red, opacity: 0.6 }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>SCENARIO SIMULATOR · CAT {simStormCat}</div>
                      <input type="range" min={50} max={1000} step={10} value={simStormDist}
                        onChange={e => { const v = parseFloat(e.target.value); setSimStormDist(v); setStormScenario(buildHurricaneScenario(v, simStormCat)); setConfirmedIds(new Set()); setOverriddenIds(new Set()); }}
                        style={{ width: "100%", accentColor: "#a78bfa", cursor: "pointer" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                        <span>50mi</span><span style={{ color: C.amber }}>400 WATCH</span><span style={{ color: C.red }}>200 WARNING</span><span>1000mi</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        {[0,1,2,3,4,5].map(cat => (
                          <button key={cat} onClick={() => { setSimStormCat(cat); setStormScenario(buildHurricaneScenario(simStormDist, cat)); setConfirmedIds(new Set()); setOverriddenIds(new Set()); }} style={{ flex: 1, padding: "3px 0", borderRadius: 3, border: `1px solid ${simStormCat === cat ? "#a78bfa" : C.border}`, background: simStormCat === cat ? "#a78bfa22" : "transparent", color: simStormCat === cat ? "#a78bfa" : C.muted, fontFamily: C.mono, fontSize: 8, cursor: "pointer" }}>
                            {cat === 0 ? "TS" : `C${cat}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <GaugeBar value={simGauge} />
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 4, letterSpacing: "0.08em" }}>SCENARIO SIMULATOR</div>
                      <input type="range" min={1} max={10} step={0.1} value={simGauge}
                        onChange={e => { const v = parseFloat(e.target.value); setSimGauge(v); setScenario(buildFloodScenario(v)); setConfirmedIds(new Set()); setOverriddenIds(new Set()); }}
                        style={{ width: "100%", accentColor: C.teal, cursor: "pointer" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                        <span>1ft</span><span style={{ color: C.amber }}>5.5 ELEVATED</span><span style={{ color: C.red }}>8.0 CRITICAL</span><span>10ft</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ background: pendingCount > 0 ? `${C.red}08` : C.panel, border: `1px solid ${pendingCount > 0 ? C.red + "44" : C.border}`, borderRadius: 8, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 8 }}>DECISIONS AWAITING</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontFamily: C.mono, fontSize: 52, fontWeight: 700, color: pendingCount > 0 ? C.red : C.muted, lineHeight: 1, textShadow: pendingCount > 0 ? `0 0 30px ${C.red}44` : "none" }}>{pendingCount}</span>
                    <span style={{ fontFamily: C.mono, fontSize: 12, color: C.muted }}>{pendingCount === 1 ? "decision" : "decisions"}</span>
                  </div>
                </div>
                <div>
                  {pendingCount > 0 ? (() => {
                    const top = scenario.decisions.filter(d => !confirmedIds.has(d.id) && !overriddenIds.has(d.id))[0];
                    return (
                      <div style={{ padding: "10px 12px", borderRadius: 6, background: `${C.amber}10`, border: `1px solid ${C.amber}33` }}>
                        <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.08em", marginBottom: 4 }}>ADVANCE WARNING</div>
                        <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.amber, lineHeight: 1 }}>⏱ {top?.advanceWarning}</div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginTop: 4 }}>before scheduled berthing impact</div>
                      </div>
                    );
                  })() : <div style={{ fontSize: 12, color: C.muted }}>All systems nominal — no action required</div>}
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 8 }}>NEXT INBOUND VESSEL</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>MV Delta Voyager</div>
                  <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginBottom: 4 }}>LOA 185m · Draft 9.2m · ETA 04:20 CST</div>
                  <Badge color={activeScenario.riskColor} small>{activeScenario.risk}</Badge>
                </div>
                {totalSavings > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6, background: `${C.green}10`, border: `1px solid ${C.green}22` }}>
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 2, letterSpacing: "0.08em" }}>SAVINGS TODAY</div>
                    <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 700, color: C.green }}>${totalSavings.toLocaleString()}</div>
                    {confirmedSavings > 0 && (
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.teal, marginTop: 3 }}>
                        ✓ ${confirmedSavings.toLocaleString()} confirmed{pendingSavings > 0 ? ` · $${pendingSavings.toLocaleString()} pending` : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* DISRUPTION TYPE SELECTOR */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.12em", marginBottom: 10 }}>DISRUPTION MONITOR — CORPS OF ENGINEERS CLASSIFICATION</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {DISRUPTION_TYPES.map(({ type, label, color, live }) => {
                  const isActive = activeDisruption === type;
                  return (
                    <div key={type} onClick={() => switchDisruption(type)} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 4,
                      border: `1px solid ${isActive ? color + "88" : live ? color + "33" : C.border}`,
                      background: isActive ? `${color}20` : live ? `${color}08` : "transparent",
                      opacity: live ? 1 : 0.35,
                      cursor: live ? "pointer" : "not-allowed",
                      transition: "all 0.2s ease",
                    }}>
                      {live && <span style={{ width: 5, height: 5, borderRadius: "50%", background: isActive ? color : color + "88", flexShrink: 0, display: "inline-block" }} />}
                      <span style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 700, color: isActive ? color : live ? color + "99" : C.muted, letterSpacing: "0.06em" }}>{type}</span>
                      <span style={{ fontFamily: C.mono, fontSize: 8, color: isActive ? color + "cc" : live ? color + "66" : C.mutedLo }}>{live ? label : "COMING SOON"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}` }}>
              {[
                { id: "inbox",  label: `DECISION INBOX${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
                { id: "log",    label: "AGENT LOG" },
                { id: "impact", label: "IMPACT" },
                { id: "status", label: "SYSTEM STATUS" },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "10px 18px", border: "none", borderBottom: activeTab === tab.id ? `2px solid ${C.teal}` : "2px solid transparent", background: "transparent", color: activeTab === tab.id ? C.teal : tab.id === "impact" && sessionTotal > 0 ? C.green : C.muted, fontFamily: C.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer", transition: "all 0.2s ease", marginBottom: -1 }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "inbox" && (() => {
              const pending  = activeScenario.decisions.filter(d => !confirmedIds.has(d.id) && !overriddenIds.has(d.id));
              const actioned = activeScenario.decisions.filter(d => confirmedIds.has(d.id) || overriddenIds.has(d.id));
              const allClear = activeScenario.decisions.length === 0;
              const allDone  = activeScenario.decisions.length > 0 && pending.length === 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pending.map(d => <DecisionCard key={d.id} decision={d} onConfirm={handleConfirm} onOverride={handleOverride} />)}
                  {allClear && (
                    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: C.muted, textAlign: "center" }}>
                      <div style={{ fontSize: 32, opacity: 0.3 }}>✓</div>
                      <div style={{ fontFamily: C.mono, fontSize: 12, letterSpacing: "0.08em" }}>INBOX CLEAR</div>
                      <div style={{ fontSize: 13 }}>No pending decisions. All systems nominal.</div>
                      <div style={{ fontSize: 12, color: C.mutedLo, marginTop: 4 }}>Drag the scenario simulator to simulate river stage events</div>
                    </div>
                  )}
                  {allDone && (
                    <div style={{ padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.teal}33`, background: `${C.teal}08`, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: C.teal, fontSize: 16 }}>✓</span>
                      <div>
                        <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.06em" }}>ALL DECISIONS ACTIONED</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Check Agent Log for full execution records · Drag slider to reset</div>
                      </div>
                    </div>
                  )}
                  {actioned.map(d => (
                    <div key={d.id + "-done"} id={`decision-${d.id}`} style={{ border: `1px solid ${confirmedIds.has(d.id) ? C.teal + "33" : C.amber + "33"}`, borderLeft: `3px solid ${confirmedIds.has(d.id) ? C.teal : C.amber}`, borderRadius: 8, background: confirmedIds.has(d.id) ? C.tealFaint : C.amberFaint, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: confirmedIds.has(d.id) ? C.teal : C.amber, fontSize: 14 }}>{confirmedIds.has(d.id) ? "✓" : "⚠"}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{d.title}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginTop: 2 }}>
                            {confirmedIds.has(d.id) ? `Confirmed · $${d.costAvoided.toLocaleString()} cost avoided · 6 alerts dispatched` : "Overridden · Manual action required"}
                          </div>
                        </div>
                      </div>
                      <Badge color={confirmedIds.has(d.id) ? C.teal : C.amber} small>{confirmedIds.has(d.id) ? "CONFIRMED" : "OVERRIDE"}</Badge>
                    </div>
                  ))}
                </div>
              );
            })()}

            {activeTab === "log" && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                {agentLog.map((entry, i) => (
                  <AgentLogEntry key={i} entry={entry} isFirst={i === 0} isLast={i === agentLog.length - 1}
                    entryId={entry.id} autoExpand={entry.id === autoExpandLogId} />
                ))}
              </div>
            )}

            {activeTab === "impact" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "SESSION TOTAL AVOIDED", value: `$${sessionTotal.toLocaleString()}`, color: C.green, sub: `${sessionSavings.length} decisions confirmed` },
                    { label: "AVG PER DECISION", value: sessionSavings.length ? `$${Math.round(sessionTotal / sessionSavings.length).toLocaleString()}` : "--", color: C.teal, sub: "cost avoidance per action" },
                    { label: "ALERTS DISPATCHED", value: String(sessionSavings.length * 6), color: C.teal, sub: "SMS + API calls executed" },
                    { label: "VS. MANUAL", value: `${sessionSavings.length * 45}m`, color: C.amber, sub: `saved vs ~${sessionSavings.length * 20} manual calls` },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
                      <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{sub}</div>
                    </div>
                  ))}
                </div>
                {sessionSavings.length === 0 ? (
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "48px 24px", textAlign: "center", color: C.muted }}>
                    <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 12 }}>$</div>
                    <div style={{ fontFamily: C.mono, fontSize: 12, letterSpacing: "0.08em", marginBottom: 8 }}>NO CONFIRMED SAVINGS YET</div>
                    <div style={{ fontSize: 13 }}>Confirm decisions in the inbox to track cost avoidance here</div>
                  </div>
                ) : (
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em" }}>CONFIRMED ACTIONS — SESSION HISTORY</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.green }}>${sessionTotal.toLocaleString()} total avoided</div>
                    </div>
                    {sessionSavings.slice().reverse().map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: i < sessionSavings.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, flexShrink: 0 }}>{s.time}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.white, marginBottom: 2 }}>{s.title}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>Gauge {s.gauge.toFixed(1)}ft · Agents: {s.agents.join(", ")} · 6 alerts dispatched</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: C.green }}>${s.amount.toLocaleString()}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>avoided</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, background: `${C.green}08`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>Est. seasonal frequency (15–20 high-water events/year)</div>
                      <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: C.green }}>~${(sessionTotal * 15).toLocaleString()}–${(sessionTotal * 20).toLocaleString()} / season</div>
                    </div>
                  </div>
                )}
                {sessionSavings.length > 0 && (
                  <div style={{ padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel }}>
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.08em", marginBottom: 6 }}>PILOT ROI PROJECTION</div>
                    <div style={{ fontSize: 13, color: "#a0c4c0", lineHeight: 1.6 }}>
                      This session simulated <span style={{ color: C.green, fontWeight: 600 }}>${sessionTotal.toLocaleString()}</span> in cost avoidance across <span style={{ color: C.white, fontWeight: 600 }}>{sessionSavings.length} {sessionSavings.length === 1 ? "event" : "events"}</span>. The Lower Mississippi experiences <span style={{ color: C.white, fontWeight: 600 }}>15–20 high-water events per season</span>. At this rate, a single terminal could realize <span style={{ color: C.green, fontWeight: 600 }}>${(Math.round(sessionTotal / sessionSavings.length) * 15).toLocaleString()}–${(Math.round(sessionTotal / sessionSavings.length) * 20).toLocaleString()}</span> in annual cost avoidance.
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "status" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>DATA FEEDS</div>
                  {(activeDisruption === "FOG" ? [
                    { label: "NDBC BURL1 — SW Pass Visibility", ok: !fogError, detail: fogData ? `${fogData.toFixed(2)}nm live` : "simulated" },
                    { label: "NWS Marine Forecast — GMZ572",    ok: true, detail: "Coastal waters advisory active" },
                    { label: "AIS Vessel Track",                ok: true, detail: "MV Delta Voyager at anchorage" },
                    { label: "SMS Gateway (Twilio)",            ok: true, detail: "Ready to dispatch" },
                    { label: "Agent Orchestrator",              ok: true, detail: "3 agents active" },
                  ] : activeDisruption === "SNOW & ICE" ? [
                    { label: "Corps of Engineers — Ice Index",  ok: false, detail: "Simulated — Corps RSS feed" },
                    { label: "NOAA Water Temp — Carrollton",    ok: true,  detail: gaugeData ? `${simGauge.toFixed(1)}ft / temp monitored` : "simulated" },
                    { label: "AIS Barge Tow Track",             ok: true,  detail: "14 tows monitored upstream" },
                    { label: "SMS Gateway (Twilio)",            ok: true,  detail: "Ready to dispatch" },
                    { label: "Agent Orchestrator",              ok: true,  detail: "3 agents active" },
                  ] : activeDisruption === "SEVERE WEATHER" ? [
                    { label: "NHC Active Storms Feed",          ok: !!nhcData, detail: nhcData ? "Live storm data" : "No active storms / simulated" },
                    { label: "NOAA Storm Surge Model",          ok: true,  detail: "SLOSH model active" },
                    { label: "AIS Vessel Track",                ok: true,  detail: "All berths monitored" },
                    { label: "SMS Gateway (Twilio)",            ok: true,  detail: "Ready to dispatch" },
                    { label: "Agent Orchestrator",              ok: true,  detail: "3 agents active" },
                  ] : [
                    { label: "NOAA Carrollton Gauge", ok: !gaugeError, detail: gaugeData ? `${gaugeData.toFixed(2)}ft live` : "simulated" },
                    { label: "AIS Vessel Track",      ok: true, detail: "MV Delta Voyager inbound" },
                    { label: "NOPB Rail API",         ok: true, detail: "14 cars staged · Yard 3" },
                    { label: "SMS Gateway (Twilio)",  ok: true, detail: "Ready to dispatch" },
                    { label: "Agent Orchestrator",    ok: true, detail: "3 agents active" },
                  ]).map(({ label, ok, detail }) => (
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
                    { code: "RW", name: "River Warden",    color: C.teal,    status: "Monitoring gauge · 15min cycle" },
                    { code: "BM", name: "Berth Master",    color: C.amber,   status: "Berth sequence optimized" },
                    { code: "IS", name: "Intermodal Sync", color: "#a78bfa", status: "Rail handoff confirmed" },
                  ].map(ag => (
                    <div key={ag.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 6, border: `1px solid ${ag.color}22`, background: `${ag.color}08`, marginBottom: 8 }}>
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Badge color={C.teal}>TWIC-CLEARED FOUNDERS</Badge>
                <Badge color={C.tealDim}>MTSA ALIGNED</Badge>
                <Badge color={C.muted}>NEWLAB NEW ORLEANS</Badge>
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>2026 DELTAAGENT AI, LLC · deltaagent.ai · BETA</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
