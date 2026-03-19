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
  muted:     "#4a7a75",   // chrome, labels, hints — intentionally dim
  body:      "#7ab8b2",   // body text, secondary info — readable
  label:     "#5a9490",   // section labels, metadata — slightly above muted
  mutedLo:   "#1e3835",
  mono:      "'JetBrains Mono', monospace",
  sans:      "'Plus Jakarta Sans', sans-serif",
};

//    DATA SOURCES                                                             
const NOAA_URL     = "/api/noaa";
const NDBC_FOG_URL = "/api/fog";
const NHC_URL      = "/api/hurricane";
const AIS_URL      = "/api/ais";
const WIND_URL     = "/api/wind";

//    DISRUPTION TYPE DEFINITIONS                                              
const DISRUPTION_TYPES = [
  { type: "FLOOD",        label: "High Water",       color: "#dc2626", live: true  },
  { type: "LOW WATER",    label: "Drought / Low",    color: "#d97706", live: false },
  { type: "FOG",          label: "Visibility",       color: "#3bbfb2", live: true  },
  { type: "ICE",          label: "Freeze / Ice",     color: "#93c5fd", live: true  },
  { type: "HURRICANE",    label: "Tropical Storm+",  color: "#a78bfa", live: true  },
  { type: "LOCK FAILURE", label: "Lock / Dam",       color: "#d97706", live: false },
  { type: "MAINTENANCE",  label: "Scheduled",        color: "#4a7a75", live: false },
];

// -- FLOOD / HIGH WATER SCENARIO ---------------------------------------------
// Carrollton Gauge operational thresholds (Lower Mississippi specific):
// Below 4ft  = LOW WATER - saltwater wedge, draft restrictions
// 4 - 8ft    = NOMINAL operational range
// 8ft        = ALGIERS POINT restriction triggers - vessel size limits at bend
// 8 - 11ft   = ELEVATED - Algiers Point restrictions active
// 11ft       = HIGH WATER PROCLAMATION - daylight mooring, barge fleeting
// 11 - 13ft  = ELEVATED+ - High Water Proclamation active
// 13ft       = HUEY P. LONG BRIDGE clearance restriction triggers
// 13 - 15ft  = WARNING - bridge clearance restricted, standby tugs
// 15 - 17ft  = CRITICAL - mandatory tugs, construction halt
// 17ft+      = FLOOD STAGE - Bonnet Carre coordination
function buildFloodScenario(ft) {
  const floodStage  = ft >= 17;
  const critical    = ft >= 15 && ft < 17;
  const bridgeWarn  = ft >= 13 && ft < 15;
  const hwProclaim  = ft >= 11 && ft < 13;
  const algiers     = ft >= 8  && ft < 11;
  const lowWater    = ft < 4;

  const status = floodStage ? "FLOOD STAGE"
    : critical   ? "CRITICAL"
    : bridgeWarn ? "CRITICAL"
    : hwProclaim ? "ELEVATED"
    : algiers    ? "ELEVATED"
    : lowWater   ? "LOW WATER"
    : "NOMINAL";

  const statusColor = (floodStage || critical || bridgeWarn) ? C.red
    : (hwProclaim || algiers) ? C.amber
    : lowWater ? "#93c5fd"
    : C.teal;

  const risk = floodStage ? "FLOOD STAGE"
    : (critical || bridgeWarn) ? "HIGH RISK"
    : (hwProclaim || algiers)  ? "ELEVATED RISK"
    : lowWater ? "LOW WATER RISK"
    : "NOMINAL";

  const riskColor = statusColor;

  const scenarioKey = floodStage ? "fs" : critical ? "cr" : bridgeWarn ? "bw" : hwProclaim ? "hw" : algiers ? "al" : lowWater ? "lw" : "nm";
  const decisions = floodStage ? [
    {
      id: `flood-${scenarioKey}-d1`, severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "FLOOD STAGE",
      title: "COORDINATE - Bonnet Carre Spillway Protocol",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft - official flood stage reached. Coordinate with Army Corps regarding Bonnet Carre Spillway opening. Navigation hazardous for all vessel classes.",
      costAvoided: 96000, costIfIgnored: 96000, advanceWarning: "6h 00m",
      agents: ["RW", "BM", "IS"],
      actions: ["Notify Army Corps - Bonnet Carre Spillway opening review initiated", "Issue Navigation Safety Notice to all inbound vessels", "Coordinate with Coast Guard Sector NOLA - full navigation advisory", "Alert all terminal operators - emergency mooring protocols activated", "Monitor saltwater wedge at Southwest Pass"],
    },
    {
      id: `flood-${scenarioKey}-d2`, severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "LEVEE PROTECTION",
      title: "HALT - All Construction Within 1500ft of Levee",
      reason: "At " + ft.toFixed(1) + "ft soil saturation puts critical pressure on levees. All construction activity within 1,500 feet must halt immediately per Corps protocol.",
      costAvoided: 54000, costIfIgnored: 54000, advanceWarning: "2h 00m",
      agents: ["RW", "BM"],
      actions: ["Halt all construction within 1,500ft of levee - regulatory requirement", "Notify all contractors via emergency SMS dispatch", "Deploy Levee District monitoring crew", "Log MTSA and Corps compliance record"],
    },
  ] : critical ? [
    {
      id: `flood-${scenarioKey}-d1`, severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "HIGH WATER",
      title: "MANDATE - Standby Tugs at All Berths",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft. Extreme river currents at Algiers Point and Carrollton Bend. Coast Guard mandate requires standby assist tugs for all deep-draft vessels.",
      costAvoided: 48000, costIfIgnored: 48000, advanceWarning: "3h 45m",
      agents: ["RW", "BM", "IS"],
      actions: ["Deploy standby tugs to Berths 1-4 via Crescent Towing", "Notify all deep-draft vessel masters - tug assist mandatory at Algiers Point", "Restrict barge fleeting - breakaway prevention protocol activated", "SMS dispatch to Port Director + Coast Guard Sector NOLA"],
    },
    {
      id: `flood-${scenarioKey}-d2`, severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "CONSTRUCTION HALT",
      title: "PREPARE - Halt Construction Near Levees",
      reason: "Stage at " + ft.toFixed(1) + "ft and rising toward flood stage. Soil saturation risk escalating. Pre-position halt orders for all sites within 1,500ft of levee.",
      costAvoided: 22000, costIfIgnored: 22000, advanceWarning: "2h 10m",
      agents: ["RW"],
      actions: ["Pre-position halt orders for levee-adjacent construction sites", "Notify Levee District monitoring teams", "Flag for Port Director review - halt imminent"],
    },
  ] : bridgeWarn ? [
    {
      id: `flood-${scenarioKey}-d1`, severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "BRIDGE CLEARANCE",
      title: "RESTRICT - Huey P. Long Bridge Clearance",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft triggers Huey P. Long Bridge air draft restriction. Tall vessels and loaded barges must be re-routed or rescheduled.",
      costAvoided: 38000, costIfIgnored: 38000, advanceWarning: "3h 00m",
      agents: ["RW", "BM", "IS"],
      actions: ["Issue Huey P. Long Bridge clearance restriction notice", "Notify all vessels with air draft above restriction threshold", "Re-sequence affected vessels to wait for stage drop", "Coordinate with CN/KCS rail - bridge traffic impacts intermodal timing", "SMS dispatch to Port Director + affected vessel agents"],
    },
    {
      id: `flood-${scenarioKey}-d2`, severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "STANDBY TUGS",
      title: "PREPARE - Standby Tugs at Upper Berths",
      reason: "Stage at " + ft.toFixed(1) + "ft. River current at Algiers Point and Carrollton Bend increasing. Pre-position standby tugs before mandatory tug assist threshold is reached.",
      costAvoided: 18000, costIfIgnored: 18000, advanceWarning: "2h 30m",
      agents: ["RW", "BM"],
      actions: ["Pre-position Crescent Towing standby tugs at upper berths", "Notify vessel masters - tug assist advisory issued", "Monitor current speed at Algiers Point - mandatory assist approaching"],
    },
  ] : hwProclaim ? [
    {
      id: `flood-${scenarioKey}-d1`, severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "HIGH WATER PROCLAMATION",
      title: "ACTIVATE - High Water Proclamation",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft - above 11ft threshold. High Water Proclamation required. Switch to daylight-only mooring for all deep-draft vessels. Huey P. Long Bridge restriction approaching.",
      costAvoided: 28000, costIfIgnored: 28000, advanceWarning: "2h 30m",
      agents: ["RW", "BM", "IS"],
      actions: ["Issue High Water Proclamation - daylight-only mooring for deep-draft vessels", "Restrict barge fleeting - single-cut tows only above Carrollton", "Notify all vessel masters and agents via SMS + VHF Ch 16", "Monitor Huey P. Long Bridge clearance - restriction threshold at 13ft", "CN/KCS rail windows adjusted for potential cargo delays"],
    },
    {
      id: `flood-${scenarioKey}-d2`, severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "BARGE RESTRICTION",
      title: "RESTRICT - Barge Fleeting at Carrollton Bend",
      reason: "Current speed increasing at Carrollton Bend above 11ft. Restrict large barge tows to prevent breakaways that could impact bridges and vessels.",
      costAvoided: 14200, costIfIgnored: 14200, advanceWarning: "1h 45m",
      agents: ["RW", "BM"],
      actions: ["Restrict barge tow size at Carrollton Bend - single-cut only", "Notify all fleeting areas upstream", "Alert Huey P. Long and Greater New Orleans Bridge tenders - increased debris"],
    },
  ] : algiers ? [
    {
      id: `flood-${scenarioKey}-d1`, severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "ALGIERS POINT",
      title: "RESTRICT - Algiers Point Vessel Size Limit",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft - Algiers Point restriction threshold reached. River current at the bend now limits deep-draft vessel maneuverability. Vessel size restrictions now active.",
      costAvoided: 22000, costIfIgnored: 22000, advanceWarning: "2h 15m",
      agents: ["RW", "BM", "IS"],
      actions: ["Activate Algiers Point vessel size restriction protocol", "Notify Crescent River Port Pilots - current advisory for the bend", "Restrict deep-draft inbound vessels - tug assist required at Algiers Point", "Re-sequence vessel queue - smaller drafts prioritized through the bend", "SMS dispatch to all vessel agents with Algiers Point restriction notice"],
    },
    {
      id: `flood-${scenarioKey}-d2`, severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "DREDGING PRIORITY",
      title: "SCHEDULE - Priority Dredging at Critical Berths",
      reason: "Rising stage at " + ft.toFixed(1) + "ft increasing siltation risk at berths. Schedule dredging priority to maintain 50ft draft for Post-Panamax vessels before channel shoaling occurs.",
      costAvoided: 16000, costIfIgnored: 16000, advanceWarning: "24h",
      agents: ["BM", "IS"],
      actions: ["Schedule priority dredging at Berths 2 and 4 - Post-Panamax draft maintenance", "Coordinate with dredging contractors - Weeks Marine and Great Lakes Dredge", "Issue berth depth advisory to vessel agents", "Flag for Port Director review - dredging authorization required"],
    },
  ] : lowWater ? [
    {
      id: `flood-${scenarioKey}-d1`, severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "SALTWATER WEDGE",
      title: "MONITOR - Saltwater Intrusion Risk",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft - below 4ft threshold. River flow too weak to push back Gulf saltwater. Saltwater wedge creeping toward New Orleans industrial intakes.",
      costAvoided: 32000, costIfIgnored: 32000, advanceWarning: "48h",
      agents: ["RW", "IS"],
      actions: ["Monitor saltwater wedge position at Southwest Pass - hourly readings", "Alert industrial water intake operators - potential salinity increase", "Coordinate with Army Corps regarding underwater sill deployment", "Notify terminal operators - machinery corrosion risk if salt reaches intakes"],
    },
    {
      id: `flood-${scenarioKey}-d2`, severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "DRAFT RESTRICTION",
      title: "ISSUE - Draft Restrictions for Inbound Vessels",
      reason: "Low water at " + ft.toFixed(1) + "ft reduces controlling draft. Vessels may only load to 45ft draft instead of 50ft - costing millions in lost cargo revenue per ship.",
      costAvoided: 18000, costIfIgnored: 18000, advanceWarning: "24h",
      agents: ["RW", "BM", "IS"],
      actions: ["Issue draft restriction notices to all inbound vessels and agents", "Notify shipping lines - maximum draft reduced to 45ft at Southwest Pass", "Coordinate with dredging contractors - priority berths identified", "Update Port NOLA bulletin - draft restriction effective immediately"],
    },
  ] : [];


  const trend = floodStage
    ? [12.1, 13.4, 14.8, 15.6, 16.2, 16.8, 17.1, ft]
    : critical
    ? [10.2, 11.4, 12.8, 13.5, 14.1, 14.6, 14.9, ft]
    : bridgeWarn
    ? [8.4, 9.2, 10.1, 11.0, 11.8, 12.4, 12.8, ft]
    : hwProclaim
    ? [7.2, 7.8, 8.4, 9.1, 9.8, 10.4, 10.8, ft]
    : algiers
    ? [5.8, 6.2, 6.8, 7.2, 7.6, 7.9, 8.1, ft]
    : lowWater
    ? [6.2, 5.4, 4.8, 4.2, 3.8, 3.4, 3.1, ft]
    : [6.4, 6.1, 5.8, 5.5, 5.8, 6.1, 6.3, ft];

  return { ft, status, statusColor, risk, riskColor, decisions, trend, scenarioKey };
}

//    FOG SCENARIO - Lower Mississippi River specific
// LMR fog phases based on Port Director operational protocols:
// 1.0 - 2.0nm  = CAUTIONARY - tow-heads disappearing, VTS monitoring, tug standby
// 0.5 - 1.0nm  = RESTRICTED - one-way traffic at bridges, pilot wait-and-see
// 0.25 - 0.5nm = CRITICAL   - suspend mooring, anchor in place at straightaways
// < 0.25nm     = ZERO-ZERO  - halt all movement, stop trucks and trains
// "Visibility controls traffic flow. Water level controls infrastructure safety."
function buildFogScenario(visNm) {
  const zeroZero   = visNm < 0.25;
  const critical   = visNm >= 0.25 && visNm < 0.5;
  const restricted = visNm >= 0.5  && visNm < 1.0;
  const cautionary = visNm >= 1.0  && visNm < 2.0;

  const status = zeroZero   ? "ZERO-ZERO"
    : critical   ? "CRITICAL"
    : restricted ? "RESTRICTED"
    : cautionary ? "CAUTIONARY"
    : "NOMINAL";

  const statusColor = zeroZero   ? C.red
    : critical   ? C.red
    : restricted ? C.amber
    : cautionary ? C.amber
    : C.teal;

  const risk = zeroZero   ? "CATASTROPHIC"
    : critical   ? "HIGH RISK"
    : restricted ? "ELEVATED RISK"
    : cautionary ? "MONITOR"
    : "NOMINAL";

  const riskColor = statusColor;

  const fogBandKey = zeroZero ? "zz" : critical ? "cr" : restricted ? "rs" : cautionary ? "ca" : "nm";
  const decisions = zeroZero ? [
    {
      id: `fog-${fogBandKey}-d1`, severity: "critical",
      disruptionType: "FOG", disruptionLabel: "ZERO-ZERO",
      title: "HALT - Total Movement Shutdown",
      reason: "KMSY visibility " + visNm.toFixed(2) + "nm - Zero-Zero conditions. Catastrophic collision risk. Every vessel stays put. Logistics domino imminent - 500+ trucks idling at terminal gates.",
      costAvoided: 84000, costIfIgnored: 84000, advanceWarning: "IMMEDIATE",
      agents: ["RW", "BM", "IS"],
      actions: ["Halt all vessel movement - every ship stays put per Coast Guard order", "Shut down truck gates - prevent land-side gridlock on surface streets", "Stop CN/KCS rail lines - prevent intermodal backup at terminal", "Order anchorage for all vessels currently in Kenner Bend straightaway", "Notify Port Director - logistics domino protocol activated"],
    },
    {
      id: `fog-${fogBandKey}-d2`, severity: "critical",
      disruptionType: "FOG", disruptionLabel: "ALLISION RISK",
      title: "PROHIBIT - No Vessel May Leave or Approach Wharves",
      reason: "Sub-0.25nm visibility creates total disorientation risk. A 30-second radar or GPS outage could cause allision with bridge pier or levee grounding.",
      costAvoided: 52000, costIfIgnored: 52000, advanceWarning: "IMMEDIATE",
      agents: ["BM", "IS"],
      actions: ["Prohibit all wharf approaches and departures - allision risk critical", "Notify all terminal berth crews - stand down immediately", "22 drayage trucks diverted - gate closure SMS dispatched via Twilio", "MTSA emergency log entry created - Coast Guard Sector NOLA notified"],
    },
  ] : critical ? [
    {
      id: `fog-${fogBandKey}-d1`, severity: "critical",
      disruptionType: "FOG", disruptionLabel: "DENSE FOG",
      title: "SUSPEND - All Mooring Operations",
      reason: "KMSY visibility " + visNm.toFixed(2) + "nm - dense fog threshold. Suspend all docking and undocking. Order ships in straightaways to find nearest anchorage immediately.",
      costAvoided: 44000, costIfIgnored: 44000, advanceWarning: "30m",
      agents: ["RW", "BM", "IS"],
      actions: ["Suspend all mooring operations - no vessel may leave or approach wharf", "Order vessels in Kenner Bend straightaway to nearest anchorage", "Pilot boarding suspended at Southwest Pass and Pilottown stations", "Crane gang stood down - berth crews on hold", "Drayage trucks notified - 2-4hr delay window via Twilio SMS"],
    },
    {
      id: `fog-${fogBandKey}-d2`, severity: "warning",
      disruptionType: "FOG", disruptionLabel: "BRIDGE RESTRICTION",
      title: "COORDINATE - One-Way Traffic at Bridges",
      reason: "Dense fog makes two-way traffic under Huey P. Long and Crescent City Connection bridges catastrophically dangerous. One-way protocol must be maintained.",
      costAvoided: 18000, costIfIgnored: 18000, advanceWarning: "45m",
      agents: ["RW", "BM"],
      actions: ["Maintain one-way traffic through Huey P. Long Bridge", "Maintain one-way traffic through Crescent City Connection", "Coordinate with Coast Guard VTS - bridge passage sequencing", "Notify all vessel agents - one-way protocol active"],
    },
  ] : restricted ? [
    {
      id: `fog-${fogBandKey}-d1`, severity: "warning",
      disruptionType: "FOG", disruptionLabel: "RESTRICTED VIS",
      title: "INITIATE - One-Way Traffic at Dangerous Bends",
      reason: "KMSY visibility " + visNm.toFixed(2) + "nm - restricted phase. Radar ghosting at sharp bends. Initiate one-way traffic through bridges. Pilots may stop boarding at Southwest Pass.",
      costAvoided: 28000, costIfIgnored: 28000, advanceWarning: "1h 15m",
      agents: ["RW", "BM", "IS"],
      actions: ["Coordinate with Coast Guard - initiate one-way traffic at Huey P. Long and Crescent City Connection", "Pilot wait-and-see advisory - Southwest Pass and Pilottown stations", "Safe speed mandate issued to all vessels transiting bends", "Parking lot forming in Gulf - notify vessel agents of delay window", "Berth crew notified - crane gang on short-notice standby"],
    },
  ] : cautionary ? [
    {
      id: `fog-${fogBandKey}-d1`, severity: "warning",
      disruptionType: "FOG", disruptionLabel: "CAUTIONARY",
      title: "ACTIVATE - VTS Monitoring and Tug Standby",
      reason: "KMSY visibility " + visNm.toFixed(2) + "nm - cautionary phase. Tow-heads beginning to disappear. Reaction time compressed by 4-knot current. Activate VTS checkpoint monitoring.",
      costAvoided: 14000, costIfIgnored: 14000, advanceWarning: "2h 00m",
      agents: ["RW", "BM"],
      actions: ["Activate VTS checkpoint monitoring - 81-Mile Point and Algiers Point", "Alert assist tugs at Valero and PBF terminals - short-notice standby", "Ensure all vessels checking in at designated checkpoints via VHF Ch 16", "Monitor visibility trend - restricted phase approaching at 1.0nm"],
    },
  ] : [];

  const trend = zeroZero
    ? [1.8, 1.2, 0.8, 0.5, 0.35, 0.28, 0.22, visNm]
    : critical
    ? [2.1, 1.6, 1.1, 0.8, 0.6, 0.45, 0.38, visNm]
    : restricted
    ? [2.8, 2.4, 2.0, 1.6, 1.2, 0.9, 0.7, visNm]
    : cautionary
    ? [4.2, 3.8, 3.2, 2.6, 2.2, 1.8, 1.4, visNm]
    : [8.0, 8.5, 9.0, 9.2, 9.5, 9.8, 10.0, visNm];

  return { visNm, status, statusColor, risk, riskColor, decisions, trend, fogBandKey };
}

