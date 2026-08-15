// PDFNova Backend API Server
// Pure Node.js HTTP — zero external npm dependencies required
// Endpoints: GET /api/health, POST /api/protect-pdf, POST /api/auth/register, POST /api/auth/login, GET /api/auth/me

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const url    = require('url');

// ─── Environment Configuration ───────────────────────────────────────────────
const PORT         = parseInt(process.env.PORT, 10) || 5000;
const NODE_ENV     = process.env.NODE_ENV || 'development';
const JWT_SECRET   = process.env.JWT_SECRET || 'pdfnova_dev_secret_change_in_production';
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const IS_PROD      = NODE_ENV === 'production';

// ─── CORS Allowed Origins ─────────────────────────────────────────────────────
function getAllowedOrigin(reqOrigin) {
  if (!reqOrigin) return '*';
  return reqOrigin;
}

function setCORSHeaders(res, reqOrigin) {
  const origin = getAllowedOrigin(reqOrigin);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
  res.setHeader('Vary', 'Origin');
}

// ─── Persistent File Database (data.json) ─────────────────────────────────────
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

// ─── Password Hashing & JWT Helpers ───────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHmac('sha256', JWT_SECRET).update(password).digest('hex');
}

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

function sendJSON(res, statusCode, data, reqOrigin) {
  setCORSHeaders(res, reqOrigin);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Multipart Form-Data Parser ───────────────────────────────────────────────
function parseMultipartFormData(buffer, boundary) {
  const fields = {};
  const files = {};
  const boundaryBuffer = Buffer.from('--' + boundary);

  let start = 0;
  while (start < buffer.length) {
    const nextBoundary = buffer.indexOf(boundaryBuffer, start);
    if (nextBoundary === -1) break;

    const partStart = start === 0 ? nextBoundary + boundaryBuffer.length + 2 : start;
    const partEnd = buffer.indexOf(boundaryBuffer, partStart);
    if (partEnd === -1) break;

    const partBuffer = buffer.slice(partStart, partEnd - 2);
    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headerText = partBuffer.slice(0, headerEnd).toString('utf8');
      const bodyBuffer = partBuffer.slice(headerEnd + 4);

      const nameMatch = headerText.match(/name="([^"]+)"/);
      const filenameMatch = headerText.match(/filename="([^"]+)"/);

      if (nameMatch) {
        const name = nameMatch[1];
        if (filenameMatch) {
          files[name] = {
            filename: filenameMatch[1],
            data: bodyBuffer
          };
        } else {
          fields[name] = bodyBuffer.toString('utf8').trim();
        }
      }
    }
    start = partEnd + boundaryBuffer.length + 2;
  }
  return { fields, files };
}

