const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all predictions of the logged-in user
router.get('/', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      m.scheduled_at, m.is_finished, m.team1_score AS actual1, m.team2_score AS actual2,
      m.stage, m.group_letter,
      t1.name AS team1_name, t1.flag AS team1_flag,
      t2.name AS team2_name, t2.flag AS team2_flag
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    JOIN teams t1  ON t1.id = m.team1_id
    JOIN teams t2  ON t2.id = m.team2_id
    WHERE p.user_id = ?
    ORDER BY m.scheduled_at
  `).all(req.user.id);
  res.json(rows);
});

// Create or update a prediction for a match
router.put('/:matchId', authenticate, (req, res) => {
  const { team1_score, team2_score } = req.body;
  if (team1_score == null || team2_score == null) {
    return res.status(400).json({ error: 'Debes ingresar los dos marcadores' });
  }

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.matchId);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

  // Lock predictions once match has started
  if (new Date() >= new Date(match.scheduled_at.replace(' ', 'T') + 'Z')) {
    return res.status(400).json({ error: 'No se pueden modificar pronósticos una vez iniciado el partido' });
  }

  const existing = db.prepare(
    'SELECT id FROM predictions WHERE user_id = ? AND match_id = ?'
  ).get(req.user.id, req.params.matchId);

  if (existing) {
    db.prepare(
      'UPDATE predictions SET team1_score = ?, team2_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(team1_score, team2_score, existing.id);
  } else {
    db.prepare(
      'INSERT INTO predictions (user_id, match_id, team1_score, team2_score) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, req.params.matchId, team1_score, team2_score);
  }

  res.json({ message: 'Pronóstico guardado' });
});

// Global ranking
router.get('/ranking/global', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username,
      COALESCE(SUM(p.points_earned), 0) AS total_points,
      COUNT(p.id) AS total_predictions,
      SUM(CASE WHEN p.points_earned = 3 THEN 1 ELSE 0 END) AS exact_results
    FROM users u
    LEFT JOIN predictions p ON p.user_id = u.id
    WHERE u.is_admin = 0
    GROUP BY u.id
    ORDER BY total_points DESC, exact_results DESC
  `).all();
  res.json(rows);
});

// Group-specific ranking
router.get('/ranking/group/:groupId', authenticate, (req, res) => {
  const member = db.prepare(
    "SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'approved'"
  ).get(req.params.groupId, req.user.id);
  if (!member) return res.status(403).json({ error: 'No eres miembro de este grupo' });

  const rows = db.prepare(`
    SELECT u.id, u.username,
      COALESCE(SUM(p.points_earned), 0) AS total_points,
      COUNT(p.id) AS total_predictions,
      SUM(CASE WHEN p.points_earned = 3 THEN 1 ELSE 0 END) AS exact_results
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN predictions p ON p.user_id = u.id
    WHERE gm.group_id = ? AND gm.status = 'approved'
    GROUP BY u.id
    ORDER BY total_points DESC, exact_results DESC
  `).all(req.params.groupId);
  res.json(rows);
});

module.exports = router;
