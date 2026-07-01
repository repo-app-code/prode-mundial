const user = requireAuth();
if (!user?.is_admin) window.location.href = '/dashboard.html';

const STAGE_LABELS = {
  group: 'Fase de Grupos',
  r32:   'Ronda de 32',
  r16:   'Octavos de Final',
  qf:    'Cuartos de Final',
  sf:    'Semifinales',
  third: 'Tercer Puesto',
  final: 'Final',
};
const STAGE_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

let allMatches = [];
let activeFilter = 'all';
let editingMatchId = null;
let selectedResultWinner = null;

async function loadMatches() {
  allMatches = await api.get('/matches');
  renderFilters();
  renderMatches();
}

function renderFilters() {
  const groups = [...new Set(allMatches.filter(m => m.group_letter).map(m => m.group_letter))].sort();
  const knockoutStages = [...new Set(allMatches.filter(m => m.stage !== 'group').map(m => m.stage))]
    .sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b));

  const filters = [
    { key: 'all',      label: 'Todos' },
    { key: 'pending',  label: 'Sin resultado' },
    { key: 'finished', label: 'Finalizados' },
  ];
  if (knockoutStages.length) {
    filters.push({ key: 'grupos', label: 'Fase de Grupos' });
    knockoutStages.forEach(s => filters.push({ key: `stage_${s}`, label: STAGE_LABELS[s] || s }));
  }
  filters.push(...groups.map(g => ({ key: `g_${g}`, label: `Grupo ${g}` })));

  const bar = document.getElementById('filter-bar');
  bar.innerHTML = filters.map(f =>
    `<button class="filter-btn ${activeFilter === f.key ? 'active' : ''}" data-key="${f.key}">${f.label}</button>`
  ).join('');
  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.key;
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMatches();
    });
  });
}

function renderMatchCard(m) {
  const d = new Date(m.scheduled_at.replace(' ', 'T') + 'Z');
  const dateStr = d.toLocaleDateString('es-AR', { weekday: 'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  const stageStr = m.group_letter ? `Grupo ${m.group_letter}` : (STAGE_LABELS[m.stage] || m.stage);
  return `
    <div class="match-card" style="margin-bottom:.75rem;">
      <div class="match-header">
        <span>${stageStr} · ${m.venue || ''}</span>
        <span>${dateStr}</span>
      </div>
      <div class="match-body">
        <div class="match-team">${m.team1_flag} ${m.team1_name}</div>
        <div class="match-center">
          ${m.is_finished
            ? `<div class="match-score">${m.team1_score} – ${m.team2_score}</div>
               <span class="badge badge-green" style="font-size:.7rem;">Finalizado</span>`
            : `<div class="match-vs">vs</div>`}
        </div>
        <div class="match-team right">${m.team2_flag} ${m.team2_name}</div>
      </div>
      <div style="padding:.5rem 1rem; border-top:1px solid var(--border); text-align:right;">
        <button class="btn btn-accent btn-sm btn-load-result" data-match-id="${m.id}" data-name="${m.team1_name} vs ${m.team2_name}">
          ${m.is_finished ? '✏️ Editar resultado' : '⚽ Cargar resultado'}
        </button>
      </div>
    </div>`;
}

function renderMatches() {
  let filtered = allMatches;
  if (activeFilter === 'pending')           filtered = allMatches.filter(m => !m.is_finished);
  else if (activeFilter === 'finished')     filtered = allMatches.filter(m => m.is_finished);
  else if (activeFilter === 'grupos')       filtered = allMatches.filter(m => m.stage === 'group');
  else if (activeFilter.startsWith('stage_')) filtered = allMatches.filter(m => m.stage === activeFilter.slice(6));
  else if (activeFilter.startsWith('g_'))   filtered = allMatches.filter(m => m.group_letter === activeFilter.slice(2));

  const container = document.getElementById('admin-matches');
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><p>No hay partidos</p></div>';
    return;
  }

  const hasKnockout = filtered.some(m => m.stage !== 'group');
  const isGroupOnly = filtered.every(m => m.stage === 'group');
  let html = '';

  if (!hasKnockout || isGroupOnly) {
    html = filtered.map(renderMatchCard).join('');
  } else {
    const byStage = {};
    filtered.forEach(m => { (byStage[m.stage] = byStage[m.stage] || []).push(m); });
    STAGE_ORDER.forEach(stage => {
      if (!byStage[stage]) return;
      if (stage !== 'group') html += `<div class="stage-section-label">${STAGE_LABELS[stage] || stage}</div>`;
      html += byStage[stage].map(renderMatchCard).join('');
    });
  }

  container.innerHTML = html;
  container.querySelectorAll('.btn-load-result').forEach(btn => {
    btn.addEventListener('click', () => openResultModal(parseInt(btn.dataset.matchId), btn.dataset.name));
  });
}

function openResultModal(matchId, name) {
  editingMatchId = matchId;
  selectedResultWinner = null;
  const match = allMatches.find(m => m.id === matchId);
  document.getElementById('result-modal-title').textContent = `Resultado: ${name}`;
  document.getElementById('result-score1').value = match?.team1_score ?? '';
  document.getElementById('result-score2').value = match?.team2_score ?? '';
  document.getElementById('result-alert').className = 'alert hidden';

  const winnerSection = document.getElementById('result-winner-section');
  const isPlayoff = match?.stage !== 'group';
  if (isPlayoff) {
    const btn1 = document.getElementById('result-winner-btn1');
    const btn2 = document.getElementById('result-winner-btn2');
    btn1.textContent = `${match.team1_flag} ${match.team1_name}`;
    btn1.dataset.team = match.team1_code;
    btn2.textContent = `${match.team2_flag} ${match.team2_name}`;
    btn2.dataset.team = match.team2_code;
    selectedResultWinner = match.winner_code || null;
    updateResultWinnerBtns();
    checkResultDraw();
    winnerSection.style.display = '';
  } else {
    winnerSection.style.display = 'none';
  }

  document.getElementById('modal-result').classList.remove('hidden');
  document.getElementById('result-score1').focus();
}

function updateResultWinnerBtns() {
  document.querySelectorAll('.btn-result-winner').forEach(btn => {
    btn.className = `btn btn-sm btn-result-winner ${btn.dataset.team === selectedResultWinner ? 'btn-primary' : 'btn-secondary'}`;
  });
}

function checkResultDraw() {
  const s1 = document.getElementById('result-score1').value;
  const s2 = document.getElementById('result-score2').value;
  const winnerSection = document.getElementById('result-winner-section');
  const match = allMatches.find(m => m.id === editingMatchId);
  if (!match || match.stage === 'group') return;
  const isDraw = s1 !== '' && s2 !== '' && parseInt(s1) === parseInt(s2);
  winnerSection.style.display = isDraw ? '' : 'none';
  if (!isDraw) selectedResultWinner = null;
}

document.getElementById('btn-result-cancel').addEventListener('click', () => {
  document.getElementById('modal-result').classList.add('hidden');
  editingMatchId = null;
  selectedResultWinner = null;
});

document.getElementById('result-score1').addEventListener('input', checkResultDraw);
document.getElementById('result-score2').addEventListener('input', checkResultDraw);

document.querySelectorAll('.btn-result-winner').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedResultWinner = btn.dataset.team;
    updateResultWinnerBtns();
  });
});

