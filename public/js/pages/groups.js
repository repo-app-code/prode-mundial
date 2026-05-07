requireAuth();

async function loadGroups() {
  try {
    const groups = await api.get('/groups');
    renderGroups(groups);
  } catch (err) {
    document.getElementById('groups-container').innerHTML =
      `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function renderGroups(groups) {
  const container = document.getElementById('groups-container');
  if (!groups.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <p>No pertenecés a ningún grupo todavía.</p>
        <p>Creá uno o unite con un código de invitación.</p>
      </div>`;
    return;
  }
  container.innerHTML = `<div class="groups-grid">${groups.map(g => `
    <a class="group-card" href="/group.html?id=${g.id}">
      <div class="group-name">${g.name}</div>
      ${g.description ? `<div class="group-desc">${g.description}</div>` : ''}
      <div class="group-meta">
        <span>👤 ${g.member_count} ${g.member_count === 1 ? 'miembro' : 'miembros'}</span>
        ${g.pending_count > 0 && (g.my_role === 'admin' || g.my_role === 'creator')
          ? `<span class="badge badge-yellow">⏳ ${g.pending_count} pendiente${g.pending_count > 1 ? 's' : ''}</span>`
          : ''}
        <span class="badge badge-${g.my_role === 'creator' ? 'blue' : g.my_role === 'admin' ? 'green' : 'gray'}">${
          g.my_role === 'creator' ? 'Creador' : g.my_role === 'admin' ? 'Admin' : 'Miembro'
        }</span>
      </div>
    </a>`).join('')}</div>`;
}

// ── Create modal ──
document.getElementById('btn-create').addEventListener('click', () => {
  document.getElementById('modal-create').classList.remove('hidden');
  document.getElementById('create-name').focus();
});
document.getElementById('btn-create-cancel').addEventListener('click', () => {
  document.getElementById('modal-create').classList.add('hidden');
});
document.getElementById('btn-create-submit').addEventListener('click', async () => {
  const name = document.getElementById('create-name').value.trim();
  const desc = document.getElementById('create-desc').value.trim();
  const alertEl = document.getElementById('create-alert');
  alertEl.className = 'alert hidden';
  if (!name) { alertEl.textContent = 'El nombre es obligatorio'; alertEl.className = 'alert alert-danger'; return; }
  try {
    await api.post('/groups', { name, description: desc || undefined });
    document.getElementById('modal-create').classList.add('hidden');
    document.getElementById('create-name').value = '';
    document.getElementById('create-desc').value = '';
    loadGroups();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = 'alert alert-danger';
  }
});

// ── Join modal ──
let previewedGroupCode = null;

document.getElementById('btn-join').addEventListener('click', () => {
  document.getElementById('modal-join').classList.remove('hidden');
  document.getElementById('join-code').focus();
});
document.getElementById('btn-join-cancel').addEventListener('click', () => {
  document.getElementById('modal-join').classList.add('hidden');
  previewedGroupCode = null;
  document.getElementById('join-preview').classList.add('hidden');
  document.getElementById('btn-join-submit').classList.add('hidden');
});

document.getElementById('join-code').addEventListener('input', () => {
  previewedGroupCode = null;
  document.getElementById('join-preview').classList.add('hidden');
  document.getElementById('btn-join-submit').classList.add('hidden');
});

document.getElementById('btn-join-preview').addEventListener('click', async () => {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const alertEl = document.getElementById('join-alert');
  alertEl.className = 'alert hidden';
  if (!code) { alertEl.textContent = 'Ingresá un código'; alertEl.className = 'alert alert-danger'; return; }
  try {
    const group = await api.get(`/groups/preview/${code}`);
    previewedGroupCode = code;
    document.getElementById('preview-name').textContent = group.name;
    document.getElementById('preview-desc').textContent = group.description || '';
    document.getElementById('preview-members').textContent = `${group.member_count} miembro${group.member_count !== 1 ? 's' : ''}`;
    document.getElementById('join-preview').classList.remove('hidden');
    document.getElementById('btn-join-submit').classList.remove('hidden');
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = 'alert alert-danger';
  }
});

document.getElementById('btn-join-submit').addEventListener('click', async () => {
  if (!previewedGroupCode) return;
  const alertEl = document.getElementById('join-alert');
  alertEl.className = 'alert hidden';
  try {
    const res = await api.post('/groups/join', { invite_code: previewedGroupCode });
    alertEl.textContent = res.message;
    alertEl.className = 'alert alert-success';
    document.getElementById('btn-join-submit').classList.add('hidden');
    setTimeout(() => {
      document.getElementById('modal-join').classList.add('hidden');
      loadGroups();
    }, 1800);
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = 'alert alert-danger';
  }
});

loadGroups();
