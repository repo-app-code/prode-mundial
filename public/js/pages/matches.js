const user = requireAuth();

let allMatches = [];
let predictions = {};
let activeFilter = 'all';

const STAGE_LABELS = {
  group:  'Fase de Grupos',
  r32:    'Ronda de 32',
  r16:    'Octavos de Final',
  qf:     'Cuartos de Final',
  sf:     'Semifinales',
  third:  'Tercer Puesto',
  final:  'Final',
};

const STAGE_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

async function loadMatches() {
  const [matches, preds] = await Promise.all([
    api.get('/matches'),
    api.get('/predictions'),
  ]);
  allMatches = matches;
  preds.forEach(p => { predictions[p.match_id] = p; });
  renderFilters();
  renderMatches();
}

function hasKnockout() {
  return allMatches.some(m => m.stage !== 'group');
}

function renderFilters() {
  const groups = [...new Set(allMatches.filter(m => m.group_letter).map(m => m.group_letter))].sort();
  const knockoutStages = [...new Set(allMatches.filter(m => m.stage !== 'group').map(m => m.stage))]
    .sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b));

  const filters = [
    { key: 'all',      label: 'Todos' },
    { key: 'pending',  label: 'Sin pronosticar' },
    { key: 'finished', label: 'Finalizados' },
  ];

  if (knockoutStages.length) {
    filters.push({ key: 'grupos', label: 'Fase de Grupos' });
    knockoutStages.forEach(s => filters.push({ key: `stage_${s}`, label: STAGE_LABELS[s] || s }));
  }

  filters.push(...groups.map(g => ({ key: `group_${g}`, label: `Grupo ${g}` })));

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

function renderMatches() {
  let filtered = allMatches;
  if      (activeFilter === 'pending')         filtered = allMatches.filter(m => !m.is_finished && !predictions[m.id]);
  else if (activeFilter === 'finished')        filtered = allMatches.filter(m => m.is_finished);
  else if (activeFilter === 'grupos')          filtered = allMatches.filter(m => m.stage === 'group');
  else if (activeFilter.startsWith('stage_'))  filtered = allMatches.filter(m => m.stage === activeFilter.slice(6));
  else if (activeFilter.startsWith('group_'))  filtered = allMatches.filter(m => m.group_letter === activeFilter.slice(6));

  const container = document.getElementById('matches-container');
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚽</div><p>No hay partidos para mostrar</p></div>';
    return;
  }

  // Fase de grupos: agrupar por fecha
  // Playoff: agrupar por fase y dentro por fecha
  const isGroupOnly = filtered.every(m => m.stage === 'group');

  let html = '';

  if (isGroupOnly) {
    html = renderGroupedByDate(filtered);
  } else {
    // Agrupar por stage primero, luego por fecha dentro de cada stage
    const byStage = {};
    filtered.forEach(m => {
      if (!byStage[m.stage]) byStage[m.stage] = [];
      byStage[m.stage].push(m);
    });
    STAGE_ORDER.forEach(stage => {
      if (!byStage[stage]) return;
      if (stage !== 'group') {
        html += `<div class="stage-section-label">${STAGE_LABELS[stage] || stage}</div>`;
      }
      html += renderGroupedByDate(byStage[stage]);
    });
  }

  container.innerHTML = html;
  container.querySelectorAll('.btn-save-pred').forEach(btn => {
    btn.addEventListener('click', () => savePrediction(parseInt(btn.dataset.matchId)));
  });
}

function renderGroupedByDate(matches) {
  const byDate = {};
  matches.forEach(m => {
    const d = new Date(m.scheduled_at.replace(' ', 'T') + 'Z');
    const key = d.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  });
  return Object.entries(byDate).map(([date, ms]) => `
    <div class="match-group-label">${date}</div>
    ${ms.map(m => renderMatchCard(m)).join('')}
  `).join('');
}

function renderMatchCard(m) {
  const now       = new Date();
  const matchDate = new Date(m.scheduled_at.replace(' ', 'T') + 'Z');
  const isLocked  = now >= matchDate;
  const pred      = predictions[m.id];
  const timeStr   = matchDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const stageStr  = m.group_letter ? `Grupo ${m.group_letter}` : (STAGE_LABELS[m.stage] || m.stage);

  let scoreCenter = m.is_finished
    ? `<div class="match-score">${m.team1_score} – ${m.team2_score}</div>`
    : `<div class="match-vs">vs</div><div style="font-size:.75rem; color:var(--text-muted);">${timeStr}</div>`;

  let predRow = '';
  if (m.is_finished && pred) {
    const pts = pred.points_earned;
    predRow = `
      <div class="prediction-row">
        <span style="font-size:.8rem; color:var(--text-muted);">Tu pronóstico:</span>
        <strong>${pred.team1_score} – ${pred.team2_score}</strong>
        <span class="points-chip points-${pts}">${pts} ${pts === 1 ? 'punto' : 'puntos'}</span>
      </div>`;
  } else if (!m.is_finished && isLocked) {
    predRow = `
      <div class="prediction-row">
        <span class="locked-badge">🔒 Partido en curso — pronósticos cerrados</span>
        ${pred ? `<strong style="margin-left:.5rem;">${pred.team1_score} – ${pred.team2_score}</strong>` : ''}
      </div>`;
  } else if (!m.is_finished) {
    predRow = `
      <div class="prediction-row">
        <span style="font-size:.8rem; color:var(--text-muted); font-weight:600;">Tu pronóstico:</span>
        <div class="score-inputs">
          <input class="score-input" type="number" min="0" max="20" id="p1_${m.id}" value="${pred?.team1_score ?? ''}" placeholder="0">
          <span class="score-sep">–</span>
          <input class="score-input" type="number" min="0" max="20" id="p2_${m.id}" value="${pred?.team2_score ?? ''}" placeholder="0">
        </div>
        <button class="btn btn-primary btn-sm btn-save-pred" data-match-id="${m.id}">Guardar</button>
        ${pred ? '<span class="badge badge-green">Guardado</span>' : '<span class="badge badge-yellow">Sin guardar</span>'}
      </div>`;
  }

  return `
    <div class="match-card" id="match_${m.id}">
      <div class="match-header">
        <span>${stageStr} · ${m.venue || ''}</span>
        <span>${matchDate.toLocaleDateString('es-AR', { day:'2-digit', month:'short' })}</span>
      </div>
      <div class="match-body">
        <div class="match-team">
          <span class="team-flag">${m.team1_flag}</span>
          <span class="team-name">${m.team1_name}</span>
        </div>
        <div class="match-center">${scoreCenter}</div>
        <div class="match-team right">
          <span class="team-flag">${m.team2_flag}</span>
          <span class="team-name">${m.team2_name}</span>
        </div>
      </div>
      ${predRow}
    </div>`;
}

async function savePrediction(matchId) {
  const s1 = document.getElementById(`p1_${matchId}`).value;
  const s2 = document.getElementById(`p2_${matchId}`).value;
  if (s1 === '' || s2 === '') { alert('Ingresá los dos marcadores antes de guardar.'); return; }
  try {
    await api.put(`/predictions/${matchId}`, {
      team1_score: parseInt(s1),
      team2_score: parseInt(s2),
    });
    predictions[matchId] = { ...(predictions[matchId] || {}), match_id: matchId, team1_score: parseInt(s1), team2_score: parseInt(s2) };
    renderMatches();
  } catch (err) {
    alert(err.message);
  }
}

loadMatches().catch(console.error);
