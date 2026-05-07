require('dotenv').config();
const db = require('./database');

const teams = [
  { name: 'Estados Unidos', code: 'USA', flag: '🇺🇸', group: 'A' },
  { name: 'Jamaica',        code: 'JAM', flag: '🇯🇲', group: 'A' },
  { name: 'Panamá',         code: 'PAN', flag: '🇵🇦', group: 'A' },
  { name: 'Serbia',         code: 'SRB', flag: '🇷🇸', group: 'A' },

  { name: 'Canadá',         code: 'CAN', flag: '🇨🇦', group: 'B' },
  { name: 'Venezuela',      code: 'VEN', flag: '🇻🇪', group: 'B' },
  { name: 'Perú',           code: 'PER', flag: '🇵🇪', group: 'B' },
  { name: 'Marruecos',      code: 'MAR', flag: '🇲🇦', group: 'B' },

  { name: 'México',         code: 'MEX', flag: '🇲🇽', group: 'C' },
  { name: 'Ecuador',        code: 'ECU', flag: '🇪🇨', group: 'C' },
  { name: 'Chile',          code: 'CHI', flag: '🇨🇱', group: 'C' },
  { name: 'Camerún',        code: 'CMR', flag: '🇨🇲', group: 'C' },

  { name: 'Argentina',      code: 'ARG', flag: '🇦🇷', group: 'D' },
  { name: 'Paraguay',       code: 'PAR', flag: '🇵🇾', group: 'D' },
  { name: 'Bolivia',        code: 'BOL', flag: '🇧🇴', group: 'D' },
  { name: 'Nueva Zelanda',  code: 'NZL', flag: '🇳🇿', group: 'D' },

  { name: 'Brasil',         code: 'BRA', flag: '🇧🇷', group: 'E' },
  { name: 'Colombia',       code: 'COL', flag: '🇨🇴', group: 'E' },
  { name: 'Uruguay',        code: 'URU', flag: '🇺🇾', group: 'E' },
  { name: 'Corea del Sur',  code: 'KOR', flag: '🇰🇷', group: 'E' },

  { name: 'Alemania',       code: 'GER', flag: '🇩🇪', group: 'F' },
  { name: 'España',         code: 'ESP', flag: '🇪🇸', group: 'F' },
  { name: 'Portugal',       code: 'POR', flag: '🇵🇹', group: 'F' },
  { name: 'Japón',          code: 'JPN', flag: '🇯🇵', group: 'F' },

  { name: 'Francia',        code: 'FRA', flag: '🇫🇷', group: 'G' },
  { name: 'Inglaterra',     code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'G' },
  { name: 'Países Bajos',   code: 'NED', flag: '🇳🇱', group: 'G' },
  { name: 'Irán',           code: 'IRN', flag: '🇮🇷', group: 'G' },

  { name: 'Italia',         code: 'ITA', flag: '🇮🇹', group: 'H' },
  { name: 'Bélgica',        code: 'BEL', flag: '🇧🇪', group: 'H' },
  { name: 'Croacia',        code: 'CRO', flag: '🇭🇷', group: 'H' },
  { name: 'Arabia Saudita', code: 'KSA', flag: '🇸🇦', group: 'H' },

  { name: 'Turquía',        code: 'TUR', flag: '🇹🇷', group: 'I' },
  { name: 'Suiza',          code: 'SUI', flag: '🇨🇭', group: 'I' },
  { name: 'Dinamarca',      code: 'DEN', flag: '🇩🇰', group: 'I' },
  { name: 'Senegal',        code: 'SEN', flag: '🇸🇳', group: 'I' },

  { name: 'Austria',        code: 'AUT', flag: '🇦🇹', group: 'J' },
  { name: 'Polonia',        code: 'POL', flag: '🇵🇱', group: 'J' },
  { name: 'Rumania',        code: 'ROU', flag: '🇷🇴', group: 'J' },
  { name: 'Egipto',         code: 'EGY', flag: '🇪🇬', group: 'J' },

  { name: 'Hungría',        code: 'HUN', flag: '🇭🇺', group: 'K' },
  { name: 'Rep. Checa',     code: 'CZE', flag: '🇨🇿', group: 'K' },
  { name: 'Nigeria',        code: 'NGA', flag: '🇳🇬', group: 'K' },
  { name: 'Costa de Marfil',code: 'CIV', flag: '🇨🇮', group: 'K' },

  { name: 'Escocia',        code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'L' },
  { name: 'Australia',      code: 'AUS', flag: '🇦🇺', group: 'L' },
  { name: 'Argelia',        code: 'ALG', flag: '🇩🇿', group: 'L' },
  { name: 'Eslovenia',      code: 'SVN', flag: '🇸🇮', group: 'L' },
];

