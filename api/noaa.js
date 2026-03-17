export default async function handler(req, res) {
  // NWS AHPS gauge NORL1 - New Orleans (Carrollton)
  // This is the same data source as weather.gov and Corps of Engineers
  // Returns the official river stage in feet matching public reports
  const url = "https://water.weather.gov/ahps2/hydrograph_to_xml.php?gage=norl1&output=tabular";
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // Parse the observed stage from the tabular HTML
    // Format: rows with date/time and stage value
    const match = text.match(/<td[^>]*>(\d+\.\d+)<\/td>/);
    if (match) {
      const stage = parseFloat(match[1]);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "s-maxage=300");
      res.json({ data: [{ v: stage.toFixed(2), t: new Date().toISOString() }] });
    } else {
      // Fallback to NOAA with manual offset
      const noaaUrl = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8761927&product=water_level&datum=STND&time_zone=lst_ldt&units=english&format=json&range=2";
      const noaaResp = await fetch(noaaUrl);
      const noaaData = await noaaResp.json();
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json(noaaData);
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
