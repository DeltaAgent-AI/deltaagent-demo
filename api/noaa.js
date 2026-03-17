export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  try {
    // NWPS API - official NWS gauge NORL1 (New Orleans/Carrollton)
    // This matches water.noaa.gov and the Corps of Engineers readings
    const url = "https://api.water.noaa.gov/nwps/v1/gauges/norl1/stageflow";
    const response = await fetch(url);
    const json = await response.json();

    // NWPS returns observed array with stage values
    const observed = json?.observed?.data;
    if (observed && observed.length > 0) {
      const latest = observed[observed.length - 1];
      const stage = parseFloat(latest.primary);
      if (!isNaN(stage)) {
        // Return in same format as NOAA CO-OPS so App.jsx doesnt need to change
        return res.json({
          data: [{ v: stage.toFixed(2), t: latest.valid }]
        });
      }
    }

    // Fallback: NOAA CO-OPS STND datum
    const fallback = await fetch(
      "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
      "?station=8761927&product=water_level&datum=STND" +
      "&time_zone=lst_ldt&units=english&format=json&range=2"
    );
    const fallbackData = await fallback.json();
    return res.json(fallbackData);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
