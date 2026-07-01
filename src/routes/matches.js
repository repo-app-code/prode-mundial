const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const MATCH_SQL = `
  SELECT
    m.*,
    t1.name  AS team1_name,  t1.code AS team1_code,  t1.flag AS team1_flag,
    t2.name  AS team2_name,  t2.code AS team2_code,  t2.flag AS team2_flag
  FROM matches m
  JOIN teams t1 ON t1.id = m.team1_id
  JOIN teams t2 ON t2.id = m.team2_id
`;

router.get('/', authenticate, (req, res) => {
  const { stage, group } = req.query;
  let sql = MATCH_SQL;
  const params = [];

  if (stage) { sql += ' WHERE m.stage = ?'; params.push(stage); }
  if (group) {
    sql += params.length ? ' AND' : ' WHERE';
    sql += ' m.group_letter = ?';
    params.push(group);
  }
  sql += ' ORDER BY m.scheduled_at';

  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', authenticate, (req, res) => {
  const match = db.prepare(MATCH_SQL + ' WHERE m.id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  res.json(match);
});

router.put('/:id/result', authenticate, requireAdmin, (req, res) => {
  const { team1_score, team2_score, winner_code } = req.body;
  if (team1_score == null || team2_score == null) {
    return res.status(400).json({ error: 'Se requieren los marcadores de ambos equipos' });
  }

  const match = db.prepare(`
    SELECT m.id, m.stage, t1.code AS team1_code, t2.code AS team2_code
    FROM matches m
    JOIN teams t1 ON t1.id = m.team1_id
    JOIN teams t2 ON t2.id = m.team2_id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

  const isPlayoff = match.stage !== 'group';
  let effectiveWinner = null;
  if (isPlayoff) {
    if (team1_score > team2_score)      effectiveWinner = match.team1_code;
    else if (team2_score > team1_score) effectiveWinner = match.team2_code;
    else                                effectiveWinner = winner_code || null;
  }

  db.prepare(
    'UPDATE matches SET team1_score = ?, team2_score = ?, winner_code = ?, is_finished = 1 WHERE id = ?'
  ).run(team1_score, team2_score, effectiveWinner, match.id);

  const predictions = db.prepare(
    'SELECT id, team1_score AS p1, team2_score AS p2, predicted_winner FROM predictions WHERE match_id = ?'
  ).all(match.id);

  const updatePoints = db.prepare('UPDATE predictions SET points_earned = ? WHERE id = ?');
  const update = db.transaction(() => {
    for (const pred of predictions) {
      const pts = calcPoints(pred.p1, pred.p2, team1_score, team2_score, {
        isPlayoff,
        predictedWinner: pred.predicted_winner,
        actualWinner: effectiveWinner,
        team1Code: match.team1_code,
        team2Code: match.team2_code,
      });
      updatePoints.run(pts, pred.id);
    }
  });
  update();

  res.json({ message: 'Resultado actualizado y puntos recalculados' });
});

function calcPoints(p1, p2, a1, a2, opts = {}) {
  if (p1 === a1 && p2 === a2) {
    if (opts.isPlayoff && p1 === p2 && opts.predictedWinner && opts.actualWinner) {
      return opts.predictedWinner === opts.actualWinner ? 4 : 3;
    }
    return 3;
  }
  if (opts.isPlayoff) {
    const effectivePred = (p1 !== p2)
      ? (p1 > p2 ? opts.team1Code : opts.team2Code)
      : opts.predictedWinner;
    return (effectivePred && opts.actualWinner && effectivePred === opts.actualWinner) ? 1 : 0;
  }
  return Math.sign(p1 - p2) === Math.sign(a1 - a2) ? 1 : 0;
}

module.exports = router;
