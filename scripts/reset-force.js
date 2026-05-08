// Uso: railway run node scripts/reset-force.js
require('dotenv').config();
const db = require('../src/config/database');

const predCount  = db.prepare('SELECT COUNT(*) AS cnt FROM predictions').get().cnt;
const matchCount = db.prepare('SELECT COUNT(*) AS cnt FROM matches WHERE is_finished = 1').get().cnt;

console.log(`Predicciones a borrar : ${predCount}`);
console.log(`Resultados a resetear : ${matchCount}`);

db.prepare('DELETE FROM predictions').run();
db.prepare('UPDATE matches SET team1_score = NULL, team2_score = NULL, is_finished = 0, sync_log = NULL').run();

console.log('✅ Reset completo.');
