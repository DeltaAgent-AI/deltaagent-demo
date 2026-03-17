export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");
  const url = "https://www.ndbc.noaa.gov/data/realtime2/BURL1.txt";
  try {
    const r = await fetch(url);
    const txt = await r.text();
    const lines = txt.split("\n").filter(l => !l.startsWith("#") && l.trim());
    const parts = lines[0].trim().split(/\s+/);
    const vis = parseFloat(parts[16]);
    res.json({ vis: isNaN(vis) ? null : vis });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}