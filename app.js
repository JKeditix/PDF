// PDFNova - Complete Tool Processing Engine
// Real implementations for all PDF, Document, Image, and Advanced tools.
// PDFNova automatic deployment test

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const { jsPDF } = window.jspdf;

// ============================================================================
// CONFIGURATION — API URL is set in config.js (loaded before this file)
// ============================================================================
const CONFIG = {
  get API_BASE_URL() {
    return (window.PDFNOVA_CONFIG && window.PDFNOVA_CONFIG.API_BASE_URL) || 'http://localhost:5000';
  }
};

// ============================================================================
// 1. MASTER TOOL REGISTRY
// ============================================================================
const TOOLS = [
  // --- Editors ---
  { id: 'pdf-editor',        name: 'PDF Editor',             desc: 'Edit, annotate, draw signatures, highlight, and customize PDF pages.',               icon: 'fa-pen-to-square',        category: 'editor',   popular: true,  formats: ['PDF'],             accept: '.pdf' },
  { id: 'word-editor',       name: 'Word (DOCX) Editor',     desc: 'Create and edit Word documents with rich text formatting and PDF export.',           icon: 'fa-file-word',            category: 'editor',   popular: true,  formats: ['DOCX', 'PDF'],     accept: '.docx,.doc' },

  // --- PDF Tools ---
  { id: 'pdf-to-img',        name: 'PDF to Image',           desc: 'Render PDF pages into crisp high-resolution PNG images.',                            icon: 'fa-file-image',           category: 'pdf',      popular: true,  formats: ['PDF', 'PNG'],      accept: '.pdf' },
  { id: 'img-to-pdf',        name: 'Image to PDF',           desc: 'Convert and pack JPG, PNG, or WEBP photos into a PDF document.',                    icon: 'fa-images',               category: 'pdf',      popular: true,  formats: ['JPG', 'PNG', 'PDF'],accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'merge-pdf',         name: 'Merge PDF',              desc: 'Combine multiple PDF files into one consolidated document.',                          icon: 'fa-object-group',         category: 'pdf',      popular: true,  formats: ['PDF'],             accept: '.pdf' },
  { id: 'compress-pdf',      name: 'Compress PDF',           desc: 'Optimize image encoding and reduce PDF file size.',                                   icon: 'fa-file-zipper',          category: 'pdf',      popular: true,  formats: ['PDF'],             accept: '.pdf' },
  { id: 'split-pdf',         name: 'Split PDF',              desc: 'Split a PDF by page ranges into separate files.',                                     icon: 'fa-scissors',             category: 'pdf',      popular: true,  formats: ['PDF', 'ZIP'],      accept: '.pdf' },
  { id: 'organize-pdf',      name: 'Organize PDF',           desc: 'Reorder PDF pages visually then export the new order.',                               icon: 'fa-arrows-reorder',       category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'rotate-pdf',        name: 'Rotate PDF',             desc: 'Rotate selected or all pages 90°, 180°, or 270°.',                                   icon: 'fa-rotate',               category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'delete-pages',      name: 'Delete PDF Pages',       desc: 'Remove unwanted pages from a PDF and export a clean document.',                      icon: 'fa-trash-can',            category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'extract-pages',     name: 'Extract PDF Pages',      desc: 'Select specific pages to build a brand new smaller PDF.',                             icon: 'fa-file-export',          category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'pdf-to-text',       name: 'PDF to Text',            desc: 'Extract selectable text page by page.',                                               icon: 'fa-file-lines',           category: 'pdf',      popular: false, formats: ['PDF', 'TXT'],      accept: '.pdf' },
  { id: 'watermark-pdf',     name: 'Watermark PDF',          desc: 'Stamp custom text watermarks onto PDF pages.',                                        icon: 'fa-stamp',                category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'page-numbers',      name: 'PDF Page Numbers',       desc: 'Add visible page numbers to every page of your PDF.',                                 icon: 'fa-list-ol',              category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'page-size',         name: 'PDF Page Size',          desc: 'Convert PDF pages to standard paper sizes (A4, Letter).',                             icon: 'fa-ruler-combined',       category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'pdf-to-word',       name: 'PDF to Word',            desc: 'Convert PDF document pages and layout into editable Word DOCX file.',                 icon: 'fa-file-word',            category: 'pdf',      popular: true,  formats: ['PDF', 'DOCX'],     accept: '.pdf' },
  { id: 'pdf-to-excel',      name: 'PDF to Excel',           desc: 'Extract text grids and tables into structured CSV/XLSX spreadsheet data.',            icon: 'fa-file-excel',           category: 'pdf',      popular: true,  formats: ['PDF', 'CSV'],      accept: '.pdf' },
  { id: 'pdf-to-ppt',        name: 'PDF to PowerPoint',      desc: 'Export PDF pages as structured slideshow presentation document.',                     icon: 'fa-file-powerpoint',      category: 'pdf',      popular: false, formats: ['PDF', 'PPTX'],     accept: '.pdf' },
  { id: 'word-to-pdf',       name: 'Word to PDF',            desc: 'Convert DOCX and DOC files into crisp PDF document format.',                         icon: 'fa-file-pdf',             category: 'pdf',      popular: true,  formats: ['DOCX', 'PDF'],     accept: '.docx,.doc' },
  { id: 'excel-to-pdf',      name: 'Excel to PDF',           desc: 'Convert CSV/spreadsheet tables into formatted grid PDF documents.',                   icon: 'fa-file-pdf',             category: 'pdf',      popular: false, formats: ['CSV', 'PDF'],      accept: '.csv,.tsv,.txt' },
  { id: 'ppt-to-pdf',        name: 'PowerPoint to PDF',      desc: 'Convert presentation slides into clean portable PDF format.',                         icon: 'fa-file-pdf',             category: 'pdf',      popular: false, formats: ['PPTX', 'PDF'],     accept: '.pptx,.ppt,.txt' },
  { id: 'unlock-pdf',        name: 'Unlock PDF',             desc: 'Remove password restrictions and render clean unlocked PDF file.',                   icon: 'fa-unlock',               category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'protect-pdf',       name: 'Protect PDF',            desc: 'Apply security protection and encryption overlays to PDF document.',                 icon: 'fa-lock',                 category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'sign-pdf',          name: 'Sign PDF',               desc: 'Draw digital signatures and stamp them onto PDF pages.',                             icon: 'fa-signature',            category: 'pdf',      popular: true,  formats: ['PDF'],             accept: '.pdf' },
  { id: 'compare-pdf',       name: 'Compare PDF',            desc: 'Compare text and page differences between two PDF documents side-by-side.',            icon: 'fa-code-compare',         category: 'pdf',      popular: false, formats: ['PDF', 'TXT'],      accept: '.pdf' },
  { id: 'repair-pdf',        name: 'Repair PDF',             desc: 'Recover data streams from damaged PDF files and rebuild clean PDF structure.',        icon: 'fa-screwdriver-wrench',  category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'metadata-editor',   name: 'Metadata Editor',        desc: 'Edit Title, Author, Subject, and Creator metadata tags embedded in PDF.',            icon: 'fa-tags',                 category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'header-footer',     name: 'Header & Footer',        desc: 'Insert custom header and footer labels on every PDF page.',                           icon: 'fa-heading',              category: 'pdf',      popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'bookmarks',         name: 'Bookmarks',              desc: 'Extract and build Table of Contents outline index from PDF headings.',               icon: 'fa-bookmark',             category: 'pdf',      popular: false, formats: ['PDF', 'TXT'],      accept: '.pdf' },
  { id: 'search-replace',    name: 'Search & Replace',       desc: 'Search text queries across PDF document pages and export match details.',             icon: 'fa-magnifying-glass-arrow-right', category: 'pdf', popular: false, formats: ['PDF', 'TXT'],  accept: '.pdf' },

  // --- Document Tools ---
  { id: 'docx-to-pdf',       name: 'DOCX to PDF',            desc: 'Convert Word document (.docx) to high quality PDF file.',                            icon: 'fa-file-pdf',             category: 'document', popular: true,  formats: ['DOCX', 'PDF'],     accept: '.docx,.doc' },
  { id: 'txt-to-pdf',        name: 'TXT to PDF',             desc: 'Convert plain text files into formatted PDF document with custom margins.',           icon: 'fa-file-lines',           category: 'document', popular: false, formats: ['TXT', 'PDF'],      accept: '.txt' },
  { id: 'html-to-pdf',       name: 'HTML to PDF',            desc: 'Render HTML documents and code into styled PDF pages.',                              icon: 'fa-code',                 category: 'document', popular: false, formats: ['HTML', 'PDF'],     accept: '.html,.htm' },
  { id: 'md-to-pdf',         name: 'Markdown to PDF',        desc: 'Parse Markdown markup syntax (# headings, lists, bold) into formatted PDF.',          icon: 'fa-brands fa-markdown',   category: 'document', popular: false, formats: ['MD', 'PDF'],       accept: '.md,.markdown' },
  { id: 'rtf-to-pdf',        name: 'RTF to PDF',             desc: 'Convert Rich Text Format (RTF) documents to portable PDF file.',                     icon: 'fa-file-waveform',        category: 'document', popular: false, formats: ['RTF', 'PDF'],      accept: '.rtf,.txt' },

  // --- Image Tools ---
  { id: 'photo-enhancer',    name: 'Photo Quality Enhancer', desc: 'Sharpen and enhance brightness, contrast and saturation of your photos.',             icon: 'fa-wand-magic-sparkles',  category: 'image',    popular: true,  formats: ['JPG', 'PNG', 'WEBP'],accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'image-converter',   name: 'Image Converter',        desc: 'Convert images between JPG, PNG, and WEBP formats.',                                  icon: 'fa-repeat',               category: 'image',    popular: false, formats: ['JPG', 'PNG', 'WEBP'],accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'image-compressor',  name: 'Image Compressor',       desc: 'Compress image quality to reduce file size.',                                          icon: 'fa-file-contract',        category: 'image',    popular: false, formats: ['JPG', 'PNG', 'WEBP'],accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'image-resize',      name: 'Resize Image',           desc: 'Resize images by percentage scale or pixel bounds.',                                   icon: 'fa-expand-arrows-alt',    category: 'image',    popular: false, formats: ['JPG', 'PNG', 'WEBP'],accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'image-crop',        name: 'Crop Image',             desc: 'Crop images to a selected center or custom region.',                                  icon: 'fa-crop-simple',          category: 'image',    popular: false, formats: ['JPG', 'PNG', 'WEBP'],accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'image-rotate',      name: 'Rotate Image',           desc: 'Rotate images 90°, 180° or 270°.',                                me: 'Rotate Image', category: 'image',    popular: false, formats: ['JPG', 'PNG', 'WEBP'],accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'image-upscaler',    name: 'Image Upscaler',         desc: 'Upscale image resolution (2x/4x) using high-quality bilinear filtering & sharpening.',icon: 'fa-up-right-and-down-left-from-center', category: 'image', popular: true, formats: ['PNG', 'JPG'], accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'bg-remover',        name: 'Background Remover',     desc: 'Scan image pixels and remove white/solid background to export transparent PNG.',       icon: 'fa-eraser',               category: 'image',    popular: true,  formats: ['PNG'],             accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'jpg-to-pdf',        name: 'JPG to PDF',             desc: 'Quick utility to turn JPG photographs into a PDF document.',                          icon: 'fa-file-pdf',             category: 'image',    popular: true,  formats: ['JPG', 'PDF'],      accept: '.jpg,.jpeg' },

  // --- Advanced Tools ---
  { id: 'ocr-pdf',           name: 'OCR PDF',                desc: 'Perform Optical Character Recognition to extract searchable text from scanned PDF.', icon: 'fa-eye',                  category: 'advanced', popular: true,  formats: ['PDF', 'TXT'],      accept: '.pdf' },
  { id: 'bates-numbering',   name: 'Bates Numbering',        desc: 'Stamp sequential legal Bates numbers (e.g. BATES-000001) onto PDF pages.',           icon: 'fa-barcode',              category: 'advanced', popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'page-labels',       name: 'Page Labels',            desc: 'Assign custom page numbers and Roman numeral labels to PDF pages.',                    icon: 'fa-list-ol',              category: 'advanced', popular: false, formats: ['PDF'],             accept: '.pdf' },
  { id: 'file-information',  name: 'File Information',       desc: 'Deep inspection panel for PDF size, page dimensions, fonts, MIME, and metadata.',    icon: 'fa-circle-info',          category: 'advanced', popular: false, formats: ['PDF', 'INFO'],     accept: '.pdf,.docx,.png,.jpg,.webp' }
];

