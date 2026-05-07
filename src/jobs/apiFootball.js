// Cliente para API-Football (v3.football.api-sports.io)
// Plan gratuito: 100 requests/día, sin live scores

const API_HOST = 'v3.football.api-sports.io';
const WC_LEAGUE_ID = 1;   // FIFA World Cup
const WC_SEASON    = 2026;

async function apiFetch(path) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error('API_FOOTBALL_KEY no configurada en .env');

  const url = `https://${API_HOST}${path}`;
  const res = await fetch(url, {
    headers: { 'x-apisports-key': key },
  });

  if (!res.ok) throw new Error(`API-Football error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`API-Football: ${JSON.stringify(json.errors)}`);
  }
  return json.response;
}

function getFixtures(params = {}) {
  const qs = new URLSearchParams({
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
    ...params,
  }).toString();
  return apiFetch(`/fixtures?${qs}`);
}

function getFinishedFixtures() {
  return getFixtures({ status: 'FT' }); // FT = Full Time
}

function getAllFixtures() {
  return getFixtures();
}

module.exports = { getAllFixtures, getFinishedFixtures, WC_LEAGUE_ID, WC_SEASON };