//    ICE SCENARIO - Lower Mississippi River specific
// Ice coverage % mapped to 0-10 index (0=clear, 10=severe jamming)
// LMR ice is frazil ice/chunks flowing from Ohio River - not frozen solid
// Phases: Trace (1-10%), Intermediate (10-40%), Heavy (40-70%), Severe (70%+)
// Critical co-factor: low water + ice = saltwater wedge + engine clog nightmare
function buildIceScenario(iceIndex) {
  // Map 0-10 index to coverage %: 0=0%, 10=100%
  const coverage    = iceIndex * 10;
  const severe      = iceIndex >= 7;  // 70%+ - total loss of control
  const heavy       = iceIndex >= 4 && iceIndex < 7;  // 40-70% - mooring line snap risk
  const intermediate = iceIndex >= 1 && iceIndex < 4; // 10-40% - buoy displacement
  const trace       = iceIndex > 0 && iceIndex < 1;   // 1-10% - intake clog risk

  const status = severe       ? "CRITICAL"
    : heavy        ? "CRITICAL"
    : intermediate ? "ELEVATED"
    : trace        ? "CAUTIONARY"
    : "NOMINAL";

  const statusColor = (severe || heavy) ? C.red
    : intermediate ? C.amber
    : trace        ? C.amber
    : C.teal;

  const risk = (severe || heavy) ? "HIGH RISK"
    : intermediate ? "ELEVATED RISK"
    : trace        ? "MONITOR"
    : "NOMINAL";

  const riskColor = statusColor;

  const iceBandKey = severe ? "sv" : heavy ? "hv" : intermediate ? "im" : trace ? "tr" : "nm";
  const decisions = severe ? [
    {
      id: `ice-${iceBandKey}-d1`, severity: "critical",
      disruptionType: "ICE", disruptionLabel: "RIVER CLOSURE",
      title: "HALT - Full River Closure Protocol",
      reason: "Ice coverage at " + coverage.toFixed(0) + "% - severe jamming. River current pushing ice floes with enough force to overwhelm vessel engines. Coast Guard coordination required for immediate closure. Bridge piers at Huey P. Long at risk of ice dam formation.",
      costAvoided: 96000, costIfIgnored: 96000, advanceWarning: "IMMEDIATE",
      agents: ["RW", "BM", "IS"],
      actions: ["Coordinate with Coast Guard Sector NOLA - river closure declaration", "Halt all vessel traffic - no exceptions", "Monitor Huey P. Long Bridge piers for ice jam formation", "Suspend all land-side operations - shut truck gates and rail lines", "Port Director emergency notification - MTSA ice closure protocol activated"],
    },
    {
      id: `ice-${iceBandKey}-d2`, severity: "critical",
      disruptionType: "ICE", disruptionLabel: "LOGISTICS FREEZE",
      title: "SUSPEND - All Land-Side Operations",
      reason: "Ships cannot move. Port is now a warehouse that cannot be emptied. Rail and trucking must halt to prevent land-side gridlock on surface streets.",
      costAvoided: 54000, costIfIgnored: 54000, advanceWarning: "IMMEDIATE",
      agents: ["BM", "IS"],
      actions: ["Shut terminal truck gates - prevent surface street gridlock", "Halt CN/KCS rail - cars staged at inland yards", "Terminal inventory freeze - no new cargo movement", "Notify all shipping agents - port closed until ice clears"],
    },
  ] : heavy ? [
    {
      id: `ice-${iceBandKey}-d1`, severity: "critical",
      disruptionType: "ICE", disruptionLabel: "MOORING RISK",
      title: "MANDATE - Standby Tugs at All Berths",
      reason: "Ice coverage at " + coverage.toFixed(0) + "% - ice building between docked ships and wharf. Pressure can snap massive steel mooring lines. Require assist tugs pinned against all docked vessels to maintain pressure.",
      costAvoided: 48000, costIfIgnored: 48000, advanceWarning: "2h 00m",
      agents: ["RW", "BM"],
      actions: ["Mandate standby assist tugs at all berths via Crescent Towing", "Suspend all barge fleeting - loose barge in ice becomes a battering ram", "Notify vessel masters - mooring line snap risk advisory issued", "Increase mooring line checks to every 30 minutes", "SMS dispatch to Port Director + Coast Guard Sector NOLA"],
    },
    {
      id: `ice-${iceBandKey}-d2`, severity: "warning",
      disruptionType: "ICE", disruptionLabel: "BARGE FLEETING",
      title: "SUSPEND - Barge Fleeting Operations",
      reason: "Heavy ice coverage makes barge building dangerous. A loose barge in pack ice becomes a battering ram capable of damaging bridge piers or other vessels.",
      costAvoided: 22000, costIfIgnored: 22000, advanceWarning: "1h 30m",
      agents: ["BM", "IS"],
      actions: ["Stop all barge fleeting operations immediately", "Secure all staged barges - additional mooring lines required", "Notify barge operators - Kirby, ACBL, Canal Barge via SMS", "CN/KCS rail windows adjusted for barge fleet delays"],
    },
  ] : intermediate ? [
    {
      id: `ice-${iceBandKey}-d1`, severity: "warning",
      disruptionType: "ICE", disruptionLabel: "BUOY DISPLACEMENT",
      title: "DECLARE - Unreliable Aids to Navigation",
      reason: "Ice coverage at " + coverage.toFixed(0) + "% - moving ice snagging buoy chains and dragging channel markers out of position. Green and red channel markers may not be where they are supposed to be.",
      costAvoided: 28000, costIfIgnored: 28000, advanceWarning: "3h 00m",
      agents: ["RW", "BM", "IS"],
      actions: ["Issue Unreliable Aids to Navigation notice to all vessel pilots", "Restrict navigation to daylight hours - visual channel confirmation required", "Notify Crescent River Port Pilots - buoy displacement advisory active", "SMS dispatch to all inbound vessel agents via Twilio", "Coast Guard buoy tender deployed to reassess channel markers"],
    },
  ] : trace ? [
    {
      id: `ice-${iceBandKey}-d1`, severity: "warning",
      disruptionType: "ICE", disruptionLabel: "ENGINE INTAKES",
      title: "ADVISORY - Monitor Vessel Engine Intakes",
      reason: "Trace ice (frazil slush) detected on Lower Mississippi. Primary risk is sea chest clogging on tugs and ships. Slush can block cooling water intakes causing engines to overheat and fail mid-current.",
      costAvoided: 14000, costIfIgnored: 14000, advanceWarning: "4h 00m",
      agents: ["RW"],
      actions: ["Issue sea chest clog advisory to all vessels in corridor", "Advise vessels to reduce speed - prevent bow thruster ice ingestion", "Notify tug operators - Crescent Towing, Bisso Marine - increased intake monitoring", "Monitor for progression to intermediate ice coverage"],
    },
  ] : [];

  const trend = severe
    ? [2.1, 3.8, 5.2, 6.4, 7.1, 7.6, 7.9, iceIndex]
    : heavy
    ? [1.2, 2.1, 3.0, 3.6, 4.1, 4.5, 4.8, iceIndex]
    : intermediate
    ? [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, iceIndex]
    : [0.1, 0.1, 0.2, 0.1, 0.2, 0.1, 0.1, iceIndex];

  return { iceIndex, coverage, status, statusColor, risk, riskColor, decisions, trend, iceBandKey };
}