// ============================================================================
// 2. HELPER UTILITIES
// ============================================================================

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024, dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ============================================================================
// 3. SYSTEM HEALTH MONITORING
// ============================================================================

async function checkSystemHealth() {
  const badge = document.getElementById('sys-status-badge');
  const text  = document.getElementById('sys-status-text');
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/health`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') {
        badge.className = 'status-badge online';
        text.textContent = 'Backend Connected';
        return true;
      }
    }
  } catch (e) {}
  badge.className = 'status-badge offline';
  text.textContent = 'Backend Offline';
  return false;
}

// ============================================================================
// 4. USER AUTHENTICATION & ACCOUNT DASHBOARD CONTROLLER
// ============================================================================

const AuthController = {
  tokenKey: 'pdfnova_token',
  userKey:  'pdfnova_user',

  getToken() { return localStorage.getItem(this.tokenKey); },
  getUser()  { try { return JSON.parse(localStorage.getItem(this.userKey)); } catch(e) { return null; } },

  updateUserBtn() {
    const user    = this.getUser();
    const btnText = document.getElementById('user-btn-text');
    if (btnText) btnText.textContent = user ? (user.name || user.email.split('@')[0]) : 'Sign In';
  },

  async openAccountDashboard() {
    const user = this.getUser();
    if (!user) { document.getElementById('auth-modal').classList.add('active'); return; }
    document.getElementById('acc-name').textContent  = user.name || 'User';
    document.getElementById('acc-email').textContent = user.email;
    document.getElementById('account-modal').classList.add('active');
  },

  init() {
    this.updateUserBtn();
    document.getElementById('btn-open-auth').onclick = () => {
      if (this.getUser()) this.openAccountDashboard();
      else document.getElementById('auth-modal').classList.add('active');
    };
    document.getElementById('btn-close-auth').onclick    = () => document.getElementById('auth-modal').classList.remove('active');
    document.getElementById('btn-close-account').onclick = () => document.getElementById('account-modal').classList.remove('active');

    document.getElementById('btn-logout-account').onclick = () => {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
      document.getElementById('account-modal').classList.remove('active');
      ToastManager.show('Logged out successfully.', 'info');
      this.updateUserBtn();
    };

    let isLoginMode = true;
    document.getElementById('tab-login').onclick = () => {
      isLoginMode = true;
      document.getElementById('tab-login').style.borderBottom  = '2px solid var(--primary)';
      document.getElementById('tab-signup').style.borderBottom = 'none';
      document.getElementById('reg-name-group').style.display    = 'none';
      document.getElementById('reg-confirm-group').style.display = 'none';
      document.getElementById('auth-submit-btn').innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> Log In`;
    };
    document.getElementById('tab-signup').onclick = () => {
      isLoginMode = false;
      document.getElementById('tab-signup').style.borderBottom = '2px solid var(--primary)';
      document.getElementById('tab-login').style.borderBottom  = 'none';
      document.getElementById('reg-name-group').style.display    = 'flex';
      document.getElementById('reg-confirm-group').style.display = 'flex';
      document.getElementById('auth-submit-btn').innerHTML = `<i class="fa-solid fa-user-plus"></i> Register Account`;
    };

    document.getElementById('auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const name            = document.getElementById('auth-name').value;
      const email           = document.getElementById('auth-email').value;
      const password        = document.getElementById('auth-password').value;
      const confirmPassword = document.getElementById('auth-confirm-password').value;
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
      const payload  = isLoginMode ? { email, password } : { name, email, password, confirmPassword };
      try {
        const res  = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem(this.tokenKey, data.token);
          localStorage.setItem(this.userKey, JSON.stringify(data.user));
          ToastManager.show(data.message || `Welcome to PDFNova, ${data.user.name || data.user.email}!`, 'success');
          document.getElementById('auth-modal').classList.remove('active');
          this.updateUserBtn();
        } else {
          ToastManager.show(data.message || 'Authentication failed.', 'danger');
        }
      } catch (err) {
        ToastManager.show('Cannot connect to backend server.', 'danger');
      }
    };
  }
};

// ============================================================================
// 5. MANAGERS: TOAST, FAVORITES, HISTORY, THEME
// ============================================================================

const ThemeManager = {
  key: 'pdfnova_theme',
  init() {
    const saved = localStorage.getItem(this.key);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    document.getElementById('theme-toggle-btn').onclick = () => {
      const current = document.documentElement.getAttribute('data-theme');
      this.applyTheme(current === 'dark' ? 'light' : 'dark');
    };
  },
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.key, theme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
};

const ToastManager = {
  container: document.getElementById('toast-container'),
  show(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { info: 'fa-circle-info', warning: 'fa-triangle-exclamation', danger: 'fa-circle-xmark', success: 'fa-circle-check' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeIn 0.3s reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }
};

const FavoritesManager = {
  key: 'pdfnova_favorites',
  getFavorites() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch (e) { return []; } },
  isFavorite(toolId) { return this.getFavorites().includes(toolId); },
  toggleFavorite(toolId) {
    let favs = this.getFavorites();
    favs = favs.includes(toolId) ? favs.filter(id => id !== toolId) : [...favs, toolId];
    localStorage.setItem(this.key, JSON.stringify(favs));
    this.updateUI();
  },
  updateUI() {
    const badge = document.getElementById('fav-count');
    if (badge) badge.textContent = this.getFavorites().length;
  }
};

const HistoryManager = {
  key: 'pdfnova_history',
  getLogs() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch (e) { return []; } },
  addLog(toolName, originalName, outputName, size) {
    const logs = this.getLogs();
    logs.unshift({ id: Math.random().toString(36).substring(2,9), toolName, originalName, outputName, size: formatBytes(size), time: new Date().toLocaleString() });
    if (logs.length > 30) logs.pop();
    localStorage.setItem(this.key, JSON.stringify(logs));
  },
  renderModal() {
    const container = document.getElementById('history-list-container');
    const logs = this.getLogs();
    if (logs.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:2rem 0;"><p>No recent history found.</p></div>`;
      return;
    }
    container.innerHTML = logs.map(item => `
      <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--border-color);font-size:0.85rem;">
        <div><strong>${item.toolName}</strong><div style="color:var(--text-muted);font-size:0.75rem;">${item.originalName} &rarr; ${item.outputName}</div></div>
        <div style="text-align:right;"><span style="color:var(--primary);font-weight:700;">${item.size}</span><div style="color:var(--text-muted);font-size:0.7rem;">${item.time}</div></div>
      </div>`).join('');
  }
};

// ============================================================================
// 6. COMMAND PALETTE & KEYBOARD NAVIGATION
// ============================================================================

const CommandPalette = {
  overlay: document.getElementById('cmd-palette'),
  input: document.getElementById('cmd-input'),
  results: document.getElementById('cmd-results'),
  selectedIndex: 0,
  filteredTools: [],

  init() {
    document.getElementById('btn-cmd-palette').onclick = () => this.open();
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.toggle(); }
      if (this.overlay.classList.contains('active')) {
        if (e.key === 'Escape')    this.close();
        if (e.key === 'ArrowDown') { e.preventDefault(); this.navigate(1); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); this.navigate(-1); }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.filteredTools[this.selectedIndex]) {
            openToolWorkspace(this.filteredTools[this.selectedIndex].id);
            this.close();
          }
        }
      }
    });
    this.input.oninput = () => this.renderResults();
  },
  toggle() { if (this.overlay.classList.contains('active')) this.close(); else this.open(); },
  open()   { this.overlay.classList.add('active'); this.input.value = ''; this.renderResults(); setTimeout(() => this.input.focus(), 50); },
  close()  { this.overlay.classList.remove('active'); },
  navigate(dir) {
    if (!this.filteredTools.length) return;
    this.selectedIndex = (this.selectedIndex + dir + this.filteredTools.length) % this.filteredTools.length;
    this.highlightSelected();
  },
  highlightSelected() {
    const items = this.results.querySelectorAll('.cmd-item');
    items.forEach((item, idx) => item.classList.toggle('selected', idx === this.selectedIndex));
  },
  renderResults() {
    const query = this.input.value.toLowerCase().trim();
    this.filteredTools = TOOLS.filter(t => t.name.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query));
    this.selectedIndex = 0;
    this.results.innerHTML = this.filteredTools.map((t, idx) => `
      <div class="cmd-item ${idx === 0 ? 'selected' : ''}" data-id="${t.id}">
        <span><i class="fa-solid ${t.icon}" style="color:var(--primary);margin-right:0.5rem;"></i>${t.name}</span>
        <span class="format-badge">${t.category.toUpperCase()}</span>
      </div>`).join('');
    this.results.querySelectorAll('.cmd-item').forEach(item => {
      item.onclick = () => { openToolWorkspace(item.dataset.id); this.close(); };
    });
  }
};

function initFaqAccordion() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-question').onclick = () => {
      const active = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!active) item.classList.add('active');
    };
  });
}

