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

//    DATA SOURCES                                                             
const NOAA_URL = "/api/noaa";

// NDBC BURL1 - Southwest Pass, LA (28.906N 89.429W)
// Proxied via /api/fog to avoid CORS
const NDBC_FOG_URL = "/api/fog";

// NHC active storms - proxied via /api/hurricane
const NHC_URL = "/api/hurricane";

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

  const decisions = floodStage ? [
    {
      id: "d1", severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "FLOOD STAGE",
      title: "COORDINATE - Bonnet Carre Spillway Protocol",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft - official flood stage reached. Coordinate with Army Corps regarding Bonnet Carre Spillway opening. Navigation hazardous for all vessel classes.",
      costAvoided: 96000, costIfIgnored: 96000, advanceWarning: "6h 00m",
      agents: ["RW", "BM", "IS"],
      actions: ["Notify Army Corps - Bonnet Carre Spillway opening review initiated", "Issue Navigation Safety Notice to all inbound vessels", "Coordinate with Coast Guard Sector NOLA - full navigation advisory", "Alert all terminal operators - emergency mooring protocols activated", "Monitor saltwater wedge at Southwest Pass"],
    },
    {
      id: "d2", severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "LEVEE PROTECTION",
      title: "HALT - All Construction Within 1500ft of Levee",
      reason: "At " + ft.toFixed(1) + "ft soil saturation puts critical pressure on levees. All construction activity within 1,500 feet must halt immediately per Corps protocol.",
      costAvoided: 54000, costIfIgnored: 54000, advanceWarning: "2h 00m",
      agents: ["RW", "BM"],
      actions: ["Halt all construction within 1,500ft of levee - regulatory requirement", "Notify all contractors via emergency SMS dispatch", "Deploy Levee District monitoring crew", "Log MTSA and Corps compliance record"],
    },
  ] : critical ? [
    {
      id: "d1", severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "HIGH WATER",
      title: "MANDATE - Standby Tugs at All Berths",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft. Extreme river currents at Algiers Point and Carrollton Bend. Coast Guard mandate requires standby assist tugs for all deep-draft vessels.",
      costAvoided: 48000, costIfIgnored: 48000, advanceWarning: "3h 45m",
      agents: ["RW", "BM", "IS"],
      actions: ["Deploy standby tugs to Berths 1-4 via Crescent Towing", "Notify all deep-draft vessel masters - tug assist mandatory at Algiers Point", "Restrict barge fleeting - breakaway prevention protocol activated", "SMS dispatch to Port Director + Coast Guard Sector NOLA"],
    },
    {
      id: "d2", severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "CONSTRUCTION HALT",
      title: "PREPARE - Halt Construction Near Levees",
      reason: "Stage at " + ft.toFixed(1) + "ft and rising toward flood stage. Soil saturation risk escalating. Pre-position halt orders for all sites within 1,500ft of levee.",
      costAvoided: 22000, costIfIgnored: 22000, advanceWarning: "2h 10m",
      agents: ["RW"],
      actions: ["Pre-position halt orders for levee-adjacent construction sites", "Notify Levee District monitoring teams", "Flag for Port Director review - halt imminent"],
    },
  ] : bridgeWarn ? [
    {
      id: "d1", severity: "critical",
      disruptionType: "FLOOD", disruptionLabel: "BRIDGE CLEARANCE",
      title: "RESTRICT - Huey P. Long Bridge Clearance",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft triggers Huey P. Long Bridge air draft restriction. Tall vessels and loaded barges must be re-routed or rescheduled.",
      costAvoided: 38000, costIfIgnored: 38000, advanceWarning: "3h 00m",
      agents: ["RW", "BM", "IS"],
      actions: ["Issue Huey P. Long Bridge clearance restriction notice", "Notify all vessels with air draft above restriction threshold", "Re-sequence affected vessels to wait for stage drop", "Coordinate with CN/KCS rail - bridge traffic impacts intermodal timing", "SMS dispatch to Port Director + affected vessel agents"],
    },
    {
      id: "d2", severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "STANDBY TUGS",
      title: "PREPARE - Standby Tugs at Upper Berths",
      reason: "Stage at " + ft.toFixed(1) + "ft. River current at Algiers Point and Carrollton Bend increasing. Pre-position standby tugs before mandatory tug assist threshold is reached.",
      costAvoided: 18000, costIfIgnored: 18000, advanceWarning: "2h 30m",
      agents: ["RW", "BM"],
      actions: ["Pre-position Crescent Towing standby tugs at upper berths", "Notify vessel masters - tug assist advisory issued", "Monitor current speed at Algiers Point - mandatory assist approaching"],
    },
  ] : hwProclaim ? [
    {
      id: "d1", severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "HIGH WATER PROCLAMATION",
      title: "ACTIVATE - High Water Proclamation",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft - above 11ft threshold. High Water Proclamation required. Switch to daylight-only mooring for all deep-draft vessels. Huey P. Long Bridge restriction approaching.",
      costAvoided: 28000, costIfIgnored: 28000, advanceWarning: "2h 30m",
      agents: ["RW", "BM", "IS"],
      actions: ["Issue High Water Proclamation - daylight-only mooring for deep-draft vessels", "Restrict barge fleeting - single-cut tows only above Carrollton", "Notify all vessel masters and agents via SMS + VHF Ch 16", "Monitor Huey P. Long Bridge clearance - restriction threshold at 13ft", "CN/KCS rail windows adjusted for potential cargo delays"],
    },
    {
      id: "d2", severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "BARGE RESTRICTION",
      title: "RESTRICT - Barge Fleeting at Carrollton Bend",
      reason: "Current speed increasing at Carrollton Bend above 11ft. Restrict large barge tows to prevent breakaways that could impact bridges and vessels.",
      costAvoided: 14200, costIfIgnored: 14200, advanceWarning: "1h 45m",
      agents: ["RW", "BM"],
      actions: ["Restrict barge tow size at Carrollton Bend - single-cut only", "Notify all fleeting areas upstream", "Alert Huey P. Long and Greater New Orleans Bridge tenders - increased debris"],
    },
  ] : algiers ? [
    {
      id: "d1", severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "ALGIERS POINT",
      title: "RESTRICT - Algiers Point Vessel Size Limit",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft - Algiers Point restriction threshold reached. River current at the bend now limits deep-draft vessel maneuverability. Vessel size restrictions now active.",
      costAvoided: 22000, costIfIgnored: 22000, advanceWarning: "2h 15m",
      agents: ["RW", "BM", "IS"],
      actions: ["Activate Algiers Point vessel size restriction protocol", "Notify Crescent River Port Pilots - current advisory for the bend", "Restrict deep-draft inbound vessels - tug assist required at Algiers Point", "Re-sequence vessel queue - smaller drafts prioritized through the bend", "SMS dispatch to all vessel agents with Algiers Point restriction notice"],
    },
    {
      id: "d2", severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "DREDGING PRIORITY",
      title: "SCHEDULE - Priority Dredging at Critical Berths",
      reason: "Rising stage at " + ft.toFixed(1) + "ft increasing siltation risk at berths. Schedule dredging priority to maintain 50ft draft for Post-Panamax vessels before channel shoaling occurs.",
      costAvoided: 16000, costIfIgnored: 16000, advanceWarning: "24h",
      agents: ["BM", "IS"],
      actions: ["Schedule priority dredging at Berths 2 and 4 - Post-Panamax draft maintenance", "Coordinate with dredging contractors - Weeks Marine and Great Lakes Dredge", "Issue berth depth advisory to vessel agents", "Flag for Port Director review - dredging authorization required"],
    },
  ] : lowWater ? [
    {
      id: "d1", severity: "warning",
      disruptionType: "FLOOD", disruptionLabel: "SALTWATER WEDGE",
      title: "MONITOR - Saltwater Intrusion Risk",
      reason: "Carrollton Gauge at " + ft.toFixed(1) + "ft - below 4ft threshold. River flow too weak to push back Gulf saltwater. Saltwater wedge creeping toward New Orleans industrial intakes.",
      costAvoided: 32000, costIfIgnored: 32000, advanceWarning: "48h",
      agents: ["RW", "IS"],
      actions: ["Monitor saltwater wedge position at Southwest Pass - hourly readings", "Alert industrial water intake operators - potential salinity increase", "Coordinate with Army Corps regarding underwater sill deployment", "Notify terminal operators - machinery corrosion risk if salt reaches intakes"],
    },
    {
      id: "d2", severity: "warning",
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

  return { ft, status, statusColor, risk, riskColor, decisions, trend };
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

  const decisions = zeroZero ? [
    {
      id: "f1", severity: "critical",
      disruptionType: "FOG", disruptionLabel: "ZERO-ZERO",
      title: "HALT - Total Movement Shutdown",
      reason: "KMSY visibility " + visNm.toFixed(2) + "nm - Zero-Zero conditions. Catastrophic collision risk. Every vessel stays put. Logistics domino imminent - 500+ trucks idling at terminal gates.",
      costAvoided: 84000, costIfIgnored: 84000, advanceWarning: "IMMEDIATE",
      agents: ["RW", "BM", "IS"],
      actions: ["Halt all vessel movement - every ship stays put per Coast Guard order", "Shut down truck gates - prevent land-side gridlock on surface streets", "Stop CN/KCS rail lines - prevent intermodal backup at terminal", "Order anchorage for all vessels currently in Kenner Bend straightaway", "Notify Port Director - logistics domino protocol activated"],
    },
    {
      id: "f2", severity: "critical",
      disruptionType: "FOG", disruptionLabel: "ALLISION RISK",
      title: "PROHIBIT - No Vessel May Leave or Approach Wharves",
      reason: "Sub-0.25nm visibility creates total disorientation risk. A 30-second radar or GPS outage could cause allision with bridge pier or levee grounding.",
      costAvoided: 52000, costIfIgnored: 52000, advanceWarning: "IMMEDIATE",
      agents: ["BM", "IS"],
      actions: ["Prohibit all wharf approaches and departures - allision risk critical", "Notify all terminal berth crews - stand down immediately", "22 drayage trucks diverted - gate closure SMS dispatched via Twilio", "MTSA emergency log entry created - Coast Guard Sector NOLA notified"],
    },
  ] : critical ? [
    {
      id: "f1", severity: "critical",
      disruptionType: "FOG", disruptionLabel: "DENSE FOG",
      title: "SUSPEND - All Mooring Operations",
      reason: "KMSY visibility " + visNm.toFixed(2) + "nm - dense fog threshold. Suspend all docking and undocking. Order ships in straightaways to find nearest anchorage immediately.",
      costAvoided: 44000, costIfIgnored: 44000, advanceWarning: "30m",
      agents: ["RW", "BM", "IS"],
      actions: ["Suspend all mooring operations - no vessel may leave or approach wharf", "Order vessels in Kenner Bend straightaway to nearest anchorage", "Pilot boarding suspended at Southwest Pass and Pilottown stations", "Crane gang stood down - berth crews on hold", "Drayage trucks notified - 2-4hr delay window via Twilio SMS"],
    },
    {
      id: "f2", severity: "warning",
      disruptionType: "FOG", disruptionLabel: "BRIDGE RESTRICTION",
      title: "COORDINATE - One-Way Traffic at Bridges",
      reason: "Dense fog makes two-way traffic under Huey P. Long and Crescent City Connection bridges catastrophically dangerous. One-way protocol must be maintained.",
      costAvoided: 18000, costIfIgnored: 18000, advanceWarning: "45m",
      agents: ["RW", "BM"],
      actions: ["Maintain one-way traffic through Huey P. Long Bridge", "Maintain one-way traffic through Crescent City Connection", "Coordinate with Coast Guard VTS - bridge passage sequencing", "Notify all vessel agents - one-way protocol active"],
    },
  ] : restricted ? [
    {
      id: "f1", severity: "warning",
      disruptionType: "FOG", disruptionLabel: "RESTRICTED VIS",
      title: "INITIATE - One-Way Traffic at Dangerous Bends",
      reason: "KMSY visibility " + visNm.toFixed(2) + "nm - restricted phase. Radar ghosting at sharp bends. Initiate one-way traffic through bridges. Pilots may stop boarding at Southwest Pass.",
      costAvoided: 28000, costIfIgnored: 28000, advanceWarning: "1h 15m",
      agents: ["RW", "BM", "IS"],
      actions: ["Coordinate with Coast Guard - initiate one-way traffic at Huey P. Long and Crescent City Connection", "Pilot wait-and-see advisory - Southwest Pass and Pilottown stations", "Safe speed mandate issued to all vessels transiting bends", "Parking lot forming in Gulf - notify vessel agents of delay window", "Berth crew notified - crane gang on short-notice standby"],
    },
  ] : cautionary ? [
    {
      id: "f1", severity: "warning",
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

  return { visNm, status, statusColor, risk, riskColor, decisions, trend };
}

//    ICE SCENARIO                                                              
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
      disruptionType: "ICE", disruptionLabel: "ICE RESTRICTION",
      title: "RESEQUENCE - Upstream Ice Delay " + delayDays + " Days",
      reason: "Corps of Engineers ice restriction index " + iceIndex.toFixed(1) + "/10 on Ohio River above Cairo, IL. Barge tow delays of " + delayDays + "+ days projected. Terminal inventory and rail schedule must be resequenced.",
      costAvoided: 44000, costIfIgnored: 44000, advanceWarning: "72h",
      agents: ["RW", "BM", "IS"],
      actions: ["14 barge tows flagged for " + delayDays + "-day delay - ETA revised", "CN/KCS rail departure windows shifted to compensate upstream delay", "Terminal inventory resequenced - priority cargo identified", "Port Director and commodity traders notified via SMS"],
    },
    {
      id: "i2", severity: "warning",
      disruptionType: "ICE", disruptionLabel: "DRAFT REDUCTION",
      title: "ADVISORY - Reduce Barge Draft Capacity",
      reason: "Ice floe activity reducing navigable channel width at Locks 52/53. Barge tows must reduce to single-cut configuration below Cairo.",
      costAvoided: 16000, costIfIgnored: 16000, advanceWarning: "48h",
      agents: ["RW", "IS"],
      actions: ["Barge operators notified: single-cut restriction below Cairo, IL", "Commodity load plans adjusted for reduced draft capacity", "Arrival window extended +48h for affected tows"],
    },
  ] : moderate ? [
    {
      id: "i1", severity: "warning",
      disruptionType: "ICE", disruptionLabel: "ICE ADVISORY",
      title: "MONITOR - Upstream Ice Advisory Active",
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

//    HURRICANE SCENARIO                                                         
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
      disruptionType: "HURRICANE", disruptionLabel: "HURRICANE",
      title: "EVACUATE - Clear All Berths Within 24h",
      reason: catLabel + " " + distanceMiles + " miles from Southwest Pass. NHC forecast landfall within 18-24h. All vessels must depart or seek shelter. Port closure imminent.",
      costAvoided: 112000, costIfIgnored: 112000, advanceWarning: "18h",
      agents: ["RW", "BM", "IS"],
      actions: ["All inbound vessels diverted to Mobile, AL or Pascagoula, MS anchorage", "All berths cleared - vessels at dock given 6h departure window", "CN/KCS rail traffic halted - cars staged at inland yards", "Port Director, Coast Guard Sector NOLA, and FEMA notified", "Emergency operation mode activated - MTSA hurricane protocol"],
    },
    {
      id: "h2", severity: "critical",
      disruptionType: "HURRICANE", disruptionLabel: "STORM SURGE",
      title: "SECURE - Storm Surge Protocol Activated",
      reason: "NHC surge forecast " + (category * 4 + 6) + "-" + (category * 4 + 10) + "ft above normal at Southwest Pass. Terminal equipment must be secured.",
      costAvoided: 68000, costIfIgnored: 68000, advanceWarning: "12h",
      agents: ["BM"],
      actions: ["Crane booms lowered and secured at all berths", "Terminal cargo covered and tie-downs verified", "Equipment moved to elevated staging areas", "Berth infrastructure flood checklist completed"],
    },
  ] : watch ? [
    {
      id: "h1", severity: "warning",
      disruptionType: "HURRICANE", disruptionLabel: "HURRICANE WATCH",
      title: "PREPARE - Hurricane Watch Protocol",
      reason: catLabel + " tracking toward Gulf Coast - " + distanceMiles + " miles out. 48-72h window for preparation. Vessel sequencing must begin now.",
      costAvoided: 54000, costIfIgnored: 54000, advanceWarning: "48h",
      agents: ["RW", "BM", "IS"],
      actions: ["Inbound vessel queue reviewed - priority cargo expedited", "Berth clearance schedule drafted for potential port closure", "CN/KCS rail pre-positioned for rapid clearance", "Port Director briefed - contingency plan activated"],
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
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{time}   6 alerts dispatched</div>
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.teal }}>view record  </div>
          </div>
          <div style={{ background: `${C.teal}0d`, border: `1px solid ${C.teal}22`, borderRadius: 7, padding: "8px 10px", marginBottom: 8 }}>
            <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 2 }}>  {decision.title}</div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>Gauge {decision.ft?.toFixed(1)}ft   ${decision.costAvoided?.toLocaleString()} avoided</div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["Port Director","Pilot Station","CN/KCS","Drayage","Berth TOS","Audit"].map((l, i) => (
              <div key={i} style={{ fontFamily: C.mono, fontSize: 8, color: C.teal, background: `${C.teal}10`, border: `1px solid ${C.teal}22`, borderRadius: 3, padding: "2px 5px" }}>  {l}</div>
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
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,#92400e,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}> </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: "0.06em" }}>MANUAL ACTION REQUIRED</div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{time}   override logged</div>
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.amber }}>view  </div>
          </div>
          <div style={{ background: `${C.amber}0d`, border: `1px solid ${C.amber}33`, borderRadius: 7, padding: "8px 10px", marginBottom: 8 }}>
            <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 2 }}>  {decision.title}</div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>Automated dispatch cancelled   Your team must coordinate</div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["Port Director","Pilot Station","CN/KCS","Drayage"].map((l, i) => (
              <div key={i} style={{ fontFamily: C.mono, fontSize: 8, color: C.amber, background: `${C.amber}10`, border: `1px solid ${C.amber}22`, borderRadius: 3, padding: "2px 5px" }}>  {l}</div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontFamily: C.mono, fontSize: 9, color: "#666" }}>~45 min / 20 manual calls required   MTSA audit logged</div>
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
        { label: "Pilot Station - boarding advisory issued",     detail: "+1 (504) 555-0293   visibility alert",  icon: "->" },
        { label: "Coast Guard Sector NOLA notified",             detail: "VHF Ch 16 + SMS dispatch",              icon: "->" },
        { label: "Berth crew stood down - crane on standby",     detail: "Berth 1 crew hold confirmed",           icon: "->" },
        { label: "Drayage fleet notified via Twilio",            detail: "22 trucks - delay window issued",       icon: "->" },
        { label: "NWS marine forecast logged",                   detail: "GMZ572 advisory acknowledged",          icon: "->" },
        { label: "MTSA audit entry created",                     detail: "Fog delay compliance record",           icon: "->" },
      ];
    case "ICE":
      return [
        { label: "Corps of Engineers restriction acknowledged",  detail: "Navigation notice logged",              icon: "->" },
        { label: "Upstream barge operators notified",            detail: "Draft reduction advisory - 14 tows",   icon: "->" },
        { label: "CN/KCS rail windows shifted",                  detail: "Departure delay +48h logged",           icon: "->" },
        { label: "Terminal inventory resequenced",               detail: "Priority cargo identified + flagged",   icon: "->" },
        { label: "Commodity traders notified via Twilio",        detail: "Grain + fertilizer stakeholders",       icon: "->" },
        { label: "MTSA audit entry created",                     detail: "Ice restriction compliance record",     icon: "->" },
      ];
    case "HURRICANE":
      return [
        { label: "Coast Guard Sector NOLA - port closure alert", detail: "MARSEC level updated",                 icon: "->" },
        { label: "NHC advisory acknowledged + logged",           detail: "Track data ingested   surge model run", icon: "->" },
        { label: "All berths cleared - departure sequence set",  detail: "6h vessel departure window issued",    icon: "->" },
        { label: "Crane booms secured - storm protocol active",  detail: "All terminals confirmed",               icon: "->" },
        { label: "FEMA + Port NOLA emergency ops notified",      detail: "+1 (504) 555-0911   EOC activated",    icon: "->" },
        { label: "MTSA hurricane audit log created",             detail: "Emergency operations record",          icon: "->" },
      ];
    default: // FLOOD
      return [
        { label: "SMS dispatched to Port Director",              detail: "+1 (504) 555-0147",                    icon: "->" },
        { label: "SMS dispatched to Pilot Station",              detail: "+1 (504) 555-0293",                    icon: "->" },
        { label: "CN/KCS Rail API window updated",               detail: "08:45 to 10:15 CST",                   icon: "->" },
        { label: "Drayage fleet notified via Twilio",            detail: "22 trucks rerouted",                   icon: "->" },
        { label: "Berth schedule updated in TOS",                detail: "Navis N4 API call",                    icon: "->" },
        { label: "MTSA audit log entry created",                 detail: "MTSA compliance record",               icon: "->" },
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

function ExecutionTicker({ decision }) {
  const [firedCount, setFiredCount] = useState(0);
  const [done, setDone]             = useState(false);
  const [elapsed, setElapsed]       = useState("0.0");
  const startRef                    = useRef(Date.now());
  const steps = getExecSteps(decision.disruptionType);

  useEffect(() => {
    const clock = setInterval(() => setElapsed(((Date.now() - startRef.current) / 1000).toFixed(1)), 100);
    steps.forEach((_, i) => {
      setTimeout(() => {
        setFiredCount(i + 1);
        if (i === steps.length - 1) setTimeout(() => { setDone(true); clearInterval(clock); }, 500);
      }, (i + 1) * 800);
    });
    return () => clearInterval(clock);
  }, []);

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, background: C.panel, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {done ? <span style={{ color: C.teal }}> </span> : <PulsingDot color={C.teal} size={8} />}
          <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.08em" }}>{done ? "EXECUTION RECORD" : "EXECUTING..."}</span>
        </div>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>{elapsed}s elapsed</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {steps.map((step, i) => {
          const fired = i < firedCount;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 5, background: fired ? `${C.teal}0d` : "transparent", border: `1px solid ${fired ? C.teal + "33" : C.border}`, opacity: fired ? 1 : 0.3, transition: "all 0.4s ease" }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{step.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: fired ? C.white : C.muted, fontWeight: fired ? 600 : 400 }}>{step.label}</div>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{step.detail}</div>
              </div>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: fired ? C.teal : C.mutedLo, flexShrink: 0 }}>{fired ? `  ${((i + 1) * 0.8).toFixed(1)}s` : "--"}</span>
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
              { label: "ALERTS SENT",  value: String(steps.length), color: C.teal },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "10px 12px", borderRadius: 6, background: `${color}10`, border: `1px solid ${color}22`, textAlign: "center" }}>
                <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 3, letterSpacing: "0.08em" }}>{label}</div>
                <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 5, background: `${C.muted}0d`, border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>
              Human review: ~3 sec | Agent execution: {elapsed}s | vs. manual: {getManualComparison(decision.disruptionType)}
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
              {decision.agents.map(a => <Badge key={a} color={C.muted} small>{a}</Badge>)}
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.amber, marginLeft: "auto", fontWeight: 700 }}>  {decision.advanceWarning} advance warning</span>
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
                CONFIRM &amp; DISPATCH
            </button>
            <button onClick={handleOverride} style={{ flex: 1, padding: "11px 0", borderRadius: 6, border: `1px solid ${C.amber}`, background: `${C.amber}10`, color: C.amber, fontFamily: C.mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>
                OVERRIDE
            </button>
            <button onClick={() => setExpanded(!expanded)} style={{ padding: "11px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontFamily: C.mono, fontSize: 11, cursor: "pointer" }}>
              {expanded ? " " : " "}
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
              <span style={{ fontSize: 18, flexShrink: 0 }}> </span>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: "0.06em", marginBottom: 4 }}>OVERRIDE LOGGED - MANUAL ACTION REQUIRED</div>
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
        {isConfirmed && <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, flexShrink: 0, paddingTop: 2 }}>{expanded ? "  hide" : "  details"}</div>}
      </div>
      {expanded && isConfirmed && (
        <div style={{ padding: "0 20px 16px 20px", animation: "fadeSlideIn 0.2s ease" }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 10 }}>EXECUTION RECORD</div>
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

export default function DeltaAgentDashboard() {
  //    All four threat simulators run simultaneously   
  const [gaugeData, setGaugeData]   = useState(null);
  const [simGauge, setSimGauge]     = useState(4.4);
  const [floodScenario, setFloodScenario] = useState(() => buildFloodScenario(4.4));

  const [fogData, setFogData]       = useState(null);
  const [simVis, setSimVis]         = useState(8.0);
  const [fogScenario, setFogScenario] = useState(() => buildFogScenario(8.0));

  const [simIce, setSimIce]         = useState(1.0);
  const [iceScenario, setIceScenario] = useState(() => buildIceScenario(1.0));

  const [nhcData, setNhcData]       = useState(null);
  const [simStormDist, setSimStormDist] = useState(800);
  const [simStormCat, setSimStormCat]   = useState(2);
  const [stormScenario, setStormScenario] = useState(() => buildHurricaneScenario(800, 2));

  //    shared UI state   
  const [time, setTime]                   = useState(new Date());
  const [smsQueue, setSmsQueue]           = useState([]);
  const [overrideQueue, setOverrideQueue] = useState([]);
  const [activeTab, setActiveTab]         = useState("inbox");
  const [confirmedIds, setConfirmedIds]   = useState(new Set());
  const [overriddenIds, setOverriddenIds] = useState(new Set());
  const [autoExpandLogId, setAutoExpandLogId] = useState(null);
  const [sessionSavings, setSessionSavings]   = useState([]);
  const [agentLog, setAgentLog] = useState([
    { id: "bg1", time: "05:14:22", action: "MONITORING: Carrollton Gauge polled",     cost: "Stage 0.7ft   Nominal   No action required",      severity: "ok" },
    { id: "bg2", time: "05:00:00", action: "MONITORING: AIS vessel position updated", cost: "MV Delta Voyager   ETA Southwest Pass 04:20 CST", severity: "ok" },
    { id: "bg3", time: "04:45:11", action: "MONITORING: CN/KCS rail status checked",  cost: "14 intermodal cars staged   Yard 3   On schedule", severity: "ok" },
    { id: "bg4", time: "04:30:00", action: "MONITORING: Berth schedule reviewed",     cost: "Berth 2 nominal   Crane gang confirmed",           severity: "ok" },
  ]);

  //    Merge all active decisions from all threat types into one unified inbox   
  const allDecisions = [
    ...floodScenario.decisions,
    ...fogScenario.decisions,
    ...iceScenario.decisions,
    ...stormScenario.decisions,
  ];

  // Sort by severity: critical first, then warning
  const sortedDecisions = [...allDecisions].sort((a, b) => {
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (b.severity === "critical" && a.severity !== "critical") return 1;
    return 0;
  });

  const pendingDecisions  = sortedDecisions.filter(d => !confirmedIds.has(d.id) && !overriddenIds.has(d.id));
  const actionedDecisions = sortedDecisions.filter(d => confirmedIds.has(d.id) || overriddenIds.has(d.id));
  const pendingCount      = pendingDecisions.length;

  // Overall corridor status - worst active threat drives the header
  const allStatuses = [floodScenario, fogScenario, iceScenario, stormScenario];
  const hasCritical = allStatuses.some(s => s.status === "CRITICAL");
  const hasElevated = allStatuses.some(s => s.status === "ELEVATED");
  const corridorStatus      = hasCritical ? "CRITICAL" : hasElevated ? "ELEVATED" : "NOMINAL";
  const corridorStatusColor = hasCritical ? C.red : hasElevated ? C.amber : C.teal;

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
    setAgentLog(prev => [{
      id: logId,
      time: ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Chicago" }),
      action: `CONFIRMED: ${decision.title}`,
      cost: `$${decision.costAvoided.toLocaleString()} cost avoidance logged   ${getExecSteps(decision.disruptionType).length} alerts dispatched`,
      severity: decision.severity, disruptionType: decision.disruptionType,
    }, ...prev]);
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

  function removeSms(id) { setSmsQueue(q => q.filter(s => s.id !== id)); }

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
          onClick={() => { setOverrideQueue(q => q.filter(o => o.id !== ov.id)); setActiveTab("inbox"); }} />
      ))}

      <div style={{ minHeight: "100vh", background: C.bg, color: C.white, fontFamily: C.sans, position: "relative", overflow: "hidden" }}>
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
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div onClick={() => pendingCount > 0 && setActiveTab("inbox")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: pendingCount > 0 ? `${corridorStatusColor}18` : `${C.teal}10`, border: `1px solid ${pendingCount > 0 ? corridorStatusColor + "55" : C.teal + "33"}`, animation: pendingCount > 0 ? "pulseGlow 2s ease-in-out infinite" : "none", cursor: pendingCount > 0 ? "pointer" : "default" }}>
                <PulsingDot color={pendingCount > 0 ? corridorStatusColor : C.teal} size={7} />
                <span style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: pendingCount > 0 ? corridorStatusColor : C.teal, letterSpacing: "0.08em" }}>
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

          <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/*    ACTIVE THREAT MONITOR - all four threats shown simultaneously    */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 20px" }}>
              <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.12em", marginBottom: 12 }}>ACTIVE THREAT MONITOR   LOWER MISSISSIPPI CORRIDOR</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>

                {/* FLOOD */}
                <div style={{ background: `${floodScenario.statusColor}08`, border: `1px solid ${floodScenario.statusColor}33`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <PulsingDot color={floodScenario.statusColor} size={6} />
                      <span style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, color: floodScenario.statusColor, letterSpacing: "0.08em" }}>FLOOD</span>
                    </div>
                    {gaugeData ? <Badge color={C.teal} small>LIVE</Badge> : <Badge color={C.muted} small>STANDBY</Badge>}
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 700, color: floodScenario.statusColor, lineHeight: 1, marginBottom: 4 }}>{simGauge.toFixed(1)}<span style={{ fontSize: 11, color: C.muted, marginLeft: 3 }}>ft</span></div>
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 6 }}>Carrollton Gauge   8761927</div>
                  <GaugeBar value={simGauge} />
                  <input type="range" min={0} max={20} step={0.1} value={simGauge}
                    onChange={e => { const v = parseFloat(e.target.value); setSimGauge(v); setFloodScenario(buildFloodScenario(v)); }}
                    style={{ width: "100%", accentColor: C.teal, cursor: "pointer", marginTop: 6 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 7, color: C.muted }}>
                    <span style={{ color: "#93c5fd" }}>LOW</span><span style={{ color: C.amber }}>8 AP</span><span style={{ color: C.amber }}>11</span><span style={{ color: C.red }}>13 HPL</span><span style={{ color: C.red }}>17+</span>
                  </div>
                </div>

                {/* FOG - simFogIndex: 0=clear(10nm), 10=dense(0.05nm). Drag right = more fog = danger */}
                <div style={{ background: `${fogScenario.statusColor}08`, border: `1px solid ${fogScenario.statusColor}33`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <PulsingDot color={fogScenario.statusColor} size={6} />
                      <span style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, color: fogScenario.statusColor, letterSpacing: "0.08em" }}>FOG</span>
                    </div>
                    {fogData ? <Badge color={C.teal} small>LIVE</Badge> : <Badge color={C.muted} small>STANDBY</Badge>}
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 700, color: fogScenario.statusColor, lineHeight: 1, marginBottom: 4 }}>{simVis.toFixed(1)}<span style={{ fontSize: 11, color: C.muted, marginLeft: 3 }}>nm</span></div>
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 6 }}>SW Pass Visibility   BURL1</div>
                  <div style={{ width: "100%", height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative", marginBottom: 6 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(((10 - simVis) / 9.95) * 100, 100)}%`, background: fogScenario.statusColor, transition: "width 0.3s ease" }} />
                    {[2.0, 1.0, 0.5, 0.25].map((t, i) => (
                      <div key={i} style={{ position: "absolute", left: `${((10 - t) / 9.95) * 100}%`, top: 0, height: "100%", width: 1, background: i < 2 ? C.amber : C.red, opacity: 0.6 }} />
                    ))}
                  </div>
                  {/* Inverted slider: min=0.05(right/danger), max=10(left/clear), displayed reversed */}
                  <input type="range" min={0.05} max={10} step={0.05}
                    value={10 - simVis + 0.05}
                    onChange={e => { const inv = parseFloat(e.target.value); const v = Math.max(0.05, 10 - inv + 0.05); setSimVis(parseFloat(v.toFixed(2))); setFogScenario(buildFogScenario(parseFloat(v.toFixed(2)))); }}
                    style={{ width: "100%", accentColor: C.teal, cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 7, color: C.muted }}>
                    <span>10nm CLEAR</span><span style={{ color: C.amber }}>1.0</span><span style={{ color: C.amber }}>0.5</span><span style={{ color: C.red }}>0.25</span><span style={{ color: C.red }}>ZERO-ZERO</span>
                  </div>
                </div>

                {/* ICE */}
                <div style={{ background: `${iceScenario.statusColor}08`, border: `1px solid ${iceScenario.statusColor}33`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <PulsingDot color={iceScenario.statusColor} size={6} />
                      <span style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, color: iceScenario.statusColor, letterSpacing: "0.08em" }}>ICE</span>
                    </div>
                    <Badge color={C.muted} small>STANDBY</Badge>
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 700, color: iceScenario.statusColor, lineHeight: 1, marginBottom: 4 }}>{simIce.toFixed(1)}<span style={{ fontSize: 11, color: C.muted, marginLeft: 3 }}>/10</span></div>
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 6 }}>Corps Ice Index   Ohio/UMR</div>
                  <div style={{ width: "100%", height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative", marginBottom: 6 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(simIce / 10) * 100}%`, background: iceScenario.statusColor, transition: "width 1.2s ease" }} />
                    {[4, 7].map((t, i) => <div key={i} style={{ position: "absolute", left: `${(t / 10) * 100}%`, top: 0, height: "100%", width: 1, background: i === 0 ? C.amber : C.red, opacity: 0.6 }} />)}
                  </div>
                  <input type="range" min={0} max={10} step={0.1} value={simIce}
                    onChange={e => { const v = parseFloat(e.target.value); setSimIce(v); setIceScenario(buildIceScenario(v)); }}
                    style={{ width: "100%", accentColor: "#93c5fd", cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 7, color: C.muted }}>
                    <span>0</span><span style={{ color: C.amber }}>4</span><span style={{ color: C.red }}>7</span><span>10</span>
                  </div>
                </div>

                {/* HURRICANE - drag right = storm closer = danger. Display shows distance decreasing */}
                <div style={{ background: `${stormScenario.statusColor}08`, border: `1px solid ${stormScenario.statusColor}33`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <PulsingDot color={stormScenario.statusColor} size={6} />
                      <span style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, color: stormScenario.statusColor, letterSpacing: "0.08em" }}>HURRICANE</span>
                    </div>
                    {nhcData ? <Badge color={C.red} small>LIVE</Badge> : <Badge color={C.muted} small>STANDBY</Badge>}
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 700, color: stormScenario.statusColor, lineHeight: 1, marginBottom: 4 }}>{simStormDist}<span style={{ fontSize: 11, color: C.muted, marginLeft: 3 }}>mi</span></div>
                  <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, marginBottom: 6 }}>Storm Distance   NHC Track   Cat {simStormCat}</div>
                  <div style={{ width: "100%", height: 4, background: C.mutedLo, borderRadius: 2, overflow: "hidden", position: "relative", marginBottom: 6 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(((1000 - simStormDist) / 950) * 100, 100)}%`, background: stormScenario.statusColor, transition: "width 0.3s ease" }} />
                    <div style={{ position: "absolute", left: `${((1000 - 400) / 950) * 100}%`, top: 0, height: "100%", width: 1, background: C.amber, opacity: 0.6 }} />
                    <div style={{ position: "absolute", left: `${((1000 - 200) / 950) * 100}%`, top: 0, height: "100%", width: 1, background: C.red, opacity: 0.6 }} />
                  </div>
                  {/* Inverted: slider value = 1000-dist so dragging right decreases distance */}
                  <input type="range" min={0} max={950} step={10}
                    value={1000 - simStormDist}
                    onChange={e => { const v = 1000 - parseFloat(e.target.value); setSimStormDist(v); setStormScenario(buildHurricaneScenario(v, simStormCat)); }}
                    style={{ width: "100%", accentColor: "#a78bfa", cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 7, color: C.muted }}>
                    <span>1000mi CLEAR</span><span style={{ color: C.amber }}>400</span><span style={{ color: C.red }}>IMMINENT</span>
                  </div>
                  <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                    {[0,1,2,3,4,5].map(cat => (
                      <button key={cat} onClick={() => { setSimStormCat(cat); setStormScenario(buildHurricaneScenario(simStormDist, cat)); }} style={{ flex: 1, padding: "2px 0", borderRadius: 2, border: `1px solid ${simStormCat === cat ? "#a78bfa" : C.border}`, background: simStormCat === cat ? "#a78bfa22" : "transparent", color: simStormCat === cat ? "#a78bfa" : C.muted, fontFamily: C.mono, fontSize: 7, cursor: "pointer" }}>
                        {cat === 0 ? "TS" : `C${cat}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/*    HERO STATS ROW    */}
            <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: pendingCount > 0 ? `${corridorStatusColor}08` : C.panel, border: `1px solid ${pendingCount > 0 ? corridorStatusColor + "44" : C.border}`, borderRadius: 8, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 8 }}>DECISIONS AWAITING</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontFamily: C.mono, fontSize: 52, fontWeight: 700, color: pendingCount > 0 ? corridorStatusColor : C.muted, lineHeight: 1, textShadow: pendingCount > 0 ? `0 0 30px ${corridorStatusColor}44` : "none" }}>{pendingCount}</span>
                    <span style={{ fontFamily: C.mono, fontSize: 12, color: C.muted }}>{pendingCount === 1 ? "decision" : "decisions"}</span>
                  </div>
                </div>
                <div>
                  {pendingCount > 0 ? (
                    <div style={{ padding: "10px 12px", borderRadius: 6, background: `${C.amber}10`, border: `1px solid ${C.amber}33` }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted, letterSpacing: "0.08em", marginBottom: 4 }}>TOP ADVANCE WARNING</div>
                      <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.amber, lineHeight: 1 }}>  {pendingDecisions[0]?.advanceWarning}</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginTop: 4 }}>{pendingDecisions[0]?.disruptionType}   {pendingDecisions[0]?.disruptionLabel}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: C.muted }}>All systems nominal - no action required</div>
                  )}
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 8 }}>ACTIVE THREATS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "FLOOD", s: floodScenario, val: `${simGauge.toFixed(1)}ft` },
                      { label: "FOG",   s: fogScenario,   val: `${simVis.toFixed(1)}nm` },
                      { label: "ICE",   s: iceScenario,   val: `${simIce.toFixed(1)}/10` },
                      { label: "HURRICANE", s: stormScenario, val: `${simStormDist}mi` },
                    ].map(({ label, s, val }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.statusColor, flexShrink: 0 }} />
                          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: C.mono, fontSize: 9, color: s.statusColor === C.teal ? C.muted : s.statusColor }}>{s.status}</span>
                          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 12 }}>CORRIDOR SUMMARY</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>ACTIVE THREATS</span>
                      <span style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: hasCritical ? C.red : hasElevated ? C.amber : C.teal }}>
                        {[floodScenario, fogScenario, iceScenario, stormScenario].filter(s => s.status !== "NOMINAL").length} / 4
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>PENDING DECISIONS</span>
                      <span style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: pendingCount > 0 ? corridorStatusColor : C.muted }}>{pendingCount}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>POTENTIAL SAVINGS</span>
                      <span style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: pendingSavings > 0 ? C.green : C.muted }}>
                        {pendingSavings > 0 ? `$${pendingSavings.toLocaleString()}` : "--"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>NEXT VESSEL</span>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: simVis < 0.5 ? C.amber : C.white }}>
                        {simVis < 0.5 ? "HELD AT ANCHORAGE" : "MV Delta Voyager"}
                      </span>
                    </div>
                  </div>
                </div>
                {confirmedSavings > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6, background: `${C.green}10`, border: `1px solid ${C.green}22` }}>
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 2, letterSpacing: "0.08em" }}>CONFIRMED SAVINGS</div>
                    <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 700, color: C.green }}>${confirmedSavings.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            {/*    TABS    */}
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

            {/*    INBOX - unified across all threat types    */}
            {activeTab === "inbox" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingDecisions.map(d => (
                  <DecisionCard key={d.id} decision={d} onConfirm={handleConfirm} onOverride={handleOverride} />
                ))}
                {pendingDecisions.length === 0 && (
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: C.muted, textAlign: "center" }}>
                    <div style={{ fontSize: 32, opacity: 0.3 }}> </div>
                    <div style={{ fontFamily: C.mono, fontSize: 12, letterSpacing: "0.08em" }}>INBOX CLEAR</div>
                    <div style={{ fontSize: 13 }}>All threats nominal. Drag any simulator to trigger decisions.</div>
                  </div>
                )}
                {actionedDecisions.length > 0 && (
                  <div style={{ padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.teal}33`, background: `${C.teal}08`, display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <span style={{ color: C.teal, fontSize: 16 }}> </span>
                    <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.06em" }}>
                      {actionedDecisions.length} DECISION{actionedDecisions.length > 1 ? "S" : ""} ACTIONED
                    </div>
                  </div>
                )}
                {actionedDecisions.map(d => (
                  <div key={d.id + "-done"} id={`decision-${d.id}`} style={{ border: `1px solid ${confirmedIds.has(d.id) ? C.teal + "33" : C.amber + "33"}`, borderLeft: `3px solid ${confirmedIds.has(d.id) ? C.teal : C.amber}`, borderRadius: 8, background: confirmedIds.has(d.id) ? C.tealFaint : C.amberFaint, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: confirmedIds.has(d.id) ? C.teal : C.amber, fontSize: 14 }}>{confirmedIds.has(d.id) ? " " : " "}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{d.title}</div>
                        <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: threatColor[d.disruptionType] || C.muted }}>{d.disruptionType}</span>
                          <span> </span>
                          <span>{confirmedIds.has(d.id) ? `$${d.costAvoided.toLocaleString()} cost avoided` : "Overridden   Manual action required"}</span>
                        </div>
                      </div>
                    </div>
                    <Badge color={confirmedIds.has(d.id) ? C.teal : C.amber} small>{confirmedIds.has(d.id) ? "CONFIRMED" : "OVERRIDE"}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/*    AGENT LOG    */}
            {activeTab === "log" && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                {agentLog.map((entry, i) => (
                  <AgentLogEntry key={i} entry={entry} isFirst={i === 0} isLast={i === agentLog.length - 1}
                    entryId={entry.id} autoExpand={entry.id === autoExpandLogId} />
                ))}
              </div>
            )}

            {/*    IMPACT    */}
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
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em" }}>CONFIRMED ACTIONS - SESSION HISTORY</div>
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
                          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>avoided</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, background: `${C.green}08`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>Est. seasonal frequency (15-20 high-water events/year)</div>
                      <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: C.green }}>~${(sessionTotal * 15).toLocaleString()}-${(sessionTotal * 20).toLocaleString()} / season</div>
                    </div>
                  </div>
                )}
                {sessionSavings.length > 0 && (
                  <div style={{ padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel }}>
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.08em", marginBottom: 6 }}>PILOT ROI PROJECTION</div>
                    <div style={{ fontSize: 13, color: "#a0c4c0", lineHeight: 1.6 }}>
                      This session simulated <span style={{ color: C.green, fontWeight: 600 }}>${sessionTotal.toLocaleString()}</span> in cost avoidance across <span style={{ color: C.white, fontWeight: 600 }}>{sessionSavings.length} {sessionSavings.length === 1 ? "event" : "events"}</span>. The Lower Mississippi experiences <span style={{ color: C.white, fontWeight: 600 }}>15-20 high-water events per season</span>. At this rate, a single terminal could realize <span style={{ color: C.green, fontWeight: 600 }}>${(Math.round(sessionTotal / sessionSavings.length) * 15).toLocaleString()}-${(Math.round(sessionTotal / sessionSavings.length) * 20).toLocaleString()}</span> in annual cost avoidance.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/*    SYSTEM STATUS    */}
            {activeTab === "status" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>DATA FEEDS</div>
                  {[
                    { label: "NOAA Carrollton Gauge",           ok: !!gaugeData,  detail: gaugeData ? `${simGauge.toFixed(2)}ft live` : "simulated" },
                    { label: "NDBC BURL1 - SW Pass Visibility", ok: !!fogData,    detail: fogData ? `${fogData.toFixed(2)}nm live` : "simulated" },
                    { label: "Corps Ice Index",                  ok: false,        detail: "Simulated - Corps RSS feed" },
                    { label: "NHC Active Storms",               ok: !!nhcData,    detail: nhcData ? "Live storm data" : "No active storms / simulated" },
                    { label: "AIS Vessel Track",                ok: true,         detail: "MV Delta Voyager   SW Pass" },
                    { label: "SMS Gateway (Twilio)",            ok: true,         detail: "Ready to dispatch" },
                  ].map(({ label, ok, detail }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.white }}>{label}</div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{detail}</div>
                      </div>
                      <Badge color={ok ? C.teal : C.amber} small> {ok ? "ONLINE" : "STANDBY"}</Badge>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>AGENT NETWORK</div>
                  {[
                    { code: "RW", name: "River Warden",    color: C.teal,    status: "Monitoring all 4 threat feeds   15min cycle" },
                    { code: "BM", name: "Berth Master",    color: C.amber,   status: "Berth sequence optimized" },
                    { code: "IS", name: "Intermodal Sync", color: "#a78bfa", status: "Rail + truck handoff confirmed" },
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

            {/*    FOOTER    */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Badge color={C.teal}>TWIC-CLEARED FOUNDERS</Badge>
                <Badge color={C.tealDim}>MTSA ALIGNED</Badge>
                <Badge color={C.muted}>NEWLAB NEW ORLEANS</Badge>
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>2026 DELTAAGENT AI, LLC   deltaagent.ai   BETA</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