//    HURRICANE SCENARIO - Lower Mississippi River / USCG MHCPP
// Governed by Sector New Orleans Maritime Hurricane Contingency Port Plan (MHCPP)
// Timeline anchored to arrival of Gale Force Winds (34 knots) at SW Pass Entrance Sea Buoy
// Port Conditions set by USCG Captain of the Port (COTP):
// WHISKEY = 72h to impact  (port open, prep begins)
// X-RAY   = 48h to impact  (open, intensified prep)
// YANKEE  = 24h to impact  (restricted, inbound closed)
// ZULU    = 12h to impact  (fully closed)
// RECOVERY = post-storm   (closed pending survey)
function buildHurricaneScenario(distanceMiles, category) {
  const catLabel = category === 0 ? "Tropical Storm" : "Cat " + category;

  // Map distance to Port Condition
  // Assuming storm speed ~15mph: 72h=1080mi, 48h=720mi, 24h=360mi, 12h=180mi
  const zulu    = distanceMiles < 180;
  const yankee  = distanceMiles >= 180 && distanceMiles < 360;
  const xray    = distanceMiles >= 360 && distanceMiles < 720;
  const whiskey = distanceMiles >= 720 && distanceMiles < 1000;

  const portCondition = zulu ? "ZULU" : yankee ? "YANKEE" : xray ? "X-RAY" : whiskey ? "WHISKEY" : "NOMINAL";

  const status = (zulu || yankee) ? "CRITICAL"
    : xray    ? "ELEVATED"
    : whiskey ? "CAUTIONARY"
    : "NOMINAL";

  const statusColor = (zulu || yankee) ? C.red
    : xray    ? C.amber
    : whiskey ? C.amber
    : C.teal;

  const risk = (zulu || yankee) ? "HIGH RISK"
    : xray    ? "ELEVATED RISK"
    : whiskey ? "MONITOR"
    : "NOMINAL";

  const riskColor = statusColor;

  const stormBandKey = zulu ? "zu" : yankee ? "ya" : xray ? "xr" : whiskey ? "wh" : "nm";
  const decisions = zulu ? [
    {
      id: `storm-${stormBandKey}-d1`, severity: "critical",
      disruptionType: "HURRICANE", disruptionLabel: "PORT CONDITION ZULU",
      title: "CLOSE - Port Condition ZULU - Full Closure",
      reason: catLabel + " " + distanceMiles + "mi from SW Pass - 12h to gale force winds. COTP declaring Port Condition ZULU. Port closed to ALL inbound and outbound traffic. Suspend all cargo operations including bunkering and lightering.",
      costAvoided: 128000, costIfIgnored: 128000, advanceWarning: "12h",
      agents: ["RW", "BM", "IS"],
      actions: ["COTP Port Condition ZULU declared - all traffic halted", "Suspend all cargo ops including bunkering and lightering", "Gantry cranes, conveyors, and loose gear lashed and secured", "Essential Personnel roster activated - designated staff report to stations", "Joint Gulf Coast Inland Waterways Hurricane Response Protocol activated", "FEMA + Port NOLA EOC notified - MTSA hurricane audit log created"],
    },
    {
      id: `storm-${stormBandKey}-d2`, severity: "critical",
      disruptionType: "HURRICANE", disruptionLabel: "RNA ENFORCEMENT",
      title: "ENFORCE - Regulated Navigation Area Restriction",
      reason: "RNA restrictions now active. All floating vessels prohibited from Harvey Canal and Algiers Canal unless pre-approved Annual Hurricane Operation Plan (AHOP) is on file.",
      costAvoided: 64000, costIfIgnored: 64000, advanceWarning: "IMMEDIATE",
      agents: ["BM", "RW"],
      actions: ["Enforce RNA - Harvey Canal and Algiers Canal restricted", "Verify AHOP status for all vessels remaining in restricted areas", "Two-anchor requirement enforced - vessels must be underway-ready within 15 min", "Coast Guard Sector NOLA RNA enforcement notification dispatched"],
    },
  ] : yankee ? [
    {
      id: `storm-${stormBandKey}-d1`, severity: "critical",
      disruptionType: "HURRICANE", disruptionLabel: "PORT CONDITION YANKEE",
      title: "RESTRICT - Port Condition YANKEE - Inbound Closed",
      reason: catLabel + " " + distanceMiles + "mi from SW Pass - 24h to gale force winds. Port restricted - closed to all inbound vessel traffic. Order termination of all cargo operations not associated with storm prep.",
      costAvoided: 96000, costIfIgnored: 96000, advanceWarning: "24h",
      agents: ["RW", "BM", "IS"],
      actions: ["Port closed to all inbound traffic - COTP YANKEE declared", "Terminate all cargo operations not related to storm preparation", "Encourage vessels to depart - those staying must have approved storm mooring system", "Vessel storm mooring plans reviewed and approved by Port Director", "CN/KCS rail traffic pre-positioned - cars staged at inland yards"],
    },
    {
      id: `storm-${stormBandKey}-d2`, severity: "warning",
      disruptionType: "HURRICANE", disruptionLabel: "VESSEL MOORING",
      title: "VERIFY - Storm Mooring Plans for All Remaining Vessels",
      reason: "Vessels electing to remain must have a written storm mooring plan on file. Minimum two anchors required. All must be ready to get underway within 15 minutes.",
      costAvoided: 42000, costIfIgnored: 42000, advanceWarning: "18h",
      agents: ["BM"],
      actions: ["Request written storm mooring plans from all remaining vessel masters", "Verify minimum two-anchor requirement for each vessel", "Confirm 15-minute underway readiness for all docked vessels", "Berth-by-berth inspection of mooring line condition and storm tie-downs"],
    },
  ] : xray ? [
    {
      id: `storm-${stormBandKey}-d1`, severity: "warning",
      disruptionType: "HURRICANE", disruptionLabel: "PORT CONDITION X-RAY",
      title: "PREPARE - Port Condition X-RAY - Intensified Prep",
      reason: catLabel + " " + distanceMiles + "mi from SW Pass - 48h to gale force winds. Port open but preparation intensifies. Review all vessel mooring plans. Secure or remove all potential flying debris and hazardous materials.",
      costAvoided: 58000, costIfIgnored: 58000, advanceWarning: "48h",
      agents: ["RW", "BM", "IS"],
      actions: ["Review vessel mooring plans - written plans required upon request", "Secure or remove all potential flying debris from terminal areas", "Secure all hazardous materials per MHCPP protocol", "Confirm all expected vessel arrivals and sailings with masters and agents", "Pre-position CN/KCS rail for potential rapid clearance"],
    },
  ] : whiskey ? [
    {
      id: `storm-${stormBandKey}-d1`, severity: "warning",
      disruptionType: "HURRICANE", disruptionLabel: "PORT CONDITION WHISKEY",
      title: "INITIATE - Port Condition WHISKEY - Storm Prep Begins",
      reason: catLabel + " tracking toward Gulf - " + distanceMiles + "mi from SW Pass. 72h to gale force winds at SW Pass Entrance Sea Buoy. Port remains open. Begin fuel top-offs and confirm vessel schedules.",
      costAvoided: 32000, costIfIgnored: 32000, advanceWarning: "72h",
      agents: ["RW", "BM", "IS"],
      actions: ["Begin fueling all district vehicles and bulk tanks", "Inspect all port areas - document current condition", "Confirm all expected vessel arrivals and sailings with masters and agents", "Activate Gulf Coast Inland Waterways Joint Hurricane Response Protocol monitoring", "Port Director briefed - MHCPP contingency plan on standby"],
    },
  ] : [];

  const trend = zulu
    ? [900, 750, 580, 420, 320, 220, 185, distanceMiles]
    : yankee
    ? [950, 820, 680, 540, 430, 380, 365, distanceMiles]
    : xray
    ? [1050, 950, 850, 750, 680, 600, 550, distanceMiles]
    : whiskey
    ? [1200, 1150, 1080, 1020, 960, 900, 850, distanceMiles]
    : [1400, 1350, 1280, 1200, 1150, 1100, 1050, distanceMiles];

  return { distanceMiles, category, portCondition, status, statusColor, risk, riskColor, decisions, trend, stormBandKey };
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

const AGENT_INFO = {
  RW: {
    name: "River Warden",
    color: C.teal,
    role: "Environmental monitoring",
    description: "Watches NOAA gauge data, visibility, ice index, and NHC storm tracks. Triggers threshold alerts and classifies disruption severity.",
  },
  BM: {
    name: "Berth Master",
    color: C.amber,
    role: "Berth & crane sequencing",
    description: "Manages dock scheduling, crane gang assignments, and vessel queue priority. Re-sequences arrivals when conditions change.",
  },
  IS: {
    name: "Intermodal Sync",
    color: "#a78bfa",
    role: "Rail & drayage coordination",
    description: "Coordinates CN/KCS rail windows and drayage fleet notifications. Ensures the land-side handoff is ready when ships hit the dock.",
  },
};

function AgentBadge({ code }) {
  const [hovered, setHovered] = useState(false);
  const posRef                = useRef({ top: 0, left: 0 });
  const [posReady, setPosReady] = useState(false);
  const ref                   = useRef(null);
  const agent = AGENT_INFO[code];
  if (!agent) return <Badge color={C.muted} small>{code}</Badge>;

  function handleMouseEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      posRef.current = { top: r.top, left: r.left + r.width / 2 };
      setPosReady(true);
    }
    setHovered(true);
  }

  function handleMouseLeave() {
    setHovered(false);
    setPosReady(false);
  }

  const pos = posRef.current;

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Badge color={agent.color} small>{code}</Badge>
      {hovered && posReady && (
        <div style={{
          position: "fixed",
          top: pos.top - 12,
          left: pos.left,
          transform: "translate(-50%, -100%)",
          width: 230, zIndex: 9999,
          background: "#0a1a18",
          border: `1px solid ${agent.color}44`,
          borderRadius: 7,
          padding: "10px 12px",
          boxShadow: `0 8px 32px rgba(0,0,0,0.9), 0 0 0 1px ${agent.color}22`,
          pointerEvents: "none",
          animation: "tooltipFadeIn 0.15s ease",
          fontFamily: C.sans,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, background: `${agent.color}20`, border: `1px solid ${agent.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontSize: 9, fontWeight: 700, color: agent.color, flexShrink: 0 }}>{code}</div>
            <div>
              <div style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: agent.color, letterSpacing: "0.06em" }}>{agent.name}</div>
              <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>{agent.role}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.body, lineHeight: 1.55 }}>{agent.description}</div>
          {/* Arrow pointing down */}
          <div style={{
            position: "absolute", bottom: -5, left: "50%",
            width: 8, height: 8, background: "#0a1a18",
            border: `1px solid ${agent.color}44`, borderTop: "none", borderLeft: "none",
            transform: "translateX(-50%) rotate(45deg)",
          }} />
        </div>
      )}
    </span>
  );
}

function CredentialChip({ label, color, title, detail }) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const ref                   = useRef(null);

  function handleMouseEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    }
    setHovered(true);
  }

  return (
    <span
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 4, border: `1px solid ${color}33`, background: `${color}0d`, cursor: "default" }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
      <span style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, color, letterSpacing: "0.08em" }}>{label}</span>
      {hovered && (
        <div style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          transform: "translateX(-50%)",
          width: 240, zIndex: 9999,
          background: "#0a1a18",
          border: `1px solid ${color}44`,
          borderRadius: 7,
          padding: "10px 12px",
          boxShadow: `0 8px 32px rgba(0,0,0,0.9), 0 0 0 1px ${color}22`,
          pointerEvents: "none",
          animation: "tooltipFadeIn 0.15s ease",
          fontFamily: C.sans,
        }}>
          {/* Arrow pointing up */}
          <div style={{
            position: "absolute", top: -5, left: "50%",
            width: 8, height: 8, background: "#0a1a18",
            border: `1px solid ${color}44`, borderBottom: "none", borderRight: "none",
            transform: "translateX(-50%) rotate(45deg)",
          }} />
          <div style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color, letterSpacing: "0.06em", marginBottom: 5 }}>{title}</div>
          <div style={{ fontSize: 11, color: C.body, lineHeight: 1.55 }}>{detail}</div>
        </div>
      )}
    </span>
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

function GaugeBar({ value, max = 20 }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 15 ? C.red : value >= 13 ? C.red : value >= 8 ? C.amber : value < 4 ? "#93c5fd" : C.teal;
  return (
    <div style={{ width: "100%", marginTop: 8 }}>
      <div style={{ height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: color, transition: "width 1.2s ease, background 0.6s ease", boxShadow: `0 0 6px ${color}66` }} />
        {[4, 8, 11, 13, 15, 17].map((t, i) => (
          <div key={i} style={{ position: "absolute", left: `${(t / max) * 100}%`, top: 0, height: "100%", width: 1, background: i < 1 ? "#93c5fd" : i < 3 ? C.amber : C.red, opacity: 0.6 }} />
        ))}
      </div>
    </div>
  );
}

const TOAST_DURATION = 7000;

function SMSNotification({ decision, onClose, onClick }) {
  const [visible, setVisible]     = useState(false);
  const [hovered, setHovered]     = useState(false);
  const [progress, setProgress]   = useState(100); // 100 → 0
  const timerRef                  = useRef(null);
  const progressRef               = useRef(null);
  const startTimeRef              = useRef(null);
  const remainingRef              = useRef(TOAST_DURATION);

  function startDrain() {
    const start = Date.now();
    startTimeRef.current = start;
    // Drain progress bar
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / remainingRef.current) * 100);
      setProgress(pct);
    }, 50);
    // Close when drained
    timerRef.current = setTimeout(() => {
      clearInterval(progressRef.current);
      setVisible(false);
      setTimeout(onClose, 400);
    }, remainingRef.current);
  }

  function pauseDrain() {
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
    // Save how much time is left
    if (startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  }

  useEffect(() => {
    setTimeout(() => { setVisible(true); startDrain(); }, 50);
    return () => { clearTimeout(timerRef.current); clearInterval(progressRef.current); };
  }, []);

  function handleMouseEnter() { setHovered(true); pauseDrain(); }
  function handleMouseLeave() { setHovered(false); startDrain(); }
  function handleClick() {
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
    onClick();
    setVisible(false);
    setTimeout(onClose, 400);
  }

  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" });
  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)", transform: visible ? `translateX(0) scale(${hovered ? 1.02 : 1})` : "translateX(120%) scale(0.9)", opacity: visible ? 1 : 0, cursor: "pointer" }}>
      <div style={{ width: 340, background: "linear-gradient(150deg,#040f0e,#061a17)", borderRadius: 12, overflow: "hidden", boxShadow: hovered ? `0 32px 80px rgba(0,0,0,0.95),0 0 0 1px ${C.teal}88,0 0 40px ${C.teal}22` : `0 24px 64px rgba(0,0,0,0.9),0 0 0 1px ${C.teal}44`, fontFamily: C.sans, transition: "box-shadow 0.2s ease" }}>
        {/* Top accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg,${C.teal},#0f4547,transparent)` }} />
        <div style={{ padding: "14px 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,#0f4547,${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 12px ${C.teal}44` }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,14 8,10 2,14" fill="white" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: C.teal, letterSpacing: "0.08em" }}>EXECUTION COMPLETE</div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginTop: 1 }}>{time}   6 alerts dispatched</div>
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.teal, opacity: 0.7 }}>view record →</div>
          </div>
          <div style={{ background: `${C.teal}0d`, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: "9px 12px", marginBottom: 10 }}>
            <div style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 3 }}>{decision.title}</div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>
              Gauge {decision.ft?.toFixed(1)}ft   <span style={{ color: C.green }}>${decision.costAvoided?.toLocaleString()} avoided</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {["Port Director","Pilot Station","CN/KCS","Drayage","Berth TOS","Audit"].map((l, i) => (
              <div key={i} style={{ fontFamily: C.mono, fontSize: 8, color: C.teal, background: `${C.teal}12`, border: `1px solid ${C.teal}30`, borderRadius: 3, padding: "3px 6px" }}>{l}</div>
            ))}
          </div>
          {/* Progress drain bar */}
          <div style={{ height: 2, background: C.mutedLo, borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              background: hovered ? C.amber : C.teal,
              transition: hovered ? "background 0.2s ease" : "background 0.2s ease",
              borderRadius: 1,
            }} />
          </div>
          {hovered && (
            <div style={{ marginTop: 6, fontFamily: C.mono, fontSize: 9, color: C.muted, textAlign: "center" }}>
              Click to open Agent Log
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverrideNotification({ decision, onClose, onClick }) {
  const [visible, setVisible]   = useState(false);
  const [hovered, setHovered]   = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef                = useRef(null);
  const progressRef             = useRef(null);
  const startTimeRef            = useRef(null);
  const remainingRef            = useRef(TOAST_DURATION);

  function startDrain() {
    const start = Date.now();
    startTimeRef.current = start;
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / remainingRef.current) * 100);
      setProgress(pct);
    }, 50);
    timerRef.current = setTimeout(() => {
      clearInterval(progressRef.current);
      setVisible(false);
      setTimeout(onClose, 400);
    }, remainingRef.current);
  }

  function pauseDrain() {
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
    if (startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  }

  useEffect(() => {
    setTimeout(() => { setVisible(true); startDrain(); }, 50);
    return () => { clearTimeout(timerRef.current); clearInterval(progressRef.current); };
  }, []);

  function handleMouseEnter() { setHovered(true); pauseDrain(); }
  function handleMouseLeave() { setHovered(false); startDrain(); }
  function handleClick() {
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
    onClick();
    setVisible(false);
    setTimeout(onClose, 400);
  }

  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" });
  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)", transform: visible ? `translateX(0) scale(${hovered ? 1.02 : 1})` : "translateX(120%) scale(0.9)", opacity: visible ? 1 : 0, cursor: "pointer" }}>
      <div style={{ width: 340, background: "linear-gradient(150deg,#0f0a00,#1a1000)", borderRadius: 12, overflow: "hidden", boxShadow: hovered ? `0 32px 80px rgba(0,0,0,0.95),0 0 0 1px ${C.amber}88,0 0 40px ${C.amber}22` : `0 24px 64px rgba(0,0,0,0.9),0 0 0 1px ${C.amber}55`, fontFamily: C.sans, transition: "box-shadow 0.2s ease" }}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${C.amber},#92400e,transparent)` }} />
        <div style={{ padding: "14px 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#92400e,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, boxShadow: `0 0 12px ${C.amber}44` }}>!</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: C.amber, letterSpacing: "0.08em" }}>MANUAL ACTION REQUIRED</div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginTop: 1 }}>{time}   override logged</div>
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.amber, opacity: 0.7 }}>view →</div>
          </div>
          <div style={{ background: `${C.amber}0d`, border: `1px solid ${C.amber}44`, borderRadius: 8, padding: "9px 12px", marginBottom: 10 }}>
            <div style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 3 }}>{decision.title}</div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>Automated dispatch cancelled   <span style={{ color: C.amber }}>Your team must coordinate manually</span></div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {["Port Director","Pilot Station","CN/KCS","Drayage"].map((l, i) => (
              <div key={i} style={{ fontFamily: C.mono, fontSize: 8, color: C.amber, background: `${C.amber}12`, border: `1px solid ${C.amber}30`, borderRadius: 3, padding: "3px 6px" }}>{l}</div>
            ))}
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: "#666", marginBottom: 8 }}>~45 min / 20 manual calls required   MTSA audit logged</div>
          {/* Progress drain bar */}
          <div style={{ height: 2, background: C.mutedLo, borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              background: hovered ? C.red : C.amber,
              transition: "background 0.2s ease",
              borderRadius: 1,
            }} />
          </div>
          {hovered && (
            <div style={{ marginTop: 6, fontFamily: C.mono, fontSize: 9, color: C.muted, textAlign: "center" }}>
              Click to view override record in Agent Log
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STEPS_DURATION = 8000;

function getExecSteps(disruptionType) {
  switch (disruptionType) {
    case "FOG":
      return [
        { label: "Pilot Station - boarding advisory issued",    detail: "+1 (504) 555-0293   visibility alert",  icon: "->", type: "SMS"   },
        { label: "Coast Guard Sector NOLA notified",            detail: "VHF Ch 16 + SMS dispatch",              icon: "->", type: "SMS"   },
        { label: "Berth crew stood down - crane on standby",    detail: "Berth 1 crew hold confirmed",           icon: "->", type: "OPS"   },
        { label: "Drayage fleet notified via Twilio",           detail: "22 trucks - delay window issued",       icon: "->", type: "SMS"   },
        { label: "NWS marine forecast logged",                  detail: "GMZ572 advisory acknowledged",          icon: "->", type: "DATA"  },
        { label: "MTSA audit entry created",                    detail: "Fog delay compliance record",           icon: "->", type: "AUDIT" },
      ];
    case "ICE":
      return [
        { label: "Coast Guard Sector NOLA - ice advisory issued",  detail: "Navigation notice dispatched",         icon: "->", type: "SMS"   },
        { label: "Vessel masters notified - sea chest monitoring", detail: "All vessels in corridor alerted",      icon: "->", type: "SMS"   },
        { label: "Crescent Towing - standby tugs pre-positioned",  detail: "Berths 1-4 covered",                  icon: "->", type: "OPS"   },
        { label: "CN/KCS rail windows shifted",                    detail: "Barge arrival delay +48h logged",     icon: "->", type: "API"   },
        { label: "Barge operators notified via Twilio",            detail: "Kirby, ACBL, Canal Barge alerted",    icon: "->", type: "SMS"   },
        { label: "MTSA ice restriction audit log created",         detail: "Compliance record filed",             icon: "->", type: "AUDIT" },
      ];
    case "HURRICANE":
      return [
        { label: "COTP Port Condition declared - Coast Guard notified",  detail: "Sector New Orleans MHCPP activated",   icon: "->", type: "SMS"   },
        { label: "NHC advisory + track data logged",                     detail: "SW Pass Sea Buoy reference updated",  icon: "->", type: "DATA"  },
        { label: "Vessel masters notified - mooring plans required",     detail: "All agents contacted via Twilio",     icon: "->", type: "SMS"   },
        { label: "Terminal equipment securing protocol activated",       detail: "Cranes, conveyors, gear lashed",      icon: "->", type: "OPS"   },
        { label: "Essential Personnel roster activated",                 detail: "Storm duty assignments confirmed",    icon: "->", type: "OPS"   },
        { label: "MTSA hurricane audit log + FEMA EOC notified",        detail: "Joint Response Protocol active",      icon: "->", type: "AUDIT" },
      ];
    default: // FLOOD
      return [
        { label: "SMS dispatched to Port Director",    detail: "+1 (504) 555-0147",       icon: "->", type: "SMS"   },
        { label: "SMS dispatched to Pilot Station",    detail: "+1 (504) 555-0293",       icon: "->", type: "SMS"   },
        { label: "CN/KCS Rail API window updated",     detail: "08:45 to 10:15 CST",      icon: "->", type: "API"   },
        { label: "Drayage fleet notified via Twilio",  detail: "22 trucks rerouted",       icon: "->", type: "SMS"   },
        { label: "Berth schedule updated in TOS",      detail: "Navis N4 API call",        icon: "->", type: "API"   },
        { label: "MTSA audit log entry created",       detail: "MTSA compliance record",   icon: "->", type: "AUDIT" },
      ];
  }
}

function getManualComparison(disruptionType) {
  switch (disruptionType) {
    case "FOG":            return "~30 min / 12 manual calls required";
    case "ICE":     return "~60 min / 18 manual calls required";
    case "HURRICANE": return "~4 hrs / 40+ manual calls required";
    default:               return "~45 min / 20 manual calls required";
  }
}

function ExecutionTicker({ decision, alreadyDone = false, onDone }) {
  const steps = getExecSteps(decision.disruptionType);
  const [firedCount, setFiredCount] = useState(alreadyDone ? steps.length : 0);
  const [done, setDone]             = useState(alreadyDone);
  const [elapsed, setElapsed]       = useState(alreadyDone ? "5.3" : "0.0");
  const [collapsed, setCollapsed]   = useState(alreadyDone);
  const startRef                    = useRef(Date.now());

  useEffect(() => {
    if (alreadyDone) return;
    const clock = setInterval(() => setElapsed(((Date.now() - startRef.current) / 1000).toFixed(1)), 100);
    steps.forEach((_, i) => {
      setTimeout(() => {
        setFiredCount(i + 1);
        if (i === steps.length - 1) {
          setTimeout(() => {
            setDone(true);
            clearInterval(clock);
            // Brief pause so user sees the completed state before card moves
            setTimeout(() => {
              setCollapsed(true);
              onDone && onDone();
            }, 800);
          }, 500);
        }
      }, (i + 1) * 800);
    });
    return () => clearInterval(clock);
  }, []);

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{ borderTop: `1px solid ${C.border}`, background: C.panel, padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.teal, letterSpacing: "0.06em" }}>EXECUTION RECORD</span>
          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{steps.length} actions   {elapsed}s   ${decision.costAvoided.toLocaleString()} avoided</span>
        </div>
        <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>click to expand</span>
      </div>
    );
  }

  return (
    <div onClick={() => done && setCollapsed(true)} style={{ borderTop: `1px solid ${C.border}`, background: C.panel, padding: "12px 20px", cursor: done ? "pointer" : "default" }}>
      {!done && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PulsingDot color={C.teal} size={7} />
            <span style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: C.teal, letterSpacing: "0.08em" }}>EXECUTING...</span>
          </div>
          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{elapsed}s elapsed</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: done ? 10 : 0 }}>
        {steps.map((step, i) => {
          const fired = i < firedCount;
          const typeColors = { SMS: C.teal, API: "#818cf8", OPS: C.amber, DATA: "#67e8f9", AUDIT: C.muted };
          const typeColor = typeColors[step.type] || C.muted;
          return (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "38px 1fr auto 32px",
              alignItems: "center",
              gap: 8,
              padding: "5px 10px",
              borderRadius: 4,
              background: fired ? `${C.teal}09` : "transparent",
              border: `1px solid ${fired ? C.teal + "1a" : C.border + "88"}`,
              opacity: fired ? 1 : 0.28,
              transition: "all 0.4s ease",
            }}>
              <div style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, color: typeColor, background: `${typeColor}18`, border: `1px solid ${typeColor}30`, borderRadius: 3, padding: "2px 0", textAlign: "center", letterSpacing: "0.04em" }}>
                {step.type}
              </div>
              <div style={{ fontSize: 11, color: fired ? C.white : C.muted, fontWeight: fired ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {step.label}
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, textAlign: "right", whiteSpace: "nowrap" }}>
                {step.detail}
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: fired ? C.teal : C.mutedLo, textAlign: "right", whiteSpace: "nowrap" }}>
                {fired ? `${((i + 1) * 0.8).toFixed(1)}s` : "--"}
              </div>
            </div>
          );
        })}
      </div>
      {done && (
        <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 12px", borderRadius: 5, background: `${C.green}09`, border: `1px solid ${C.green}22`, marginBottom: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.06em" }}>AVOIDED</span>
                <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.green }}>${decision.costAvoided.toLocaleString()}</span>
              </div>
              {getCostAnnotation(decision.costAvoided, decision.disruptionType) && (
                <span style={{ fontFamily: C.mono, fontSize: 8, color: C.body }}>{getCostAnnotation(decision.costAvoided, decision.disruptionType)}</span>
              )}
            </div>
            <div style={{ width: 1, height: 24, background: C.border }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.06em" }}>ELAPSED</span>
              <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: C.teal }}>{elapsed}s</span>
            </div>
            <div style={{ width: 1, height: 14, background: C.border }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.06em" }}>ALERTS</span>
              <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: C.teal }}>{steps.length}</span>
            </div>
            <div style={{ marginLeft: "auto", fontFamily: C.mono, fontSize: 9, color: C.muted }}>
              vs. manual: {getManualComparison(decision.disruptionType)}
            </div>
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, textAlign: "center" }}>Filing to Agent Log...</div>
        </div>
      )}
    </div>
  );
}

// Hoisted so CountdownTimer can use it outside the dashboard component
function warningToMinutes(w) {
  if (!w || w === "IMMEDIATE") return 0;
  const h = w.match(/(\d+)h/);
  const m = w.match(/(\d+)m/);
  let mins = 0;
  if (h) mins += parseInt(h[1]) * 60;
  if (m && !w.includes("h 00m")) mins += parseInt(m[1]);
  if (w === "24h") return 24 * 60;
  if (w === "48h") return 48 * 60;
  if (w === "72h") return 72 * 60;
  return mins || 9999;
}

