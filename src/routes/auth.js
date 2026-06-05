const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

function getBaseUrl() {
  const url = process.env.APP_URL || 'http://localhost:3000';
  return url.replace(/\/[^/]+\.html$/, '').replace(/\/$/, '');
}

async function sendMail({ to, subject, html }) {
  console.log('BREVO_KEY length:', process.env.BREVO_KEY?.length, '| starts with:', process.env.BREVO_KEY?.slice(0, 8));
  console.log('All env keys:', Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('PASS') && !k.includes('KEY') && !k.includes('TOKEN')).join(', '));
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:      { name: 'Prode Mundial 2026', email: process.env.MAIL_USER },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }
}

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

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  const user = db.prepare('SELECT id, username FROM users WHERE email = ?').get(email);
  if (!user) return res.json({ message: 'ok' }); // no revelar si existe

  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
  db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
    .run(user.id, token, expiresAt);

  const resetUrl = `${getBaseUrl()}/reset-password.html?token=${token}`;

  try {
    await sendMail({
      to:      email,
      subject: 'Recupero de contraseña – Prode Mundial 2026',
      html: `
        <div style="font-family:sans-serif; max-width:480px; margin:auto;">
          <h2 style="color:#1a56a4;">⚽ Prode Mundial 2026</h2>
          <p>Hola <strong>${user.username}</strong>,</p>
          <p>Recibimos una solicitud para resetear tu contraseña.</p>
          <p style="margin:1.5rem 0;">
            <a href="${resetUrl}"
               style="background:#1a56a4; color:#fff; padding:.7rem 1.5rem; border-radius:8px; text-decoration:none; font-weight:600;">
              Resetear contraseña
            </a>
          </p>
          <p style="color:#64748b; font-size:.85rem;">El link expira en 1 hora.<br>
          Si no solicitaste esto, ignorá este email.</p>
        </div>`,
    });
  } catch (err) {
    console.error('Email error:', err.message);
    return res.status(500).json({ error: 'No se pudo enviar el email. Verificá la configuración SMTP.' });
  }

  res.json({ message: 'ok' });
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Datos incompletos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const record = db.prepare(
    'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0'
  ).get(token);

  if (!record) return res.status(400).json({ error: 'Link inválido o ya utilizado' });
  if (new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: 'El link expiró. Solicitá uno nuevo.' });
  }

  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(bcrypt.hashSync(password, 10), record.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
      .run(record.id);
  })();

  res.json({ message: 'Contraseña actualizada correctamente' });
});

module.exports = router;
