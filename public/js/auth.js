function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

function requireAuth() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/login.html'; return null; }
  return getUser();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}
