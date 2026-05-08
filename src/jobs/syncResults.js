require('dotenv').config();
const db = require('../config/database');
const { getWCGroupStageMatches, getWCMatchesByStage } = require('./apiFootballData');
const { getFinishedFixtures, getAllFixtures } = require('./apiFootball');

// ─── Datos locales de equipos ───────────────────────────────────────────────
// Cubre todos los equipos del WC 2026. Usar como fuente de verdad para nombres
// en español y emojis de bandera cuando la API no los provee.
const TEAM_DATA = {
  ALG: { name: 'Argelia',           flag: '🇩🇿' },
  ARG: { name: 'Argentina',         flag: '🇦🇷' },
  AUS: { name: 'Australia',         flag: '🇦🇺' },
  AUT: { name: 'Austria',           flag: '🇦🇹' },
  BEL: { name: 'Bélgica',          flag: '🇧🇪' },
  BIH: { name: 'Bosnia y Herz.',    flag: '🇧🇦' },
  BRA: { name: 'Brasil',            flag: '🇧🇷' },
  CAN: { name: 'Canadá',           flag: '🇨🇦' },
  CIV: { name: 'Costa de Marfil',   flag: '🇨🇮' },
  COD: { name: 'Rep. D. del Congo', flag: '🇨🇩' },
  COL: { name: 'Colombia',          flag: '🇨🇴' },
  CPV: { name: 'Cabo Verde',        flag: '🇨🇻' },
  CRO: { name: 'Croacia',           flag: '🇭🇷' },
  CUR: { name: 'Curazao',           flag: '🇨🇼' },
  CZE: { name: 'Rep. Checa',        flag: '🇨🇿' },
  ECU: { name: 'Ecuador',           flag: '🇪🇨' },
  EGY: { name: 'Egipto',            flag: '🇪🇬' },
  ENG: { name: 'Inglaterra',        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  ESP: { name: 'España',            flag: '🇪🇸' },
  FRA: { name: 'Francia',           flag: '🇫🇷' },
  GER: { name: 'Alemania',          flag: '🇩🇪' },
  GHA: { name: 'Ghana',             flag: '🇬🇭' },
  HAI: { name: 'Haití',            flag: '🇭🇹' },
  IRN: { name: 'Irán',             flag: '🇮🇷' },
  IRQ: { name: 'Irak',              flag: '🇮🇶' },
  ITA: { name: 'Italia',            flag: '🇮🇹' },
  JOR: { name: 'Jordania',          flag: '🇯🇴' },
  JPN: { name: 'Japón',            flag: '🇯🇵' },
  KOR: { name: 'Corea del Sur',     flag: '🇰🇷' },
  KSA: { name: 'Arabia Saudita',    flag: '🇸🇦' },
  MAR: { name: 'Marruecos',         flag: '🇲🇦' },
  MEX: { name: 'México',           flag: '🇲🇽' },
  NED: { name: 'Países Bajos',     flag: '🇳🇱' },
  NOR: { name: 'Noruega',           flag: '🇳🇴' },
  NZL: { name: 'Nueva Zelanda',     flag: '🇳🇿' },
  PAN: { name: 'Panamá',           flag: '🇵🇦' },
  PAR: { name: 'Paraguay',          flag: '🇵🇾' },
  POR: { name: 'Portugal',          flag: '🇵🇹' },
  QAT: { name: 'Catar',             flag: '🇶🇦' },
  RSA: { name: 'Sudáfrica',        flag: '🇿🇦' },
  SCO: { name: 'Escocia',           flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  SEN: { name: 'Senegal',           flag: '🇸🇳' },
  SUI: { name: 'Suiza',             flag: '🇨🇭' },
  SRB: { name: 'Serbia',            flag: '🇷🇸' },
  SWE: { name: 'Suecia',            flag: '🇸🇪' },
  TUN: { name: 'Túnez',            flag: '🇹🇳' },
  TUR: { name: 'Turquía',          flag: '🇹🇷' },
  URU: { name: 'Uruguay',           flag: '🇺🇾' },
  USA: { name: 'Estados Unidos',    flag: '🇺🇸' },
  UZB: { name: 'Uzbekistán',       flag: '🇺🇿' },
};

// Mapeo TLA de API-Football (inglés) → código local cuando difieren
const API_FOOTBALL_NAME_TO_CODE = {
  'United States':     'USA',
  'Netherlands':       'NED',
  'Czech Republic':    'CZE',
  'Czechia':           'CZE',
  'South Korea':       'KOR',
  'Republic of Korea': 'KOR',
  'Iran':              'IRN',
  'Saudi Arabia':      'KSA',
  'Ivory Coast':       'CIV',
  "Côte d'Ivoire":     'CIV',
  'New Zealand':       'NZL',
  'Morocco':           'MAR',
  'Algeria':           'ALG',
  'Scotland':          'SCO',
  'England':           'ENG',
  'Bosnia':            'BIH',
  'Mexico':            'MEX',
  'Panama':            'PAN',
  'Ecuador':           'ECU',
  'Paraguay':          'PAR',
  'Brazil':            'BRA',
  'Germany':           'GER',
  'Belgium':           'BEL',
  'Croatia':           'CRO',
  'Turkey':            'TUR',
  'Switzerland':       'SUI',
  'Serbia':            'SRB',
  'Denmark':           'DEN',
  'Austria':           'AUT',
  'Poland':            'POL',
  'Romania':           'ROU',
  'Egypt':             'EGY',
  'Hungary':           'HUN',
  'Nigeria':           'NGA',
  'Australia':         'AUS',
  'Italy':             'ITA',
  'South Africa':      'RSA',
  'Norway':            'NOR',
  'Sweden':            'SWE',
  'Ghana':             'GHA',
  'Haiti':             'HAI',
  'Iraq':              'IRQ',
  'Jordan':            'JOR',
  'Qatar':             'QAT',
  'Uzbekistan':        'UZB',
  'Cape Verde':        'CPV',
  'Curacao':           'CUR',
  'DR Congo':          'COD',
  'Congo DR':          'COD',
  'Tunisia':           'TUN',
};

function stageFromFD(apiStage) {
  switch (apiStage) {
    case 'GROUP_STAGE':    return 'group';
    case 'LAST_32':        return 'r32';
    case 'LAST_16':        return 'r16';
    case 'QUARTER_FINALS': return 'qf';
    case 'SEMI_FINALS':    return 'sf';
    case 'THIRD_PLACE':    return 'third';
    case 'FINAL':          return 'final';
    default:               return 'group';
  }
}

function groupLetterFromFD(apiGroup) {
  if (!apiGroup) return null;
  const m = apiGroup.match(/GROUP_([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}

// Obtiene o crea un equipo local por código TLA. Devuelve el id local.
function upsertTeam(tla, apiName, apiExternalId) {
  if (!tla) return null;
  const local = TEAM_DATA[tla];
  const name  = local?.name || apiName || tla;
  const flag  = local?.flag || '🏳️';

  const existing = db.prepare('SELECT id FROM teams WHERE code = ?').get(tla);
  if (existing) {
    db.prepare('UPDATE teams SET external_id = ? WHERE code = ?').run(apiExternalId ?? null, tla);
    return existing.id;
  }
  const result = db.prepare(
    'INSERT INTO teams (name, code, flag) VALUES (?, ?, ?)'
  ).run(name, tla, flag);
  if (apiExternalId) {
    db.prepare('UPDATE teams SET external_id = ? WHERE id = ?').run(apiExternalId, result.lastInsertRowid);
  }
  return result.lastInsertRowid;
}

// ─── SETUP desde football-data.org ──────────────────────────────────────────
// Importa el fixture real del WC 2026 (fase de grupos).
// REGLA DE ORO: si hay predicciones guardadas, NUNCA borra ni reemplaza matches.
// Solo actualiza metadatos (fecha, grupo, external_id).
async function setupFromFootballData() {
  const matches = await getWCGroupStageMatches();
  if (!matches.length) {
    return { imported: 0, total: 0, message: 'La API no devolvió partidos.' };
  }

  const predCount = db.prepare('SELECT COUNT(*) AS cnt FROM predictions').get().cnt;

  let imported = 0, updated = 0, skipped = 0;

  const run = db.transaction(() => {
    if (predCount === 0) {
      // Sin predicciones: reemplazo limpio
      db.prepare('DELETE FROM matches').run();
    }

    for (const m of matches) {
      const homeTla = m.homeTeam?.tla;
      const awayTla = m.awayTeam?.tla;
      if (!homeTla || !awayTla) { skipped++; continue; }

      const groupLetter = groupLetterFromFD(m.group);
      const stage       = stageFromFD(m.stage);
      const scheduledAt = m.utcDate
        ? new Date(m.utcDate).toISOString().replace('T', ' ').substring(0, 19)
        : null;

      // Upsert teams (actualiza group_letter con el valor real)
      const homeId = upsertTeam(homeTla, m.homeTeam.name, m.homeTeam.id);
      const awayId = upsertTeam(awayTla, m.awayTeam.name, m.awayTeam.id);
      if (groupLetter) {
        db.prepare('UPDATE teams SET group_letter = ? WHERE id = ?').run(groupLetter, homeId);
        db.prepare('UPDATE teams SET group_letter = ? WHERE id = ?').run(groupLetter, awayId);
      }

      if (predCount === 0) {
        db.prepare(`
          INSERT INTO matches (external_id, team1_id, team2_id, scheduled_at, stage, group_letter)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(m.id, homeId, awayId, scheduledAt, stage, groupLetter);
        imported++;
      } else {
        // Con predicciones: busca el match existente por par de equipos y actualiza solo metadatos
        const existing = db.prepare(`
          SELECT id FROM matches
          WHERE (team1_id = ? AND team2_id = ?) OR (team1_id = ? AND team2_id = ?)
        `).get(homeId, awayId, awayId, homeId);

        if (existing) {
          db.prepare(`
            UPDATE matches SET external_id = ?, scheduled_at = ?, stage = ?, group_letter = ?
            WHERE id = ?
          `).run(m.id, scheduledAt, stage, groupLetter, existing.id);
          updated++;
        } else {
          // Partido nuevo que no existía → insertar
          db.prepare(`
            INSERT INTO matches (external_id, team1_id, team2_id, scheduled_at, stage, group_letter)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(m.id, homeId, awayId, scheduledAt, stage, groupLetter);
          imported++;
        }
      }
    }
  });

  run();

  // Limpieza: elimina matches del seed que no tienen external_id (no vienen de la API)
  // y tampoco tienen predicciones. Son los partidos aproximados que ya no sirven.
  const cleaned = db.prepare(`
    DELETE FROM matches
    WHERE external_id IS NULL
      AND id NOT IN (SELECT DISTINCT match_id FROM predictions)
  `).run().changes;

  return {
    source: 'football-data.org',
    imported,
    updated,
    cleaned,
    skipped,
    total: matches.length,
    predCount,
    note: predCount > 0
      ? `⚠️ Había ${predCount} predicciones guardadas: metadatos actualizados, ${cleaned} partidos huérfanos eliminados.`
      : '✅ Sin predicciones previas: fixture reemplazado limpiamente.',
  };
}

// ─── Re-mapeo a API-Football (correr antes del torneo) ───────────────────────
// Actualiza external_id con los IDs de API-Football para habilitar el sync de resultados.
// No toca equipos ni datos de partidos — solo el campo external_id.
async function remapToApiFootball() {
  const fixtures = await getAllFixtures();
  if (!fixtures?.length) {
    return { remapped: 0, total: 0, message: 'API-Football aún no tiene el fixture 2026 disponible.' };
  }

  let remapped = 0, notFound = [];

  const remap = db.transaction(() => {
    for (const f of fixtures) {
      const homeName = f.teams?.home?.name;
      const awayName = f.teams?.away?.name;
      if (!homeName || !awayName) continue;

      const homeTla = API_FOOTBALL_NAME_TO_CODE[homeName] || homeName.slice(0, 3).toUpperCase();
      const awayTla = API_FOOTBALL_NAME_TO_CODE[awayName] || awayName.slice(0, 3).toUpperCase();

      const homeTeam = db.prepare('SELECT id FROM teams WHERE code = ?').get(homeTla);
      const awayTeam = db.prepare('SELECT id FROM teams WHERE code = ?').get(awayTla);
      if (!homeTeam || !awayTeam) { notFound.push(`${homeName} vs ${awayName}`); continue; }

      const match = db.prepare(`
        SELECT id FROM matches
        WHERE (team1_id = ? AND team2_id = ?) OR (team1_id = ? AND team2_id = ?)
      `).get(homeTeam.id, awayTeam.id, awayTeam.id, homeTeam.id);

      if (match) {
        db.prepare('UPDATE matches SET external_id = ? WHERE id = ?').run(f.fixture.id, match.id);
        remapped++;
      } else {
        notFound.push(`Sin partido local: ${homeName} vs ${awayName}`);
      }
    }
  });

  remap();
  return { source: 'api-football', remapped, total: fixtures.length, notFound };
}

// ─── Sync de resultados (API-Football) ───────────────────────────────────────
// Actualiza scores de partidos finalizados y recalcula puntos.
// Nunca borra ni modifica predicciones — solo les asigna points_earned.
async function syncResults() {
  const finished = await getFinishedFixtures();
  if (!finished?.length) {
    return { updated: 0, skipped: 0, message: 'No hay partidos finalizados en API-Football todavía.' };
  }

  let updated = 0, skipped = 0;

  const updateMatch  = db.prepare(`
    UPDATE matches SET team1_score = ?, team2_score = ?, is_finished = 1, sync_log = ?
    WHERE external_id = ? AND is_finished = 0
  `);
  const updatePoints = db.prepare('UPDATE predictions SET points_earned = ? WHERE id = ?');

  const run = db.transaction(() => {
    for (const f of finished) {
      const score = f.goals;
      if (score.home == null || score.away == null) { skipped++; continue; }

      const note = `API-Football · ${new Date().toISOString()}`;
      const res  = updateMatch.run(score.home, score.away, note, f.fixture.id);

      if (res.changes === 0) { skipped++; continue; }

      const match = db.prepare('SELECT id FROM matches WHERE external_id = ?').get(f.fixture.id);
      if (!match) continue;

      for (const pred of db.prepare(
        'SELECT id, team1_score AS p1, team2_score AS p2 FROM predictions WHERE match_id = ?'
      ).all(match.id)) {
        updatePoints.run(calcPoints(pred.p1, pred.p2, score.home, score.away), pred.id);
      }

      updated++;
    }
  });

  run();
  return { source: 'api-football', updated, skipped, total: finished.length };
}

function calcPoints(p1, p2, a1, a2) {
  if (p1 === a1 && p2 === a2) return 3;
  if (Math.sign(p1 - p2) === Math.sign(a1 - a2)) return 1;
  return 0;
}

// ─── Importar una fase de playoff ────────────────────────────────────────────
// Trae los partidos de una fase eliminatoria desde football-data.org
// e inserta solo los que ya tienen ambos equipos definidos.
// No toca predicciones existentes — solo agrega partidos nuevos.
async function importKnockoutStage(fdStage) {
  const matches = await getWCMatchesByStage(fdStage);
  if (!matches.length) {
    return { imported: 0, skipped: 0, message: 'La API no devolvió partidos para esta fase.' };
  }

  let imported = 0, skipped = 0, tbd = 0;

  const run = db.transaction(() => {
    for (const m of matches) {
      const homeTla = m.homeTeam?.tla;
      const awayTla = m.awayTeam?.tla;

      // Equipos aún no definidos (TBD)
      if (!homeTla || !awayTla) { tbd++; continue; }

      const homeTeam = db.prepare('SELECT id FROM teams WHERE code = ?').get(homeTla);
      const awayTeam = db.prepare('SELECT id FROM teams WHERE code = ?').get(awayTla);

      if (!homeTeam || !awayTeam) { skipped++; continue; }

      // Evitar duplicados
      const existing = db.prepare('SELECT id FROM matches WHERE external_id = ?').get(m.id);
      if (existing) { skipped++; continue; }

      const stage       = stageFromFD(m.stage);
      const scheduledAt = m.utcDate
        ? new Date(m.utcDate).toISOString().replace('T', ' ').substring(0, 19)
        : null;

      db.prepare(`
        INSERT INTO matches (external_id, team1_id, team2_id, scheduled_at, stage, group_letter)
        VALUES (?, ?, ?, ?, ?, NULL)
      `).run(m.id, homeTeam.id, awayTeam.id, scheduledAt, stage);

      imported++;
    }
  });

  run();

  return {
    imported,
    skipped,
    tbd,
    total: matches.length,
    message: tbd > 0 ? `${tbd} partido(s) aún sin equipos definidos (TBD), se importarán cuando se confirmen.` : null,
  };
}

module.exports = { setupFromFootballData, remapToApiFootball, syncResults, importKnockoutStage };
