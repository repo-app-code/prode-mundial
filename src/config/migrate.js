require('dotenv').config();
const db = require('./database');

// Agrega external_id a teams y matches si no existen todavía
const tableInfo = (table) => db.prepare(`PRAGMA table_info(${table})`).all();

if (!tableInfo('teams').find(c => c.name === 'external_id')) {
  db.exec('ALTER TABLE teams ADD COLUMN external_id INTEGER');
  console.log('teams.external_id agregado');
}

if (!tableInfo('matches').find(c => c.name === 'external_id')) {
  db.exec('ALTER TABLE matches ADD COLUMN external_id INTEGER');
  console.log('matches.external_id agregado');
}

if (!tableInfo('matches').find(c => c.name === 'sync_log')) {
  db.exec('ALTER TABLE matches ADD COLUMN sync_log TEXT');
  console.log('matches.sync_log agregado');
}

console.log('Migración completada.');
