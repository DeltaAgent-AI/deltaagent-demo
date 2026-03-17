export default async function handler(req, res) {
  const url = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8761927&product=water_level&datum=STND&time_zone=lst_ldt&units=english&format=json&range=2";
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300");
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
