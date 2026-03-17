export default async function handler(req, res) {
  const url = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8761927&product=water_level&datum=MLLW&time_zone=lst_ldt&units=english&format=json&range=2";
  const data = await fetch(url).then(r => r.json());
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(data);
}