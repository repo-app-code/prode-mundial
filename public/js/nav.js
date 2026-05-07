function renderNav() {
  const user = getUser();
  const path = window.location.pathname.replace(/\.html$/, '');
  const links = [
    { href: '/dashboard.html', label: 'Inicio', match: '/dashboard' },
    { href: '/matches.html',   label: 'Partidos', match: '/matches' },
    { href: '/groups.html',    label: 'Mis grupos', match: '/groups' },
  ];
  if (user?.is_admin) links.push({ href: '/admin.html', label: 'Admin', match: '/admin' });

  document.getElementById('nav-links').innerHTML = links
    .map(l => `<a href="${l.href}" class="${path === l.match ? 'active' : ''}">${l.label}</a>`)
    .join('');

  document.getElementById('nav-username').textContent = user?.username || '';
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  renderNav();
});