function CountdownTimer({ advanceWarning, createdAt }) {
  const totalSeconds = advanceWarning === "IMMEDIATE" ? 0 : warningToMinutes(advanceWarning) * 60;
  // If createdAt is provided, subtract elapsed time so all timers stay in sync
  const initialSeconds = createdAt
    ? Math.max(0, totalSeconds - Math.floor((Date.now() - createdAt) / 1000))
    : totalSeconds;
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (advanceWarning === "IMMEDIATE" || totalSeconds === 0) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  if (advanceWarning === "IMMEDIATE") {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <PulsingDot color={C.red} size={6} />
        <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.red, letterSpacing: "0.04em" }}>IMMEDIATE</span>
      </span>
    );
  }

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  const isUrgent   = secondsLeft < 30 * 60;  // under 30 min
  const isCritical = secondsLeft < 10 * 60;  // under 10 min
  const isPulse    = secondsLeft < 5  * 60;  // under 5 min

  const color = isCritical ? C.red : isUrgent ? C.amber : C.amber;

  const display = h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : m > 0
    ? `${m}m ${String(s).padStart(2, "0")}s`
    : `${s}s`;

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.06em" }}>ACT WITHIN</span>
      <span style={{
        fontFamily: C.mono, fontSize: 12, fontWeight: 700, color,
        letterSpacing: "0.04em",
        animation: isPulse ? "pulseText 1s ease-in-out infinite" : "none",
      }}>
        {display}
      </span>
      {isUrgent && <PulsingDot color={color} size={5} />}
    </span>
  );
}

function CorridorRow({ label, value, valueColor, tab, hint, active, small, onNavigate, tabsRef }) {
  const [hovered, setHovered] = useState(false);
  const isClickable = active || hint;
  function handleClick() {
    onNavigate(tab);
    // If we're switching to a new tab or just need to show the tab area, scroll it into view
    if (tabsRef?.current) {
      tabsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "7px 8px", borderRadius: 5,
        cursor: isClickable ? "pointer" : "default",
        background: hovered ? `${valueColor}0d` : "transparent",
        border: `1px solid ${hovered ? valueColor + "22" : "transparent"}`,
        transition: "all 0.15s ease",
      }}
    >
      <span style={{ fontFamily: C.mono, fontSize: 9, color: hovered ? C.white : C.muted, transition: "color 0.15s ease" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {hovered && hint && (
          <span style={{ fontFamily: C.mono, fontSize: 8, color: valueColor, opacity: 0.8, animation: "fadeSlideIn 0.15s ease" }}>{hint}</span>
        )}
        <span style={{ fontFamily: C.mono, fontSize: small ? 9 : 14, fontWeight: 700, color: valueColor }}>{value}</span>
      </div>
    </div>
  );
}
function getCostAnnotation(amount, disruptionType) {
  if (!amount) return null;
  // Industry benchmarks for Lower Mississippi operations:
  // Crane gang:     ~$2,400/hr (operator + equipment + standby crew)
  // Vessel idle:    ~$8,500/hr (demurrage + crew + fuel at berth)
  // Drayage truck:  ~$180/hr   (driver + fuel + opportunity cost)
  // Tug assist:     ~$3,200/hr (tug + captain + assist crew)
  // Pilot hold:     ~$1,100/hr (pilot standby + vessel delay)
  switch (disruptionType) {
    case "FOG":
      return `≈ ${Math.round(amount / 180)} truck-hours held`;
    case "HURRICANE":
      return `≈ ${Math.round(amount / 8500)} vessel-hours at risk`;
    case "ICE":
      return `≈ ${Math.round(amount / 3200)} tug-hours standby`;
    default: // FLOOD
      if (amount >= 20000) return `≈ ${Math.round(amount / 8500)} vessel idle-hours`;
      if (amount >= 8000)  return `≈ ${Math.round(amount / 2400)} crane gang-hours`;
      return `≈ ${Math.round(amount / 2400)} crane gang-hours`;
  }
}

function DecisionCard({ decision, onConfirm, onOverride, onDismiss, onResolve, resolved = false, cardState = "pending", onStateChange }) {
  const [expanded, setExpanded] = useState(false);
  const [exiting, setExiting]   = useState(false);
  const [overrideStep, setOverrideStep] = useState("idle"); // idle | confirm | reason
  const [overrideReason, setOverrideReason] = useState("");
  const severityColor = decision.severity === "critical" ? C.red : C.amber;
  const severityBg    = decision.severity === "critical" ? C.redFaint : C.amberFaint;

  const state = cardState;
  function setState(s) { onStateChange && onStateChange(s); }

  function handleConfirm() {
    setState("executing");
  }

  function handleOverrideClick() {
    if (overrideStep === "idle") {
      setOverrideStep("confirm");
    } else if (overrideStep === "confirm") {
      setOverrideStep("reason");
    }
  }

  function handleOverrideSubmit() {
    setState("override");
    onOverride(decision);
    setOverrideStep("idle");
  }

  function handleOverrideCancel() {
    setOverrideStep("idle");
    setOverrideReason("");
  }

  // Called by ExecutionTicker when all steps complete
  function handleTickerDone() {
    setState("done");
    setExiting(true);
    setTimeout(() => onConfirm(decision), 350);
  }

  const borderColor = state === "executing" ? C.teal : state === "done" ? C.teal : severityColor;
  const bgColor     = state === "executing" ? C.tealFaint : state === "done" ? C.tealFaint : severityBg;
  const isCritical  = decision.severity === "critical" && state === "pending";

  // Who gets notified on confirm — derived from decision agents
  const recipients = [
    decision.agents.includes("RW") && "River Warden",
    decision.agents.includes("BM") && "Port Director",
    decision.agents.includes("IS") && "CN/KCS Rail",
    "Pilot Station",
  ].filter(Boolean);

  return (
    <div style={{
      border: `1px solid ${borderColor}${isCritical ? "66" : "44"}`,
      borderLeft: `${isCritical ? "4px" : "3px"} solid ${borderColor}`,
      borderRadius: 8, background: bgColor,
      transition: "all 0.5s ease, opacity 0.35s ease, transform 0.35s ease",
      opacity: exiting ? 0 : 1,
      transform: exiting ? "translateY(-6px) scale(0.98)" : "none",
      pointerEvents: exiting ? "none" : "auto",
      boxShadow: isCritical ? `0 0 0 1px ${C.red}22, 0 4px 24px ${C.red}18` : "none",
      animation: isCritical ? "criticalPulse 3s ease-in-out infinite" : "none",
    }}>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flexShrink: 0, paddingTop: 2 }}>
            {state === "done" ? <span style={{ color: C.teal, fontSize: 16 }}> </span> : <PulsingDot color={severityColor} size={10} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <Badge color={state === "done" ? C.teal : severityColor}>{state === "done" ? "CONFIRMED" : decision.severity}</Badge>
              {decision.disruptionType && (
                <span style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 700, color: C.muted, background: `${C.muted}15`, border: `1px solid ${C.muted}33`, borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em" }}>
                  {decision.disruptionType} &middot; {decision.disruptionLabel}
                </span>
              )}
              {decision.agents.map(a => <AgentBadge key={a} code={a} />)}
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.amber, marginLeft: "auto", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {state === "pending" && (
                  <CountdownTimer key={decision.id} advanceWarning={decision.advanceWarning} createdAt={decision.createdAt} />
                )}
                {(state === "done" || state === "override") && (
                  <DismissButton onDismiss={e => { e?.stopPropagation?.(); onDismiss(); }} />
                )}
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6, lineHeight: 1.3 }}>{decision.title}</div>
            <div style={{ fontSize: 12, color: C.body, lineHeight: 1.55 }}>{decision.reason}</div>

            {/* Consequence if ignored — new */}
            {state === "pending" && decision.costIfIgnored > 0 && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: C.red, opacity: 0.8 }}>
                  ⚠ If ignored: ${decision.costIfIgnored.toLocaleString()} exposure + manual coordination required
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Cost strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: `${C.muted}08`, border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.06em" }}>EST. COST AVOIDED</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.green }}>${decision.costAvoided.toLocaleString()}</span>
              {getCostAnnotation(decision.costAvoided, decision.disruptionType) && (
                <span style={{ fontFamily: C.mono, fontSize: 9, color: C.body }}>{getCostAnnotation(decision.costAvoided, decision.disruptionType)}</span>
              )}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: C.border }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.06em" }}>IF IGNORED</span>
            <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.red }}>${decision.costIfIgnored.toLocaleString()}</span>
          </div>
          <div style={{ marginLeft: "auto", fontFamily: C.mono, fontSize: 9, color: C.muted }}>
            {decision.actions.length} actions queued
          </div>
        </div>

        {state === "pending" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Override reason input — shown when in reason step */}
            {overrideStep === "reason" && (
              <div style={{ padding: "12px 14px", borderRadius: 6, background: `${C.amber}0a`, border: `1px solid ${C.amber}44`, animation: "fadeSlideIn 0.2s ease" }}>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.amber, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>
                  OVERRIDE REASON — required for MTSA audit log
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {["Conditions improving", "Already coordinating manually", "Pilot discretion", "Shore-side instruction"].map(r => (
                    <button key={r} onClick={() => setOverrideReason(r)}
                      style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${overrideReason === r ? C.amber + "88" : C.border}`, background: overrideReason === r ? `${C.amber}18` : "transparent", color: overrideReason === r ? C.amber : C.muted, fontFamily: C.mono, fontSize: 9, cursor: "pointer" }}>
                      {r}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleOverrideCancel}
                    style={{ padding: "7px 14px", borderRadius: 5, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontFamily: C.mono, fontSize: 9, cursor: "pointer" }}>
                    CANCEL
                  </button>
                  <button onClick={handleOverrideSubmit} disabled={!overrideReason}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 5, border: `1px solid ${overrideReason ? C.amber + "66" : C.border}`, background: overrideReason ? `${C.amber}15` : "transparent", color: overrideReason ? C.amber : C.muted, fontFamily: C.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", cursor: overrideReason ? "pointer" : "default" }}>
                    CONFIRM OVERRIDE
                  </button>
                </div>
              </div>
            )}

            {/* Main action row */}
            {overrideStep !== "reason" && (
              <div style={{ display: "flex", gap: 8 }}>
                {/* CONFIRM — with recipient sub-label */}
                <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 3 }}>
                  <button onClick={handleConfirm}
                    style={{ width: "100%", padding: "11px 0", borderRadius: 6, border: `1px solid ${C.teal}`, background: `${C.teal}20`, color: C.teal, fontFamily: C.mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>
                    CONFIRM &amp; DISPATCH
                  </button>
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, textAlign: "center" }}>
                    SMS → {recipients.slice(0, 3).join(" · ")}{recipients.length > 3 ? ` + ${recipients.length - 3} more` : ""}
                  </div>
                </div>

                {/* OVERRIDE — two-step, visually distinct */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                  <button onClick={handleOverrideClick}
                    style={{
                      width: "100%", padding: "11px 0", borderRadius: 6,
                      border: `1px solid ${overrideStep === "confirm" ? C.red + "88" : C.border}`,
                      background: overrideStep === "confirm" ? `${C.red}12` : "transparent",
                      color: overrideStep === "confirm" ? C.red : C.muted,
                      fontFamily: C.mono, fontSize: overrideStep === "confirm" ? 11 : 12,
                      fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}>
                    {overrideStep === "confirm" ? "CONFIRM OVERRIDE?" : "OVERRIDE"}
                  </button>
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, textAlign: "center" }}>
                    {overrideStep === "confirm" ? "Click again to proceed" : "Manual coordination required"}
                  </div>
                </div>

                {/* DETAILS */}
                <button onClick={() => setExpanded(!expanded)}
                  style={{ padding: "11px 14px", borderRadius: 6, border: `1px solid ${C.border}`, background: expanded ? `${C.teal}08` : "transparent", color: expanded ? C.teal : C.muted, fontFamily: C.mono, fontSize: 9, cursor: "pointer", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  {expanded ? "HIDE" : `${decision.actions.length} ACTIONS`}
                </button>
              </div>
            )}
          </div>
        )}
        {state === "executing" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 0" }}>
            <PulsingDot color={C.teal} size={7} />
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.teal, fontWeight: 700, letterSpacing: "0.06em" }}>DISPATCHING ALERTS...</span>
          </div>
        )}
        {state === "override" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {resolved ? (
              <div style={{ padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.green}44`, background: `${C.green}0d`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: C.green, fontSize: 14 }}>✓</span>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: C.green, letterSpacing: "0.06em" }}>MANUALLY RESOLVED</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginTop: 2 }}>Team coordination complete — MTSA audit record closed</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: "12px 14px", borderRadius: 6, border: `1px solid ${C.amber}44`, background: `${C.amber}0d` }}>
                  <div style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: "0.06em", marginBottom: 4 }}>OVERRIDE LOGGED — MANUAL ACTION REQUIRED</div>
                  {overrideReason && (
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.amber, opacity: 0.8, marginBottom: 6 }}>Reason: {overrideReason}</div>
                  )}
                  <div style={{ fontSize: 12, color: C.body, lineHeight: 1.5, marginBottom: 10 }}>Your team must manually coordinate with Port Director, Pilot Station, and CN/KCS rail. Mark resolved when complete.</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["Port Director", "Pilot Station", "CN/KCS"].map(c => (
                      <span key={c} style={{ fontFamily: C.mono, fontSize: 8, color: C.amber, background: `${C.amber}12`, border: `1px solid ${C.amber}30`, borderRadius: 3, padding: "2px 7px" }}>{c}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 5, background: `${C.red}08`, border: `1px solid ${C.red}22` }}>
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.red }}>~45 min / 20 manual calls vs. 4.8s automated</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onResolve && onResolve(decision); }}
                    style={{ padding: "8px 16px", borderRadius: 5, border: `1px solid ${C.green}55`, background: `${C.green}12`, color: C.green, fontFamily: C.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer", whiteSpace: "nowrap" }}>
                    MARK RESOLVED ✓
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {expanded && state === "pending" && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 20px", background: C.panel, animation: "fadeSlideIn 0.25s ease" }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.1em", marginBottom: 10 }}>AGENT ACTIONS QUEUED</div>
          {decision.actions.map((action, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, paddingBottom: 8, borderBottom: i < decision.actions.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: severityColor, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontSize: 12, color: C.body, lineHeight: 1.5 }}>{action}</div>
            </div>
          ))}
        </div>
      )}
      {(state === "executing" || state === "done") && <ExecutionTicker decision={decision} alreadyDone={false} onDone={handleTickerDone} />}
    </div>
  );
}

function AgentLogEntry({ entry, isFirst, isLast, autoExpand = false, entryId }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const ref = useRef(null);

  // Scenario divider — special rendering
  if (entry.severity === "divider") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: !isLast ? `1px solid ${C.border}` : "none", background: `${C.teal}06` }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 700, color: C.teal, letterSpacing: "0.1em" }}>{entry.action.replace(/──\s?/g, "").replace(/\s?──/g, "")}</span>
          <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>{entry.time}</span>
        </div>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
    );
  }

  const isConfirmed = entry.action.startsWith("CONFIRMED");
  const isOverride  = entry.severity === "override";
  const isResolved  = entry.action.startsWith("RESOLVED:");
  const isAlert     = entry.action.startsWith("ALERT:");
  const isMonitor   = entry.action.startsWith("MONITORING:") || entry.action.startsWith("RIVER WARDEN:");
  const entryColor  = isOverride  ? C.amber
    : isConfirmed   ? C.green
    : isResolved    ? C.green
    : isAlert       ? (entry.severity === "critical" ? C.red : C.amber)
    : isMonitor     ? C.teal
    : entry.severity === "critical" ? C.red
    : entry.severity === "warning"  ? C.amber
    : C.teal;

  useEffect(() => {
    if (autoExpand && ref.current) {
      // Don't scroll - tabs are sticky, navigateToTab already handles scroll position
      setExpanded(true);
    }
  }, [autoExpand]);

  return (
    <div id={entryId} ref={ref} style={{ borderBottom: !isLast ? `1px solid ${C.border}` : "none", animation: isFirst ? "fadeSlideIn 0.3s ease" : "none" }}>
      <div onClick={() => isConfirmed && setExpanded(!expanded)} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 20px", cursor: isConfirmed ? "pointer" : "default", background: expanded ? `${C.teal}06` : "transparent", transition: "background 0.2s ease" }}>
        <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, flexShrink: 0, paddingTop: 2 }}>{entry.time}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: entryColor, marginBottom: 2 }}>{entry.action}</div>
          <div style={{ fontSize: 11, color: C.body }}>{entry.cost}</div>
        </div>
        {isConfirmed && <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, flexShrink: 0, paddingTop: 2 }}>{expanded ? "  hide" : "  details"}</div>}
      </div>
      {expanded && isConfirmed && (
        <div style={{ padding: "0 20px 16px 20px", animation: "fadeSlideIn 0.2s ease" }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.1em", marginBottom: 10 }}>EXECUTION RECORD</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
            {getExecSteps(entry.disruptionType).map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 5, background: `${C.teal}0a`, border: `1px solid ${C.teal}22` }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>{step.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.white, fontWeight: 600 }}>{step.label}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{step.detail}</div>
                </div>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: C.teal, flexShrink: 0 }}>  {((i + 1) * 0.8).toFixed(1)}s</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 5, background: `${C.muted}0d`, border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>Total elapsed: 4.8s   {getExecSteps(entry.disruptionType).length} alerts dispatched   {entry.cost}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordDrawer({ record, onClose, onViewLog }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 20);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 320);
  }

  if (!record) return null;

  const isConfirm = record.type === "confirm";
  const accentColor = isConfirm ? C.teal : C.amber;
  const steps = getExecSteps(record.disruptionType);
  const typeColors = { SMS: C.teal, API: "#818cf8", OPS: C.amber, DATA: "#67e8f9", AUDIT: C.muted };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: 420,
        background: "linear-gradient(160deg,#060f0d,#030a08)",
        borderLeft: `1px solid ${accentColor}33`,
        boxShadow: `-24px 0 80px rgba(0,0,0,0.7), 0 0 0 1px ${accentColor}22`,
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
        display: "flex", flexDirection: "column",
        fontFamily: C.sans,
        overflowY: "auto",
      }}>
        {/* Top accent line */}
        <div style={{ height: 3, background: `linear-gradient(90deg,${accentColor},${accentColor}44,transparent)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${accentColor}22`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: isConfirm
                    ? `linear-gradient(135deg,#0f4547,${C.teal})`
                    : "linear-gradient(135deg,#92400e,#d97706)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 10px ${accentColor}44`,
                }}>
                  {isConfirm
                    ? <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,14 8,10 2,14" fill="white" /></svg>
                    : <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>!</span>
                  }
                </div>
                <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: "0.1em" }}>
                  {isConfirm ? "EXECUTION RECORD" : "OVERRIDE RECORD"}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.white, lineHeight: 1.35, marginBottom: 4 }}>
                {record.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{record.time}</span>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: accentColor, background: `${accentColor}15`, border: `1px solid ${accentColor}33`, borderRadius: 3, padding: "1px 6px" }}>
                  {record.disruptionType}
                </span>
                {isConfirm && (
                  <span style={{ fontFamily: C.mono, fontSize: 9, color: C.green }}>
                    ${record.costAvoided?.toLocaleString()} avoided
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontFamily: C.mono, fontSize: 11, padding: "4px 10px", borderRadius: 4, cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", flex: 1 }}>
          {isConfirm ? (
            <>
              {/* Summary strip */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "AVOIDED",  value: `$${record.costAvoided?.toLocaleString()}`, color: C.green, sub: getCostAnnotation(record.costAvoided, record.disruptionType) },
                  { label: "ELAPSED",  value: "5.3s",   color: C.teal, sub: "agent execution" },
                  { label: "ALERTS",   value: String(steps.length), color: C.teal, sub: "dispatched" },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, background: `${color}10`, border: `1px solid ${color}22`, textAlign: "center" }}>
                    <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color }}>{value}</div>
                    {sub && <div style={{ fontFamily: C.mono, fontSize: 8, color: `${color}99`, marginTop: 2 }}>{sub}</div>}
                  </div>
                ))}
              </div>

              {/* Execution steps */}
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.1em", marginBottom: 8 }}>DISPATCH LOG</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                {steps.map((step, i) => {
                  const typeColor = typeColors[step.type] || C.muted;
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "34px 1fr auto 28px", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 4, background: `${C.teal}09`, border: `1px solid ${C.teal}1a` }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, color: typeColor, background: `${typeColor}18`, border: `1px solid ${typeColor}30`, borderRadius: 3, padding: "2px 0", textAlign: "center" }}>
                        {step.type}
                      </div>
                      <div style={{ fontSize: 11, color: C.white, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.label}</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, whiteSpace: "nowrap" }}>{step.detail}</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.teal, textAlign: "right" }}>{((i + 1) * 0.8).toFixed(1)}s</div>
                    </div>
                  );
                })}
              </div>

              {/* vs manual */}
              <div style={{ padding: "8px 12px", borderRadius: 5, background: `${C.muted}0a`, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>
                  Agent execution: 5.3s   vs. manual: {getManualComparison(record.disruptionType)}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Override body */}
              <div style={{ padding: "12px 14px", borderRadius: 6, background: `${C.amber}0d`, border: `1px solid ${C.amber}33`, marginBottom: 14 }}>
                <div style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: "0.06em", marginBottom: 6 }}>
                  OVERRIDE LOGGED — MANUAL ACTION REQUIRED
                </div>
                <div style={{ fontSize: 12, color: C.body, lineHeight: 1.6 }}>
                  Automated dispatch was cancelled. Your team must manually coordinate with the Port Director, Pilot Station, and CN/KCS rail. This decision has been recorded in the MTSA audit trail.
                </div>
              </div>

              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.1em", marginBottom: 8 }}>CONTACTS REQUIRING MANUAL COORDINATION</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                {["Port Director — +1 (504) 555-0147", "Pilot Station — +1 (504) 555-0293", "CN/KCS Rail Operations", "Drayage Fleet Dispatcher"].map((contact, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 4, background: `${C.amber}08`, border: `1px solid ${C.amber}22` }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.white }}>{contact}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: "8px 12px", borderRadius: 5, background: `${C.red}08`, border: `1px solid ${C.red}22` }}>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.red }}>
                  ~45 min / 20 manual calls required   vs. 4.8s automated
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>
            MTSA audit record filed   {record.time}
          </div>
          <button
            onClick={onViewLog}
            style={{ background: "transparent", border: `1px solid ${accentColor}44`, color: accentColor, fontFamily: C.mono, fontSize: 9, padding: "4px 12px", borderRadius: 4, cursor: "pointer", letterSpacing: "0.06em" }}>
            VIEW IN AGENT LOG →
          </button>
        </div>
      </div>
    </>
  );
}

