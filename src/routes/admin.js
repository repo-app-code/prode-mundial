const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { setupFromFootballData, remapToApiFootball, syncResults, importKnockoutStage } = require('../jobs/syncResults');
const db = require('../config/database');

const router = express.Router();

let lastSync = null;

router.get('/sync/status', authenticate, requireAdmin, (req, res) => {
  const mapped   = db.prepare('SELECT COUNT(*) AS cnt FROM matches WHERE external_id IS NOT NULL').get().cnt;
  const total    = db.prepare('SELECT COUNT(*) AS cnt FROM matches').get().cnt;
  const predCount = db.prepare('SELECT COUNT(*) AS cnt FROM predictions').get().cnt;
  res.json({ lastSync, mappedCount: mapped, totalMatches: total, predCount });
});

// Paso 1: Importar fixture real desde football-data.org
router.post('/sync/setup-fd', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await setupFromFootballData();
    lastSync = { type: 'setup-fd', at: new Date().toISOString(), result };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paso 2 (antes del torneo): Remap a IDs de API-Football para habilitar sync de resultados
router.post('/sync/remap-apifootball', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await remapToApiFootball();
    lastSync = { type: 'remap-apifootball', at: new Date().toISOString(), result };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paso 3 (durante el torneo): Sync de resultados desde API-Football
router.post('/sync/results', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await syncResults();
    lastSync = { type: 'sync-results', at: new Date().toISOString(), result };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importar partidos de una fase de playoff (correr cuando los cruces estén definidos)
const VALID_KNOCKOUT_STAGES = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

router.post('/sync/import-stage', authenticate, requireAdmin, async (req, res) => {
  const { stage } = req.body;
  if (!stage || !VALID_KNOCKOUT_STAGES.includes(stage)) {
    return res.status(400).json({ error: `Fase inválida. Opciones: ${VALID_KNOCKOUT_STAGES.join(', ')}` });
  }
  try {
    const result = await importKnockoutStage(stage);
    lastSync = { type: `import-stage:${stage}`, at: new Date().toISOString(), result };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all non-admin users
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, username, email, created_at FROM users WHERE is_admin = 0 ORDER BY username'
  ).all();
  res.json(users);
});

// Reset password (generates a temporary password, shown once)
router.post('/users/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const user = db.prepare(
    'SELECT id, username FROM users WHERE id = ? AND is_admin = 0'
  ).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const tempPassword = crypto.randomBytes(5).toString('hex'); // 10 chars
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(tempPassword, 10), req.params.id);

  res.json({ username: user.username, temp_password: tempPassword });
});

module.exports = router;
