// PDFNova Backend API Server
// Pure Node.js HTTP — zero external npm dependencies required
// Endpoints: GET /api/health, POST /api/auth/register, POST /api/auth/login, GET /api/auth/me

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const url    = require('url');

// ─── Environment Configuration ───────────────────────────────────────────────
// In production, set these via environment variables (or a .env loader).
// Never hardcode real secrets here.
const PORT         = parseInt(process.env.PORT, 10) || 5000;
const NODE_ENV     = process.env.NODE_ENV || 'development';
const JWT_SECRET   = process.env.JWT_SECRET || 'pdfnova_dev_secret_change_in_production';
const FRONTEND_URL = process.env.FRONTEND_URL || '';   // e.g. https://pdfnova.yourdomain.com
const IS_PROD      = NODE_ENV === 'production';

// ─── CORS Allowed Origins ─────────────────────────────────────────────────────
// Development: allow localhost on any port.
// Production: allow only the configured FRONTEND_URL.
const ALLOWED_ORIGINS = IS_PROD
  ? [FRONTEND_URL].filter(Boolean)       // production: only the real domain
  : [                                    // development: local origins
      'http://localhost:3000',
      'http://localhost:8000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8000',
      'http://127.0.0.1:5173'
    ];

function getAllowedOrigin(reqOrigin) {
  if (!reqOrigin) return '*';
  // In development, also allow any localhost/127.0.0.1 origin
  if (!IS_PROD) {
    if (reqOrigin.startsWith('http://localhost:') || reqOrigin.startsWith('http://127.0.0.1:')) {
      return reqOrigin;
    }
  }
  return ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0] || '';
}

// ─── Persistent File Database (data.json) ─────────────────────────────────────
// For production with multiple instances, migrate to PostgreSQL using DATABASE_URL env var.
const DB_FILE = path.join(__dirname, 'data.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { users: [] };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ─── Password Hashing (SHA-256 HMAC) ─────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHmac('sha256', JWT_SECRET).update(password).digest('hex');
}

