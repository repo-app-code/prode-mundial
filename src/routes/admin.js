const express = require('express');
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

module.exports = router;