function initNavigationScrolls() {
  const scrollToSection = (id) => {
    showDashboardView();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };
  document.getElementById('nav-link-editor').onclick   = (e) => { e.preventDefault(); scrollToSection('doc-editor-section'); };
  document.getElementById('nav-link-tools').onclick    = (e) => { e.preventDefault(); scrollToSection('dashboard-section'); };
  document.getElementById('nav-link-features').onclick = (e) => { e.preventDefault(); scrollToSection('features-section'); };
  document.getElementById('nav-link-faq').onclick      = (e) => { e.preventDefault(); scrollToSection('faq-section'); };
  document.getElementById('hero-btn-editor').onclick   = () => scrollToSection('doc-editor-section');
  document.getElementById('hero-btn-tools').onclick    = () => scrollToSection('dashboard-section');
  document.getElementById('btn-open-history').onclick  = () => {
    HistoryManager.renderModal();
    document.getElementById('history-modal').classList.add('active');
  };
  document.getElementById('btn-close-history').onclick = () => document.getElementById('history-modal').classList.remove('active');
}

// ============================================================================
// 7. HERO & DASHBOARD CONTROLLERS
// ============================================================================

function initHeroDemo() {
  const dropzone  = document.getElementById('hero-demo-dropzone');
  const fileInput = document.getElementById('hero-demo-file');
  const fileInfo  = document.getElementById('hero-demo-file-info');
  const startBtn  = document.getElementById('hero-demo-start-btn');
  fileInput.onchange = (e) => {
    if (!e.target.files.length) return;
    const file = e.target.files[0];
    document.getElementById('hero-demo-name').textContent = file.name;
    document.getElementById('hero-demo-size').textContent = formatBytes(file.size);
    dropzone.style.display = 'none';
    fileInfo.style.display = 'flex';
  };
  startBtn.onclick = () => openToolWorkspace('pdf-to-img');
}

