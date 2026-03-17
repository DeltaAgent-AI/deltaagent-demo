export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");
  try {
    // KMSY - Louis Armstrong Airport, closest reliable NWS visibility station
    const r = await fetch("https://api.weather.gov/stations/KMSY/observations/latest");
    const d = await r.json();
    const vis = d?.properties?.visibility?.value;
    // NWS returns visibility in meters, convert to nautical miles
    if (vis !== null && vis !== undefined) {
      const nm = vis / 1852;
      return res.json({ vis: parseFloat(nm.toFixed(2)) });
    }
    return res.json({ vis: null });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}