document.getElementById('btn-result-submit').addEventListener('click', async () => {
  const s1 = document.getElementById('result-score1').value;
  const s2 = document.getElementById('result-score2').value;
  const alertEl = document.getElementById('result-alert');
  if (s1 === '' || s2 === '') {
    alertEl.textContent = 'Ingresá ambos marcadores';
    alertEl.className = 'alert alert-danger';
    return;
  }
  const match = allMatches.find(m => m.id === editingMatchId);
  const isPlayoff = match?.stage !== 'group';
  const isDraw = parseInt(s1) === parseInt(s2);
  if (isPlayoff && isDraw && !selectedResultWinner) {
    alertEl.textContent = 'Para un empate, seleccioná quién avanzó';
    alertEl.className = 'alert alert-danger';
    return;
  }
  try {
    await api.put(`/matches/${editingMatchId}/result`, {
      team1_score: parseInt(s1),
      team2_score: parseInt(s2),
      ...(isPlayoff && isDraw ? { winner_code: selectedResultWinner } : {}),
    });
    alertEl.textContent = '¡Resultado guardado y puntos calculados!';
    alertEl.className = 'alert alert-success';
    setTimeout(() => {
      document.getElementById('modal-result').classList.add('hidden');
      editingMatchId = null;
      loadMatches();
    }, 1200);
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = 'alert alert-danger';
  }
});

// ── Sync panel ──
async function loadSyncStatus() {
  try {
    const s = await api.get('/admin/sync/status');
    const badge  = document.getElementById('sync-status-badge');
    const lastEl = document.getElementById('sync-last');

    if (s.mappedCount === 0) {
      badge.textContent = 'Sin fixture importado';
      badge.className   = 'badge badge-yellow';
    } else {
      badge.textContent = `${s.mappedCount}/${s.totalMatches} partidos mapeados · ${s.predCount} predicciones`;
      badge.className   = 'badge badge-green';
    }
    if (s.lastSync) {
      const at = new Date(s.lastSync.at).toLocaleString('es-AR');
      lastEl.textContent = `Última operación: ${s.lastSync.type} · ${at}`;
    }
  } catch {}
}

