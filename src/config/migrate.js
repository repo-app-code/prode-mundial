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

db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    token      TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used       INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('Migración completada.');
