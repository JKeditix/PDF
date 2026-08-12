/**
 * PDFNova — Runtime Configuration
 *
 * HOW TO CONFIGURE:
 *
 * DEVELOPMENT (localhost):
 *   Set API_BASE_URL to 'http://localhost:5000'
 *   This file is already configured for local development by default.
 *
 * PRODUCTION:
 *   Change API_BASE_URL to your real deployed backend URL.
 *   Example: 'https://api.pdfnova.yourdomain.com'
 *
 * This is the ONLY place you need to change the API URL.
 * Never hardcode http://localhost in app.js or index.html.
 */

window.PDFNOVA_CONFIG = (function () {
  // Auto-detect: if running on localhost, use local backend.
  // Otherwise, use the production backend URL below.
  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';

  return {
    // ─── Development backend ────────────────────────────────────────────────
    // Used automatically when opening on localhost / 127.0.0.1
    DEV_API_URL: 'http://localhost:5000',

    // ─── Production backend ─────────────────────────────────────────────────
    // Replace this with your real deployed backend URL before deploying.
    // Example: 'https://api.pdfnova.yourdomain.com'
    PROD_API_URL: 'https://api.pdfnova.yourdomain.com',

    // Resolved URL used by the app
    API_BASE_URL: isLocalDev
      ? 'http://localhost:5000'
      : 'https://api.pdfnova.yourdomain.com'
  };
})();