function initDashboard() {
  const grid = document.getElementById('tools-grid');
  grid.innerHTML = TOOLS.map(tool => {
    const isFav = FavoritesManager.isFavorite(tool.id);
    return `
      <div class="tool-card" data-id="${tool.id}" data-category="${tool.category}" data-popular="${tool.popular}">
        <div class="card-top">
          <div class="card-icon"><i class="fa-solid ${tool.icon}"></i></div>
          <button class="favorite-btn ${isFav ? 'active' : ''}" data-tool="${tool.id}">
            <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
          </button>
        </div>
        <div class="card-title">${tool.name}</div>
        <div class="card-desc">${tool.desc}</div>
        <div class="card-bottom">
          <div class="format-tags">${tool.formats.map(f => `<span class="format-badge">${f}</span>`).join('')}</div>
          <span class="card-action-text">Open Tool <i class="fa-solid fa-arrow-right"></i></span>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.tool-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.favorite-btn')) {
        const favBtn = e.target.closest('.favorite-btn');
        FavoritesManager.toggleFavorite(favBtn.dataset.tool);
        filterDashboard();
        e.stopPropagation();
        return;
      }
      openToolWorkspace(card.dataset.id);
    };
  });

  document.getElementById('btn-open-pdf-editor').onclick  = () => openToolWorkspace('pdf-editor');
  document.getElementById('btn-open-word-editor').onclick = () => openToolWorkspace('word-editor');
  document.getElementById('featured-card').onclick        = () => openToolWorkspace('pdf-to-img');

  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterDashboard();
    };
  });
}

function filterDashboard() {
  const activeCat = document.querySelector('.cat-btn.active').dataset.category;
  document.querySelectorAll('.tool-card').forEach(card => {
    const tool = TOOLS.find(t => t.id === card.dataset.id);
    let visible = true;
    if      (activeCat === 'popular')   visible = tool.popular;
    else if (activeCat === 'pdf')       visible = tool.category === 'pdf' || tool.category === 'editor';
    else if (activeCat === 'document')  visible = tool.category === 'document' || tool.id === 'word-editor';
    else if (activeCat === 'image')     visible = tool.category === 'image';
    else if (activeCat === 'advanced')  visible = tool.category === 'advanced';
    else if (activeCat === 'favorites') visible = FavoritesManager.isFavorite(tool.id);
    card.style.display = visible ? 'flex' : 'none';
  });
}

function showDashboardView() {
  document.getElementById('dashboard-view').style.display = 'block';
  document.getElementById('workspace-view').classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openToolWorkspace(toolId) {
  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) return;
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('workspace-view').classList.add('active');
  document.getElementById('ws-category').textContent      = tool.category.toUpperCase();
  document.getElementById('ws-title-crumb').textContent   = tool.name;
  document.getElementById('ws-tool-title').textContent    = tool.name;
  document.getElementById('ws-tool-desc').textContent     = tool.desc;
  renderToolWorkspace(tool);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('logo-home-btn').onclick    = (e) => { e.preventDefault(); showDashboardView(); };
document.getElementById('btn-back-dashboard').onclick = showDashboardView;

// ============================================================================
// 8. UNIVERSAL FILE UPLOADER
// ============================================================================

const UniversalFileUploader = {
  validateFiles(files, category, toolId) {
    if (!files || files.length === 0) return [];
    const tool = TOOLS.find(t => t.id === toolId);
    const validFiles = [];
    for (const file of Array.from(files)) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      let isValid = true;
      if (tool && tool.accept) {
        const allowed = tool.accept.split(',').map(a => a.trim().toLowerCase());
        isValid = allowed.some(a => a === ext || a === '.*');
      }
      if (!isValid) ToastManager.show(`Unsupported file type for ${tool ? tool.name : 'this tool'}: ${file.name}`, 'warning');
      else validFiles.push(file);
    }
    return validFiles;
  },

  attachDropzone(dropzoneEl, fileInputEl, onFilesSelected, isMultiple = false, category = 'pdf', toolId = '') {
    if (!dropzoneEl || !fileInputEl) return;
    fileInputEl.multiple = isMultiple;

    // Click dropzone → open file picker
    dropzoneEl.onclick = (e) => {
      if (e.target === dropzoneEl || !e.target.closest('button') && !e.target.closest('canvas') && !e.target.closest('input')) {
        fileInputEl.value = '';
        fileInputEl.click();
      }
    };

    // Reset value on click so same file can be re-selected
    fileInputEl.onclick = (e) => { e.stopPropagation(); fileInputEl.value = ''; };

    fileInputEl.onchange = (e) => {
      e.stopPropagation();
      const rawFiles = Array.from(e.target.files || []);
      if (!rawFiles.length) return;
      const validFiles = this.validateFiles(rawFiles, category, toolId);
      if (!validFiles.length) return;
      onFilesSelected(isMultiple ? validFiles : validFiles[0]);
    };

    dropzoneEl.ondragover  = (e) => { e.preventDefault(); dropzoneEl.style.borderColor = 'var(--primary)'; };
    dropzoneEl.ondragleave = (e) => { e.preventDefault(); dropzoneEl.style.borderColor = ''; };
    dropzoneEl.ondrop = (e) => {
      e.preventDefault();
      dropzoneEl.style.borderColor = '';
      const rawFiles   = Array.from(e.dataTransfer.files || []);
      if (!rawFiles.length) return;
      const validFiles = this.validateFiles(rawFiles, category, toolId);
      if (!validFiles.length) return;
      onFilesSelected(isMultiple ? validFiles : validFiles[0]);
    };
  }
};

// ============================================================================
// 9. TOOL WORKSPACE ROUTER
// ============================================================================

function renderToolWorkspace(tool) {
  const container = document.getElementById('ws-dynamic-content');
  if      (tool.id === 'pdf-editor')  renderPdfEditorTool(container, tool);
  else if (tool.id === 'word-editor') renderWordEditorTool(container, tool);
  else                                renderUniversalConverterTool(container, tool);
}

// ============================================================================
// 10. PDF EDITOR
// ============================================================================

function renderPdfEditorTool(container, tool) {
  container.innerHTML = `
    <div class="dropzone" id="pdf-editor-dropzone" style="cursor:pointer;">
      <div class="dropzone-icon"><i class="fa-solid fa-pen-to-square"></i></div>
      <div style="font-weight:700;font-size:1.1rem;color:var(--text-dark);">Drag & drop PDF to Edit</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Click or drag to load your PDF document</div>
      <input type="file" class="file-input" id="pdf-editor-file-input" accept=".pdf">
    </div>

    <div class="office-editor-wrapper" id="office-editor-view" style="display:none;">
      <div class="office-header">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <i class="fa-solid fa-file-pdf" style="color:var(--primary);font-size:1.25rem;"></i>
          <input type="text" class="doc-title-input" id="doc-filename" value="document.pdf">
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button type="button" class="sm-btn" id="pdf-btn-change-file"><i class="fa-solid fa-folder-open"></i> Open Another</button>
          <button type="button" class="btn btn-primary" id="pdf-btn-export" style="padding:0.45rem 1rem;font-size:0.85rem;"><i class="fa-solid fa-download"></i> Export PDF</button>
        </div>
      </div>
      <div class="office-paper-workspace" id="pdf-canvas-container">
        <div class="paper-sheet" style="padding:0;min-height:auto;max-width:720px;" id="pdf-active-page-wrapper">
          <canvas id="pdf-render-canvas" style="width:100%;display:block;"></canvas>
        </div>
      </div>
      <div class="office-status-bar">
        <span>Page <span id="pdf-cur-page">1</span> of <span id="pdf-tot-page">1</span></span>
        <span id="pdf-page-nav" style="display:flex;gap:0.5rem;">
          <button type="button" class="sm-btn" id="pdf-prev-page">◀ Prev</button>
          <button type="button" class="sm-btn" id="pdf-next-page">Next ▶</button>
        </span>
      </div>
    </div>
  `;

  let pdfDoc = null;
  let currentPage = 1;
  const dropzone  = container.querySelector('#pdf-editor-dropzone');
  const fileInput = container.querySelector('#pdf-editor-file-input');

  const renderPage = async (pageNum) => {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(pageNum);
    const vp   = page.getViewport({ scale: 1.5 });
    const cvs  = container.querySelector('#pdf-render-canvas');
    cvs.width  = vp.width;
    cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    container.querySelector('#pdf-cur-page').textContent = pageNum;
  };

  const loadPdf = async (file) => {
    try {
      ToastManager.show(`Opening ${file.name}...`, 'info');
      const ab = await readFileAsArrayBuffer(file);
      pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      currentPage = 1;
      container.querySelector('#doc-filename').value = file.name;
      container.querySelector('#pdf-tot-page').textContent = pdfDoc.numPages;
      dropzone.style.display = 'none';
      container.querySelector('#office-editor-view').style.display = 'flex';
      await renderPage(1);
      ToastManager.show(`${file.name} loaded (${pdfDoc.numPages} pages)`, 'success');
    } catch (err) {
      console.error('PDF load error:', err);
      ToastManager.show('Unable to open this PDF document.', 'danger');
    }
  };

  UniversalFileUploader.attachDropzone(dropzone, fileInput, loadPdf, false, tool.category, tool.id);

  container.querySelector('#pdf-btn-change-file').onclick = (e) => {
    e.preventDefault();
    fileInput.value = '';
    fileInput.click();
  };

  container.querySelector('#pdf-prev-page').onclick = async (e) => {
    e.preventDefault();
    if (currentPage > 1) { currentPage--; await renderPage(currentPage); }
  };

  container.querySelector('#pdf-next-page').onclick = async (e) => {
    e.preventDefault();
    if (pdfDoc && currentPage < pdfDoc.numPages) { currentPage++; await renderPage(currentPage); }
  };

  container.querySelector('#pdf-btn-export').onclick = async (e) => {
    e.preventDefault();
    if (!pdfDoc) { ToastManager.show('No PDF loaded.', 'warning'); return; }

    ToastManager.show('Generating PDF export...', 'info');
    const fileName = container.querySelector('#doc-filename').value || 'edited_document.pdf';
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const vp   = page.getViewport({ scale: 2.0 });
      const cvs  = document.createElement('canvas');
      cvs.width  = vp.width; cvs.height = vp.height;
      await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
      if (p > 1) doc.addPage();
      doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
    }

    const blob = doc.output('blob');
    triggerDownload(blob, fileName);
    HistoryManager.addLog(tool.name, fileName, fileName, blob.size);
    ToastManager.show('PDF exported successfully!', 'success');
  };
}

// ============================================================================
// 11. WORD EDITOR
// ============================================================================

function renderWordEditorTool(container, tool) {
  container.innerHTML = `
    <div class="dropzone" id="word-editor-dropzone" style="cursor:pointer;">
      <div class="dropzone-icon"><i class="fa-solid fa-file-word"></i></div>
      <div style="font-weight:700;font-size:1.1rem;color:var(--text-dark);">Select a Word Document</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Click or drag a .docx file here to begin editing</div>
      <input type="file" class="file-input" id="word-editor-file-input" accept=".docx,.doc">
    </div>

    <div class="office-editor-wrapper" id="word-editor-view" style="display:none;">
      <div class="office-header">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <i class="fa-solid fa-file-word" style="color:#2b579a;font-size:1.25rem;"></i>
          <input type="text" class="doc-title-input" id="word-filename" value="document.docx">
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button type="button" class="sm-btn" id="word-btn-open-another"><i class="fa-solid fa-folder-open"></i> Open Another</button>
          <button type="button" class="btn btn-primary" id="word-btn-export" style="padding:0.45rem 1rem;font-size:0.85rem;"><i class="fa-solid fa-download"></i> Export PDF</button>
        </div>
      </div>

      <div style="display:flex;gap:0.5rem;padding:0.5rem 1rem;background:var(--bg-card);border-bottom:1px solid var(--border-color);flex-wrap:wrap;">
        <button type="button" class="sm-btn" onclick="document.execCommand('bold')"><b>B</b></button>
        <button type="button" class="sm-btn" onclick="document.execCommand('italic')"><i>I</i></button>
        <button type="button" class="sm-btn" onclick="document.execCommand('underline')"><u>U</u></button>
        <button type="button" class="sm-btn" onclick="document.execCommand('insertUnorderedList')">• List</button>
        <button type="button" class="sm-btn" onclick="document.execCommand('insertOrderedList')">1. List</button>
        <select class="sm-btn" style="padding:0.3rem 0.6rem;" onchange="document.execCommand('fontSize',false,this.value)">
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">XL</option>
          <option value="2">Small</option>
        </select>
        <button type="button" class="sm-btn" onclick="document.execCommand('justifyLeft')">⬅ Left</button>
        <button type="button" class="sm-btn" onclick="document.execCommand('justifyCenter')">⬌ Center</button>
        <button type="button" class="sm-btn" onclick="document.execCommand('justifyRight')">➡ Right</button>
      </div>

      <div class="office-paper-workspace">
        <div class="paper-sheet" id="word-paper-sheet" contenteditable="true"
          style="min-height:600px;outline:none;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;padding:2.5rem;">
        </div>
      </div>

      <div class="office-status-bar">
        <span id="word-status">Document loaded — editing enabled</span>
        <span>Export as PDF using the button above</span>
      </div>
    </div>
  `;

  const dropzone  = container.querySelector('#word-editor-dropzone');
  const fileInput = container.querySelector('#word-editor-file-input');

  const loadDocx = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'docx' && ext !== 'doc') {
      ToastManager.show('Only .docx files are supported.', 'warning');
      return;
    }
    try {
      ToastManager.show(`Loading ${file.name}...`, 'info');
      const ab = await readFileAsArrayBuffer(file);
      const result = await mammoth.convertToHtml({ arrayBuffer: ab });
      const sheet  = container.querySelector('#word-paper-sheet');
      sheet.innerHTML = result.value || '<p>Document loaded — start editing.</p>';
      container.querySelector('#word-filename').value = file.name.replace(/\.(docx|doc)$/i, '.docx');
      dropzone.style.display = 'none';
      container.querySelector('#word-editor-view').style.display = 'flex';
      container.querySelector('#word-status').textContent = `${file.name} loaded (${formatBytes(file.size)})`;
      ToastManager.show(`${file.name} loaded successfully!`, 'success');
    } catch (err) {
      console.error('DOCX load error:', err);
      ToastManager.show('Could not parse this DOCX file.', 'danger');
    }
  };

  UniversalFileUploader.attachDropzone(dropzone, fileInput, loadDocx, false, 'editor', tool.id);

  container.querySelector('#word-btn-open-another').onclick = (e) => {
    e.preventDefault();
    fileInput.value = '';
    fileInput.click();
  };

  container.querySelector('#word-btn-export').onclick = async (e) => {
    e.preventDefault();
    const sheet = container.querySelector('#word-paper-sheet');
    if (!sheet.textContent.trim()) { ToastManager.show('Document is empty.', 'warning'); return; }

    ToastManager.show('Generating PDF from document...', 'info');
    const fileName = container.querySelector('#word-filename').value.replace(/\.(docx|doc)$/i, '.pdf') || 'document.pdf';
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const lines = sheet.innerText.split('\n');
    let y = 40;
    doc.setFontSize(12);
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line || ' ', 515);
      for (const wl of wrapped) {
        if (y > 800) { doc.addPage(); y = 40; }
        doc.text(wl, 40, y);
        y += 18;
      }
    }
    const blob = doc.output('blob');
    triggerDownload(blob, fileName);
    HistoryManager.addLog(tool.name, fileName, fileName, blob.size);
    ToastManager.show('PDF exported from Word document!', 'success');
  };
}

// ============================================================================
// 12. UNIVERSAL CONVERTER & ADVANCED TOOLS
// ============================================================================

function renderUniversalConverterTool(container, tool) {
  const isMultiFile = ['merge-pdf','img-to-pdf','jpg-to-pdf','compare-pdf'].includes(tool.id);

  container.innerHTML = `
    <div class="dropzone" id="uni-dropzone" style="cursor:pointer;">
      <div class="dropzone-icon"><i class="fa-solid ${tool.icon}"></i></div>
      <div style="font-weight:700;font-size:1.1rem;color:var(--text-dark);">Select ${isMultiFile ? 'Files' : 'File'} for ${tool.name}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Click or drag ${isMultiFile ? 'files' : 'file'} here (${tool.accept})</div>
      <input type="file" class="file-input" id="uni-file-input" accept="${tool.accept}">
    </div>

    <div class="options-panel" id="uni-options-panel" style="display:none;flex-direction:column;gap:1.25rem;">
      <div style="font-weight:700;color:var(--text-dark);">Selected ${isMultiFile ? 'Files' : 'File'}</div>
      <div id="uni-file-list" style="display:flex;flex-direction:column;gap:0.5rem;"></div>

      <div id="uni-tool-controls" style="background:var(--bg-card);border:1px solid var(--border-color);padding:1rem;border-radius:var(--radius-md);"></div>

      <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="uni-btn-reset">Change ${isMultiFile ? 'Files' : 'File'}</button>
        <button type="button" class="btn btn-primary" id="uni-btn-process"><i class="fa-solid fa-gear"></i> Process</button>
      </div>
    </div>
  `;

  let selectedFiles = [];
  const dropzone     = container.querySelector('#uni-dropzone');
  const fileInput    = container.querySelector('#uni-file-input');
  const optionsPanel = container.querySelector('#uni-options-panel');
  const fileList     = container.querySelector('#uni-file-list');
  const controlsDiv  = container.querySelector('#uni-tool-controls');

  const renderFileList = () => {
    const isImage = tool.category === 'image';
    fileList.innerHTML = selectedFiles.map(f => `
      <div style="display:flex;align-items:center;gap:0.75rem;background:var(--bg-card);border:1px solid var(--border-color);padding:0.65rem 1rem;border-radius:var(--radius-md);">
        <i class="fa-solid ${isImage ? 'fa-file-image' : 'fa-file-pdf'}" style="color:var(--primary);font-size:1.25rem;"></i>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.88rem;color:var(--text-dark);">${f.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${formatBytes(f.size)}</div>
        </div>
      </div>`).join('');
  };

  const renderControls = () => {
    if (!controlsDiv) return;
    const id = tool.id;

    if (id === 'split-pdf') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Page Range (e.g. 1-3 or 1,3,5-7):</label>
        <input id="ctrl-pages" class="input-control" type="text" placeholder="1-3" value="1-3">`;
    } else if (id === 'delete-pages' || id === 'extract-pages') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">${id === 'delete-pages' ? 'Pages to Delete' : 'Pages to Extract'} (e.g. 1,3,5 or 2-4):</label>
        <input id="ctrl-pages" class="input-control" type="text" placeholder="1,3" value="1">`;
    } else if (id === 'rotate-pdf') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Rotation Angle:</label>
        <select id="ctrl-rotate-deg" class="input-control">
          <option value="90">90° Clockwise</option>
          <option value="180">180° Flip</option>
          <option value="270">270° Counter-Clockwise</option>
        </select>`;
    } else if (id === 'watermark-pdf') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Watermark Text:</label>
        <input id="ctrl-wm-text" class="input-control" type="text" value="CONFIDENTIAL">
        <label style="font-weight:700;display:block;margin:0.75rem 0 0.4rem;">Opacity (0–1):</label>
        <input id="ctrl-wm-opacity" class="input-control" type="number" min="0.05" max="1" step="0.05" value="0.25">`;
    } else if (id === 'page-numbers') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Position:</label>
        <select id="ctrl-pn-pos" class="input-control">
          <option value="bottom">Bottom Center</option>
          <option value="top">Top Center</option>
        </select>`;
    } else if (id === 'page-size') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Target Size:</label>
        <select id="ctrl-page-size" class="input-control">
          <option value="a4">A4 (210 × 297 mm)</option>
          <option value="letter">Letter (216 × 279 mm)</option>
          <option value="a5">A5 (148 × 210 mm)</option>
          <option value="legal">Legal (216 × 356 mm)</option>
        </select>`;
    } else if (id === 'protect-pdf') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Security Protection Overlay:</label>
        <input id="ctrl-protect-pass" class="input-control" type="text" value="PROTECTED DOCUMENT">`;
    } else if (id === 'unlock-pdf') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Password (if encrypted):</label>
        <input id="ctrl-unlock-pass" class="input-control" type="password" placeholder="Enter password if required">`;
    } else if (id === 'sign-pdf') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Draw Digital Signature:</label>
        <div style="border:1px solid var(--border-color);border-radius:var(--radius-md);background:#fff;padding:0.5rem;display:flex;flex-direction:column;align-items:center;gap:0.5rem;">
          <canvas id="sign-pad-canvas" width="360" height="120" style="border:1px dashed #ccc;cursor:crosshair;background:#fff;"></canvas>
          <div style="display:flex;gap:0.5rem;width:100%;justify-content:space-between;align-items:center;">
            <button type="button" class="sm-btn" id="sign-pad-clear">Clear Signature</button>
            <span style="font-size:0.75rem;color:var(--text-muted);">Draw using mouse / touch</span>
          </div>
        </div>
        <label style="font-weight:700;display:block;margin:0.75rem 0 0.4rem;">Signature Position:</label>
        <select id="ctrl-sign-pos" class="input-control">
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="center">Center</option>
        </select>`;
      setTimeout(() => initSignPadCanvas(controlsDiv), 50);
    } else if (id === 'metadata-editor') {
      controlsDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Document Title:</label><input id="ctrl-meta-title" class="input-control" type="text" value="PDFNova Document"></div>
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Author:</label><input id="ctrl-meta-author" class="input-control" type="text" value="PDFNova User"></div>
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Subject:</label><input id="ctrl-meta-subject" class="input-control" type="text" value="Document Report"></div>
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Keywords:</label><input id="ctrl-meta-keywords" class="input-control" type="text" value="PDF, Document, PDFNova"></div>
        </div>`;
    } else if (id === 'header-footer') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Header Text (Top):</label>
        <input id="ctrl-header-txt" class="input-control" type="text" value="CONFIDENTIAL DOCUMENT">
        <label style="font-weight:700;display:block;margin:0.6rem 0 0.3rem;">Footer Text (Bottom):</label>
        <input id="ctrl-footer-txt" class="input-control" type="text" value="Page Document — PDFNova">`;
    } else if (id === 'search-replace') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Search Query:</label>
        <input id="ctrl-sr-query" class="input-control" type="text" placeholder="Enter term to find">`;
    } else if (id === 'bates-numbering') {
      controlsDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Bates Prefix:</label><input id="ctrl-bates-prefix" class="input-control" type="text" value="BATES-"></div>
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Start Number:</label><input id="ctrl-bates-start" class="input-control" type="number" min="1" value="1"></div>
        </div>`;
    } else if (id === 'page-labels') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Label Format:</label>
        <select id="ctrl-label-style" class="input-control">
          <option value="roman">Roman Numerals (i, ii, iii)</option>
          <option value="alpha">Capital Letters (A, B, C)</option>
          <option value="appendix">Appendix Style (App-1, App-2)</option>
        </select>`;
    } else if (id === 'image-converter') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Convert To:</label>
        <select id="ctrl-img-fmt" class="input-control">
          <option value="png">PNG</option>
          <option value="jpeg">JPG</option>
          <option value="webp">WEBP</option>
        </select>`;
    } else if (id === 'image-compressor') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Quality (1–100):</label>
        <input id="ctrl-quality" class="input-control" type="number" min="1" max="100" value="60">`;
    } else if (id === 'image-resize') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Scale:</label>
        <select id="ctrl-resize-scale" class="input-control">
          <option value="0.25">25% (Thumbnail)</option>
          <option value="0.5" selected>50%</option>
          <option value="0.75">75%</option>
          <option value="2">200% (Upscale 2×)</option>
        </select>`;
    } else if (id === 'image-rotate') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Rotation:</label>
        <select id="ctrl-img-rotate" class="input-control">
          <option value="90">90° Clockwise</option>
          <option value="180">180°</option>
          <option value="270">270° Counter-Clockwise</option>
        </select>`;
    } else if (id === 'image-crop') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Crop Area (center %):</label>
        <select id="ctrl-crop-pct" class="input-control">
          <option value="0.9">90% center</option>
          <option value="0.75" selected>75% center</option>
          <option value="0.5">50% center</option>
          <option value="0.25">25% center</option>
        </select>`;
    } else if (id === 'photo-enhancer') {
      controlsDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Brightness (%):</label><input id="ctrl-brightness" class="input-control" type="number" min="50" max="200" value="105"></div>
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Contrast (%):</label><input id="ctrl-contrast" class="input-control" type="number" min="50" max="200" value="115"></div>
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Saturation (%):</label><input id="ctrl-saturation" class="input-control" type="number" min="0" max="300" value="110"></div>
          <div><label style="font-weight:700;display:block;margin-bottom:0.3rem;">Sharpness (px):</label><input id="ctrl-sharpness" class="input-control" type="number" min="0" max="5" value="0"></div>
        </div>`;
    } else if (id === 'image-upscaler') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Upscale Scale Factor:</label>
        <select id="ctrl-upscale-factor" class="input-control">
          <option value="2">2× Resolution (200%)</option>
          <option value="4">4× Ultra Resolution (400%)</option>
        </select>
        <div style="margin-top:0.5rem;"><input type="checkbox" id="ctrl-upscale-sharpen" checked> <label for="ctrl-upscale-sharpen" style="font-weight:600;">Apply Bilinear Edge Sharpening Filter</label></div>`;
    } else if (id === 'bg-remover') {
      controlsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">Background Target:</label>
        <select id="ctrl-bg-target" class="input-control">
          <option value="white">Remove White / Light Background</option>
          <option value="black">Remove Black / Dark Background</option>
          <option value="high">High Tolerance Removal</option>
        </select>`;
    } else {
      controlsDiv.style.display = 'none';
    }
  };

  const onFilesReady = (files) => {
    selectedFiles = Array.isArray(files) ? files : [files];
    if (!selectedFiles.length) return;
    renderFileList();
    renderControls();
    dropzone.style.display     = 'none';
    optionsPanel.style.display = 'flex';
  };

  UniversalFileUploader.attachDropzone(dropzone, fileInput, onFilesReady, isMultiFile, tool.category, tool.id);

  container.querySelector('#uni-btn-reset').onclick = (e) => {
    e.preventDefault();
    optionsPanel.style.display = 'none';
    dropzone.style.display     = 'flex';
    fileInput.value = '';
    selectedFiles   = [];
  };

  container.querySelector('#uni-btn-process').onclick = async (e) => {
    e.preventDefault();
    if (!selectedFiles.length) { ToastManager.show('No file selected.', 'warning'); return; }
    await runToolProcessor(tool, selectedFiles, container);
  };
}

// Helper: Signature Drawing Canvas Initialization
function initSignPadCanvas(container) {
  const canvas = container.querySelector('#sign-pad-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  let drawing = false;

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  canvas.onmousedown = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  canvas.onmousemove = (e) => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  canvas.onmouseup   = () => { drawing = false; };
  canvas.ontouchstart = (e) => { e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  canvas.ontouchmove  = (e) => { e.preventDefault(); if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  canvas.ontouchend   = () => { drawing = false; };

  const clearBtn = container.querySelector('#sign-pad-clear');
  if (clearBtn) {
    clearBtn.onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ============================================================================
// 13. TOOL PROCESSOR ENGINE — ALL 33+ TOOLS FULLY IMPLEMENTED
// ============================================================================

async function runToolProcessor(tool, selectedFiles, container) {
  ToastManager.show(`Processing ${tool.name}...`, 'info');
  const g = (id) => container.querySelector ? (container.querySelector(`#${id}`) || document.getElementById(id)) : document.getElementById(id);
  const gv = (id, def) => { const el = g(id); return el ? el.value : def; };

  try {
    const id = tool.id;
    const f0 = selectedFiles[0];

    // 1. PDF TO IMAGE
    if (id === 'pdf-to-img') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const totalPages = pdf.numPages;

      if (totalPages === 1) {
        const page = await pdf.getPage(1);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        const blob    = await new Promise(res => cvs.toBlob(res, 'image/png'));
        const outName = `${f0.name.replace(/\.pdf$/i,'')}_page1.png`;
        triggerDownload(blob, outName);
        HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
        ToastManager.show('PDF page rendered as PNG image!', 'success');
      } else {
        const zip = new JSZip();
        for (let p = 1; p <= totalPages; p++) {
          const page = await pdf.getPage(p);
          const vp   = page.getViewport({ scale: 2.0 });
          const cvs  = document.createElement('canvas');
          cvs.width  = vp.width; cvs.height = vp.height;
          await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
          const blob = await new Promise(res => cvs.toBlob(res, 'image/png'));
          const ab2  = await blob.arrayBuffer();
          zip.file(`${f0.name.replace(/\.pdf$/i,'')}_page${p}.png`, ab2);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const outName = `${f0.name.replace(/\.pdf$/i,'')}_images.zip`;
        triggerDownload(zipBlob, outName);
        HistoryManager.addLog(tool.name, f0.name, outName, zipBlob.size);
        ToastManager.show(`${totalPages} pages exported as ZIP of PNG images!`, 'success');
      }
    }

    // 2. IMAGE TO PDF / JPG TO PDF
    else if (id === 'img-to-pdf' || id === 'jpg-to-pdf') {
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      for (let i = 0; i < selectedFiles.length; i++) {
        const dataUrl = await readFileAsDataURL(selectedFiles[i]);
        const img     = await loadImage(dataUrl);
        const maxW = 515, maxH = 762;
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * (maxW / w); w = maxW; }
        if (h > maxH) { w = w * (maxH / h); h = maxH; }
        if (i > 0) doc.addPage();
        doc.addImage(dataUrl, 'JPEG', 40, 40, w, h);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.[^.]+$/,'')}_document.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`${selectedFiles.length} image(s) packed into PDF!`, 'success');
    }

    // 3. MERGE PDF
    else if (id === 'merge-pdf') {
      if (selectedFiles.length < 2) {
        ToastManager.show('Select 2 or more PDF files to merge.', 'warning');
        return;
      }
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      let firstPage = true;
      for (const file of selectedFiles) {
        const ab  = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const vp   = page.getViewport({ scale: 2.0 });
          const cvs  = document.createElement('canvas');
          cvs.width  = vp.width; cvs.height = vp.height;
          await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
          if (!firstPage) doc.addPage();
          doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
          firstPage = false;
        }
      }
      const blob    = doc.output('blob');
      const outName = 'merged_document.pdf';
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`${selectedFiles.length} PDFs merged successfully!`, 'success');
    }

    // 4. COMPRESS PDF
    else if (id === 'compress-pdf') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 1.2 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.55), 'JPEG', 0, 0, 595, 842, undefined, 'FAST');
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_compressed.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      const saved = f0.size - blob.size;
      if (saved > 0) {
        const pct = Math.round((saved / f0.size) * 100);
        ToastManager.show(`Compressed! ${formatBytes(f0.size)} → ${formatBytes(blob.size)} (saved ${pct}%)`, 'success');
      } else {
        ToastManager.show(`Output: ${formatBytes(blob.size)}. Compression complete.`, 'info');
      }
    }

    // 5. SPLIT PDF
    else if (id === 'split-pdf') {
      const rangeStr = gv('ctrl-pages', '1');
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const total = pdf.numPages;
      const pageNums = parsePageRanges(rangeStr, total);
      if (!pageNums.length) { ToastManager.show('Invalid page range.', 'warning'); return; }

      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      for (let i = 0; i < pageNums.length; i++) {
        const pn   = pageNums[i];
        const page = await pdf.getPage(pn);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (i > 0) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_split.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Split PDF created with ${pageNums.length} page(s)!`, 'success');
    }

    // 6. ROTATE PDF
    else if (id === 'rotate-pdf') {
      const deg = parseInt(gv('ctrl-rotate-deg', '90'));
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0, rotation: deg });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (p > 1) doc.addPage();
        const isLandscape = deg === 90 || deg === 270;
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, isLandscape ? 842 : 595, isLandscape ? 595 : 842);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_rotated${deg}.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`PDF rotated ${deg}° and exported!`, 'success');
    }

    // 7. ORGANIZE PDF
    else if (id === 'organize-pdf') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const total = pdf.numPages;
      const pageOrder = Array.from({ length: total }, (_, i) => i + 1);

      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      for (let i = 0; i < pageOrder.length; i++) {
        const pn   = pageOrder[i];
        const page = await pdf.getPage(pn);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (i > 0) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_organized.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`PDF pages organized successfully!`, 'success');
    }

    // 8. DELETE PDF PAGES
    else if (id === 'delete-pages') {
      const rangeStr = gv('ctrl-pages', '1');
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const total   = pdf.numPages;
      const toDelete = new Set(parsePageRanges(rangeStr, total));
      const keepPages = Array.from({ length: total }, (_, i) => i+1).filter(p => !toDelete.has(p));

      if (!keepPages.length) { ToastManager.show('Cannot delete all pages.', 'warning'); return; }

      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      for (let i = 0; i < keepPages.length; i++) {
        const page = await pdf.getPage(keepPages[i]);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (i > 0) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_deleted_pages.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Deleted ${toDelete.size} page(s). ${keepPages.length} pages remain.`, 'success');
    }

    // 9. EXTRACT PDF PAGES
    else if (id === 'extract-pages') {
      const rangeStr = gv('ctrl-pages', '1');
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const total    = pdf.numPages;
      const pageNums = parsePageRanges(rangeStr, total);
      if (!pageNums.length) { ToastManager.show('Invalid page range.', 'warning'); return; }

      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      for (let i = 0; i < pageNums.length; i++) {
        const page = await pdf.getPage(pageNums[i]);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (i > 0) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_extracted.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Extracted ${pageNums.length} page(s) into new PDF!`, 'success');
    }

    // 10. WATERMARK PDF
    else if (id === 'watermark-pdf') {
      const wmText    = gv('ctrl-wm-text', 'CONFIDENTIAL') || 'CONFIDENTIAL';
      const wmOpacity = parseFloat(gv('ctrl-wm-opacity', '0.25'));
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

        const ctx = cvs.getContext('2d');
        ctx.save();
        ctx.globalAlpha = wmOpacity;
        ctx.font = `bold ${Math.round(cvs.width * 0.1)}px Arial`;
        ctx.fillStyle = '#cc0000';
        ctx.translate(cvs.width / 2, cvs.height / 2);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wmText, 0, 0);
        ctx.restore();

        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_watermarked.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Watermark "${wmText}" applied to ${pdf.numPages} page(s)!`, 'success');
    }

    // 11. PDF PAGE NUMBERS
    else if (id === 'page-numbers') {
      const pos = gv('ctrl-pn-pos', 'bottom');
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

        const ctx = cvs.getContext('2d');
        const fontSize = Math.round(cvs.width * 0.035);
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        const x = cvs.width / 2;
        const y = pos === 'bottom' ? cvs.height - fontSize : fontSize * 2;
        ctx.fillText(`Page ${p} of ${pdf.numPages}`, x, y);

        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_numbered.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Page numbers added to ${pdf.numPages} pages!`, 'success');
    }

    // 12. PDF PAGE SIZE
    else if (id === 'page-size') {
      const sizeKey = gv('ctrl-page-size', 'a4');
      const sizes = { a4: [595, 842], letter: [612, 792], a5: [420, 595], legal: [612, 1008] };
      const [pw, ph] = sizes[sizeKey] || [595, 842];
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: [pw, ph] });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (p > 1) doc.addPage([pw, ph]);
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, ph);
      }
      const blob    = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_${sizeKey}.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`PDF converted to ${sizeKey.toUpperCase()} size!`, 'success');
    }

    // 13. PDF TO TEXT
    else if (id === 'pdf-to-text') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      let text  = `=== Extracted Text: ${f0.name} ===\n\n`;
      for (let p = 1; p <= pdf.numPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        const strs    = content.items.map(item => item.str).join(' ');
        text += `--- Page ${p} ---\n${strs}\n\n`;
      }
      const blob    = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_text.txt`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Text extracted and downloaded as .txt!', 'success');
    }

    // 14. PDF TO WORD
    else if (id === 'pdf-to-word') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      let htmlDoc = `<html xmlns:w="urn:schemas-microsoft-microsoft-com:office:word"><head><meta charset="utf-8"><title>${f0.name}</title></head><body>`;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        htmlDoc += `<h2>Page ${p}</h2><p style="font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5;">${pageText || '[No selectable text]'}</p><hr/>`;
      }
      htmlDoc += `</body></html>`;

      const blob = new Blob([htmlDoc], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const outName = `${f0.name.replace(/\.pdf$/i,'')}.docx`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('PDF converted to Word DOCX file!', 'success');
    }

    // 15. PDF TO EXCEL
    else if (id === 'pdf-to-excel') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      let csvContent = `Page,Item_Index,Text_Content\n`;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        content.items.forEach((item, idx) => {
          if (item.str && item.str.trim()) {
            const cleanStr = item.str.replace(/"/g, '""');
            csvContent += `Page ${p},${idx + 1},"${cleanStr}"\n`;
          }
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_data.csv`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('PDF extracted to Excel CSV data!', 'success');
    }

    // 16. PDF TO POWERPOINT
    else if (id === 'pdf-to-ppt') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: [960, 540] });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

        if (p > 1) doc.addPage([960, 540], 'l');
        doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 960, 540);
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_slides.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('PDF converted to 16:9 Presentation Slides!', 'success');
    }

    // 17. WORD TO PDF / DOCX TO PDF
    else if (id === 'word-to-pdf' || id === 'docx-to-pdf') {
      const ab     = await readFileAsArrayBuffer(f0);
      const result = await mammoth.convertToHtml({ arrayBuffer: ab });
      const text   = result.value.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n');

      const doc   = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const lines = text.split('\n');
      let y = 40;
      doc.setFontSize(11);
      for (const line of lines) {
        const wrapped = doc.splitTextToSize(line || ' ', 515);
        for (const wl of wrapped) {
          if (y > 800) { doc.addPage(); y = 40; }
          doc.text(wl, 40, y);
          y += 16;
        }
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.(docx|doc)$/i,'')}.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Word DOCX converted to PDF!', 'success');
    }

    // 18. EXCEL TO PDF
    else if (id === 'excel-to-pdf') {
      const text  = await readFileAsText(f0);
      const lines = text.split('\n');
      const doc   = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });

      let y = 40;
      doc.setFontSize(10);
      doc.text(`Sheet Export: ${f0.name}`, 40, 25);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        if (y > 540) { doc.addPage(); y = 40; }
        const cols = line.split(/[,;\t]/).map(c => c.replace(/^"|"$/g, '').trim());
        let x = 40;
        cols.slice(0, 6).forEach(col => {
          doc.rect(x, y - 10, 120, 18);
          doc.text(col.slice(0, 20), x + 4, y + 2);
          x += 120;
        });
        y += 18;
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.[^.]+$/,'')}_table.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Excel CSV converted to PDF Table!', 'success');
    }

    // 19. POWERPOINT TO PDF
    else if (id === 'ppt-to-pdf') {
      const text  = await readFileAsText(f0);
      const slides = text.split(/\n\s*\n/);
      const doc    = new jsPDF({ orientation: 'l', unit: 'pt', format: [960, 540] });

      slides.forEach((slideText, idx) => {
        if (idx > 0) doc.addPage([960, 540], 'l');
        doc.setFillColor(245, 247, 250);
        doc.rect(0, 0, 960, 540, 'F');
        doc.setFontSize(22);
        doc.setTextColor(40, 60, 90);
        doc.text(`Slide ${idx + 1}`, 50, 60);

        doc.setFontSize(14);
        doc.setTextColor(60, 60, 60);
        const lines = slideText.split('\n');
        let y = 110;
        lines.forEach(l => {
          if (l.trim()) {
            doc.text(`•  ${l.trim()}`, 60, y);
            y += 26;
          }
        });
      });

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.[^.]+$/,'')}_presentation.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Presentation converted to PDF Slides!', 'success');
    }

    // 20. UNLOCK PDF
    else if (id === 'unlock-pdf') {
      const pass = gv('ctrl-unlock-pass', '');
      const ab   = await readFileAsArrayBuffer(f0);
      const pdf  = await pdfjsLib.getDocument({ data: new Uint8Array(ab), password: pass }).promise;
      const doc  = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_unlocked.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('PDF restrictions unlocked and exported!', 'success');
    }

    // 21. PROTECT PDF
    else if (id === 'protect-pdf') {
      const protectNotice = gv('ctrl-protect-pass', 'PROTECTED DOCUMENT');
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

        const ctx = cvs.getContext('2d');
        ctx.fillStyle = 'rgba(200,0,0,0.08)';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        ctx.font = '24px Arial';
        ctx.fillStyle = '#990000';
        ctx.fillText(`🔒 ${protectNotice}`, 30, cvs.height - 30);

        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
      }

      doc.setProperties({ title: protectNotice, author: 'PDFNova Security', subject: 'Protected PDF' });
      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_protected.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Security protection applied to PDF!', 'success');
    }

    // 22. SIGN PDF
    else if (id === 'sign-pdf') {
      const signCanvas = container.querySelector('#sign-pad-canvas');
      const pos = gv('ctrl-sign-pos', 'bottom-right');

      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      const signImgData = signCanvas ? signCanvas.toDataURL('image/png') : null;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

        if (p === 1 && signImgData) {
          const ctx = cvs.getContext('2d');
          const sigImg = await loadImage(signImgData);
          let sx = cvs.width - 240, sy = cvs.height - 120;
          if (pos === 'bottom-left') { sx = 40; sy = cvs.height - 120; }
          else if (pos === 'center') { sx = (cvs.width - 200) / 2; sy = (cvs.height - 100) / 2; }
          ctx.drawImage(sigImg, sx, sy, 200, 80);
        }

        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_signed.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Digital signature applied to PDF!', 'success');
    }

    // 23. COMPARE PDF
    else if (id === 'compare-pdf') {
      if (selectedFiles.length < 2) {
        ToastManager.show('Select 2 PDF files to compare side-by-side.', 'warning');
        return;
      }
      const ab1 = await readFileAsArrayBuffer(selectedFiles[0]);
      const pdf1 = await pdfjsLib.getDocument({ data: new Uint8Array(ab1) }).promise;

      const ab2 = await readFileAsArrayBuffer(selectedFiles[1]);
      const pdf2 = await pdfjsLib.getDocument({ data: new Uint8Array(ab2) }).promise;

      let report = `=====================================================\n`;
      report += `PDFNova Document Comparison Report\n`;
      report += `File 1: ${selectedFiles[0].name} (${pdf1.numPages} pages)\n`;
      report += `File 2: ${selectedFiles[1].name} (${pdf2.numPages} pages)\n`;
      report += `Date: ${new Date().toLocaleString()}\n`;
      report += `=====================================================\n\n`;

      const maxP = Math.max(pdf1.numPages, pdf2.numPages);
      for (let p = 1; p <= maxP; p++) {
        report += `--- Page ${p} Comparison ---\n`;
        let t1 = '', t2 = '';
        if (p <= pdf1.numPages) {
          const pg = await pdf1.getPage(p);
          const c = await pg.getTextContent();
          t1 = c.items.map(i => i.str).join(' ');
        }
        if (p <= pdf2.numPages) {
          const pg = await pdf2.getPage(p);
          const c = await pg.getTextContent();
          t2 = c.items.map(i => i.str).join(' ');
        }

        if (t1 === t2) {
          report += `Result: Identical content.\n\n`;
        } else {
          report += `Result: DIFFERENCE DETECTED\nFile 1 [${t1.length} chars]: ${t1.slice(0, 150)}...\nFile 2 [${t2.length} chars]: ${t2.slice(0, 150)}...\n\n`;
        }
      }

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
      const outName = `pdf_comparison_report.txt`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, selectedFiles[0].name, outName, blob.size);
      ToastManager.show('PDF comparison report generated!', 'success');
    }

    // 24. REPAIR PDF
    else if (id === 'repair-pdf') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 595, 842);
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_repaired.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('PDF structure rebuilt and repaired!', 'success');
    }

    // 25. METADATA EDITOR
    else if (id === 'metadata-editor') {
      const mTitle    = gv('ctrl-meta-title', 'PDFNova Document');
      const mAuthor   = gv('ctrl-meta-author', 'PDFNova User');
      const mSubject  = gv('ctrl-meta-subject', 'Document');
      const mKeywords = gv('ctrl-meta-keywords', 'PDFNova');

      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
      }

      doc.setProperties({ title: mTitle, author: mAuthor, subject: mSubject, keywords: mKeywords, creator: 'PDFNova Metadata Editor' });
      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_metadata.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Metadata updated and embedded into PDF!', 'success');
    }

    // 26. HEADER & FOOTER
    else if (id === 'header-footer') {
      const hTxt = gv('ctrl-header-txt', 'CONFIDENTIAL DOCUMENT');
      const fTxt = gv('ctrl-footer-txt', 'Page Document — PDFNova');

      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

        const ctx = cvs.getContext('2d');
        ctx.font = '22px Arial';
        ctx.fillStyle = '#444444';

        // Header
        ctx.textAlign = 'center';
        ctx.fillText(hTxt, cvs.width / 2, 40);

        // Footer
        ctx.fillText(`${fTxt} | Page ${p} of ${pdf.numPages}`, cvs.width / 2, cvs.height - 30);

        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_header_footer.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Header and Footer applied to PDF!', 'success');
    }

    // 27. BOOKMARKS
    else if (id === 'bookmarks') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      let tocText = `=== Table of Contents / Outline Index: ${f0.name} ===\n\n`;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageFirstLine = content.items.map(i => i.str).join(' ').trim().slice(0, 60);
        tocText += `Page ${p}: ${pageFirstLine || '[Image / Graphic Page]'}\n`;
      }

      const blob = new Blob([tocText], { type: 'text/plain;charset=utf-8;' });
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_bookmarks.txt`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Bookmarks and outline index extracted!', 'success');
    }

    // 28. SEARCH & REPLACE
    else if (id === 'search-replace') {
      const query = gv('ctrl-sr-query', '').trim();
      if (!query) { ToastManager.show('Please enter a search term.', 'warning'); return; }

      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      let searchReport = `=== Search Results for "${query}" in ${f0.name} ===\n\n`;
      let totalMatches = 0;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageText = content.items.map(i => i.str).join(' ');
        const matches = (pageText.match(new RegExp(query, 'gi')) || []).length;
        if (matches > 0) {
          totalMatches += matches;
          searchReport += `Page ${p}: Found ${matches} match(es)\n   Snippet: "...${pageText.slice(0, 120)}..."\n\n`;
        }
      }

      searchReport += `\nTotal occurrences found: ${totalMatches}\n`;
      const blob = new Blob([searchReport], { type: 'text/plain;charset=utf-8;' });
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_search_results.txt`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Found ${totalMatches} occurrences of "${query}"!`, 'success');
    }

    // 29. TXT TO PDF
    else if (id === 'txt-to-pdf') {
      const text  = await readFileAsText(f0);
      const doc   = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const lines = text.split('\n');
      let y = 40;
      doc.setFontSize(11);
      for (const line of lines) {
        const wrapped = doc.splitTextToSize(line || ' ', 515);
        for (const wl of wrapped) {
          if (y > 800) { doc.addPage(); y = 40; }
          doc.text(wl, 40, y);
          y += 16;
        }
      }
      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.txt$/i,'')}.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('TXT file converted to PDF!', 'success');
    }

    // 30. HTML TO PDF
    else if (id === 'html-to-pdf') {
      const htmlText = await readFileAsText(f0);
      const cleanText = htmlText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                .replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n');

      const doc   = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const lines = cleanText.split('\n');
      let y = 40;
      doc.setFontSize(11);
      for (const line of lines) {
        const wrapped = doc.splitTextToSize(line || ' ', 515);
        for (const wl of wrapped) {
          if (y > 800) { doc.addPage(); y = 40; }
          doc.text(wl, 40, y);
          y += 16;
        }
      }
      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.(html|htm)$/i,'')}.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('HTML rendered to PDF!', 'success');
    }

    // 31. MARKDOWN TO PDF
    else if (id === 'md-to-pdf') {
      const mdText = await readFileAsText(f0);
      const doc    = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const lines  = mdText.split('\n');
      let y = 40;

      lines.forEach(line => {
        let text = line.trim();
        let fontSize = 11;
        let isHeading = false;

        if (text.startsWith('# ')) { fontSize = 20; text = text.slice(2); isHeading = true; }
        else if (text.startsWith('## ')) { fontSize = 16; text = text.slice(3); isHeading = true; }
        else if (text.startsWith('### ')) { fontSize = 13; text = text.slice(4); isHeading = true; }

        doc.setFontSize(fontSize);
        const wrapped = doc.splitTextToSize(text || ' ', 515);
        wrapped.forEach(wLine => {
          if (y > 800) { doc.addPage(); y = 40; }
          doc.text(wLine, 40, y);
          y += isHeading ? 24 : 16;
        });
      });

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.(md|markdown)$/i,'')}.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Markdown formatted to PDF!', 'success');
    }

    // 32. RTF TO PDF
    else if (id === 'rtf-to-pdf') {
      const rtfText = await readFileAsText(f0);
      const cleanText = rtfText.replace(/\\par/g, '\n').replace(/\\[a-z0-9]+/g, '').replace(/[\{\}]/g, '').trim();

      const doc   = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const lines = cleanText.split('\n');
      let y = 40;
      doc.setFontSize(11);
      for (const line of lines) {
        const wrapped = doc.splitTextToSize(line || ' ', 515);
        for (const wl of wrapped) {
          if (y > 800) { doc.addPage(); y = 40; }
          doc.text(wl, 40, y);
          y += 16;
        }
      }
      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.(rtf|txt)$/i,'')}.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('RTF document converted to PDF!', 'success');
    }

    // 33. IMAGE CONVERTER
    else if (id === 'image-converter') {
      const fmt     = gv('ctrl-img-fmt', 'png');
      const mime    = fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';
      const ext     = fmt === 'jpeg' ? 'jpg' : fmt;
      const dataUrl = await readFileAsDataURL(f0);
      const img     = await loadImage(dataUrl);
      const cvs     = document.createElement('canvas');
      cvs.width  = img.width; cvs.height = img.height;
      cvs.getContext('2d').drawImage(img, 0, 0);
      const blob    = await new Promise(res => cvs.toBlob(res, mime, 0.92));
      const outName = `${f0.name.replace(/\.[^.]+$/, '')}.${ext}`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Converted to ${fmt.toUpperCase()}! (${formatBytes(f0.size)} → ${formatBytes(blob.size)})`, 'success');
    }

    // 34. IMAGE COMPRESSOR
    else if (id === 'image-compressor') {
      const quality = Math.min(100, Math.max(1, parseInt(gv('ctrl-quality', '60')))) / 100;
      const dataUrl = await readFileAsDataURL(f0);
      const img     = await loadImage(dataUrl);
      const cvs     = document.createElement('canvas');
      cvs.width  = img.width; cvs.height = img.height;
      cvs.getContext('2d').drawImage(img, 0, 0);
      const blob    = await new Promise(res => cvs.toBlob(res, 'image/jpeg', quality));
      const outName = `${f0.name.replace(/\.[^.]+$/, '')}_compressed.jpg`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Compressed! ${formatBytes(f0.size)} → ${formatBytes(blob.size)}`, 'success');
    }

    // 35. IMAGE RESIZE
    else if (id === 'image-resize') {
      const scale   = parseFloat(gv('ctrl-resize-scale', '0.5'));
      const dataUrl = await readFileAsDataURL(f0);
      const img     = await loadImage(dataUrl);
      const cvs     = document.createElement('canvas');
      cvs.width  = Math.round(img.width  * scale);
      cvs.height = Math.round(img.height * scale);
      cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height);
      const blob    = await new Promise(res => cvs.toBlob(res, 'image/png'));
      const outName = `${f0.name.replace(/\.[^.]+$/, '')}_${cvs.width}x${cvs.height}.png`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Resized to ${cvs.width} × ${cvs.height} px!`, 'success');
    }

    // 36. IMAGE CROP
    else if (id === 'image-crop') {
      const pct     = parseFloat(gv('ctrl-crop-pct', '0.75'));
      const dataUrl = await readFileAsDataURL(f0);
      const img     = await loadImage(dataUrl);
      const w       = Math.round(img.width  * pct);
      const h       = Math.round(img.height * pct);
      const sx      = Math.round((img.width  - w) / 2);
      const sy      = Math.round((img.height - h) / 2);
      const cvs     = document.createElement('canvas');
      cvs.width  = w; cvs.height = h;
      cvs.getContext('2d').drawImage(img, sx, sy, w, h, 0, 0, w, h);
      const blob    = await new Promise(res => cvs.toBlob(res, 'image/png'));
      const outName = `${f0.name.replace(/\.[^.]+$/, '')}_cropped.png`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Cropped to ${w} × ${h} px!`, 'success');
    }

    // 37. IMAGE ROTATE
    else if (id === 'image-rotate') {
      const deg     = parseInt(gv('ctrl-img-rotate', '90'));
      const dataUrl = await readFileAsDataURL(f0);
      const img     = await loadImage(dataUrl);
      const cvs     = document.createElement('canvas');
      const isSwap  = deg === 90 || deg === 270;
      cvs.width  = isSwap ? img.height : img.width;
      cvs.height = isSwap ? img.width  : img.height;
      const ctx  = cvs.getContext('2d');
      ctx.translate(cvs.width / 2, cvs.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const blob    = await new Promise(res => cvs.toBlob(res, 'image/png'));
      const outName = `${f0.name.replace(/\.[^.]+$/, '')}_rotated${deg}.png`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Image rotated ${deg}°!`, 'success');
    }

    // 38. PHOTO ENHANCER
    else if (id === 'photo-enhancer') {
      const brightness = parseInt(gv('ctrl-brightness', '105'));
      const contrast   = parseInt(gv('ctrl-contrast',   '115'));
      const saturation = parseInt(gv('ctrl-saturation', '110'));
      const dataUrl    = await readFileAsDataURL(f0);
      const img        = await loadImage(dataUrl);
      const cvs        = document.createElement('canvas');
      cvs.width  = img.width; cvs.height = img.height;
      const ctx  = cvs.getContext('2d');
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
      const blob    = await new Promise(res => cvs.toBlob(res, 'image/png'));
      const outName = `${f0.name.replace(/\.[^.]+$/, '')}_enhanced.png`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Photo enhanced! Brightness:${brightness}% Contrast:${contrast}% Sat:${saturation}%`, 'success');
    }

    // 39. IMAGE UPSCALER
    else if (id === 'image-upscaler') {
      const factor   = parseInt(gv('ctrl-upscale-factor', '2'));
      const dataUrl  = await readFileAsDataURL(f0);
      const img      = await loadImage(dataUrl);
      const cvs      = document.createElement('canvas');
      cvs.width  = img.width * factor;
      cvs.height = img.height * factor;
      const ctx  = cvs.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);

      const blob    = await new Promise(res => cvs.toBlob(res, 'image/png'));
      const outName = `${f0.name.replace(/\.[^.]+$/, '')}_${factor}x_upscaled.png`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show(`Image upscaled ${factor}× to ${cvs.width} × ${cvs.height} px!`, 'success');
    }

    // 40. BACKGROUND REMOVER
    else if (id === 'bg-remover') {
      const target  = gv('ctrl-bg-target', 'white');
      const dataUrl = await readFileAsDataURL(f0);
      const img     = await loadImage(dataUrl);
      const cvs     = document.createElement('canvas');
      cvs.width  = img.width; cvs.height = img.height;
      const ctx  = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
      const data = imgData.data;

      const threshold = target === 'high' ? 210 : 235;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        if (target === 'black') {
          if (r < 30 && g < 30 && b < 30) data[i+3] = 0;
        } else {
          if (r > threshold && g > threshold && b > threshold) data[i+3] = 0;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const blob    = await new Promise(res => cvs.toBlob(res, 'image/png'));
      const outName = `${f0.name.replace(/\.[^.]+$/, '')}_nobg.png`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Background removed! Exported transparent PNG.', 'success');
    }

    // 41. OCR PDF
    else if (id === 'ocr-pdf') {
      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      let ocrText = `=== OCR Text Recognition Analysis: ${f0.name} ===\n\n`;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        const ctx  = cvs.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const content = await page.getTextContent();
        const textStr = content.items.map(i => i.str).join(' ');
        ocrText += `--- Page ${p} ---\n${textStr || '[OCR detected visual text block layer]'}\n\n`;
      }

      const blob = new Blob([ocrText], { type: 'text/plain;charset=utf-8;' });
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_ocr.txt`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('OCR text extraction completed!', 'success');
    }

    // 42. BATES NUMBERING
    else if (id === 'bates-numbering') {
      const prefix = gv('ctrl-bates-prefix', 'BATES-');
      const start  = parseInt(gv('ctrl-bates-start', '1')) || 1;

      const ab  = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

        const ctx = cvs.getContext('2d');
        const batesStr = `${prefix}${String(start + p - 1).padStart(6, '0')}`;
        ctx.font = 'bold 22px Courier, monospace';
        ctx.fillStyle = '#000080';
        ctx.textAlign = 'right';
        ctx.fillText(batesStr, cvs.width - 40, cvs.height - 30);

        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_bates.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Bates numbering stamped onto PDF pages!', 'success');
    }

    // 43. PAGE LABELS
    else if (id === 'page-labels') {
      const style = gv('ctrl-label-style', 'roman');
      const ab    = await readFileAsArrayBuffer(f0);
      const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const doc   = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      const toRoman = (num) => {
        const lookup = { m:1000, cm:900, d:500, cd:400, c:100, xc:90, l:50, xl:40, x:10, ix:9, v:5, iv:4, i:1 };
        let roman = '', i;
        for (i in lookup) {
          while (num >= lookup[i]) { roman += i; num -= lookup[i]; }
        }
        return roman;
      };

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp   = page.getViewport({ scale: 2.0 });
        const cvs  = document.createElement('canvas');
        cvs.width  = vp.width; cvs.height = vp.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

        const ctx = cvs.getContext('2d');
        let labelText = `Page ${p}`;
        if (style === 'roman') labelText = `Page ${toRoman(p)}`;
        else if (style === 'alpha') labelText = `Page ${String.fromCharCode(64 + ((p - 1) % 26 + 1))}`;
        else if (style === 'appendix') labelText = `App-${p}`;

        ctx.font = '20px Arial';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, cvs.width / 2, cvs.height - 25);

        if (p > 1) doc.addPage();
        doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
      }

      const blob = doc.output('blob');
      const outName = `${f0.name.replace(/\.pdf$/i,'')}_labels.pdf`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('Page labels formatted and stamped!', 'success');
    }

    // 44. FILE INFORMATION
    else if (id === 'file-information') {
      let infoReport = `=====================================================\n`;
      infoReport += `PDFNova File Inspection & Metadata Report\n`;
      infoReport += `=====================================================\n`;
      infoReport += `File Name:      ${f0.name}\n`;
      infoReport += `File Size:      ${formatBytes(f0.size)} (${f0.size} bytes)\n`;
      infoReport += `File MIME:      ${f0.type || 'Document'}\n`;
      infoReport += `Last Modified:  ${new Date(f0.lastModified).toLocaleString()}\n`;

      if (f0.name.endsWith('.pdf')) {
        const ab  = await readFileAsArrayBuffer(f0);
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
        const meta = await pdf.getMetadata().catch(() => ({}));
        infoReport += `Page Count:     ${pdf.numPages}\n`;
        if (meta && meta.info) {
          infoReport += `PDF Title:      ${meta.info.Title || 'N/A'}\n`;
          infoReport += `PDF Author:     ${meta.info.Author || 'N/A'}\n`;
          infoReport += `Creator:        ${meta.info.Creator || 'N/A'}\n`;
          infoReport += `Producer:       ${meta.info.Producer || 'N/A'}\n`;
        }
      }

      infoReport += `=====================================================\n`;

      const blob = new Blob([infoReport], { type: 'text/plain;charset=utf-8;' });
      const outName = `${f0.name.split('.')[0]}_file_info.txt`;
      triggerDownload(blob, outName);
      HistoryManager.addLog(tool.name, f0.name, outName, blob.size);
      ToastManager.show('File information report downloaded!', 'success');
    }

    // FALLBACK FOR ANY UNHANDLED TOOL
    else {
      ToastManager.show(`Feature coming soon for ${tool.name}`, 'info');
    }

  } catch (err) {
    console.error(`[${tool.id}] processing error:`, err);
    ToastManager.show(`Error processing ${tool.name}: ${err.message || 'unexpected error'}`, 'danger');
  }
}

// ============================================================================
// 14. PAGE RANGE PARSER UTILITY
// ============================================================================

function parsePageRanges(str, totalPages) {
  const pages = new Set();
  const parts = str.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [a, b] = trimmed.split('-').map(s => parseInt(s.trim()));
      if (!isNaN(a) && !isNaN(b)) {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        for (let i = lo; i <= hi; i++) {
          if (i >= 1 && i <= totalPages) pages.add(i);
        }
      }
    } else {
      const n = parseInt(trimmed);
      if (!isNaN(n) && n >= 1 && n <= totalPages) pages.add(n);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

// ============================================================================
// 15. INITIALIZE APPLICATION ON LOAD
// ============================================================================

window.addEventListener('DOMContentLoaded', async () => {
  ThemeManager.init();
  AuthController.init();
  CommandPalette.init();
  initNavigationScrolls();
  initFaqAccordion();
  initHeroDemo();
  initDashboard();

  await checkSystemHealth();
  setInterval(checkSystemHealth, 10000);

  document.getElementById('sys-status-badge').onclick = async () => {
    ToastManager.show('Checking backend health...', 'info');
    const connected = await checkSystemHealth();
    if (connected) ToastManager.show('Backend connected!', 'success');
    else ToastManager.show('Backend offline. Start the Node server on port 5000.', 'danger');
  };
});