function ThreatPanel({ label, value, subtext, scenario, expanded, onClick }) {
  const [hovered, setHovered] = useState(false);
  const color = scenario.statusColor;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", cursor: "pointer",
        background: expanded ? `${color}10` : hovered ? `${color}07` : "transparent",
        transition: "background 0.15s ease",
      }}
    >
      {/* Left: dot + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <PulsingDot color={color} size={6} />
        <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color, letterSpacing: "0.08em" }}>{label}</span>
      </div>

      {/* Right: value + subtext + action pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
          <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>{subtext}</div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 7px", borderRadius: 4, flexShrink: 0,
          background: hovered || expanded ? `${color}18` : `${C.muted}10`,
          border: `1px solid ${hovered || expanded ? color + "44" : C.border}`,
          transition: "all 0.15s ease",
        }}>
          <span style={{
            fontFamily: C.mono, fontSize: 8, fontWeight: 700,
            color: hovered || expanded ? color : C.muted,
            letterSpacing: "0.04em",
            transition: "color 0.15s ease",
          }}>
            {expanded ? "CLOSE" : "SIM"}
          </span>
          <span style={{
            fontSize: 9, color: hovered || expanded ? color : C.muted,
            display: "inline-block",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease, color 0.15s ease",
          }}>∨</span>
        </div>
      </div>
    </div>
  );
}

function DismissButton({ onDismiss }) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef(null);

  function handleClick(e) {
    e?.stopPropagation?.();
    if (!confirming) {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 2500);
    } else {
      clearTimeout(timerRef.current);
      onDismiss(e);
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <button
      onClick={handleClick}
      style={{
        background: confirming ? `${C.red}18` : "transparent",
        border: `1px solid ${confirming ? C.red + "55" : C.border}`,
        color: confirming ? C.red : C.muted,
        fontFamily: C.mono, fontSize: 9,
        padding: confirming ? "2px 8px" : "2px 6px",
        borderRadius: 3, cursor: "pointer",
        letterSpacing: "0.06em",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap", flexShrink: 0,
      }}>
      {confirming ? "CONFIRM ×" : "×"}
    </button>
  );
}

function AgentLogWithFilter({ agentLog, autoExpandLogId }) {
  const [filter, setFilter] = useState("ALL");

  const filters = [
    { id: "ALL",      label: "ALL",       color: C.teal },
    { id: "ALERTS",   label: "ALERTS",    color: C.amber },
    { id: "CONFIRMED",label: "CONFIRMED", color: C.green },
    { id: "OVERRIDES",label: "OVERRIDES", color: C.amber },
    { id: "MONITOR",  label: "MONITOR",   color: C.teal },
  ];

  const filtered = agentLog.filter(entry => {
    if (filter === "ALL") return true;
    if (entry.severity === "divider") return filter === "ALL";
    const isConfirmed = entry.action.startsWith("CONFIRMED") || entry.action.startsWith("RESOLVED:");
    const isOverride  = entry.severity === "override";
    const isAlert     = entry.severity === "critical" || entry.severity === "warning";
    const isMonitor   = entry.severity === "ok";
    if (filter === "CONFIRMED") return isConfirmed;
    if (filter === "OVERRIDES") return isOverride;
    if (filter === "ALERTS")    return isAlert && !isConfirmed && !isOverride;
    if (filter === "MONITOR")   return isMonitor;
    return true;
  });

  return (
    <>
      {/* Filter chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginRight: 4 }}>FILTER</span>
        {filters.map(f => {
          const active = filter === f.id;
          // Count entries for this filter
          const count = f.id === "ALL" ? agentLog.filter(e => e.severity !== "divider").length
            : agentLog.filter(e => {
                if (e.severity === "divider") return false;
                const isConf = e.action.startsWith("CONFIRMED") || e.action.startsWith("RESOLVED:");
                const isOv   = e.severity === "override";
                const isAl   = (e.severity === "critical" || e.severity === "warning") && !isConf && !isOv;
                const isMon  = e.severity === "ok";
                if (f.id === "CONFIRMED") return isConf;
                if (f.id === "OVERRIDES") return isOv;
                if (f.id === "ALERTS")    return isAl;
                if (f.id === "MONITOR")   return isMon;
                return false;
              }).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 4, cursor: "pointer",
                fontFamily: C.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                border: `1px solid ${active ? f.color + "66" : C.border}`,
                background: active ? `${f.color}18` : "transparent",
                color: active ? f.color : C.muted,
                transition: "all 0.15s ease",
              }}>
              {f.label}
              {count > 0 && (
                <span style={{ fontFamily: C.mono, fontSize: 8, color: active ? f.color : C.muted, background: active ? `${f.color}20` : `${C.muted}15`, borderRadius: 3, padding: "0 4px" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Log entries */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", fontFamily: C.mono, fontSize: 11, color: C.muted }}>
            No {filter.toLowerCase()} entries yet
          </div>
        ) : (
          filtered.map((entry, i) => (
            <AgentLogEntry key={entry.id || i} entry={entry} isFirst={i === 0} isLast={i === filtered.length - 1}
              entryId={entry.id} autoExpand={entry.id === autoExpandLogId} />
          ))
        )}
      </div>
    </>
  );
}