// ─── JWT (HMAC-SHA256, built-in) ─────────────────────────────────────────────
function generateToken(payload) {
  const header    = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body      = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 86400 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

// ─── Response Helpers ─────────────────────────────────────────────────────────
function setCORSHeaders(res, reqOrigin) {
  const origin = getAllowedOrigin(reqOrigin);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

function sendJSON(res, statusCode, data, reqOrigin) {
  setCORSHeaders(res, reqOrigin);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Input Validation Helpers ─────────────────────────────────────────────────
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const reqOrigin = req.headers['origin'] || '';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res, reqOrigin);
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname  = parsedUrl.pathname;

  let bodyData = '';
  req.on('data', chunk => { bodyData += chunk.toString(); });
  req.on('end', () => {
    let body = {};
    if (bodyData) {
      try { body = JSON.parse(bodyData); } catch (e) {
        return sendJSON(res, 400, { success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, reqOrigin);
      }
    }

    const authHeader  = req.headers['authorization'] || '';
    const token       = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const currentUser = verifyToken(token);

    // ===========================================================================
    // GET /api/health — Public, no auth required
    // ===========================================================================
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJSON(res, 200, {
        status: 'ok',
        service: 'PDFNova API',
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
      }, reqOrigin);
    }

    // ===========================================================================
    // POST /api/auth/register — Public
    // ===========================================================================
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      const { name, email, password, confirmPassword } = body;

      if (!name || !email || !password) {
        return sendJSON(res, 400, { success: false, error: 'VALIDATION_ERROR', message: 'Name, email, and password are required.' }, reqOrigin);
      }
      if (!isValidEmail(email)) {
        return sendJSON(res, 400, { success: false, error: 'VALIDATION_ERROR', message: 'Invalid email address format.' }, reqOrigin);
      }
      if (password.length < 6) {
        return sendJSON(res, 400, { success: false, error: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters.' }, reqOrigin);
      }
      if (confirmPassword !== undefined && confirmPassword !== password) {
        return sendJSON(res, 400, { success: false, error: 'VALIDATION_ERROR', message: 'Passwords do not match.' }, reqOrigin);
      }

      const cleanEmail = email.toLowerCase().trim();
      const db = loadDB();
      if (!db.users) db.users = [];

      if (db.users.find(u => u.email === cleanEmail)) {
        return sendJSON(res, 409, { success: false, error: 'USER_EXISTS', message: 'An account with this email already exists.' }, reqOrigin);
      }

      const userId = 'u_' + crypto.randomBytes(6).toString('hex');
      db.users.push({
        id: userId,
        name: String(name).trim().slice(0, 100),
        email: cleanEmail,
        password: hashPassword(password),
        created_at: new Date().toISOString()
      });
      saveDB(db);

      const authToken = generateToken({ id: userId, email: cleanEmail, name: String(name).trim() });
      return sendJSON(res, 201, {
        success: true,
        message: 'Account created successfully. Welcome to PDFNova!',
        token: authToken,
        user: { id: userId, name: String(name).trim(), email: cleanEmail }
      }, reqOrigin);
    }

    // ===========================================================================
    // POST /api/auth/login — Public
    // ===========================================================================
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const { email, password } = body;

      if (!email || !password) {
        return sendJSON(res, 400, { success: false, error: 'VALIDATION_ERROR', message: 'Email and password are required.' }, reqOrigin);
      }

      const cleanEmail = email.toLowerCase().trim();
      const db   = loadDB();
      if (!db.users) db.users = [];
      const user = db.users.find(u => u.email === cleanEmail);

      if (!user || user.password !== hashPassword(password)) {
        return sendJSON(res, 401, { success: false, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }, reqOrigin);
      }

      const authToken = generateToken({ id: user.id, email: user.email, name: user.name });
      return sendJSON(res, 200, {
        success: true,
        message: 'Logged in successfully.',
        token: authToken,
        user: { id: user.id, name: user.name, email: user.email }
      }, reqOrigin);
    }

    // ===========================================================================
    // GET /api/auth/me — Requires authentication
    // ===========================================================================
    if (req.method === 'GET' && pathname === '/api/auth/me') {
      if (!currentUser) {
        return sendJSON(res, 401, { success: false, error: 'AUTHENTICATION_REQUIRED', message: 'Valid token required.' }, reqOrigin);
      }
      const db   = loadDB();
      if (!db.users) db.users = [];
      const user = db.users.find(u => u.id === currentUser.id);

      if (!user) {
        return sendJSON(res, 404, { success: false, error: 'USER_NOT_FOUND', message: 'User not found.' }, reqOrigin);
      }

      return sendJSON(res, 200, {
        success: true,
        user: { id: user.id, name: user.name, email: user.email, createdAt: user.created_at }
      }, reqOrigin);
    }

    // ===========================================================================
    // 404 — Not Found
    // ===========================================================================
    return sendJSON(res, 404, {
      success: false,
      error: 'NOT_FOUND',
      message: `No API route: ${req.method} ${pathname}`
    }, reqOrigin);
  });
});

server.listen(PORT, () => {
  console.log(`[PDFNova API] ${NODE_ENV} server running on http://localhost:${PORT}`);
  console.log(`[Health]  GET  http://localhost:${PORT}/api/health`);
  console.log(`[Auth]    POST http://localhost:${PORT}/api/auth/register`);
  console.log(`[Auth]    POST http://localhost:${PORT}/api/auth/login`);
  console.log(`[Auth]    GET  http://localhost:${PORT}/api/auth/me`);
  if (IS_PROD && FRONTEND_URL) {
    console.log(`[CORS]    Allowing origin: ${FRONTEND_URL}`);
  } else {
    console.log(`[CORS]    Development mode — allowing all localhost origins`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
