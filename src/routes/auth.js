const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const existing = db.prepare(
    'SELECT id FROM users WHERE email = ? OR username = ?'
  ).get(email, username);
  if (existing) {
    return res.status(409).json({ error: 'El email o nombre de usuario ya está en uso' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  ).run(username, email, hash);

  const token = jwt.sign(
    { id: result.lastInsertRowid, username, email, is_admin: 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.status(201).json({ token, user: { id: result.lastInsertRowid, username, email, is_admin: 0 } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin }
  });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

module.exports = router;