function ImpactStatCard({ label, value, color, sub, methodology, source }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
        <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.label }}>{sub}</div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ fontFamily: C.mono, fontSize: 8, color: color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 3, padding: "2px 7px", cursor: "pointer", letterSpacing: "0.04em", flexShrink: 0 }}>
            {expanded ? "HIDE" : "HOW?"}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "10px 14px 12px", borderTop: `1px solid ${C.border}`, background: `${color}06`, animation: "fadeSlideIn 0.2s ease" }}>
          <div style={{ fontSize: 11, color: C.body, lineHeight: 1.6, marginBottom: source ? 8 : 0 }}>{methodology}</div>
          {source && (
            <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, lineHeight: 1.5 }}>
              <span style={{ color: C.teal }}>SOURCE</span>  ·  {source}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DeltaAgentDashboard() {
  //    All four threat simulators run simultaneously   
  const [gaugeData, setGaugeData]   = useState(null);
  const [simGauge, setSimGauge]     = useState(4.4);
  const [floodScenario, setFloodScenario] = useState(() => buildFloodScenario(4.4));

  const [fogData, setFogData]       = useState(null);
  const [simVis, setSimVis]         = useState(8.0);
  const [fogScenario, setFogScenario] = useState(() => buildFogScenario(8.0));

  const [simIce, setSimIce]         = useState(0);
  const [iceScenario, setIceScenario] = useState(() => buildIceScenario(0));

  const [nhcData, setNhcData]       = useState(null);
  const [simStormDist, setSimStormDist] = useState(1000);
  const [simStormCat, setSimStormCat]   = useState(2);
  const [stormScenario, setStormScenario] = useState(() => buildHurricaneScenario(1000, 2));

  const [aisData, setAisData]       = useState(null);  // { vessels: [], simulated: bool }
  const [windData, setWindData]     = useState(null);  // { wind: { speedKnots, directionCompass, status, color } }

  //    shared UI state   
  const [time, setTime]                   = useState(new Date());
  const [showBanner, setShowBanner]       = useState(true);
  const [guidedDemo, setGuidedDemo]       = useState(false);
  const [guidedStep, setGuidedStep]       = useState(0);
  const [smsQueue, setSmsQueue]           = useState([]);
  const [overrideQueue, setOverrideQueue] = useState([]);
  const [activeTab, setActiveTab]         = useState("inbox");
  const [confirmedIds, setConfirmedIds]   = useState(new Set());
  const [overriddenIds, setOverriddenIds] = useState(new Set());
  // Refs so syncDecisions effects always see the latest values
  const confirmedIdsRef  = useRef(confirmedIds);
  const overriddenIdsRef = useRef(overriddenIds);
  useEffect(() => { confirmedIdsRef.current  = confirmedIds;  }, [confirmedIds]);
  useEffect(() => { overriddenIdsRef.current = overriddenIds; }, [overriddenIds]);
  const [dismissedIds, setDismissedIds]   = useState(new Set());
  const [cardStates, setCardStates]       = useState({}); // persists executing/done/override per card id
  const [alertedIds, setAlertedIds]       = useState(new Set()); // tracks which decisions have fired alert SMS
  const [resolvedIds, setResolvedIds]     = useState(new Set()); // tracks manually resolved overrides
  const [autoExpandLogId, setAutoExpandLogId] = useState(null);
  const [sessionSavings, setSessionSavings]   = useState([]);
  const [drawerRecord, setDrawerRecord]       = useState(null);
  const [expandedThreat, setExpandedThreat]   = useState(null);
  const tabsRef = useRef(null);

  function navigateToTab(tabId, logId) {
    setActiveTab(tabId);
    setAutoExpandLogId(logId || null);
  }
  const [agentLog, setAgentLog] = useState([
    { id: "bg1", time: "05:14:22", action: "MONITORING: Carrollton Gauge polled",     cost: "Stage 0.7ft   Nominal   No action required",      severity: "ok" },
    { id: "bg2", time: "05:00:00", action: "MONITORING: AIS vessel position updated", cost: "MV Delta Voyager   ETA Southwest Pass 04:20 CST", severity: "ok" },
    { id: "bg3", time: "04:45:11", action: "MONITORING: CN/KCS rail status checked",  cost: "14 intermodal cars staged   Yard 3   On schedule", severity: "ok" },
    { id: "bg4", time: "04:30:00", action: "MONITORING: Berth schedule reviewed",     cost: "Berth 2 nominal   Crane gang confirmed",           severity: "ok" },
  ]);

  //    Merge all active decisions from all threat types into one unified inbox   
  // Decision store — accumulates decisions as thresholds are crossed
  // Triggered by status string changes (discrete) not array references (unstable)
  // Each threshold band has unique IDs (flood-al-d1, flood-hw-d1 etc.)
  const [decisionStore, setDecisionStore] = useState({});

  // Flood band severity order — used to determine which bands are "above" current level
  const FLOOD_BAND_ORDER = ["nm", "lw", "al", "hw", "bw", "cr", "fs"];

  function floodBandIndex(key) {
    return FLOOD_BAND_ORDER.indexOf(key);
  }

  // Single atomic store update: prune IDs above currentIdx for typePrefix, then add incoming
  function pruneAndAdd(typePrefix, order, currentKey, incoming) {
    const currentIdx = order.indexOf(currentKey);
    setDecisionStore(prev => {
      const next = { ...prev };
      let changed = false;

      // Prune pending decisions above current band for this type
      Object.keys(next).forEach(id => {
        if (!id.startsWith(typePrefix)) return;
        const isActioned = confirmedIdsRef.current.has(id) || overriddenIdsRef.current.has(id);
        if (isActioned) return;
        const bandKey = id.split("-")[1];
        if (order.indexOf(bandKey) > currentIdx) {
          delete next[id];
          changed = true;
        }
      });

      // Add new decisions from current band — stamp createdAt for live countdown
      incoming.forEach(d => {
        if (!next[d.id]) { next[d.id] = { ...d, createdAt: Date.now() }; changed = true; }
      });

      return changed ? next : prev;
    });
  }

  // Add-only (no prune) — used when moving up
  function addDecisions(incoming) {
    if (!incoming.length) return;
    setDecisionStore(prev => {
      const next = { ...prev };
      let changed = false;
      incoming.forEach(d => {
        if (!next[d.id]) { next[d.id] = { ...d, createdAt: Date.now() }; changed = true; }
      });
      return changed ? next : prev;
    });
  }

  // Flood
  const prevFloodBandRef = useRef("nm");
  useEffect(() => {
    const currentKey = floodScenario.scenarioKey;
    // Treat nm and lw as "non-escalating" — prune all pending flood on either
    if (!currentKey || currentKey === "nm" || currentKey === "lw") {
      const isChanging = prevFloodBandRef.current !== currentKey;
      if (isChanging) {
        pruneAndAdd("flood-", FLOOD_BAND_ORDER, "nm", floodScenario.decisions);
        prevFloodBandRef.current = currentKey || "nm";
      }
      return;
    }
    const prevKey = prevFloodBandRef.current;
    if (currentKey === prevKey) return;
    prevFloodBandRef.current = currentKey;
    const currentIdx = floodBandIndex(currentKey);
    const prevIdx    = floodBandIndex(prevKey);
    if (currentIdx > prevIdx) {
      addDecisions(floodScenario.decisions);
    } else {
      pruneAndAdd("flood-", FLOOD_BAND_ORDER, currentKey, floodScenario.decisions);
    }
  }, [floodScenario.scenarioKey]);

  const FOG_BAND_ORDER   = ["nm", "ca", "rs", "cr", "zz"];
  const ICE_BAND_ORDER   = ["nm", "tr", "im", "hv", "sv"];
  const STORM_BAND_ORDER = ["nm", "wh", "xr", "ya", "zu"];

  function bandIndex(order, key) { return order.indexOf(key); }

  // Fog
  const prevFogBandRef = useRef("nm");
  useEffect(() => {
    const currentKey = fogScenario.fogBandKey;
    if (!currentKey || currentKey === "nm") {
      if (prevFogBandRef.current !== "nm") {
        pruneAndAdd("fog-", FOG_BAND_ORDER, "nm", []);
        prevFogBandRef.current = "nm";
      }
      return;
    }
    const prevKey = prevFogBandRef.current;
    if (currentKey === prevKey) return;
    prevFogBandRef.current = currentKey;
    const currentIdx = bandIndex(FOG_BAND_ORDER, currentKey);
    const prevIdx    = bandIndex(FOG_BAND_ORDER, prevKey);
    if (currentIdx > prevIdx) {
      addDecisions(fogScenario.decisions);
    } else {
      pruneAndAdd("fog-", FOG_BAND_ORDER, currentKey, fogScenario.decisions);
    }
  }, [fogScenario.fogBandKey]);

  // Ice
  const prevIceBandRef = useRef("nm");
  useEffect(() => {
    const currentKey = iceScenario.iceBandKey;
    if (!currentKey || currentKey === "nm") {
      if (prevIceBandRef.current !== "nm") {
        pruneAndAdd("ice-", ICE_BAND_ORDER, "nm", []);
        prevIceBandRef.current = "nm";
      }
      return;
    }
    const prevKey = prevIceBandRef.current;
    if (currentKey === prevKey) return;
    prevIceBandRef.current = currentKey;
    const currentIdx = bandIndex(ICE_BAND_ORDER, currentKey);
    const prevIdx    = bandIndex(ICE_BAND_ORDER, prevKey);
    if (currentIdx > prevIdx) {
      addDecisions(iceScenario.decisions);
    } else {
      pruneAndAdd("ice-", ICE_BAND_ORDER, currentKey, iceScenario.decisions);
    }
  }, [iceScenario.iceBandKey]);

  // Hurricane
  const prevStormBandRef = useRef("nm");
  useEffect(() => {
    const currentKey = stormScenario.stormBandKey;
    if (!currentKey || currentKey === "nm") {
      if (prevStormBandRef.current !== "nm") {
        pruneAndAdd("storm-", STORM_BAND_ORDER, "nm", []);
        prevStormBandRef.current = "nm";
      }
      return;
    }
    const prevKey = prevStormBandRef.current;
    if (currentKey === prevKey) return;
    prevStormBandRef.current = currentKey;
    const currentIdx = bandIndex(STORM_BAND_ORDER, currentKey);
    const prevIdx    = bandIndex(STORM_BAND_ORDER, prevKey);
    if (currentIdx > prevIdx) {
      addDecisions(stormScenario.decisions);
    } else {
      pruneAndAdd("storm-", STORM_BAND_ORDER, currentKey, stormScenario.decisions);
    }
  }, [stormScenario.stormBandKey]);

  const allDecisions = Object.values(decisionStore);

  // Sort by time urgency - least time to act goes first (real operational priority)
  // IMMEDIATE and shortest windows bubble to top regardless of severity
  const sortedDecisions = [...allDecisions].sort((a, b) => {
    const aMin = warningToMinutes(a.advanceWarning);
    const bMin = warningToMinutes(b.advanceWarning);
    return aMin - bMin;
  });

  const pendingDecisions  = sortedDecisions.filter(d => !confirmedIds.has(d.id) && !overriddenIds.has(d.id));
  const actionedDecisions = sortedDecisions.filter(d => confirmedIds.has(d.id) || overriddenIds.has(d.id));
  const pendingCount      = pendingDecisions.length;

  // Fire alert SMS when new decisions arrive in inbox (not yet alerted, not actioned)
  useEffect(() => {
    const gaugeContext = {
      ft:   simGauge.toFixed(1),
      vis:  simVis.toFixed(2),
      ice:  simIce.toFixed(1),
      dist: simStormDist,
      cat:  simStormCat,
    };
    pendingDecisions.forEach(decision => {
      if (!alertedIds.has(decision.id)) {
        setAlertedIds(prev => new Set([...prev, decision.id]));
        fetch("/api/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, gaugeContext, mode: "alert" }),
        }).catch(() => {});
        // Log the alert generation in agent log
        const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" });
        setAgentLog(prev => [{
          id: `alert-${decision.id}-${Date.now()}`,
          time: ts,
          action: `ALERT: ${decision.title}`,
          cost: `${decision.disruptionType} threshold crossed   ACT WITHIN ${decision.advanceWarning}   $${decision.costAvoided.toLocaleString()} at risk`,
          severity: decision.severity,
          disruptionType: decision.disruptionType,
        }, ...prev]);
      }
    });
  }, [pendingDecisions.map(d => d.id).join(",")]);

  // Log threshold crossings - refs initialized to NOMINAL so any crossing gets logged
  const prevFloodStatus = useRef("NOMINAL");
  const prevFogStatus   = useRef("NOMINAL");
  const prevIceStatus   = useRef("NOMINAL");
  const prevStormStatus = useRef("NOMINAL");

  function logEntry(entry) {
    setAgentLog(prev => [entry, ...prev]);
  }

  function nowTS() {
    return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" });
  }

  useEffect(() => {
    const prev = prevFloodStatus.current;
    if (floodScenario.status === prev) return;
    prevFloodStatus.current = floodScenario.status;
    const crossed = floodScenario.status !== "NOMINAL";
    logEntry({
      id: `flood-${Date.now()}`,
      time: nowTS(),
      action: `RIVER WARDEN: Carrollton Gauge - ${prev} - ${floodScenario.status}`,
      cost: `${simGauge.toFixed(1)}ft   ${crossed ? floodScenario.decisions[0]?.disruptionLabel || floodScenario.status : "All clear - no action required"}`,
      severity: crossed ? "warning" : "ok",
      disruptionType: "FLOOD",
    });
  }, [floodScenario.status]);

  useEffect(() => {
    const prev = prevFogStatus.current;
    if (fogScenario.status === prev) return;
    prevFogStatus.current = fogScenario.status;
    const crossed = fogScenario.status !== "NOMINAL";
    logEntry({
      id: `fog-${Date.now()}`,
      time: nowTS(),
      action: `RIVER WARDEN: SW Pass Visibility - ${prev} - ${fogScenario.status}`,
      cost: `${simVis.toFixed(2)}nm   ${crossed ? fogScenario.decisions[0]?.disruptionLabel || fogScenario.status : "Visibility clear - no restriction"}`,
      severity: crossed ? "warning" : "ok",
      disruptionType: "FOG",
    });
  }, [fogScenario.status]);

  useEffect(() => {
    const prev = prevIceStatus.current;
    if (iceScenario.status === prev) return;
    prevIceStatus.current = iceScenario.status;
    const crossed = iceScenario.status !== "NOMINAL";
    logEntry({
      id: `ice-${Date.now()}`,
      time: nowTS(),
      action: `RIVER WARDEN: LMR Ice Coverage - ${prev} - ${iceScenario.status}`,
      cost: `${(simIce * 10).toFixed(0)}% coverage   ${crossed ? iceScenario.decisions[0]?.disruptionLabel || iceScenario.status : "No ice restriction"}`,
      severity: crossed ? "warning" : "ok",
      disruptionType: "ICE",
    });
  }, [iceScenario.status]);

  useEffect(() => {
    const prev = prevStormStatus.current;
    if (stormScenario.status === prev) return;
    prevStormStatus.current = stormScenario.status;
    const crossed = stormScenario.status !== "NOMINAL";
    logEntry({
      id: `storm-${Date.now()}`,
      time: nowTS(),
      action: `RIVER WARDEN: Hurricane Track - ${prev} - ${stormScenario.status}`,
      cost: `${simStormDist}mi from SW Pass   Port Condition ${stormScenario.portCondition}   ${crossed ? "Action required" : "No threat"}`,
      severity: crossed ? "warning" : "ok",
      disruptionType: "HURRICANE",
    });
  }, [stormScenario.status]);

  // Overall corridor status - worst active threat drives the header
  const allStatuses = [floodScenario, fogScenario, iceScenario, stormScenario];
  const hasCritical = allStatuses.some(s => s.status === "CRITICAL");
  const hasElevated = allStatuses.some(s => s.status === "ELEVATED");
  const corridorStatus      = hasCritical ? "CRITICAL" : hasElevated ? "ELEVATED" : "NOMINAL";
  const corridorStatusColor = hasCritical ? C.red : hasElevated ? C.amber : C.teal;

  // Pending count color — driven by worst severity among actual pending decisions
  // This stays accurate even during store transitions
  const pendingHasCritical = pendingDecisions.some(d => d.severity === "critical");
  const pendingHasWarning  = pendingDecisions.some(d => d.severity === "warning");
  const pendingCountColor  = pendingCount === 0 ? C.muted
    : pendingHasCritical ? C.red
    : pendingHasWarning  ? C.amber
    : C.teal;

  const sessionTotal     = sessionSavings.reduce((s, x) => s + x.amount, 0);
  const confirmedSavings = sortedDecisions.filter(d => confirmedIds.has(d.id)).reduce((s, d) => s + d.costAvoided, 0);
  const pendingSavings   = pendingDecisions.reduce((s, d) => s + d.costAvoided, 0);
  const totalSavings     = confirmedSavings + pendingSavings;

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(NOAA_URL).then(r => r.json()).then(d => {
      const readings = d?.data;
      if (readings?.length) {
        const latest = parseFloat(readings[readings.length - 1].v);
        if (!isNaN(latest)) { const v = Math.max(0, latest); setGaugeData(v); setSimGauge(v); setFloodScenario(buildFloodScenario(v)); }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(NDBC_FOG_URL).then(r => r.json()).then(d => {
      const vis = d?.vis;
      if (vis !== null && !isNaN(vis) && vis > 0) {
        setFogData(vis);
        setSimVis(vis);
        setFogScenario(buildFogScenario(vis));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(NHC_URL).then(r => r.json()).then(d => {
      if (d?.activeStorms?.length) setNhcData(d.activeStorms[0]);
    }).catch(() => {});
  }, []);

  // AIS vessel positions — poll every 90 seconds
  useEffect(() => {
    function fetchAIS() {
      fetch(AIS_URL).then(r => r.json()).then(d => {
        if (d?.ok) setAisData(d);
      }).catch(() => {});
    }
    fetchAIS();
    const t = setInterval(fetchAIS, 90 * 1000);
    return () => clearInterval(t);
  }, []);

  // Wind observations — poll every 5 minutes (NWS updates ~hourly)
  useEffect(() => {
    function fetchWind() {
      fetch(WIND_URL).then(r => r.json()).then(d => {
        if (d?.ok) setWindData(d);
      }).catch(() => {});
    }
    fetchWind();
    const t = setInterval(fetchWind, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Guided demo automation - walks through Algiers Point flood scenario
  const guidedSteps = [
    { label: "Monitoring nominal conditions...", duration: 1500, action: () => {} },
    { label: "Simulating rising river stage...", duration: 2000, action: () => { setSimGauge(5.0); setFloodScenario(buildFloodScenario(5.0)); } },
    { label: "River approaching Algiers Point threshold...", duration: 2000, action: () => { setSimGauge(7.2); setFloodScenario(buildFloodScenario(7.2)); } },
    { label: "Algiers Point restriction triggered!", duration: 2500, action: () => { setSimGauge(8.3); setFloodScenario(buildFloodScenario(8.3)); setActiveTab("inbox"); } },
    { label: "Adding fog advisory...", duration: 2000, action: () => { const v = 0.8; setSimVis(v); setFogScenario(buildFogScenario(v)); } },
    { label: "Review decisions in inbox and hit CONFIRM & DISPATCH", duration: 99999, action: () => {} },
  ];

  useEffect(() => {
    if (!guidedDemo) return;
    if (guidedStep >= guidedSteps.length) { setGuidedDemo(false); setGuidedStep(0); return; }
    guidedSteps[guidedStep].action();
    const timer = setTimeout(() => setGuidedStep(s => s + 1), guidedSteps[guidedStep].duration);
    return () => clearTimeout(timer);
  }, [guidedDemo, guidedStep]);

  function handleConfirm(decision) {
    const logId = `log-${decision.id}-${Date.now()}`;
    setConfirmedIds(prev => new Set([...prev, decision.id]));
    setSmsQueue(q => [...q, { ...decision, ft: simGauge, id: Date.now(), logId }]);
    const ts = new Date();
    setSessionSavings(prev => [...prev, {
      title: decision.title, amount: decision.costAvoided, severity: decision.severity,
      gauge: simGauge, agents: decision.agents, disruptionType: decision.disruptionType,
      time: ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" }),
    }]);

    // Send dispatch confirmation SMS
    const gaugeContext = {
      ft:   simGauge.toFixed(1),
      vis:  simVis.toFixed(2),
      ice:  simIce.toFixed(1),
      dist: simStormDist,
      cat:  simStormCat,
    };
    fetch("/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, gaugeContext, mode: "dispatch" }),
    })
    .then(r => r.json())
    .then(result => {
      const note = result.success
        ? `${result.dispatched} SMS dispatched   $${decision.costAvoided.toLocaleString()} cost avoidance logged`
        : `SMS dispatch failed   Manual notification required`;
      setAgentLog(prev => [{
        id: logId,
        time: ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
        action: `CONFIRMED + DISPATCHED: ${decision.title}`,
        cost: note,
        severity: decision.severity, disruptionType: decision.disruptionType,
      }, ...prev]);
    })
    .catch(() => {
      setAgentLog(prev => [{
        id: logId,
        time: ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
        action: `CONFIRMED: ${decision.title}`,
        cost: `$${decision.costAvoided.toLocaleString()} cost avoidance logged   SMS offline`,
        severity: decision.severity, disruptionType: decision.disruptionType,
      }, ...prev]);
    });
  }

  function handleOverride(decision) {
    setOverriddenIds(prev => new Set([...prev, decision.id]));
    setOverrideQueue(q => [...q, { ...decision, ft: simGauge, id: Date.now() }]);
    setAgentLog(prev => [{
      id: `override-${decision.id}`,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
      action: `OVERRIDE: ${decision.title}`,
      cost: "Automated dispatch cancelled   Manual coordination required   Logged for MTSA audit",
      severity: "override", disruptionType: decision.disruptionType,
    }, ...prev]);
  }

  function handleResolve(decision) {
    setResolvedIds(prev => new Set([...prev, decision.id]));
    setAgentLog(prev => [{
      id: `resolved-${decision.id}-${Date.now()}`,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
      action: `RESOLVED: ${decision.title}`,
      cost: "Manual coordination complete   Team confirmed   MTSA audit record closed",
      severity: "ok", disruptionType: decision.disruptionType,
    }, ...prev]);
  }

  function handleReset() {
    setShowBanner(true);
    setSimGauge(4.4); setFloodScenario(buildFloodScenario(4.4));
    setSimVis(8.0);   setFogScenario(buildFogScenario(8.0));
    setSimIce(0);     setIceScenario(buildIceScenario(0));
    setSimStormDist(1000); setSimStormCat(2); setStormScenario(buildHurricaneScenario(1000, 2));
    setConfirmedIds(new Set()); setOverriddenIds(new Set()); setResolvedIds(new Set()); setDecisionStore({});
    setAlertedIds(new Set()); setDismissedIds(new Set()); setCardStates({});
    setSessionSavings([]); setDecisionStore({}); setAgentLog([
      { id: "bg1", time: "05:14:22", action: "MONITORING: Carrollton Gauge polled",     cost: "Stage 0.7ft   Nominal   No action required",      severity: "ok" },
      { id: "bg2", time: "05:00:00", action: "MONITORING: AIS vessel position updated", cost: "MV Delta Voyager   ETA Southwest Pass 04:20 CST", severity: "ok" },
      { id: "bg3", time: "04:45:11", action: "MONITORING: CN/KCS rail status checked",  cost: "14 intermodal cars staged   Yard 3   On schedule", severity: "ok" },
      { id: "bg4", time: "04:30:00", action: "MONITORING: Berth schedule reviewed",     cost: "Berth 2 nominal   Crane gang confirmed",           severity: "ok" },
    ]);
    // Reset band tracking refs so scenario restarts cleanly
    prevFloodBandRef.current  = "nm";
    prevFogBandRef.current    = "nm";
    prevIceBandRef.current    = "nm";
    prevStormBandRef.current  = "nm";
    setActiveTab("inbox");
    setSmsQueue([]); setOverrideQueue([]);
  }

  // Threat type color lookup for badges
  const threatColor = { FLOOD: C.red, FOG: C.teal, ICE: "#93c5fd", HURRICANE: "#a78bfa" };

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
        @keyframes pulseText { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes criticalPulse { 0%,100% { box-shadow: 0 0 0 1px rgba(220,38,38,0.13), 0 4px 24px rgba(220,38,38,0.09); } 50% { box-shadow: 0 0 0 1px rgba(220,38,38,0.27), 0 4px 32px rgba(220,38,38,0.19); } }
        @keyframes tooltipFadeIn { from { opacity: 0; } to { opacity: 1; } }
        button:hover { filter: brightness(1.15); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.borderHi}; border-radius: 2px; }
        @media (max-width: 640px) { .hero-grid { grid-template-columns: 1fr !important; } .hide-sm { display: none !important; } }
      `}</style>

      {drawerRecord && (
        <RecordDrawer
          record={drawerRecord}
          onClose={() => setDrawerRecord(null)}
          onViewLog={() => { setDrawerRecord(null); navigateToTab("log"); }}
        />
      )}

      {smsQueue.map(sms => (
        <SMSNotification key={sms.id} decision={sms} onClose={() => removeSms(sms.id)}
          onClick={() => setDrawerRecord({
            type: "confirm",
            title: sms.title,
            time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" }),
            disruptionType: sms.disruptionType,
            costAvoided: sms.costAvoided,
            ft: sms.ft,
          })} />
      ))}
      {overrideQueue.map(ov => (
        <OverrideNotification key={ov.id} decision={ov} onClose={() => setOverrideQueue(q => q.filter(o => o.id !== ov.id))}
          onClick={() => {
            setOverrideQueue(q => q.filter(o => o.id !== ov.id));
            setDrawerRecord({
              type: "override",
              title: ov.title,
              time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" }),
              disruptionType: ov.disruptionType,
              costAvoided: ov.costAvoided,
            });
          }} />
      ))}

      <div style={{ minHeight: "100vh", background: C.bg, color: C.white, fontFamily: C.sans, position: "relative" }}>
        <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(${C.border}44 1px,transparent 1px),linear-gradient(90deg,${C.border}44 1px,transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0, opacity: 0.6 }} />
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 100, background: `linear-gradient(to bottom,transparent,${C.teal}05,transparent)`, pointerEvents: "none", zIndex: 1, animation: "scanline 10s linear infinite" }} />

        <div style={{ position: "relative", zIndex: 2, paddingBottom: 40 }}>
          {/*    HEADER    */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", borderBottom: `1px solid ${C.border}`, background: `${C.panel}f0`, backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                <polygon points="16,3 30,28 2,28" fill="none" stroke={C.teal} strokeWidth="2" strokeLinejoin="round"/>
                <line x1="9" y1="28" x2="23" y2="28" stroke={C.teal} strokeWidth="2" strokeLinecap="round"/>
                <circle cx="16" cy="18" r="2.5" fill={C.teal}/>
              </svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.06em" }}>DELTAAGENT<span style={{ color: C.teal }}> AI</span></div>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.12em" }}>OPERATIONS COMMAND   BETA</div>
              </div>
              <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
                <CredentialChip
                  label="TWIC"
                  color={C.teal}
                  title="TWIC-Cleared Founders"
                  detail="Transportation Worker Identification Credential — federal TSA background clearance required for unescorted access to all US maritime terminals and port facilities."
                />
                <CredentialChip
                  label="MTSA"
                  color={C.tealDim}
                  title="MTSA Aligned"
                  detail="Maritime Transportation Security Act — all agent decision logs, dispatch records, and override audits are structured for MTSA compliance and Coast Guard record-keeping."
                />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={handleReset}
                style={{ padding: "5px 12px", borderRadius: 5, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontFamily: C.mono, fontSize: 9, cursor: "pointer", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 11 }}>↺</span> NEW SCENARIO
              </button>
              <div onClick={() => pendingCount > 0 && navigateToTab("inbox")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: pendingCount > 0 ? `${pendingCountColor}18` : `${C.teal}10`, border: `1px solid ${pendingCount > 0 ? pendingCountColor + "55" : C.teal + "33"}`, animation: pendingCount > 0 ? "pulseGlow 2s ease-in-out infinite" : "none", cursor: pendingCount > 0 ? "pointer" : "default" }}>
                <PulsingDot color={pendingCount > 0 ? pendingCountColor : C.teal} size={7} />
                <span style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: pendingCount > 0 ? pendingCountColor : C.teal, letterSpacing: "0.08em" }}>
                  {pendingCount > 0 ? `${corridorStatus}   ${pendingCount} PENDING` : corridorStatus}
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

          {/* SCENARIO SELECTOR BANNER */}
          {showBanner && (
            <div style={{ background: `linear-gradient(135deg, ${C.teal}10 0%, ${C.panel} 100%)`, borderBottom: `1px solid ${C.teal}33`, padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: C.teal, letterSpacing: "0.1em", marginBottom: 6 }}>
                    OPERATIONS SIMULATOR — LOWER MISSISSIPPI CORRIDOR
                  </div>
                  <div style={{ fontSize: 14, color: C.body }}>
                    Select a real scenario to see DeltaAgent respond autonomously — or explore freely.
                  </div>
                </div>
                <button onClick={() => setShowBanner(false)}
                  style={{ padding: "7px 14px", borderRadius: 5, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontFamily: C.mono, fontSize: 10, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  EXPLORE FREELY
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  {
                    icon: "🌊",
                    label: "HIGH WATER EVENT",
                    sublabel: "Carrollton Gauge — 11.4ft",
                    description: "High Water Proclamation triggered. Barge fleeting restrictions, daylight mooring orders, and CN/KCS rail re-sequencing required.",
                    color: C.red,
                    action: () => {
                      const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" });
                      setShowBanner(false);
                      setSimGauge(11.4); setFloodScenario(buildFloodScenario(11.4));
                      setSimVis(8.0); setFogScenario(buildFogScenario(8.0));
                      setSimIce(0); setIceScenario(buildIceScenario(0));
                      setSimStormDist(1000); setStormScenario(buildHurricaneScenario(1000, 2));
                      setConfirmedIds(new Set()); setOverriddenIds(new Set()); setDecisionStore({});
                      setAlertedIds(new Set()); setDismissedIds(new Set()); setCardStates({});
                      setAgentLog([
                        { id: `scenario-${Date.now()}`, time: ts, action: "── SCENARIO: HIGH WATER EVENT ──", cost: "Carrollton Gauge 11.4ft   High Water Proclamation threshold", severity: "divider" },
                        { id: "bg1", time: "05:14:22", action: "MONITORING: Carrollton Gauge polled", cost: "Stage 0.7ft   Nominal   No action required", severity: "ok" },
                        { id: "bg2", time: "05:00:00", action: "MONITORING: AIS vessel position updated", cost: "MV Delta Voyager   ETA Southwest Pass 04:20 CST", severity: "ok" },
                        { id: "bg3", time: "04:45:11", action: "MONITORING: CN/KCS rail status checked", cost: "14 intermodal cars staged   Yard 3   On schedule", severity: "ok" },
                        { id: "bg4", time: "04:30:00", action: "MONITORING: Berth schedule reviewed", cost: "Berth 2 nominal   Crane gang confirmed", severity: "ok" },
                      ]);
                      setActiveTab("inbox");
                      prevFloodBandRef.current  = "nm";
                      prevFogBandRef.current    = "nm";
                      prevIceBandRef.current    = "nm";
                      prevStormBandRef.current  = "nm";
                    },
                  },
                  {
                    icon: "🌫️",
                    label: "DENSE FOG ADVISORY",
                    sublabel: "SW Pass Visibility — 0.3nm",
                    description: "Critical visibility at Southwest Pass. One-way traffic restrictions, pilot boarding suspended, 22 drayage trucks on hold.",
                    color: C.teal,
                    action: () => {
                      const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" });
                      setShowBanner(false);
                      setSimGauge(4.4); setFloodScenario(buildFloodScenario(4.4));
                      setSimVis(0.3); setFogScenario(buildFogScenario(0.3));
                      setSimIce(0); setIceScenario(buildIceScenario(0));
                      setSimStormDist(1000); setStormScenario(buildHurricaneScenario(1000, 2));
                      setConfirmedIds(new Set()); setOverriddenIds(new Set()); setDecisionStore({});
                      setAlertedIds(new Set()); setDismissedIds(new Set()); setCardStates({});
                      setAgentLog([
                        { id: `scenario-${Date.now()}`, time: ts, action: "── SCENARIO: DENSE FOG ADVISORY ──", cost: "SW Pass Visibility 0.3nm   Critical threshold", severity: "divider" },
                        { id: "bg1", time: "05:14:22", action: "MONITORING: Carrollton Gauge polled", cost: "Stage 0.7ft   Nominal   No action required", severity: "ok" },
                        { id: "bg2", time: "05:00:00", action: "MONITORING: AIS vessel position updated", cost: "MV Delta Voyager   ETA Southwest Pass 04:20 CST", severity: "ok" },
                        { id: "bg3", time: "04:45:11", action: "MONITORING: CN/KCS rail status checked", cost: "14 intermodal cars staged   Yard 3   On schedule", severity: "ok" },
                        { id: "bg4", time: "04:30:00", action: "MONITORING: Berth schedule reviewed", cost: "Berth 2 nominal   Crane gang confirmed", severity: "ok" },
                      ]);
                      setActiveTab("inbox");
                      prevFloodBandRef.current  = "nm";
                      prevFogBandRef.current    = "nm";
                      prevIceBandRef.current    = "nm";
                      prevStormBandRef.current  = "nm";
                    },
                  },
                  {
                    icon: "🌀",
                    label: "HURRICANE APPROACH",
                    sublabel: "Cat 2 — 320mi from SW Pass",
                    description: "Port Condition YANKEE imminent. Inbound traffic closure, storm mooring plan verification, RNA enforcement required.",
                    color: "#a78bfa",
                    action: () => {
                      setShowBanner(false);
                      setSimGauge(4.4); setFloodScenario(buildFloodScenario(4.4));
                      setSimVis(8.0); setFogScenario(buildFogScenario(8.0));
                      setSimIce(0); setIceScenario(buildIceScenario(0));
                      const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" });
                      setSimStormDist(320); setSimStormCat(2); setStormScenario(buildHurricaneScenario(320, 2));
                      setConfirmedIds(new Set()); setOverriddenIds(new Set()); setDecisionStore({});
                      setAlertedIds(new Set()); setDismissedIds(new Set()); setCardStates({});
                      setAgentLog([
                        { id: `scenario-${Date.now()}`, time: ts, action: "── SCENARIO: HURRICANE APPROACH ──", cost: "Cat 2   320mi from SW Pass   Port Condition YANKEE approaching", severity: "divider" },
                        { id: "bg1", time: "05:14:22", action: "MONITORING: Carrollton Gauge polled", cost: "Stage 0.7ft   Nominal   No action required", severity: "ok" },
                        { id: "bg2", time: "05:00:00", action: "MONITORING: AIS vessel position updated", cost: "MV Delta Voyager   ETA Southwest Pass 04:20 CST", severity: "ok" },
                        { id: "bg3", time: "04:45:11", action: "MONITORING: CN/KCS rail status checked", cost: "14 intermodal cars staged   Yard 3   On schedule", severity: "ok" },
                        { id: "bg4", time: "04:30:00", action: "MONITORING: Berth schedule reviewed", cost: "Berth 2 nominal   Crane gang confirmed", severity: "ok" },
                      ]);
                      setActiveTab("inbox");
                      prevFloodBandRef.current  = "nm";
                      prevFogBandRef.current    = "nm";
                      prevIceBandRef.current    = "nm";
                      prevStormBandRef.current  = "nm";
                    },
                  },
                ].map(({ icon, label, sublabel, description, color, action }) => (
                  <div
                    key={label}
                    onClick={action}
                    style={{ background: `${color}0a`, border: `1px solid ${color}33`, borderRadius: 8, padding: "16px 18px", cursor: "pointer", transition: "all 0.2s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.borderColor = `${color}66`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${color}0a`; e.currentTarget.style.borderColor = `${color}33`; e.currentTarget.style.transform = "none"; }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color, letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 10, color: C.label, marginBottom: 8 }}>{sublabel}</div>
                    <div style={{ fontSize: 12, color: C.body, lineHeight: 1.55 }}>{description}</div>
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 3, padding: "3px 8px", letterSpacing: "0.06em" }}>
                        SIMULATE →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GUIDED DEMO PROGRESS BAR */}
          {guidedDemo && guidedStep < guidedSteps.length && (
            <div style={{ background: `${C.amber}10`, borderBottom: `1px solid ${C.amber}33`, padding: "8px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PulsingDot color={C.amber} size={6} />
                <span style={{ fontFamily: C.mono, fontSize: 10, color: C.amber, letterSpacing: "0.06em", fontWeight: 700 }}>
                  GUIDED DEMO{"   "}{guidedStep + 1}/{guidedSteps.length}{"   "}
                </span>
                <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>
                  {guidedSteps[guidedStep]?.label}
                </span>
              </div>
              <button onClick={() => { setGuidedDemo(false); setGuidedStep(0); }} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontFamily: C.mono, fontSize: 9, padding: "3px 10px", borderRadius: 4, cursor: "pointer", letterSpacing: "0.06em" }}>
                EXIT DEMO
              </button>
            </div>
          )}

          <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/*    COMPACT THREAT STRIP + CONTEXT BAR    */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Threat strip — compact by default, click any threat to expand its slider */}
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0 }}>
                  {[
                    {
                      key: "flood", label: "FLOOD", value: `${simGauge.toFixed(1)}ft`, subtext: "Carrollton Gauge",
                      scenario: floodScenario, live: !!gaugeData,
                      slider: (
                        <div style={{ padding: "12px 16px 14px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>Drag to simulate river stage</span>
                            <span style={{ fontFamily: C.mono, fontSize: 8, color: floodScenario.statusColor }}>{floodScenario.status}</span>
                          </div>
                          <GaugeBar value={simGauge} />
                          <input type="range" min={0} max={20} step={0.1} value={simGauge}
                            onChange={e => { const v = parseFloat(e.target.value); setSimGauge(v); setFloodScenario(buildFloodScenario(v)); }}
                            style={{ width: "100%", accentColor: C.teal, cursor: "pointer", marginTop: 6 }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                            <span style={{ color: "#93c5fd" }}>LOW</span><span style={{ color: C.amber }}>8ft AP</span><span style={{ color: C.amber }}>11ft</span><span style={{ color: C.red }}>13ft HPL</span><span style={{ color: C.red }}>17ft+</span>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "fog", label: "FOG", value: `${simVis.toFixed(1)}nm`, subtext: "SW Pass Visibility",
                      scenario: fogScenario, live: !!fogData,
                      slider: (
                        <div style={{ padding: "12px 16px 14px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>Drag to simulate visibility</span>
                            <span style={{ fontFamily: C.mono, fontSize: 8, color: fogScenario.statusColor }}>{fogScenario.status}</span>
                          </div>
                          <div style={{ width: "100%", height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative", marginBottom: 6 }}>
                            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(((10 - simVis) / 9.95) * 100, 100)}%`, background: fogScenario.statusColor, transition: "width 0.3s ease" }} />
                            {[2.0, 1.0, 0.5, 0.25].map((t, i) => (
                              <div key={i} style={{ position: "absolute", left: `${((10 - t) / 9.95) * 100}%`, top: 0, height: "100%", width: 1, background: i < 2 ? C.amber : C.red, opacity: 0.6 }} />
                            ))}
                          </div>
                          <input type="range" min={0.05} max={10} step={0.05} value={10 - simVis + 0.05}
                            onChange={e => { const inv = parseFloat(e.target.value); const v = Math.max(0.05, 10 - inv + 0.05); setSimVis(parseFloat(v.toFixed(2))); setFogScenario(buildFogScenario(parseFloat(v.toFixed(2)))); }}
                            style={{ width: "100%", accentColor: C.teal, cursor: "pointer" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                            <span>10nm CLEAR</span><span style={{ color: C.amber }}>1.0</span><span style={{ color: C.amber }}>0.5</span><span style={{ color: C.red }}>ZERO-ZERO</span>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "ice", label: "ICE", value: `${(simIce * 10).toFixed(0)}%`, subtext: "LMR / Ohio River",
                      scenario: iceScenario, live: false,
                      slider: (
                        <div style={{ padding: "12px 16px 14px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>Drag to simulate ice coverage</span>
                            <span style={{ fontFamily: C.mono, fontSize: 8, color: iceScenario.statusColor }}>{iceScenario.status}</span>
                          </div>
                          <div style={{ width: "100%", height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative", marginBottom: 6 }}>
                            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(simIce / 10) * 100}%`, background: iceScenario.statusColor, transition: "width 1.2s ease" }} />
                            {[4, 7].map((t, i) => <div key={i} style={{ position: "absolute", left: `${(t / 10) * 100}%`, top: 0, height: "100%", width: 1, background: i === 0 ? C.amber : C.red, opacity: 0.6 }} />)}
                          </div>
                          <input type="range" min={0} max={10} step={0.1} value={simIce}
                            onChange={e => { const v = parseFloat(e.target.value); setSimIce(v); setIceScenario(buildIceScenario(v)); }}
                            style={{ width: "100%", accentColor: "#93c5fd", cursor: "pointer" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                            <span>0%</span><span style={{ color: C.amber }}>10%</span><span style={{ color: C.amber }}>40%</span><span style={{ color: C.red }}>70%+</span>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "hurricane", label: "HURRICANE", value: `${simStormDist}mi`, subtext: `SW Pass · Cat ${simStormCat}`,
                      scenario: stormScenario, live: !!nhcData,
                      slider: (
                        <div style={{ padding: "12px 16px 14px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>Drag to simulate storm approach</span>
                            <span style={{ fontFamily: C.mono, fontSize: 8, color: stormScenario.statusColor }}>{stormScenario.portCondition !== "NOMINAL" ? `PORT COND. ${stormScenario.portCondition}` : stormScenario.status}</span>
                          </div>
                          <div style={{ width: "100%", height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative", marginBottom: 6 }}>
                            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(((1000 - simStormDist) / 950) * 100, 100)}%`, background: stormScenario.statusColor, transition: "width 0.3s ease" }} />
                            <div style={{ position: "absolute", left: `${((1000 - 400) / 950) * 100}%`, top: 0, height: "100%", width: 1, background: C.amber, opacity: 0.6 }} />
                            <div style={{ position: "absolute", left: `${((1000 - 200) / 950) * 100}%`, top: 0, height: "100%", width: 1, background: C.red, opacity: 0.6 }} />
                          </div>
                          <input type="range" min={0} max={950} step={10} value={1000 - simStormDist}
                            onChange={e => { const v = 1000 - parseFloat(e.target.value); setSimStormDist(v); setStormScenario(buildHurricaneScenario(v, simStormCat)); }}
                            style={{ width: "100%", accentColor: "#a78bfa", cursor: "pointer" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                            <span>1000mi</span><span style={{ color: C.amber }}>WHISKEY</span><span style={{ color: C.amber }}>X-RAY</span><span style={{ color: C.red }}>YANKEE</span><span style={{ color: C.red }}>ZULU</span>
                          </div>
                          <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                            {[0,1,2,3,4,5].map(cat => (
                              <button key={cat} onClick={() => { setSimStormCat(cat); setStormScenario(buildHurricaneScenario(simStormDist, cat)); }}
                                style={{ flex: 1, padding: "2px 0", borderRadius: 2, border: `1px solid ${simStormCat === cat ? "#a78bfa" : C.border}`, background: simStormCat === cat ? "#a78bfa22" : "transparent", color: simStormCat === cat ? "#a78bfa" : C.muted, fontFamily: C.mono, fontSize: 7, cursor: "pointer" }}>
                                {cat === 0 ? "TS" : `C${cat}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ),
                    },
                  ].map(({ key, label, value, subtext, scenario, live, slider }, i, arr) => (
                    <div key={key} style={{ borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      {/* Compact header row — always visible */}
                      <ThreatPanel
                        label={label}
                        value={value}
                        subtext={subtext}
                        scenario={scenario}
                        expanded={expandedThreat === key}
                        onClick={() => setExpandedThreat(expandedThreat === key ? null : key)}
                      />
                      {/* Expanded slider — shown when this threat is active */}
                      {expandedThreat === key && slider}
                    </div>
                  ))}
                </div>
                <div style={{ padding: "4px 14px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                  {[
                    { label: "FLOOD",     live: !!gaugeData },
                    { label: "FOG",       live: !!fogData },
                    { label: "ICE",       live: false },
                    { label: "HURRICANE", live: !!nhcData },
                    { label: "AIS",       live: !!(aisData && !aisData.simulated) },
                    { label: "WIND",      live: !!(windData && !windData.simulated) },
                  ].map(({ label, live }) => (
                    <span key={label} style={{ fontFamily: C.mono, fontSize: 7, color: live ? C.teal : C.mutedLo }}>
                      {label} {live ? "● LIVE" : "○ SIM"}
                    </span>
                  ))}
                </div>
              </div>

              {/* Slim context bar — decisions + threats + corridor in one line */}
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 0, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                {/* Left: pending count */}
                <div
                  onClick={() => pendingCount > 0 && navigateToTab("inbox")}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRight: `1px solid ${C.border}`, cursor: pendingCount > 0 ? "pointer" : "default", background: pendingCount > 0 ? `${pendingCountColor}08` : "transparent" }}
                >
                  <span style={{ fontFamily: C.mono, fontSize: 32, fontWeight: 700, color: pendingCountColor, lineHeight: 1, textShadow: pendingCount > 0 ? `0 0 20px ${pendingCountColor}44` : "none" }}>{pendingCount}</span>
                  <div>
                    <div style={{ fontFamily: C.mono, fontSize: 8, color: C.label, letterSpacing: "0.08em" }}>DECISIONS</div>
                    <div style={{ fontFamily: C.mono, fontSize: 8, color: C.label }}>AWAITING</div>
                  </div>
                </div>

                {/* Middle: most urgent countdown */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 4px", overflow: "hidden" }}>
                  {pendingCount > 0 ? (
                    <div style={{ padding: "0 18px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.06em" }}>MOST URGENT</span>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.border }}>·</span>
                      <CountdownTimer key={pendingDecisions[0]?.id} advanceWarning={pendingDecisions[0]?.advanceWarning} createdAt={pendingDecisions[0]?.createdAt} />
                    </div>
                  ) : (
                    <div style={{ padding: "0 18px", display: "flex", alignItems: "center", gap: 8 }}>
                      <PulsingDot color={C.teal} size={6} />
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.teal, letterSpacing: "0.08em", fontWeight: 700 }}>
                        {allDecisions.length > 0 ? "ALL DECISIONS ACTIONED" : "ALL CLEAR — CORRIDOR NOMINAL"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: savings shortcut */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, borderLeft: `1px solid ${C.border}` }}>
                  {confirmedSavings > 0 && (
                    <div onClick={() => navigateToTab("impact")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", cursor: "pointer", borderRight: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = `${C.green}0d`}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontFamily: C.mono, fontSize: 8, color: C.label }}>SAVED</span>
                      <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.green }}>${confirmedSavings.toLocaleString()}</span>
                    </div>
                  )}
                  {pendingSavings > 0 && (
                    <div onClick={() => navigateToTab("inbox")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = `${C.teal}0d`}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontFamily: C.mono, fontSize: 8, color: C.label }}>AT STAKE</span>
                      <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.teal }}>${pendingSavings.toLocaleString()}</span>
                    </div>
                  )}
                  {!confirmedSavings && !pendingSavings && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px" }}>
                      <span style={{ fontFamily: C.mono, fontSize: 8, color: C.mutedLo }}>NO ACTIVE SAVINGS</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/*    TABS    */}
            <div ref={tabsRef} style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 54, zIndex: 40, background: `${C.bg}f5`, backdropFilter: "blur(12px)" }}>
              {[
                { id: "inbox",  label: `DECISION INBOX${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
                { id: "log",    label: "AGENT LOG" },
                { id: "impact", label: "IMPACT" },
                { id: "status", label: "SYSTEM STATUS" },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "10px 18px", border: "none", borderBottom: activeTab === tab.id ? `2px solid ${C.teal}` : "2px solid transparent", background: "transparent", color: activeTab === tab.id ? C.teal : C.muted, fontFamily: C.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer", transition: "all 0.2s ease", marginBottom: -1 }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/*    INBOX - unified across all threat types    */}
            {activeTab === "inbox" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sortedDecisions.length === 0 && (
                  <div style={{ padding: "32px 0 16px" }}>
                    {/* Status line */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
                      <PulsingDot color={C.teal} size={8} />
                      <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: C.teal, letterSpacing: "0.08em" }}>
                        MONITORING 4 THREATS — ALL NOMINAL
                      </span>
                      <span style={{ fontFamily: C.mono, fontSize: 11, color: C.label }}>
                        · {sessionSavings.length > 0
                          ? `Last event actioned ${sessionSavings[sessionSavings.length - 1]?.time}. Agents watching for new threshold crossings.`
                          : "Select a scenario or adjust any simulator to begin."}
                      </span>
                    </div>

                    {/* Live agent activity */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {[
                        {
                          agent: "RW", name: "River Warden", color: C.teal,
                          activity: `Gauge: ${simGauge.toFixed(1)}ft   Vis: ${simVis.toFixed(1)}nm${windData ? `   Wind: ${windData.wind?.speedKnots}kt ${windData.wind?.directionCompass}` : "   Wind: loading..."}`,
                        },
                        {
                          agent: "BM", name: "Berth Master", color: C.tealDim,
                          activity: aisData?.vessels?.length
                            ? `${aisData.vessels.length} vessels in LMR corridor${aisData.simulated ? " (sim)" : " — live AIS"}`
                            : "AIS feed loading — MV Delta Voyager ETA 04:20 CST",
                        },
                        {
                          agent: "IS", name: "Intermodal Sync", color: "#818cf8",
                          activity: "CN/KCS rail windows confirmed — 14 intermodal cars staged Yard 3",
                        },
                      ].map(({ agent, name, color, activity }) => (
                        <div key={agent} style={{ padding: "12px 14px", borderRadius: 6, background: C.panel, border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 5, background: `${color}18`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontSize: 9, fontWeight: 700, color, flexShrink: 0 }}>{agent}</div>
                            <div>
                              <div style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color }}>{name}</div>
                              <div style={{ fontFamily: C.mono, fontSize: 8, color: C.teal }}>● MONITORING</div>
                            </div>
                          </div>
                          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.body, lineHeight: 1.5 }}>{activity}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {pendingDecisions.length === 0 && sortedDecisions.length > 0 && (
                  <div style={{ padding: "24px 0 8px", display: "flex", alignItems: "center", gap: 10 }}>
                    <PulsingDot color={C.green} size={8} />
                    <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: "0.08em" }}>
                      ALL DECISIONS ACTIONED
                    </span>
                    <span style={{ fontFamily: C.mono, fontSize: 11, color: C.body }}>
                      {sessionSavings.length > 0 && `· $${sessionSavings.reduce((s, x) => s + x.amount, 0).toLocaleString()} avoided this session.`}
                      {" "}Agents watching for new threshold crossings.
                    </span>
                    {actionedDecisions.length > 0 && (
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginLeft: "auto" }}>
                        {actionedDecisions.length} record{actionedDecisions.length !== 1 ? "s" : ""} below ↓
                      </span>
                    )}
                  </div>
                )}
                {/* Pending decisions first - sorted by urgency */}
                {pendingDecisions.filter(d => !dismissedIds.has(d.id)).map(d => (
                  <DecisionCard key={d.id} decision={d} onConfirm={handleConfirm} onOverride={handleOverride} onDismiss={() => setDismissedIds(prev => new Set([...prev, d.id]))} onResolve={handleResolve} resolved={resolvedIds.has(d.id)}
                    cardState={cardStates[d.id] || "pending"} onStateChange={s => setCardStates(prev => ({ ...prev, [d.id]: s }))} />
                ))}
                {/* Actioned decisions below with divider */}
                {actionedDecisions.filter(d => !dismissedIds.has(d.id)).length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                    <div style={{ flex: 1, height: 1, background: C.border }} />
                    <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.08em", flexShrink: 0 }}>
                      {actionedDecisions.filter(d => !dismissedIds.has(d.id)).length} ACTIONED
                    </span>
                    <div style={{ flex: 1, height: 1, background: C.border }} />
                  </div>
                )}
                {actionedDecisions.filter(d => !dismissedIds.has(d.id)).map(d => {
                  const isConfirmed = confirmedIds.has(d.id);
                  const isResolved  = resolvedIds.has(d.id);
                  const color = isConfirmed ? C.teal : isResolved ? C.green : C.amber;
                  return (
                    <div key={d.id} style={{ border: `1px solid ${color}22`, borderLeft: `3px solid ${color}44`, borderRadius: 6, background: `${color}06`, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                        <span style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 3, padding: "2px 6px", flexShrink: 0 }}>
                          {isConfirmed ? "CONFIRMED" : isResolved ? "RESOLVED" : "OVERRIDE"}
                        </span>
                        <span style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, flexShrink: 0 }}>
                          {d.disruptionType}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.white, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.title}
                        </span>
                        {isConfirmed && (
                          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.green, flexShrink: 0 }}>
                            ${d.costAvoided.toLocaleString()} avoided
                          </span>
                        )}
                        {!isConfirmed && !isResolved && (
                          <button
                            onClick={() => handleResolve(d)}
                            style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, color: C.green, background: `${C.green}12`, border: `1px solid ${C.green}44`, borderRadius: 3, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                            MARK RESOLVED ✓
                          </button>
                        )}
                        {isResolved && (
                          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.green, flexShrink: 0 }}>
                            team confirmed ✓
                          </span>
                        )}
                        <DismissButton onDismiss={() => setDismissedIds(prev => new Set([...prev, d.id]))} />
                      </div>
                      {isConfirmed && (
                        <div style={{ borderTop: `1px solid ${C.border}22` }}>
                          <ExecutionTicker decision={d} alreadyDone={true} />
                        </div>
                      )}
                      {!isConfirmed && !isResolved && (
                        <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.amber}15`, background: `${C.amber}05` }}>
                          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>
                            Manual coordination in progress — ~45 min / 20 calls required
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/*    AGENT LOG    */}
            {activeTab === "log" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Filter chips */}
                <AgentLogWithFilter agentLog={agentLog} autoExpandLogId={autoExpandLogId} />
              </div>
            )}

            {/*    IMPACT    */}
            {activeTab === "impact" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Stat cards with expandable methodology */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                  {[
                    {
                      label: "SESSION TOTAL AVOIDED",
                      value: `$${sessionTotal.toLocaleString()}`,
                      color: C.green,
                      sub: `${sessionSavings.length} decision${sessionSavings.length !== 1 ? "s" : ""} confirmed`,
                      methodology: sessionSavings.length > 0
                        ? `Sum of cost avoidance across ${sessionSavings.length} confirmed action${sessionSavings.length !== 1 ? "s" : ""} this session. Each figure is derived from industry benchmarks for the specific disruption type — vessel idle-hours for flood events, truck-hours for fog, tug standby for ice.`
                        : "Confirm decisions in the inbox to see cost avoidance figures here.",
                      source: "Benchmarks: USACE Lower Mississippi operating costs, Port NOLA tariff schedules, Crescent Towing rate cards.",
                    },
                    {
                      label: "AVG PER DECISION",
                      value: sessionSavings.length ? `$${Math.round(sessionTotal / sessionSavings.length).toLocaleString()}` : "--",
                      color: C.teal,
                      sub: "cost avoidance per action",
                      methodology: "Average cost avoidance per confirmed decision. Industry benchmarks used: vessel idle (demurrage) at ~$8,500/hr, crane gang at ~$2,400/hr, tug standby at ~$3,200/hr, drayage trucks at ~$180/hr.",
                      source: "Source: USACE 2024 operating cost data, Port NOLA terminal rate schedules.",
                    },
                    {
                      label: "ALERTS DISPATCHED",
                      value: String(sessionSavings.length * 6),
                      color: C.teal,
                      sub: "SMS + API calls executed",
                      methodology: `Each confirmed decision triggers 6 automated dispatches: Port Director SMS, Pilot Station SMS, CN/KCS Rail API window update, Drayage fleet Twilio broadcast, Berth TOS API call, and MTSA audit log entry. ${sessionSavings.length} decision${sessionSavings.length !== 1 ? "s" : ""} × 6 = ${sessionSavings.length * 6} total.`,
                      source: "Dispatch log available in the Agent Log tab.",
                    },
                    {
                      label: "VS. MANUAL",
                      value: `${sessionSavings.length * 45}m`,
                      color: C.amber,
                      sub: `saved vs ~${sessionSavings.length * 20} manual calls`,
                      methodology: `Manual coordination for a single high-water event typically requires ~20 phone calls and ~45 minutes: Port Director, 2–3 pilots, tug captain, 4–6 vessel agents, CN/KCS rail dispatcher, drayage supervisor, berth crew leads, and MTSA log entry. DeltaAgent executes the same coordination in under 5 seconds.`,
                      source: "Benchmark: Port NOLA operations interviews, Coast Guard Sector NOLA coordination protocols.",
                    },
                  ].map(({ label, value, color, sub, methodology, source }) => (
                    <ImpactStatCard key={label} label={label} value={value} color={color} sub={sub} methodology={methodology} source={source} />
                  ))}
                </div>

                {/* Session history table */}
                {sessionSavings.length === 0 ? (
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "48px 24px", textAlign: "center", color: C.muted }}>
                    <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 12 }}>$</div>
                    <div style={{ fontFamily: C.mono, fontSize: 12, letterSpacing: "0.08em", marginBottom: 8, color: C.white }}>NO CONFIRMED SAVINGS YET</div>
                    <div style={{ fontSize: 13, marginBottom: 20 }}>Confirm decisions in the inbox to track cost avoidance here</div>
                    <button
                      onClick={() => navigateToTab("inbox")}
                      style={{ padding: "9px 20px", borderRadius: 6, border: `1px solid ${C.teal}`, background: `${C.teal}18`, color: C.teal, fontFamily: C.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>
                      → GO TO DECISION INBOX
                    </button>
                  </div>
                ) : (
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.1em" }}>CONFIRMED ACTIONS — SESSION HISTORY</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.green }}>${sessionTotal.toLocaleString()} total avoided</div>
                    </div>
                    {sessionSavings.slice().reverse().map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: i < sessionSavings.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, flexShrink: 0 }}>{s.time}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.white, marginBottom: 2 }}>{s.title}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: threatColor[s.disruptionType] || C.muted }}>{s.disruptionType}</span>
                            <span>  Agents: {s.agents.join(", ")}   6 alerts dispatched</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: C.green }}>${s.amount.toLocaleString()}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.body }}>{getCostAnnotation(s.amount, s.disruptionType)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ROI Projection — prominent card */}
                {sessionSavings.length > 0 && (
                  <div style={{ background: `linear-gradient(135deg, ${C.green}0d 0%, ${C.panel} 100%)`, border: `1px solid ${C.green}33`, borderRadius: 8, padding: "20px 24px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.green, letterSpacing: "0.12em", fontWeight: 700, marginBottom: 6 }}>PILOT ROI PROJECTION</div>
                        <div style={{ fontSize: 13, color: C.body, lineHeight: 1.7, maxWidth: 560 }}>
                          This session confirmed <span style={{ color: C.green, fontWeight: 600 }}>${sessionTotal.toLocaleString()}</span> in cost avoidance across <span style={{ color: C.white, fontWeight: 600 }}>{sessionSavings.length} {sessionSavings.length === 1 ? "event" : "events"}</span>.
                          The Lower Mississippi experiences <span style={{ color: C.white, fontWeight: 600 }}>15–20 disruption events per season</span> requiring active coordination (USACE 2024).
                          At this rate, a single terminal operator could realize:
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 4 }}>EST. ANNUAL VALUE / TERMINAL</div>
                        <div style={{ fontFamily: C.mono, fontSize: 28, fontWeight: 700, color: C.green, lineHeight: 1 }}>
                          ${(Math.round(sessionTotal / sessionSavings.length) * 15).toLocaleString()}–${(Math.round(sessionTotal / sessionSavings.length) * 20).toLocaleString()}
                        </div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginTop: 3 }}>per season · conservative estimate</div>
                      </div>
                    </div>

                    {/* Methodology breakdown */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[
                        {
                          label: "AVG COST / EVENT",
                          value: `$${Math.round(sessionTotal / sessionSavings.length).toLocaleString()}`,
                          note: "This session average",
                        },
                        {
                          label: "× SEASONAL FREQUENCY",
                          value: "15–20 events",
                          note: "USACE LMR disruption data 2024",
                        },
                        {
                          label: "= ANNUAL RANGE",
                          value: `$${(Math.round(sessionTotal / sessionSavings.length) * 15).toLocaleString()}–$${(Math.round(sessionTotal / sessionSavings.length) * 20).toLocaleString()}`,
                          note: "Per terminal, conservative",
                        },
                      ].map(({ label, value, note }) => (
                        <div key={label} style={{ padding: "10px 12px", borderRadius: 6, background: `${C.green}08`, border: `1px solid ${C.green}1a` }}>
                          <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 3 }}>{value}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>{note}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: "10px 14px", borderRadius: 5, background: `${C.muted}08`, border: `1px solid ${C.border}` }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, lineHeight: 1.6 }}>
                        <span style={{ color: C.teal, fontWeight: 700 }}>METHODOLOGY NOTE</span>  ·  Cost avoidance figures derived from USACE Lower Mississippi operating cost data, Port NOLA terminal rate schedules, and Crescent Towing rate cards. Seasonal frequency based on USACE 2024 LMR disruption event log. Figures represent conservative estimates for a single terminal operator. Multi-terminal deployment would compound returns proportionally.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/*    SYSTEM STATUS    */}
            {activeTab === "status" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

                {/* DATA FEEDS — rebuilt with groups, prominent values, operational notes */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.1em", marginBottom: 16 }}>DATA FEEDS</div>

                  {/* GROUP 1: Environmental */}
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
                    ENVIRONMENTAL
                  </div>

                  {[
                    {
                      label: "NOAA Carrollton Gauge",
                      purpose: "River stage — triggers flood threshold alerts",
                      value: `${simGauge.toFixed(1)}ft`,
                      valueColor: floodScenario.status !== "NOMINAL" ? floodScenario.statusColor : C.teal,
                      status: gaugeData ? "live" : "sim",
                      badge: gaugeData ? "LIVE" : "SIMULATED",
                    },
                    {
                      label: "NDBC BURL1 — SW Pass",
                      purpose: "Visibility — triggers fog restriction decisions",
                      value: `${simVis.toFixed(1)}nm`,
                      valueColor: fogScenario.status !== "NOMINAL" ? fogScenario.statusColor : C.teal,
                      status: fogData ? "live" : "sim",
                      badge: fogData ? "LIVE" : "SIMULATED",
                    },
                    {
                      label: "NWS Wind — KMSY",
                      purpose: "Wind speed & direction — vessel speed restrictions above 25kt",
                      value: windData ? `${windData.wind?.speedKnots}kt ${windData.wind?.directionCompass}` : "--",
                      valueColor: windData?.wind?.status !== "NOMINAL" ? C.amber : C.teal,
                      status: windData && !windData.simulated ? "live" : "sim",
                      badge: windData && !windData.simulated ? "LIVE" : "SIMULATED",
                    },
                    {
                      label: "NHC Active Storms",
                      purpose: "Hurricane track — drives port condition declarations",
                      value: nhcData ? `${simStormDist}mi` : "NONE ACTIVE",
                      valueColor: nhcData ? stormScenario.statusColor : C.teal,
                      status: nhcData ? "live" : "sim",
                      badge: nhcData ? "LIVE" : "SIMULATED",
                    },
                    {
                      label: "Corps Ice Index",
                      purpose: "Ice coverage — barge fleeting and navigation restrictions",
                      value: `${(simIce * 10).toFixed(0)}%`,
                      valueColor: iceScenario.status !== "NOMINAL" ? iceScenario.statusColor : C.teal,
                      status: "sim",
                      badge: "SIMULATED",
                    },
                  ].map(({ label, purpose, value, valueColor, status, badge }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: C.white, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{purpose}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: valueColor, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                        <Badge color={status === "live" ? C.teal : C.muted} small>{badge}</Badge>
                      </div>
                    </div>
                  ))}

                  {/* GROUP 2: Operational */}
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.1em", margin: "14px 0 10px", paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
                    OPERATIONAL
                  </div>

                  {/* AIS */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.white, fontWeight: 600, marginBottom: 2 }}>AIS Vessel Track</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>
                        Live vessel positions — berth sequencing and intermodal timing
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: C.teal, lineHeight: 1, marginBottom: 4 }}>
                        {aisData && !aisData.simulated
                          ? `${aisData.vessels?.length || 0} vessel${(aisData.vessels?.length || 0) !== 1 ? "s" : ""}`
                          : aisData?.simulated
                          ? "4 vessels"
                          : "polling..."}
                      </div>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 4 }}>
                        {aisData && !aisData.simulated
                          ? "LMR corridor — aisstream.io"
                          : "LMR corridor — simulated"}
                      </div>
                      <Badge color={aisData && !aisData.simulated ? C.teal : C.muted} small>
                        {aisData && !aisData.simulated ? "LIVE" : "SIMULATED"}
                      </Badge>
                    </div>
                  </div>

                  {/* SMS */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.white, fontWeight: 600, marginBottom: 2 }}>SMS Gateway (Twilio)</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>
                        Alert dispatch — notifies Port Director, pilots, and rail on confirmation
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: C.amber, lineHeight: 1, marginBottom: 4 }}>PENDING</div>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 4 }}>
                        Carrier verification in progress
                      </div>
                      <Badge color={C.amber} small>ACTIVATING</Badge>
                    </div>
                  </div>
                </div>

                {/* AGENT NETWORK — unchanged */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.label, letterSpacing: "0.1em", marginBottom: 14 }}>AGENT NETWORK</div>
                  {Object.entries(AGENT_INFO).map(([code, ag]) => (
                    <div key={code} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 6, border: `1px solid ${ag.color}22`, background: `${ag.color}08`, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: `${ag.color}20`, border: `1px solid ${ag.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: ag.color, flexShrink: 0, marginTop: 1 }}>{code}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.white }}>{ag.name}</span>
                          <span style={{ fontFamily: C.mono, fontSize: 8, color: ag.color, background: `${ag.color}15`, border: `1px solid ${ag.color}30`, borderRadius: 3, padding: "1px 5px" }}>{ag.role}</span>
                        </div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.body, lineHeight: 1.5 }}>{ag.description}</div>
                      </div>
                      <PulsingDot color={ag.color} size={7} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/*    FOOTER    */}
            <div style={{ paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: C.mono, fontSize: 8, color: C.mutedLo }}>© 2026 DeltaAgent AI, LLC · deltaagent.ai · New Orleans, LA</div>
              <div style={{ fontFamily: C.mono, fontSize: 8, color: C.mutedLo }}>BETA · Operations Command v0.1</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
