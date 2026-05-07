const user = requireAuth();
if (!user?.is_admin) window.location.href = '/dashboard.html';

let allMatches = [];
let activeFilter = 'all';
let editingMatchId = null;

async function loadMatches() {
  allMatches = await api.get('/matches');
  renderFilters();
  renderMatches();
}

function renderFilters() {
  const groups = [...new Set(allMatches.filter(m => m.group_letter).map(m => m.group_letter))].sort();
  const bar = document.getElementById('filter-bar');
  const filters = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Sin resultado' },
    { key: 'finished', label: 'Finalizados' },
    ...groups.map(g => ({ key: `g_${g}`, label: `Grupo ${g}` })),
  ];
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

function renderMatches() {
  let filtered = allMatches;
  if (activeFilter === 'pending')  filtered = allMatches.filter(m => !m.is_finished);
  if (activeFilter === 'finished') filtered = allMatches.filter(m => m.is_finished);
  if (activeFilter.startsWith('g_')) filtered = allMatches.filter(m => m.group_letter === activeFilter.slice(2));

  const container = document.getElementById('admin-matches');
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><p>No hay partidos</p></div>';
    return;
  }

  container.innerHTML = filtered.map(m => {
    const d = new Date(m.scheduled_at.replace(' ', 'T') + 'Z');
    const dateStr = d.toLocaleDateString('es-AR', { weekday: 'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return `
      <div class="match-card" style="margin-bottom:.75rem;">
        <div class="match-header">
          <span>Grupo ${m.group_letter || m.stage} · ${m.venue || ''}</span>
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
  }).join('');

  container.querySelectorAll('.btn-load-result').forEach(btn => {
    btn.addEventListener('click', () => openResultModal(parseInt(btn.dataset.matchId), btn.dataset.name));
  });
}

function openResultModal(matchId, name) {
  editingMatchId = matchId;
  const match = allMatches.find(m => m.id === matchId);
  document.getElementById('result-modal-title').textContent = `Resultado: ${name}`;
  document.getElementById('result-score1').value = match?.team1_score ?? '';
  document.getElementById('result-score2').value = match?.team2_score ?? '';
  document.getElementById('result-alert').className = 'alert hidden';
  document.getElementById('modal-result').classList.remove('hidden');
  document.getElementById('result-score1').focus();
}

document.getElementById('btn-result-cancel').addEventListener('click', () => {
  document.getElementById('modal-result').classList.add('hidden');
  editingMatchId = null;
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
  try {
    await api.put(`/matches/${editingMatchId}/result`, {
      team1_score: parseInt(s1),
      team2_score: parseInt(s2),
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
  runSync('btn-sync', '🔄 Sync resultados', '/admin/sync/results'));

loadSyncStatus();
loadMatches().catch(console.error);
