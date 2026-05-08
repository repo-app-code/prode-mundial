const user = requireAuth();

async function loadDashboard() {
  const [ranking, predictions, matches] = await Promise.all([
    api.get('/predictions/ranking/global'),
    api.get('/predictions'),
    api.get('/matches'),
  ]);

  const myRank = ranking.findIndex(r => r.id === user.id) + 1;
  const myStats = ranking.find(r => r.id === user.id) || { total_points: 0, exact_results: 0 };

  document.getElementById('stat-points').textContent = myStats.total_points;
  document.getElementById('stat-rank').textContent   = myRank || '—';
  document.getElementById('stat-preds').textContent  = predictions.length;
  document.getElementById('stat-exact').textContent  = myStats.exact_results || 0;

  // Upcoming matches
  const now = new Date();
  const upcoming = matches
    .filter(m => !m.is_finished && new Date(m.scheduled_at.replace(' ', 'T') + 'Z') > now)
    .slice(0, 5);

  const predsMap = {};
  predictions.forEach(p => { predsMap[p.match_id] = p; });

  const upcomingEl = document.getElementById('upcoming-matches');
  if (!upcoming.length) {
    upcomingEl.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No hay partidos próximos</p></div>';
  } else {
    upcomingEl.innerHTML = upcoming.map(m => {
      const pred = predsMap[m.id];
      const dateStr = new Date(m.scheduled_at.replace(' ', 'T') + 'Z').toLocaleDateString('es-AR', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      return `
        <div class="match-card" style="margin-bottom:.5rem;">
          <div class="match-header">
            <span>Grupo ${m.group_letter || m.stage}</span>
            <span>${dateStr}</span>
          </div>
          <div class="match-body" style="padding:.6rem 1rem; font-size:.9rem;">
            <div class="match-team">${m.team1_flag} ${m.team1_name}</div>
            <div class="match-center">
              <div style="font-size:.8rem; color:var(--text-muted);">
                ${pred ? `<span style="color:var(--primary); font-weight:600;">${pred.team1_score}–${pred.team2_score}</span>` : '<span style="color:var(--accent);">Sin pronosticar</span>'}
              </div>
            </div>
            <div class="match-team right">${m.team2_flag} ${m.team2_name}</div>
          </div>
        </div>`;
    }).join('');
  }

  // Global ranking top 10
  const rankingEl = document.getElementById('global-ranking');
  if (!ranking.length) {
    rankingEl.innerHTML = '<div class="empty-state"><p>Aún no hay puntos registrados</p></div>';
  } else {
    rankingEl.innerHTML = `
      <div class="ranking-table-wrap"><table class="ranking-table">
        <thead><tr>
          <th>#</th><th>Usuario</th><th>Pts</th><th>Exactos</th>
        </tr></thead>
        <tbody>
          ${ranking.slice(0, 10).map((r, i) => `
            <tr class="rank-${i+1} ${r.id === user.id ? 'me' : ''}">
              <td class="rank-num">${i + 1}</td>
              <td>${r.username}${r.id === user.id ? ' <span class="badge badge-blue">vos</span>' : ''}</td>
              <td><strong>${r.total_points}</strong></td>
              <td>${r.exact_results}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>`;
  }
}

loadDashboard().catch(console.error);
