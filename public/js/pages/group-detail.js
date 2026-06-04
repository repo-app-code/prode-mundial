const user = requireAuth();
const groupId = new URLSearchParams(window.location.search).get('id');
if (!groupId) window.location.href = '/groups.html';

let groupData = null;

// ── Tabs ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

async function loadGroup() {
  try {
    const [group, ranking] = await Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/predictions/ranking/group/${groupId}`),
    ]);
    groupData = group;
    renderHeader(group);
    renderRanking(ranking);
    renderMembers(group);
    if (group.my_role === 'admin' || group.my_role === 'creator') {
      document.getElementById('tab-admin-btn').classList.remove('hidden');
      document.getElementById('tab-admin').classList.remove('hidden');
      renderPending(group);
    }
    if (group.my_role === 'creator') {
      document.getElementById('danger-zone').classList.remove('hidden');
    }
  } catch (err) {
    document.getElementById('group-header').innerHTML =
      `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function renderHeader(g) {
  const canCopy = !!navigator.clipboard;
  document.getElementById('group-header').innerHTML = `
    <div class="flex-between" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h1 style="font-size:1.5rem; font-weight:700;">${g.name}</h1>
        ${g.description ? `<p style="color:var(--text-muted); margin-top:.25rem;">${g.description}</p>` : ''}
        <p style="font-size:.8rem; color:var(--text-muted); margin-top:.25rem;">Creado por ${g.creator_name}</p>
      </div>
      <div>
        <div style="font-size:.75rem; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:.35rem;">Código de invitación</div>
        <div class="invite-box">
          <span class="invite-code">${g.invite_code}</span>
          ${canCopy ? `<button class="btn btn-ghost btn-sm" id="btn-copy-code">Copiar</button>` : ''}
        </div>
      </div>
    </div>`;
  if (canCopy) {
    document.getElementById('btn-copy-code').addEventListener('click', async () => {
      await navigator.clipboard.writeText(g.invite_code);
      document.getElementById('btn-copy-code').textContent = '¡Copiado!';
      setTimeout(() => { document.getElementById('btn-copy-code').textContent = 'Copiar'; }, 1500);
    });
  }
}

function renderRanking(ranking) {
  const el = document.getElementById('tab-ranking');
  if (!ranking.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><p>Aún no hay puntos en este grupo</p></div>';
    return;
  }
  el.innerHTML = `
    <div class="card">
      <div class="card-body" style="padding:0;">
        <div class="ranking-table-wrap"><table class="ranking-table">
          <thead><tr>
            <th>#</th><th>Usuario</th><th>Puntos</th><th>Pronósticos</th><th>Exactos</th>
          </tr></thead>
          <tbody>
            ${ranking.map((r, i) => `
              <tr class="rank-${i+1} ${r.id === user.id ? 'me' : ''}">
                <td class="rank-num">${i + 1}</td>
                <td>${r.username}${r.id === user.id ? ' <span class="badge badge-blue">vos</span>' : ''}</td>
                <td><strong>${r.total_points}</strong></td>
                <td>${r.total_predictions}</td>
                <td>${r.exact_results}</td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    </div>`;
}

function renderMembers(g) {
  const el = document.getElementById('tab-members');
  const approved = g.members.filter(m => m.status === 'approved');
  const isAdmin = g.my_role === 'admin' || g.my_role === 'creator';
  el.innerHTML = `
    <div class="card">
      <div class="card-header">Miembros aprobados (${approved.length})</div>
      <div class="card-body">
        ${approved.map(m => {
          const roleLabel = m.role === 'creator' ? '<span class="badge badge-blue">Creador</span>'
            : m.role === 'admin' ? '<span class="badge badge-green">Admin</span>'
            : '<span class="badge badge-gray">Miembro</span>';
          const isSelf = m.user_id === user.id;
          let actions = '';
          if (isAdmin && !isSelf && m.role !== 'creator') {
            if (g.my_role === 'creator') {
              const newRole = m.role === 'admin' ? 'member' : 'admin';
              const roleLabel2 = m.role === 'admin' ? 'Quitar admin' : 'Hacer admin';
              actions += `<button class="btn btn-ghost btn-sm" onclick="updateMember(${m.user_id}, {role:'${newRole}'})">${roleLabel2}</button>`;
            }
            actions += `<button class="btn btn-danger btn-sm" onclick="removeMember(${m.user_id})">Expulsar</button>`;
          }
          if (isSelf && m.role !== 'creator') {
            actions += `<button class="btn btn-ghost btn-sm" onclick="leaveGroup()">Salir</button>`;
          }
          return `
            <div class="member-row">
              <div class="member-avatar">${m.username[0].toUpperCase()}</div>
              <div class="member-info">
                <div class="member-name">${m.username}${isSelf ? ' (vos)' : ''}</div>
              </div>
              ${roleLabel}
              <div class="member-actions">${actions}</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderPending(g) {
  const pending = g.members.filter(m => m.status === 'pending');
  const el = document.getElementById('pending-list');
  if (!pending.length) {
    el.innerHTML = '<div class="text-muted" style="font-size:.9rem;">No hay solicitudes pendientes.</div>';
    return;
  }
  el.innerHTML = pending.map(m => `
    <div class="member-row">
      <div class="member-avatar">${m.username[0].toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${m.username}</div>
        <div class="member-meta">Solicitó unirse</div>
      </div>
      <div class="member-actions">
        <button class="btn btn-secondary btn-sm" onclick="updateMember(${m.user_id}, {status:'approved'})">✓ Aprobar</button>
        <button class="btn btn-danger btn-sm" onclick="updateMember(${m.user_id}, {status:'rejected'})">✗ Rechazar</button>
      </div>
    </div>`).join('');
}

async function updateMember(userId, data) {
  try {
    await api.patch(`/groups/${groupId}/members/${userId}`, data);
    loadGroup();
  } catch (err) { alert(err.message); }
}

async function removeMember(userId) {
  if (!confirm('¿Expulsar a este miembro del grupo?')) return;
  try {
    await api.delete(`/groups/${groupId}/members/${userId}`);
    loadGroup();
  } catch (err) { alert(err.message); }
}

async function leaveGroup() {
  if (!confirm('¿Salir de este grupo?')) return;
  try {
    await api.delete(`/groups/${groupId}/members/${user.id}`);
    window.location.href = '/groups.html';
  } catch (err) { alert(err.message); }
}

async function deleteGroup() {
  if (!confirm(`¿Eliminar el grupo "${groupData.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api.delete(`/groups/${groupId}`);
    window.location.href = '/groups.html';
  } catch (err) { alert(err.message); }
}

loadGroup();