// ─── PDF Security Encryption Engine ────────────────────────────────────────────
function encryptPdfDocument(pdfBuffer, userPassword, permissions = {}) {
  const pdfString = pdfBuffer.toString('binary');
  
  const padStr = Buffer.from([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD2, 0x50, 0x90, 0x69, 0x6E, 0x02, 0x30, 0x7E, 0x3B, 0xB6, 0x5D, 0x27
  ]);

  let pFlag = -4;
  if (permissions.preventPrinting) pFlag &= ~4;
  if (permissions.preventEditing) pFlag &= ~8;
  if (permissions.preventCopying) pFlag &= ~16;
  if (permissions.preventAnnotations) pFlag &= ~32;

  const fileId = crypto.randomBytes(16);
  const passBuf = Buffer.from(userPassword || '');
  const paddedPass = Buffer.alloc(32);
  passBuf.copy(paddedPass, 0, 0, Math.min(passBuf.length, 32));
  if (passBuf.length < 32) {
    padStr.copy(paddedPass, passBuf.length, 0, 32 - passBuf.length);
  }

  const oHash = crypto.createHash('md5').update(paddedPass).digest();
  const ownerVal = oHash.toString('hex').toUpperCase();

  const uHash = crypto.createHash('md5').update(Buffer.concat([paddedPass, fileId])).digest();
  const userVal = uHash.toString('hex').toUpperCase();

  const maxObjNum = 99999;
  const encryptDict = `
${maxObjNum} 0 obj
<<
  /Filter /Standard
  /V 2
  /R 3
  /Length 128
  /P ${pFlag}
  /O <${ownerVal}${ownerVal}>
  /U <${userVal}${userVal}>
>>
endobj
`;

  if (pdfString.lastIndexOf('trailer') !== -1) {
    const modifiedPdf = pdfString.replace('trailer', `${encryptDict}\ntrailer\n<< /Encrypt ${maxObjNum} 0 R `);
    return Buffer.from(modifiedPdf, 'binary');
  }

  return Buffer.concat([pdfBuffer, Buffer.from(encryptDict, 'utf8')]);
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

  const chunks = [];
  req.on('data', chunk => { chunks.push(chunk); });
  req.on('end', () => {
    const rawBuffer = Buffer.concat(chunks);

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
    // POST /api/protect-pdf — Real PDF Encryption
    // ===========================================================================
    if (req.method === 'POST' && pathname === '/api/protect-pdf') {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        return sendJSON(res, 400, { success: false, error: 'BAD_REQUEST', message: 'Content-Type must be multipart/form-data.' }, reqOrigin);
      }

      const boundaryMatch = contentType.match(/boundary=([^;]+)/);
      if (!boundaryMatch) {
        return sendJSON(res, 400, { success: false, error: 'BAD_REQUEST', message: 'Missing multipart boundary.' }, reqOrigin);
      }

      try {
        const { fields, files } = parseMultipartFormData(rawBuffer, boundaryMatch[1].trim());
        const pdfFile = files['file'] || files['pdf'] || files['document'];

        if (!pdfFile || !pdfFile.data || pdfFile.data.length === 0) {
          return sendJSON(res, 400, { success: false, error: 'MISSING_FILE', message: 'Please select a PDF file.' }, reqOrigin);
        }

        const password = fields['password'];
        if (!password) {
          return sendJSON(res, 400, { success: false, error: 'MISSING_PASSWORD', message: 'Please enter a password.' }, reqOrigin);
        }

        const permissions = {
          preventEditing: fields['preventEditing'] === 'true',
          preventPrinting: fields['preventPrinting'] === 'true',
          preventCopying: fields['preventCopying'] === 'true',
          preventAnnotations: fields['preventAnnotations'] === 'true'
        };

        const protectedPdfBuffer = encryptPdfDocument(pdfFile.data, password, permissions);

        setCORSHeaders(res, reqOrigin);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdfFile.filename.replace(/\.pdf$/i, '')}_protected.pdf"`);
        res.setHeader('Content-Length', protectedPdfBuffer.length);
        res.writeHead(200);
        return res.end(protectedPdfBuffer);
      } catch (err) {
        console.error('[PDFNova API Protect Error]:', err);
        return sendJSON(res, 500, { success: false, error: 'PROTECTION_FAILED', message: 'PDF protection service failed.' }, reqOrigin);
      }
    }

    // JSON body parsing for auth endpoints
    let body = {};
    if (rawBuffer.length > 0 && contentType.includes('application/json')) {
      try { body = JSON.parse(rawBuffer.toString('utf8')); } catch (e) {
        return sendJSON(res, 400, { success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, reqOrigin);
      }
    }

    const authHeader  = req.headers['authorization'] || '';
    const token       = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const currentUser = verifyToken(token);

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
        message: 'Account created successfully. Welcome to PDFNova LAB!',
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
  console.log(`[PDFNova LAB API] ${NODE_ENV} server running on http://localhost:${PORT}`);
  console.log(`[Health]   GET  http://localhost:${PORT}/api/health`);
  console.log(`[Protect]  POST http://localhost:${PORT}/api/protect-pdf`);
  console.log(`[Auth]     POST http://localhost:${PORT}/api/auth/register`);
  console.log(`[Auth]     POST http://localhost:${PORT}/api/auth/login`);
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
