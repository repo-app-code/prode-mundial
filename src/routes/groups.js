const express = require('express');
const crypto = require('crypto');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// List groups where user is an approved member
router.get('/', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT g.*, u.username AS creator_name,
      gm.role AS my_role,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'approved') AS member_count,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'pending') AS pending_count
    FROM private_groups g
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
    JOIN users u ON u.id = g.created_by
    WHERE gm.status = 'approved' AND g.is_active = 1
    ORDER BY g.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// Create group
router.post('/', authenticate, (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre del grupo es obligatorio' });

  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 10) return res.status(500).json({ error: 'No se pudo generar un código único' });
  } while (db.prepare('SELECT id FROM private_groups WHERE invite_code = ?').get(code));

  const create = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO private_groups (name, description, created_by, invite_code) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), description?.trim() || null, req.user.id, code);

    db.prepare(
      "INSERT INTO group_members (group_id, user_id, role, status) VALUES (?, ?, 'creator', 'approved')"
    ).run(result.lastInsertRowid, req.user.id);

    return result.lastInsertRowid;
  });

  const id = create();
  const group = db.prepare('SELECT * FROM private_groups WHERE id = ?').get(id);
  res.status(201).json(group);
});

// Get group by invite code (preview before joining)
router.get('/preview/:code', authenticate, (req, res) => {
  const group = db.prepare(
    'SELECT id, name, description FROM private_groups WHERE invite_code = ? AND is_active = 1'
  ).get(req.params.code.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Código de invitación inválido' });

  const memberCount = db.prepare(
    "SELECT COUNT(*) AS cnt FROM group_members WHERE group_id = ? AND status = 'approved'"
  ).get(group.id).cnt;

  res.json({ ...group, member_count: memberCount });
});

// Join group by invite code
router.post('/join', authenticate, (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'Código de invitación requerido' });

  const group = db.prepare(
    'SELECT * FROM private_groups WHERE invite_code = ? AND is_active = 1'
  ).get(invite_code.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Código inválido o grupo inactivo' });

  const existing = db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(group.id, req.user.id);

  if (existing) {
    if (existing.status === 'approved') return res.status(409).json({ error: 'Ya eres miembro de este grupo' });
    if (existing.status === 'pending') return res.status(409).json({ error: 'Tu solicitud ya está pendiente' });
    if (existing.status === 'rejected') {
      db.prepare(
        "UPDATE group_members SET status = 'pending' WHERE id = ?"
      ).run(existing.id);
      return res.json({ message: 'Solicitud reenviada, espera aprobación de un administrador' });
    }
  }

  db.prepare(
    "INSERT INTO group_members (group_id, user_id, role, status) VALUES (?, ?, 'member', 'pending')"
  ).run(group.id, req.user.id);

  res.status(201).json({ message: 'Solicitud enviada, espera aprobación de un administrador' });
});

// Get group detail (members only)
router.get('/:id', authenticate, (req, res) => {
  const membership = db.prepare(
    "SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'approved'"
  ).get(req.params.id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'No eres miembro de este grupo' });

  const group = db.prepare(
    'SELECT g.*, u.username AS creator_name FROM private_groups g JOIN users u ON u.id = g.created_by WHERE g.id = ?'
  ).get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

  const members = db.prepare(`
    SELECT gm.id AS membership_id, gm.role, gm.status, gm.joined_at,
      u.id AS user_id, u.username
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY gm.status, gm.joined_at
  `).all(req.params.id);

  res.json({ ...group, my_role: membership.role, members });
});

// Update member status or role (admins and creators only)
router.patch('/:id/members/:userId', authenticate, (req, res) => {
  const { status, role } = req.body;

  const myMembership = db.prepare(
    "SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'approved'"
  ).get(req.params.id, req.user.id);

  if (!myMembership || (myMembership.role !== 'admin' && myMembership.role !== 'creator')) {
    return res.status(403).json({ error: 'Solo administradores pueden gestionar miembros' });
  }

  const target = db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(req.params.id, req.params.userId);
  if (!target) return res.status(404).json({ error: 'Miembro no encontrado' });

  // Prevent modifying the creator
  if (target.role === 'creator') {
    return res.status(403).json({ error: 'No se puede modificar al creador del grupo' });
  }

  const updates = {};
  if (status) updates.status = status;
  // Only creator can promote/demote admins
  if (role && myMembership.role === 'creator') updates.role = role;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE group_members SET ${setClauses} WHERE group_id = ? AND user_id = ?`)
    .run(...Object.values(updates), req.params.id, req.params.userId);

  res.json({ message: 'Miembro actualizado' });
});

// Remove member (admin) or leave group (self)
router.delete('/:id/members/:userId', authenticate, (req, res) => {
  const isSelf = String(req.user.id) === String(req.params.userId);

  if (!isSelf) {
    const myMembership = db.prepare(
      "SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'approved'"
    ).get(req.params.id, req.user.id);
    if (!myMembership || (myMembership.role !== 'admin' && myMembership.role !== 'creator')) {
      return res.status(403).json({ error: 'Sin permisos para expulsar miembros' });
    }
  }

  const target = db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(req.params.id, req.params.userId);

  if (!target) return res.status(404).json({ error: 'Miembro no encontrado' });
  if (target.role === 'creator' && !isSelf) {
    return res.status(403).json({ error: 'No se puede expulsar al creador' });
  }

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
    .run(req.params.id, req.params.userId);

  res.json({ message: isSelf ? 'Saliste del grupo' : 'Miembro eliminado' });
});

module.exports = router;
