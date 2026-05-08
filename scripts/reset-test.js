require('dotenv').config();
const db = require('../src/config/database');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const predCount  = db.prepare('SELECT COUNT(*) AS cnt FROM predictions').get().cnt;
const matchCount = db.prepare('SELECT COUNT(*) AS cnt FROM matches WHERE is_finished = 1').get().cnt;

console.log(`\nEstado actual:`);
console.log(`  Predicciones guardadas : ${predCount}`);
console.log(`  Partidos con resultado : ${matchCount}`);
console.log(`\nEsto va a borrar TODAS las predicciones y resetear todos los resultados.`);

rl.question('\n¿Confirmar reset? Escribí "reset" para continuar: ', (answer) => {
  rl.close();
  if (answer.trim() !== 'reset') {
    console.log('Cancelado.');
    process.exit(0);
  }

  db.prepare('DELETE FROM predictions').run();
  db.prepare(`
    UPDATE matches
    SET team1_score = NULL, team2_score = NULL, is_finished = 0, sync_log = NULL
  `).run();

  console.log('✅ Reset completo. Predicciones eliminadas y resultados borrados.');
});
