/**
 * PDFNova LAB — Runtime Configuration
 *
 * Public Production Backend: https://pdf-tdhm.onrender.com
 * Local Development Backend: http://localhost:5000
 */

window.PDFNOVA_CONFIG = (function () {
  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const PRODUCTION_API = 'https://pdf-tdhm.onrender.com';
  const LOCAL_DEV_API  = 'http://localhost:5000';

  return {
    API_BASE_URL: isLocalDev ? LOCAL_DEV_API : PRODUCTION_API,
    PROD_API_URL: PRODUCTION_API,
    DEV_API_URL: LOCAL_DEV_API
  };
})();
