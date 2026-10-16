// ================================================================
// middleware/auth.js — Session + rate limit + CSRF
// ================================================================
const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 jam
const sessions = new Map();                // sessionId → { userId, username, mustChangePw, expiresAt }

// Rate limit login: IP → { count, blockedUntil }
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 5 * 60 * 1000; // 5 menit

function createSession(user) {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.set(id, {
    userId: user.id,
    username: user.username,
    mustChangePw: user.must_change_pw === 1,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return id;
}

function destroySession(id) { sessions.delete(id); }

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  if (!match) return null;
  const session = sessions.get(match[1]);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(match[1]); return null; }
  session._id = match[1];
  return session;
}

function setSessionCookie(res, id) {
  res.setHeader('Set-Cookie',
    `sid=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}

// ================================================================
// Rate limit
// ================================================================
function checkRateLimit(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec) return true;
  if (rec.blockedUntil && now < rec.blockedUntil) return false;
  if (rec.blockedUntil && now >= rec.blockedUntil) { loginAttempts.delete(ip); return true; }
  return true;
}

function recordFail(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) { rec.blockedUntil = now + BLOCK_MS; rec.count = 0; }
  loginAttempts.set(ip, rec);
}

function resetAttempts(ip) { loginAttempts.delete(ip); }

// ================================================================
// CSRF — verifikasi Origin untuk non-GET
// ================================================================
function checkCSRF(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const ok = (origin && origin.endsWith('://' + host)) ||
             (referer && referer.includes('://' + host + '/'));
  if (!ok) return res.status(403).json({ status: 'error', message: 'CSRF check failed' });
  next();
}

// ================================================================
// Middleware utama
// ================================================================
function requireAuth(req, res, next) {
  const session = getSession(req);

  if (!session) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ status: 'error', message: 'Belum login' });
    }
    return res.redirect('/login.html');
  }

  // Wajib ganti password dulu
  if (session.mustChangePw && req.path !== '/api/auth/change-password' &&
      req.path !== '/api/auth/logout' && req.path !== '/login.html') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ status: 'error', message: 'Harus ganti password dulu', mustChangePw: true });
    }
    return res.redirect('/login.html?change=1');
  }

  req.user = session;
  next();
}

module.exports = {
  createSession, destroySession, getSession,
  setSessionCookie, clearSessionCookie,
  checkRateLimit, recordFail, resetAttempts,
  checkCSRF, requireAuth
};