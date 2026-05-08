// Cliente para football-data.org v4
// Plan gratuito: 10 req/min, acceso completo al WC 2026

const FD_BASE   = 'https://api.football-data.org/v4';
const WC_CODE   = 'WC';
const WC_SEASON = 2026;

async function fdFetch(path) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) throw new Error('FOOTBALL_DATA_KEY no configurada en .env');

  const res = await fetch(`${FD_BASE}${path}`, {
    headers: { 'X-Auth-Token': key },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`football-data.org error ${res.status}: ${body}`);
  }

  return res.json();
}

async function getWCGroupStageMatches() {
  const data = await fdFetch(`/competitions/${WC_CODE}/matches?season=${WC_SEASON}&stage=GROUP_STAGE`);
  return data.matches || [];
}

async function getWCFinishedMatches() {
  const data = await fdFetch(`/competitions/${WC_CODE}/matches?season=${WC_SEASON}&status=FINISHED`);
  return data.matches || [];
}

// stage: 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL'
async function getWCMatchesByStage(stage) {
  const data = await fdFetch(`/competitions/${WC_CODE}/matches?season=${WC_SEASON}&stage=${stage}`);
  return data.matches || [];
}

module.exports = { getWCGroupStageMatches, getWCFinishedMatches, getWCMatchesByStage };