const venues = {
  A: 'MetLife Stadium, NJ',
  B: 'SoFi Stadium, LA',
  C: 'Estadio Azteca, CDMX',
  D: 'Hard Rock Stadium, Miami',
  E: 'Levi\'s Stadium, SF',
  F: 'Allianz Field, Minneapolis',
  G: 'AT&T Stadium, Dallas',
  H: 'Arrowhead Stadium, KC',
  I: 'Lincoln Financial Field, Phila.',
  J: 'Gillette Stadium, Boston',
  K: 'Rose Bowl, LA',
  L: 'BC Place, Vancouver',
};

// Base date: 11 June 2026
const BASE_DATE = new Date('2026-06-11T18:00:00Z');

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

function seedTeams() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM teams').get();
  if (existing.cnt > 0) {
    console.log('Teams already seeded, skipping.');
    return;
  }
  const insert = db.prepare(
    'INSERT INTO teams (name, code, flag, group_letter) VALUES (?, ?, ?, ?)'
  );
  const insertAll = db.transaction((rows) => {
    for (const t of rows) insert.run(t.name, t.code, t.flag, t.group);
  });
  insertAll(teams);
  console.log(`Inserted ${teams.length} teams.`);
}

function seedMatches() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM matches').get();
  if (existing.cnt > 0) {
    console.log('Matches already seeded, skipping.');
    return;
  }

  const insertMatch = db.prepare(`
    INSERT INTO matches (team1_id, team2_id, scheduled_at, stage, group_letter, venue)
    VALUES (?, ?, ?, 'group', ?, ?)
  `);

  const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  let dayOffset = 0;
  let matchCount = 0;

  const insertAll = db.transaction(() => {
    for (const g of groups) {
      const groupTeams = db.prepare(
        'SELECT id FROM teams WHERE group_letter = ? ORDER BY id'
      ).all(g);

      // Round-robin: each pair plays once
      const pairs = [
        [0,1],[2,3],  // matchday 1
        [0,2],[1,3],  // matchday 2
        [0,3],[1,2],  // matchday 3
      ];

      pairs.forEach(([a, b], idx) => {
        const md = Math.floor(idx / 2); // 0,0,1,1,2,2
        insertMatch.run(
          groupTeams[a].id,
          groupTeams[b].id,
          addDays(BASE_DATE, dayOffset + md * 4),
          g,
          venues[g]
        );
        matchCount++;
      });

      dayOffset++;
    }
  });

  insertAll();
  console.log(`Inserted ${matchCount} group stage matches.`);
}

function seedAdmin() {
  const bcrypt = require('bcryptjs');
  const existing = db.prepare("SELECT id FROM users WHERE email = 'admin@prode.com'").get();
  if (existing) {
    console.log('Admin user already exists.');
    return;
  }
  const hash = bcrypt.hashSync('admin1234', 10);
  db.prepare(
    'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, 1)'
  ).run('admin', 'admin@prode.com', hash);
  console.log('Admin user created: admin@prode.com / admin1234');
}

seedTeams();
seedMatches();
seedAdmin();
console.log('Seed completado.');
