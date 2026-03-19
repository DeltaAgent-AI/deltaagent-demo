// api/wind.js - DeltaAgent Wind Observations
// Fetches live wind speed and direction from NOAA NWS
// Station: KMSY (Louis Armstrong New Orleans International Airport)
// No API key required — NWS API is fully open
//
// Wind is operationally critical for Lower Mississippi:
// - Vessels have speed restrictions above 25 knots sustained
// - Crane operations halt at 35+ knots
// - Barge fleeting requires additional mooring above 30 knots

const NWS_STATION  = "KMSY"; // New Orleans International Airport
const NWS_OBS_URL  = `https://api.weather.gov/stations/${NWS_STATION}/observations/latest`;

// Nav-specific wind thresholds (Lower Mississippi operational standards)
const WIND_THRESHOLDS = {
  VESSEL_CAUTION:  15, // knots — reduced speed advisory
  VESSEL_RESTRICT: 25, // knots — vessel size/speed restrictions
  CRANE_HALT:      35, // knots — crane operations suspended
  PORT_RESTRICT:   40, // knots — port movement restricted
};

function msToKnots(ms) {
  return ms != null ? parseFloat((ms * 1.94384).toFixed(1)) : null;
}

function degToCompass(deg) {
  if (deg == null) return "VRB";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function getWindStatus(knots) {
  if (knots == null) return { status: "UNKNOWN", color: "#4a7a75" };
  if (knots >= WIND_THRESHOLDS.PORT_RESTRICT)  return { status: "PORT RESTRICT",   color: "#dc2626" };
  if (knots >= WIND_THRESHOLDS.CRANE_HALT)     return { status: "CRANE HALT",      color: "#dc2626" };
  if (knots >= WIND_THRESHOLDS.VESSEL_RESTRICT)return { status: "VESSEL RESTRICT", color: "#d97706" };
  if (knots >= WIND_THRESHOLDS.VESSEL_CAUTION) return { status: "CAUTION",         color: "#d97706" };
  return { status: "NOMINAL", color: "#3bbfb2" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const r = await fetch(NWS_OBS_URL, {
      headers: {
        "User-Agent": "DeltaAgentAI/1.0 (deltaagent.ai; jordan@deltaagent.ai)",
        "Accept": "application/geo+json",
      },
    });

    if (!r.ok) {
      throw new Error(`NWS API returned ${r.status}`);
    }

    const data = await r.json();
    const props = data.properties;

    // Wind speed in m/s from NWS — convert to knots
    const speedMs    = props.windSpeed?.value;
    const gustMs     = props.windGust?.value;
    const dirDeg     = props.windDirection?.value;
    const speedKnots = msToKnots(speedMs);
    const gustKnots  = msToKnots(gustMs);
    const compass    = degToCompass(dirDeg);
    const { status, color } = getWindStatus(speedKnots);

    return res.json({
      ok: true,
      station: NWS_STATION,
      stationName: "Louis Armstrong New Orleans Intl Airport",
      timestamp: props.timestamp,
      wind: {
        speedKnots,
        gustKnots,
        directionDeg: dirDeg,
        directionCompass: compass,
        status,
        color,
        thresholds: WIND_THRESHOLDS,
      },
      raw: {
        speedMs,
        gustMs,
        tempC: props.temperature?.value,
        visibility: props.visibility?.value, // meters
        description: props.textDescription,
      },
    });

  } catch (err) {
    // Return simulated nominal wind on error
    return res.json({
      ok: true,
      simulated: true,
      station: NWS_STATION,
      stationName: "Louis Armstrong New Orleans Intl Airport",
      timestamp: new Date().toISOString(),
      wind: {
        speedKnots: 8.5,
        gustKnots: 12.0,
        directionDeg: 185,
        directionCompass: "S",
        status: "NOMINAL",
        color: "#3bbfb2",
        thresholds: WIND_THRESHOLDS,
      },
      error: err.message,
    });
  }
}