function showSyncResult(data, isError = false) {
  const el = document.getElementById('sync-result');
  if (isError) {
    el.className  = 'alert alert-danger';
    el.textContent = `Error: ${data}`;
    return;
  }
  el.className = 'alert alert-success';
  const lines = [];
  if (data.imported != null) lines.push(`Importados: <strong>${data.imported}</strong>`);
  if (data.updated   != null && data.updated > 0)  lines.push(`Actualizados: <strong>${data.updated}</strong>`);
  if (data.remapped  != null) lines.push(`Re-mapeados: <strong>${data.remapped}</strong> de ${data.total}`);
  if (data.updated   != null && data.remapped == null) lines.push(`Resultados cargados: <strong>${data.updated}</strong>`);
  if (data.skipped   != null && data.skipped > 0) lines.push(`Omitidos: ${data.skipped}`);
  if (data.note)    lines.push(data.note);
  if (data.message) lines.push(data.message);
  if (data.notFound?.length) {
    const shown = data.notFound.slice(0, 5).join(', ');
    lines.push(`<span style="color:var(--text-muted);">Sin mapear: ${shown}${data.notFound.length > 5 ? '…' : ''}</span>`);
  }
  el.innerHTML = lines.join('<br>');
}

async function runSync(btnId, label, endpoint) {
  const btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Ejecutando...';
  document.getElementById('sync-result').className = 'hidden';
  try {
    const res = await api.post(endpoint);
    showSyncResult(res);
    loadSyncStatus();
    loadMatches();
  } catch (err) {
    showSyncResult(err.message, true);
  } finally {
    btn.disabled   = false;
    btn.textContent = label;
  }
}

document.getElementById('btn-setup-fd').addEventListener('click', () =>
  runSync('btn-setup-fd', '📥 Importar fixture', '/admin/sync/setup-fd'));

document.getElementById('btn-remap').addEventListener('click', () =>
  runSync('btn-remap', '🔗 Remap a API-Football', '/admin/sync/remap-apifootball'));

document.getElementById('btn-sync').addEventListener('click', () =>
  runSync('btn-sync', '🔄 Sync (API-Football)', '/admin/sync/results'));

document.getElementById('btn-sync-fd').addEventListener('click', () =>
  runSync('btn-sync-fd', '🔄 Sync (football-data.org)', '/admin/sync/results-fd'));

document.getElementById('btn-import-stage').addEventListener('click', async () => {
  const stage = document.getElementById('select-stage').value;
  const resultEl = document.getElementById('import-stage-result');
  if (!stage) {
    resultEl.className = 'alert alert-danger';
    resultEl.textContent = 'Seleccioná una fase antes de importar.';
    return;
  }
  const btn = document.getElementById('btn-import-stage');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Importando...';
  resultEl.className = 'hidden';
  try {
    const res = await api.post('/admin/sync/import-stage', { stage });
    resultEl.className = 'alert alert-success';
    const lines = [];
    if (res.imported != null) lines.push(`Partidos importados: <strong>${res.imported}</strong>`);
    if (res.skipped  != null && res.skipped > 0) lines.push(`Omitidos (TBD o ya existentes): ${res.skipped}`);
    if (res.message) lines.push(res.message);
    resultEl.innerHTML = lines.join('<br>') || 'Operación completada.';
    loadSyncStatus();
    loadMatches();
  } catch (err) {
    resultEl.className = 'alert alert-danger';
    resultEl.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = '📥 Importar fase';
  }
});

// ── Usuarios ──
async function loadUsers() {
  const users = await api.get('/admin/users');
  const el = document.getElementById('users-list');
  if (!users.length) {
    el.innerHTML = '<div class="empty-state"><p>No hay usuarios registrados</p></div>';
    return;
  }
  el.innerHTML = users.map(u => `
    <div class="member-row" style="padding:.65rem 1.25rem;">
      <div class="member-avatar">${u.username[0].toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${u.username}</div>
        <div class="member-meta">${u.email}</div>
      </div>
      <button class="btn btn-ghost btn-sm btn-reset-pass" data-id="${u.id}" data-username="${u.username}">
        🔑 Resetear contraseña
      </button>
    </div>`).join('');

  el.querySelectorAll('.btn-reset-pass').forEach(btn => {
    btn.addEventListener('click', () => resetPassword(parseInt(btn.dataset.id), btn.dataset.username));
  });
}

async function resetPassword(userId, username) {
  if (!confirm(`¿Resetear la contraseña de ${username}? Se generará una contraseña temporal.`)) return;
  try {
    const res = await api.post(`/admin/users/${userId}/reset-password`);
    document.getElementById('temp-pass-username').textContent = res.username;
    document.getElementById('temp-pass-value').textContent    = res.temp_password;
    document.getElementById('modal-temp-pass').classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('btn-close-temp-pass').addEventListener('click', () => {
  document.getElementById('modal-temp-pass').classList.add('hidden');
});

document.getElementById('btn-copy-temp-pass').addEventListener('click', async () => {
  const val = document.getElementById('temp-pass-value').textContent;
  await navigator.clipboard.writeText(val);
  document.getElementById('btn-copy-temp-pass').textContent = '¡Copiado!';
  setTimeout(() => { document.getElementById('btn-copy-temp-pass').textContent = 'Copiar'; }, 1500);
});

loadSyncStatus();
loadMatches().catch(console.error);
loadUsers().catch(console.error);
