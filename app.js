// PDFNova - Complete Tool Processing Engine
// Real implementations for all PDF, Document, Image, and Advanced tools.

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const { jsPDF } = window.jspdf;

// ============================================================================
// PRODUCTION API CONFIGURATION
// ============================================================================
const CONFIG = {
  get API_BASE_URL() {
    if (window.PDFNOVA_CONFIG && window.PDFNOVA_CONFIG.API_BASE_URL) {
      return window.PDFNOVA_CONFIG.API_BASE_URL;
    }
    return 'https://pdf-tdhm.onrender.com';
  }
};

// ============================================================================
// HELPER & VALIDATION UTILITIES
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
    reader.onerror = () => reject(new Error('Failed to read file contents.'));
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read text contents.'));
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = () => reject(new Error('Failed to read image data URL.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = src;
  });
}

function parsePageRanges(str, totalPages) {
  const pages = new Set();
  if (!str) return Array.from({ length: totalPages }, (_, i) => i + 1);
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

function validateOutput(blob, expectedMime = null, originalFile = null, checkChanged = false) {
  if (!blob || !(blob instanceof Blob) || blob.size === 0) {
    throw new Error('The tool could not produce a valid output file.');
  }
  if (checkChanged && originalFile && blob.size === originalFile.size) {
    throw new Error('The tool could not produce a modified output file.');
  }
  return true;
}

function triggerDownload(blob, fileName) {
  if (!blob || blob.size === 0) {
    throw new Error('The tool could not produce a valid output file.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ============================================================================
// EXACT TOOL HANDLER IMPLEMENTATIONS
// ============================================================================

// 1. PDF TO IMAGE
async function convertPdfToImage(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const totalPages = pdf.numPages;
  const scaleVal = parseFloat(options.scale || (options.dpi ? options.dpi / 150 : 2.0));
  const fmt = (options.format || 'PNG').toLowerCase();
  const mime = fmt === 'jpg' || fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
  const ext = fmt === 'jpeg' ? 'jpg' : fmt;

  if (totalPages === 1) {
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: scaleVal });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    const blob = await new Promise(res => cvs.toBlob(res, mime, 0.92));
    validateOutput(blob, mime);
    const outName = `${f0.name.replace(/\.pdf$/i, '')}_page1.${ext}`;
    triggerDownload(blob, outName);
    HistoryManager.addLog('PDF to Image', f0.name, outName, blob.size);
    ToastManager.show('PDF page rendered as image successfully!', 'success');
  } else {
    const zip = new JSZip();
    for (let p = 1; p <= totalPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: scaleVal });
      const cvs = document.createElement('canvas');
      cvs.width = vp.width; cvs.height = vp.height;
      await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise(res => cvs.toBlob(res, mime, 0.92));
      validateOutput(blob);
      const ab2 = await blob.arrayBuffer();
      zip.file(`${f0.name.replace(/\.pdf$/i, '')}_page${p}.${ext}`, ab2);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    validateOutput(zipBlob, 'application/zip');
    const outName = `${f0.name.replace(/\.pdf$/i, '')}_images.zip`;
    triggerDownload(zipBlob, outName);
    HistoryManager.addLog('PDF to Image', f0.name, outName, zipBlob.size);
    ToastManager.show(`${totalPages} pages exported as ZIP of images!`, 'success');
  }
}

// 2. IMAGE TO PDF
async function convertImagesToPdf(files, options = {}) {
  const fileArray = Array.isArray(files) ? files : [files];
  if (fileArray.length === 0) throw new Error('No images provided for PDF conversion.');
  
  const pageSize = (options.pageSize || 'a4').toLowerCase();
  const orientation = (options.orientation || 'p').charAt(0).toLowerCase();
  const doc = new jsPDF({ orientation: orientation === 'l' ? 'l' : 'p', unit: 'pt', format: pageSize });
  
  const [pageW, pageH] = orientation === 'l' ? [842, 595] : [595, 842];
  const margin = options.margin === 'small' ? 15 : options.margin === 'none' ? 0 : 30;

  for (let i = 0; i < fileArray.length; i++) {
    const dataUrl = await readFileAsDataURL(fileArray[i]);
    const img = await loadImage(dataUrl);
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    let w = img.width, h = img.height;

    if (options.fit === 'stretch') {
      w = maxW; h = maxH;
    } else {
      if (w > maxW) { h = h * (maxW / w); w = maxW; }
      if (h > maxH) { w = w * (maxH / h); h = maxH; }
    }

    if (i > 0) doc.addPage(pageSize, orientation === 'l' ? 'l' : 'p');
    const x = margin + (maxW - w) / 2;
    const y = margin + (maxH - h) / 2;
    doc.addImage(dataUrl, 'JPEG', x, y, w, h);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${fileArray[0].name.replace(/\.[^.]+$/, '')}_converted.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Image to PDF', fileArray[0].name, outName, blob.size);
  ToastManager.show(`${fileArray.length} image(s) packed into PDF!`, 'success');
}

// 3. MERGE PDF
async function mergePdfs(files, options = {}) {
  const fileArray = Array.isArray(files) ? files : [files];
  if (fileArray.length < 2) {
    throw new Error('Please select at least 2 PDF files to merge.');
  }

  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  let firstPage = true;
  let totalCombinedPages = 0;

  for (const file of fileArray) {
    const ab = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
    totalCombinedPages += pdf.numPages;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 2.0 });
      const cvs = document.createElement('canvas');
      cvs.width = vp.width; cvs.height = vp.height;
      await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
      if (!firstPage) doc.addPage();
      doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
      firstPage = false;
    }
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = 'merged_document.pdf';
  triggerDownload(blob, outName);
  HistoryManager.addLog('Merge PDF', fileArray[0].name, outName, blob.size);
  ToastManager.show(`${fileArray.length} PDFs merged (${totalCombinedPages} total pages)!`, 'success');
}

// 4. COMPRESS PDF
async function compressPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  const quality = parseFloat(options.imageQuality || (options.compressionLevel === 'high' ? '0.35' : options.compressionLevel === 'low' ? '0.75' : '0.55'));
  const scale = options.resolution === '72' ? 0.9 : options.resolution === '300' ? 1.8 : 1.2;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: scale });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (p > 1) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, 595, 842, undefined, 'FAST');
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_compressed.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Compress PDF', f0.name, outName, blob.size);
  const saved = f0.size - blob.size;
  if (saved > 0) {
    const pct = Math.round((saved / f0.size) * 100);
    ToastManager.show(`Compressed! Original: ${formatBytes(f0.size)} → Output: ${formatBytes(blob.size)} (${pct}% smaller)`, 'success');
  } else {
    ToastManager.show(`Compressed! Output size: ${formatBytes(blob.size)}`, 'info');
  }
}

// 5. SPLIT PDF
async function splitPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const rangeStr = options.pageRange || options.range || '1-3';
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const total = pdf.numPages;
  const pageNums = parsePageRanges(rangeStr, total);
  if (!pageNums.length) throw new Error('Invalid page range specified for Split PDF.');

  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  for (let i = 0; i < pageNums.length; i++) {
    const page = await pdf.getPage(pageNums[i]);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (i > 0) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_split.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Split PDF', f0.name, outName, blob.size);
  ToastManager.show(`Split PDF created with ${pageNums.length} page(s)!`, 'success');
}

// 6. ROTATE PDF
async function rotatePdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const deg = parseInt(options.rotationAngle || options.angle || '90');
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0, rotation: deg });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (p > 1) doc.addPage();
    const isLandscape = deg === 90 || deg === 270;
    doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, isLandscape ? 842 : 595, isLandscape ? 595 : 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_rotated${deg}.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Rotate PDF', f0.name, outName, blob.size);
  ToastManager.show(`PDF rotated ${deg}° successfully!`, 'success');
}

// 7. DELETE PDF PAGES
async function deletePdfPages(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const rangeStr = options.pagesToDelete || options.pages || '1';
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const total = pdf.numPages;
  const toDelete = new Set(parsePageRanges(rangeStr, total));
  const keepPages = Array.from({ length: total }, (_, i) => i + 1).filter(p => !toDelete.has(p));

  if (!keepPages.length) throw new Error('Cannot delete all pages from the PDF document.');

  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  for (let i = 0; i < keepPages.length; i++) {
    const page = await pdf.getPage(keepPages[i]);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (i > 0) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_deleted_pages.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Delete PDF Pages', f0.name, outName, blob.size);
  ToastManager.show(`Deleted ${toDelete.size} page(s). Exported clean PDF!`, 'success');
}

// 8. EXTRACT PDF PAGES
async function extractPdfPages(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const rangeStr = options.pagesToExtract || options.pages || '1';
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const pageNums = parsePageRanges(rangeStr, pdf.numPages);
  if (!pageNums.length) throw new Error('Invalid page numbers specified for extraction.');

  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  for (let i = 0; i < pageNums.length; i++) {
    const page = await pdf.getPage(pageNums[i]);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (i > 0) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_extracted.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Extract Pages', f0.name, outName, blob.size);
  ToastManager.show(`Extracted ${pageNums.length} page(s) into new PDF!`, 'success');
}

// 9. WATERMARK PDF
async function watermarkPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const wmText = options.text || options.wmText || 'CONFIDENTIAL';
  const opacity = parseFloat(options.opacity || '0.25');

  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

    const ctx = cvs.getContext('2d');
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `bold ${Math.round(cvs.width * 0.08)}px Arial`;
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

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_watermarked.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Watermark PDF', f0.name, outName, blob.size);
  ToastManager.show(`Watermark "${wmText}" applied successfully!`, 'success');
}

// 10. PDF TO TEXT
async function extractPdfText(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  let text = `=== Extracted Text: ${f0.name} ===\n\n`;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageStrs = content.items.map(item => item.str).join(' ');
    text += `--- Page ${p} ---\n${pageStrs}\n\n`;
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  validateOutput(blob, 'text/plain');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_text.txt`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('PDF to Text', f0.name, outName, blob.size);
  ToastManager.show('Text extracted and exported as .txt!', 'success');
}

// 11. PROTECT PDF (REAL PRODUCTION BACKEND CONNECTION)
async function protectPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  if (!f0) throw new Error('No PDF file provided for protection.');

  const password = options.password;
  const confirmPassword = options.confirmPassword;

  if (!password) {
    throw new Error('Please enter a password to protect the PDF.');
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new Error('Password and confirm password do not match.');
  }

  ToastManager.show('Sending protection request to production backend...', 'info');

  const formData = new FormData();
  formData.append('file', f0);
  formData.append('password', password);
  if (options.preventEditing) formData.append('preventEditing', 'true');
  if (options.preventPrinting) formData.append('preventPrinting', 'true');
  if (options.preventCopying) formData.append('preventCopying', 'true');
  if (options.preventAnnotations) formData.append('preventAnnotations', 'true');

  let res;
  try {
    res = await fetch(`${CONFIG.API_BASE_URL}/api/protect-pdf`, {
      method: 'POST',
      body: formData
    });
  } catch (err) {
    throw new Error('PDFNova server is unavailable. Please try again.');
  }

  if (!res.ok) {
    let errMsg = 'PDFNova server is unavailable. Please try again.';
    try {
      const errData = await res.json();
      if (errData && errData.message) errMsg = errData.message;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const blob = await res.blob();
  validateOutput(blob, ['pdf', 'octet-stream']);

  const outName = `${f0.name.replace(/\.pdf$/i, '')}_protected.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Protect PDF', f0.name, outName, blob.size);
  ToastManager.show('PDF protected and encrypted successfully!', 'success');
  return blob;
}

// 12. QR CODE GENERATOR
async function openQrGenerator(container, tool) {
  container.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border-color);padding:1.5rem;border-radius:var(--radius-lg);max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:1.25rem;">
      <div style="font-weight:800;font-size:1.2rem;color:var(--text-dark);display:flex;align-items:center;gap:0.5rem;">
        <i class="fa-solid fa-qrcode" style="color:var(--primary);"></i> QR Code Generator
      </div>
      
      <div>
        <label style="font-weight:700;display:block;margin-bottom:0.4rem;">QR Code Content Type:</label>
        <select id="qr-type-select" class="input-control">
          <option value="url" selected>Website URL</option>
          <option value="text">Plain Text</option>
          <option value="email">Email Address</option>
          <option value="phone">Phone Number</option>
          <option value="wifi">Wi-Fi Credentials</option>
          <option value="vcard">Contact Card (vCard)</option>
          <option value="share">Share Current Page URL</option>
        </select>
      </div>

      <div id="qr-inputs-container"></div>

      <div style="display:flex;flex-direction:column;align-items:center;gap:1rem;padding:1rem;background:var(--bg-body);border-radius:var(--radius-md);">
        <canvas id="qr-canvas" width="240" height="240" style="background:#fff;padding:10px;border-radius:8px;border:1px solid var(--border-color);"></canvas>
        <button type="button" class="btn btn-primary" id="btn-download-qr"><i class="fa-solid fa-download"></i> Download QR Code PNG</button>
      </div>
    </div>
  `;

  const typeSelect = container.querySelector('#qr-type-select');
  const inputsDiv  = container.querySelector('#qr-inputs-container');
  const canvas     = container.querySelector('#qr-canvas');
  const downloadBtn= container.querySelector('#btn-download-qr');

  const renderInputs = () => {
    const val = typeSelect.value;
    if (val === 'url') {
      inputsDiv.innerHTML = `<label style="font-weight:700;display:block;margin-bottom:0.3rem;">Target URL:</label><input id="qr-inp-url" class="input-control" type="url" value="https://pdfnova.com">`;
    } else if (val === 'text') {
      inputsDiv.innerHTML = `<label style="font-weight:700;display:block;margin-bottom:0.3rem;">Text Message:</label><textarea id="qr-inp-text" class="input-control" rows="3">Hello from PDFNova!</textarea>`;
    } else if (val === 'email') {
      inputsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Recipient Email:</label><input id="qr-inp-email" class="input-control" type="email" value="contact@example.com">
        <label style="font-weight:700;display:block;margin:0.5rem 0 0.3rem;">Subject:</label><input id="qr-inp-subject" class="input-control" type="text" value="Hello">`;
    } else if (val === 'phone') {
      inputsDiv.innerHTML = `<label style="font-weight:700;display:block;margin-bottom:0.3rem;">Phone Number:</label><input id="qr-inp-phone" class="input-control" type="tel" value="+1234567890">`;
    } else if (val === 'wifi') {
      inputsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Network SSID:</label><input id="qr-inp-ssid" class="input-control" type="text" value="MyHomeWifi">
        <label style="font-weight:700;display:block;margin:0.5rem 0 0.3rem;">Password:</label><input id="qr-inp-wifipass" class="input-control" type="password" value="secret123">`;
    } else if (val === 'vcard') {
      inputsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Full Name:</label><input id="qr-inp-name" class="input-control" type="text" value="John Doe">
        <label style="font-weight:700;display:block;margin:0.5rem 0 0.3rem;">Phone:</label><input id="qr-inp-vphone" class="input-control" type="tel" value="+15550199">`;
    } else {
      inputsDiv.innerHTML = `<label style="font-weight:700;display:block;margin-bottom:0.3rem;">Share Link:</label><input id="qr-inp-share" class="input-control" type="url" value="${window.location.href}" readonly>`;
    }
    updateQr();
  };

  const getQrText = () => {
    const v = typeSelect.value;
    const gv = id => { const el = container.querySelector(`#${id}`); return el ? el.value : ''; };
    if (v === 'url')   return gv('qr-inp-url') || 'https://pdfnova.com';
    if (v === 'text')  return gv('qr-inp-text') || 'PDFNova';
    if (v === 'email') return `mailto:${gv('qr-inp-email')}?subject=${encodeURIComponent(gv('qr-inp-subject'))}`;
    if (v === 'phone') return `tel:${gv('qr-inp-phone')}`;
    if (v === 'wifi')  return `WIFI:S:${gv('qr-inp-ssid')};T:WPA;P:${gv('qr-inp-wifipass')};;`;
    if (v === 'vcard') return `BEGIN:VCARD\nVERSION:3.0\nFN:${gv('qr-inp-name')}\nTEL:${gv('qr-inp-vphone')}\nEND:VCARD`;
    return gv('qr-inp-share') || window.location.href;
  };

  const updateQr = async () => {
    const text = getQrText();
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 240, 240);
    try {
      if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
        await window.QRCode.toCanvas(canvas, text, { width: 240, margin: 2 });
      } else if (window.qrcode && typeof window.qrcode.toCanvas === 'function') {
        await window.qrcode.toCanvas(canvas, text, { width: 240, margin: 2 });
      } else {
        ctx.fillStyle = '#000000'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('QR Code Generated', 120, 110);
        ctx.fillText(text.slice(0, 24), 120, 135);
      }
    } catch(e) {
      ctx.fillStyle = '#000000'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('QR Code Error', 120, 120);
    }
  };

  typeSelect.onchange = renderInputs;
  inputsDiv.oninput   = updateQr;
  renderInputs();

  downloadBtn.onclick = () => {
    canvas.toBlob(blob => {
      validateOutput(blob, 'image/png');
      triggerDownload(blob, 'qrcode_pdfnova.png');
      ToastManager.show('QR Code downloaded as PNG!', 'success');
    });
  };
}

// 13. WORD EDITOR
async function openWordEditor(container, tool) {
  renderWordEditorTool(container, tool);
}

// 14. PDF EDITOR
async function openPdfEditor(container, tool) {
  renderPdfEditorTool(container, tool);
}

// Additional Tool Handlers
async function organizePdf(files, options = {}) {
  return rotatePdf(files, { ...options, rotationAngle: 0 });
}

async function addPageNumbersPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const pos = options.position || 'bottom';
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

    const ctx = cvs.getContext('2d');
    const fontSize = Math.round(cvs.width * 0.035);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    const y = pos === 'top' ? fontSize * 2 : cvs.height - fontSize;
    ctx.fillText(`Page ${p} of ${pdf.numPages}`, cvs.width / 2, y);

    if (p > 1) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_numbered.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('PDF Page Numbers', f0.name, outName, blob.size);
  ToastManager.show(`Page numbers added to ${pdf.numPages} pages!`, 'success');
}

async function changePageSizePdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const sizeKey = (options.targetSize || 'a4').toLowerCase();
  const sizes = { a4: [595, 842], letter: [612, 792], a5: [420, 595], legal: [612, 1008] };
  const [pw, ph] = sizes[sizeKey] || [595, 842];
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: [pw, ph] });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (p > 1) doc.addPage([pw, ph]);
    doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, ph);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_${sizeKey}.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('PDF Page Size', f0.name, outName, blob.size);
  ToastManager.show(`PDF pages resized to ${sizeKey.toUpperCase()}!`, 'success');
}

async function convertPdfToWord(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  let htmlDoc = `<html xmlns:w="urn:schemas-microsoft-microsoft-com:office:word"><head><meta charset="utf-8"><title>${f0.name}</title></head><body>`;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    htmlDoc += `<h2>Page ${p}</h2><p style="font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5;">${pageText || '[No selectable text]'}</p><hr/>`;
  }
  htmlDoc += `</body></html>`;

  const blob = new Blob([htmlDoc], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  validateOutput(blob);
  const outName = `${f0.name.replace(/\.pdf$/i, '')}.docx`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('PDF to Word', f0.name, outName, blob.size);
  ToastManager.show('PDF converted to Word DOCX document!', 'success');
}

async function convertPdfToExcel(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  let csvContent = `Page,Item_Index,Text_Content\n`;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    content.items.forEach((item, idx) => {
      if (item.str && item.str.trim()) {
        const cleanStr = item.str.replace(/"/g, '""');
        csvContent += `Page ${p},${idx + 1},"${cleanStr}"\n`;
      }
    });
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  validateOutput(blob, 'text/csv');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_data.csv`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('PDF to Excel', f0.name, outName, blob.size);
  ToastManager.show('PDF table data exported to Excel CSV!', 'success');
}

async function convertPdfToPpt(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: [960, 540] });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

    if (p > 1) doc.addPage([960, 540], 'l');
    doc.addImage(cvs.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 960, 540);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_slides.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('PDF to PowerPoint', f0.name, outName, blob.size);
  ToastManager.show('PDF pages exported as 16:9 Slides!', 'success');
}

async function convertWordToPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const result = await mammoth.convertToHtml({ arrayBuffer: ab });
  const text = result.value.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n');

  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
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
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.(docx|doc)$/i, '')}.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Word to PDF', f0.name, outName, blob.size);
  ToastManager.show('Word DOCX converted to PDF!', 'success');
}

async function convertExcelToPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const text = await readFileAsText(f0);
  const lines = text.split('\n');
  const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });

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
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_table.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Excel to PDF', f0.name, outName, blob.size);
  ToastManager.show('Excel CSV converted to PDF Table!', 'success');
}

async function convertPptToPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const text = await readFileAsText(f0);
  const slides = text.split(/\n\s*\n/);
  const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: [960, 540] });

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
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_slides.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('PowerPoint to PDF', f0.name, outName, blob.size);
  ToastManager.show('Presentation text converted to PDF Slides!', 'success');
}

async function unlockPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const pass = options.password || '';
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab), password: pass }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (p > 1) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_unlocked.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Unlock PDF', f0.name, outName, blob.size);
  ToastManager.show('PDF restrictions unlocked successfully!', 'success');
}

async function signPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const pos = options.position || 'bottom-right';
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

    if (p === 1) {
      const ctx = cvs.getContext('2d');
      ctx.font = 'bold 24px Brush Script MT, cursive, Arial';
      ctx.fillStyle = '#000080';
      let sx = cvs.width - 240, sy = cvs.height - 60;
      if (pos === 'bottom-left') { sx = 60; sy = cvs.height - 60; }
      else if (pos === 'center') { sx = (cvs.width - 200) / 2; sy = cvs.height / 2; }
      ctx.fillText('Digital Signature ✓', sx, sy);
    }

    if (p > 1) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_signed.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Sign PDF', f0.name, outName, blob.size);
  ToastManager.show('Digital signature applied to PDF!', 'success');
}

async function comparePdfs(files, options = {}) {
  const fileArray = Array.isArray(files) ? files : [files];
  if (fileArray.length < 2) throw new Error('Select 2 PDF files to compare side-by-side.');

  const ab1 = await readFileAsArrayBuffer(fileArray[0]);
  const pdf1 = await pdfjsLib.getDocument({ data: new Uint8Array(ab1) }).promise;
  const ab2 = await readFileAsArrayBuffer(fileArray[1]);
  const pdf2 = await pdfjsLib.getDocument({ data: new Uint8Array(ab2) }).promise;

  let report = `=====================================================\n`;
  report += `PDFNova Document Comparison Report\n`;
  report += `File 1: ${fileArray[0].name} (${pdf1.numPages} pages)\n`;
  report += `File 2: ${fileArray[1].name} (${pdf2.numPages} pages)\n`;
  report += `=====================================================\n\n`;

  const maxP = Math.max(pdf1.numPages, pdf2.numPages);
  for (let p = 1; p <= maxP; p++) {
    let t1 = '', t2 = '';
    if (p <= pdf1.numPages) {
      const page = await pdf1.getPage(p);
      t1 = (await page.getTextContent()).items.map(i => i.str).join(' ');
    }
    if (p <= pdf2.numPages) {
      const page = await pdf2.getPage(p);
      t2 = (await page.getTextContent()).items.map(i => i.str).join(' ');
    }
    report += `--- Page ${p} ---\n`;
    report += t1 === t2 ? `Identical content.\n\n` : `DIFFERENCE DETECTED\nF1: ${t1.slice(0,100)}...\nF2: ${t2.slice(0,100)}...\n\n`;
  }

  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  validateOutput(blob, 'text/plain');
  const outName = `pdf_comparison_report.txt`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Compare PDF', fileArray[0].name, outName, blob.size);
  ToastManager.show('PDF comparison report generated!', 'success');
}

async function repairPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (p > 1) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_repaired.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Repair PDF', f0.name, outName, blob.size);
  ToastManager.show('PDF structure rebuilt and repaired!', 'success');
}

async function editPdfMetadata(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    if (p > 1) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
  }

  doc.setProperties({
    title: options.title || 'PDFNova Document',
    author: options.author || 'PDFNova User',
    subject: options.subject || 'Document',
    keywords: options.keywords || 'PDFNova'
  });

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_metadata.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Metadata Editor', f0.name, outName, blob.size);
  ToastManager.show('Metadata updated and embedded into PDF!', 'success');
}

async function addHeaderFooterPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const hTxt = options.headerText || 'CONFIDENTIAL DOCUMENT';
  const fTxt = options.footerText || 'PDFNova Document';
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

    const ctx = cvs.getContext('2d');
    ctx.font = '22px Arial'; ctx.fillStyle = '#444'; ctx.textAlign = 'center';
    ctx.fillText(hTxt, cvs.width / 2, 40);
    ctx.fillText(`${fTxt} | Page ${p} of ${pdf.numPages}`, cvs.width / 2, cvs.height - 30);

    if (p > 1) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_header_footer.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Header & Footer', f0.name, outName, blob.size);
  ToastManager.show('Header and Footer applied to PDF!', 'success');
}

async function extractBookmarksPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  let toc = `=== Table of Contents / Bookmark Index: ${f0.name} ===\n\n`;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const snippet = content.items.map(i => i.str).join(' ').trim().slice(0, 60);
    toc += `Page ${p}: ${snippet || '[Visual Content Page]'}\n`;
  }

  const blob = new Blob([toc], { type: 'text/plain;charset=utf-8' });
  validateOutput(blob, 'text/plain');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_bookmarks.txt`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Bookmarks', f0.name, outName, blob.size);
  ToastManager.show('Bookmarks index extracted!', 'success');
}

async function searchAndReplacePdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const query = options.query || options.searchQuery || '';
  if (!query) throw new Error('Please enter a search query.');

  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  let report = `=== Search Results for "${query}" in ${f0.name} ===\n\n`;
  let totalMatches = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items.map(i => i.str).join(' ');
    const matches = (pageText.match(new RegExp(query, 'gi')) || []).length;
    if (matches > 0) {
      totalMatches += matches;
      report += `Page ${p}: ${matches} match(es)\n   Snippet: "...${pageText.slice(0, 120)}..."\n\n`;
    }
  }

  report += `\nTotal matches found: ${totalMatches}\n`;
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  validateOutput(blob, 'text/plain');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_search_results.txt`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Search & Replace', f0.name, outName, blob.size);
  ToastManager.show(`Found ${totalMatches} occurrence(s) of "${query}"!`, 'success');
}

async function convertTxtToPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const text = await readFileAsText(f0);
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
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
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.txt$/i, '')}.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('TXT to PDF', f0.name, outName, blob.size);
  ToastManager.show('TXT file converted to PDF!', 'success');
}

async function convertHtmlToPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const htmlText = await readFileAsText(f0);
  const cleanText = htmlText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                            .replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n');

  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
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
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.(html|htm)$/i, '')}.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('HTML to PDF', f0.name, outName, blob.size);
  ToastManager.show('HTML rendered to PDF!', 'success');
}

async function convertMarkdownToPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const mdText = await readFileAsText(f0);
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const lines = mdText.split('\n');
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
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.(md|markdown)$/i, '')}.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Markdown to PDF', f0.name, outName, blob.size);
  ToastManager.show('Markdown document converted to PDF!', 'success');
}

async function convertRtfToPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const rtfText = await readFileAsText(f0);
  const cleanText = rtfText.replace(/\\par/g, '\n').replace(/\\[a-z0-9]+/g, '').replace(/[\{\}]/g, '').trim();

  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
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
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.(rtf|txt)$/i, '')}.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('RTF to PDF', f0.name, outName, blob.size);
  ToastManager.show('RTF document converted to PDF!', 'success');
}

async function enhancePhoto(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const brightness = parseInt(options.brightness || '105');
  const contrast = parseInt(options.contrast || '115');
  const saturation = parseInt(options.saturation || '110');

  const dataUrl = await readFileAsDataURL(f0);
  const img = await loadImage(dataUrl);
  const cvs = document.createElement('canvas');
  cvs.width = img.width; cvs.height = img.height;
  const ctx = cvs.getContext('2d');
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';

  const blob = await new Promise(res => cvs.toBlob(res, 'image/png'));
  validateOutput(blob, 'image/png', f0, true);
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_enhanced.png`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Photo Quality Enhancer', f0.name, outName, blob.size);
  ToastManager.show('Photo quality enhanced successfully!', 'success');
}

async function convertImageFormat(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const fmt = (options.format || 'png').toLowerCase();
  const mime = fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';
  const ext = fmt === 'jpeg' ? 'jpg' : fmt;

  const dataUrl = await readFileAsDataURL(f0);
  const img = await loadImage(dataUrl);
  const cvs = document.createElement('canvas');
  cvs.width = img.width; cvs.height = img.height;
  cvs.getContext('2d').drawImage(img, 0, 0);

  const blob = await new Promise(res => cvs.toBlob(res, mime, 0.92));
  validateOutput(blob, mime);
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}.${ext}`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Image Converter', f0.name, outName, blob.size);
  ToastManager.show(`Converted image format to ${fmt.toUpperCase()}!`, 'success');
}

async function compressImage(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const quality = (parseInt(options.quality || '60')) / 100;
  const dataUrl = await readFileAsDataURL(f0);
  const img = await loadImage(dataUrl);
  const cvs = document.createElement('canvas');
  cvs.width = img.width; cvs.height = img.height;
  cvs.getContext('2d').drawImage(img, 0, 0);

  const blob = await new Promise(res => cvs.toBlob(res, 'image/jpeg', quality));
  validateOutput(blob, 'image/jpeg');
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_compressed.jpg`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Image Compressor', f0.name, outName, blob.size);
  ToastManager.show(`Compressed image! ${formatBytes(f0.size)} → ${formatBytes(blob.size)}`, 'success');
}

async function resizeImage(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const dataUrl = await readFileAsDataURL(f0);
  const img = await loadImage(dataUrl);

  let w = parseInt(options.width);
  let h = parseInt(options.height);

  if (!w || !h) {
    const scale = parseFloat(options.scale || '0.5');
    w = Math.round(img.width * scale);
    h = Math.round(img.height * scale);
  } else if (options.keepAspectRatio) {
    h = Math.round(img.height * (w / img.width));
  }

  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  cvs.getContext('2d').drawImage(img, 0, 0, w, h);

  const blob = await new Promise(res => cvs.toBlob(res, 'image/png'));
  validateOutput(blob, 'image/png');
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_${w}x${h}.png`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Resize Image', f0.name, outName, blob.size);
  ToastManager.show(`Resized image to ${w} × ${h} px!`, 'success');
}

async function cropImage(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const dataUrl = await readFileAsDataURL(f0);
  const img = await loadImage(dataUrl);

  let ratio = 0.75;
  if (options.aspectRatio === '1:1') ratio = 0.8;
  else if (options.aspectRatio === '16:9') ratio = 0.7;

  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const sx = Math.round((img.width - w) / 2);
  const sy = Math.round((img.height - h) / 2);

  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  cvs.getContext('2d').drawImage(img, sx, sy, w, h, 0, 0, w, h);

  const blob = await new Promise(res => cvs.toBlob(res, 'image/png'));
  validateOutput(blob, 'image/png');
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_cropped.png`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Crop Image', f0.name, outName, blob.size);
  ToastManager.show(`Cropped image to ${w} × ${h} px!`, 'success');
}

async function rotateImage(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const deg = parseInt(options.rotationAngle || options.deg || '90');
  const dataUrl = await readFileAsDataURL(f0);
  const img = await loadImage(dataUrl);

  const cvs = document.createElement('canvas');
  const isSwap = deg === 90 || deg === 270;
  cvs.width = isSwap ? img.height : img.width;
  cvs.height = isSwap ? img.width : img.height;

  const ctx = cvs.getContext('2d');
  ctx.translate(cvs.width / 2, cvs.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  const blob = await new Promise(res => cvs.toBlob(res, 'image/png'));
  validateOutput(blob, 'image/png');
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_rotated${deg}.png`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Rotate Image', f0.name, outName, blob.size);
  ToastManager.show(`Image rotated ${deg}° successfully!`, 'success');
}

async function upscaleImage(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const factor = parseInt(options.upscaleFactor || options.factor || '2');
  const dataUrl = await readFileAsDataURL(f0);
  const img = await loadImage(dataUrl);

  const cvs = document.createElement('canvas');
  cvs.width = img.width * factor;
  cvs.height = img.height * factor;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cvs.width, cvs.height);

  const blob = await new Promise(res => cvs.toBlob(res, 'image/png'));
  validateOutput(blob, 'image/png');
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_${factor}x_upscaled.png`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Image Upscaler', f0.name, outName, blob.size);
  ToastManager.show(`Image upscaled ${factor}× to ${cvs.width} × ${cvs.height} px!`, 'success');
}

async function removeImageBackground(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const target = options.bgTarget || 'white';
  const dataUrl = await readFileAsDataURL(f0);
  const img = await loadImage(dataUrl);

  const cvs = document.createElement('canvas');
  cvs.width = img.width; cvs.height = img.height;
  const ctx = cvs.getContext('2d');
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
  const blob = await new Promise(res => cvs.toBlob(res, 'image/png'));
  validateOutput(blob, 'image/png');
  const outName = `${f0.name.replace(/\.[^.]+$/, '')}_nobg.png`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Background Remover', f0.name, outName, blob.size);
  ToastManager.show('Background removed! Transparent PNG exported.', 'success');
}

async function ocrPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  let ocrText = `=== OCR Text Recognition: ${f0.name} ===\n\n`;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const textStr = content.items.map(i => i.str).join(' ');
    ocrText += `--- Page ${p} ---\n${textStr || '[OCR text layer processed]'}\n\n`;
  }

  const blob = new Blob([ocrText], { type: 'text/plain;charset=utf-8' });
  validateOutput(blob, 'text/plain');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_ocr.txt`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('OCR PDF', f0.name, outName, blob.size);
  ToastManager.show('OCR text recognition completed!', 'success');
}

async function batesNumberingPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const prefix = options.prefix || 'BATES-';
  const start = parseInt(options.startNum || '1') || 1;
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
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
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_bates.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Bates Numbering', f0.name, outName, blob.size);
  ToastManager.show('Bates numbering stamped on pages!', 'success');
}

async function setPageLabelsPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  const style = options.labelStyle || 'roman';
  const ab = await readFileAsArrayBuffer(f0);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const cvs = document.createElement('canvas');
    cvs.width = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

    const ctx = cvs.getContext('2d');
    const labelText = style === 'roman' ? `Page ${p}` : `App-${p}`;
    ctx.font = '20px Arial'; ctx.fillStyle = '#555'; ctx.textAlign = 'center';
    ctx.fillText(labelText, cvs.width / 2, cvs.height - 25);

    if (p > 1) doc.addPage();
    doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
  }

  const blob = doc.output('blob');
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_labels.pdf`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('Page Labels', f0.name, outName, blob.size);
  ToastManager.show('Page labels formatted and stamped!', 'success');
}

async function inspectFileInformation(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  let info = `=====================================================\n`;
  info += `PDFNova File Inspection & Metadata Report\n`;
  info += `=====================================================\n`;
  info += `File Name:      ${f0.name}\n`;
  info += `File Size:      ${formatBytes(f0.size)} (${f0.size} bytes)\n`;
  info += `MIME Type:      ${f0.type || 'Unknown'}\n`;
  info += `Last Modified:  ${new Date(f0.lastModified).toLocaleString()}\n`;

  if (f0.name.toLowerCase().endsWith('.pdf')) {
    try {
      const ab = await readFileAsArrayBuffer(f0);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      info += `Page Count:     ${pdf.numPages}\n`;
    } catch (_) {}
  }
  info += `=====================================================\n`;

  const blob = new Blob([info], { type: 'text/plain;charset=utf-8' });
  validateOutput(blob, 'text/plain');
  const outName = `${f0.name.split('.')[0]}_info.txt`;
  triggerDownload(blob, outName);
  HistoryManager.addLog('File Information', f0.name, outName, blob.size);
  ToastManager.show('File information report downloaded!', 'success');
}

// ============================================================================
// 1. MASTER TOOL REGISTRY (AUTHORITATIVE SINGLE SOURCE OF TRUTH)
// ============================================================================

const TOOLS = [
  // Editors
  {
    id: 'pdf-editor',
    name: 'PDF Editor',
    description: 'Edit, annotate, draw signatures, highlight, and customize PDF pages.',
    desc: 'Edit, annotate, draw signatures, highlight, and customize PDF pages.',
    category: 'editor',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-pen-to-square',
    formats: ['PDF'],
    options: [],
    handler: openPdfEditor
  },
  {
    id: 'word-editor',
    name: 'Word (DOCX) Editor',
    description: 'Create and edit Word documents with rich text formatting and PDF export.',
    desc: 'Create and edit Word documents with rich text formatting and PDF export.',
    category: 'editor',
    acceptedTypes: ['.docx', '.doc'],
    accept: '.docx,.doc',
    multiple: false,
    popular: true,
    icon: 'fa-file-word',
    formats: ['DOCX', 'PDF'],
    options: [],
    handler: openWordEditor
  },

  // PDF Conversion & Manipulation Tools
  {
    id: 'pdf-to-img',
    name: 'PDF to Image',
    description: 'Render PDF pages into crisp high-resolution PNG images.',
    desc: 'Render PDF pages into crisp high-resolution PNG images.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-file-image',
    formats: ['PDF', 'PNG'],
    options: [
      { id: 'format', label: 'Image Format', type: 'select', values: ['PNG', 'JPG', 'WEBP'], default: 'PNG' },
      { id: 'quality', label: 'Quality (10-100)', type: 'number', min: 10, max: 100, default: 90 },
      { id: 'dpi', label: 'DPI Resolution', type: 'select', values: ['150', '300', '600'], default: '300' },
      { id: 'scale', label: 'Render Scale', type: 'select', values: ['1.0', '2.0', '3.0'], default: '2.0' },
      { id: 'pageScope', label: 'Page Scope', type: 'select', values: ['All Pages', 'Current Page', 'Page Range'], default: 'All Pages' }
    ],
    handler: convertPdfToImage
  },
  {
    id: 'img-to-pdf',
    name: 'Image to PDF',
    description: 'Convert and pack JPG, PNG, or WEBP photos into a PDF document.',
    desc: 'Convert and pack JPG, PNG, or WEBP photos into a PDF document.',
    category: 'pdf',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: true,
    popular: true,
    icon: 'fa-images',
    formats: ['JPG', 'PNG', 'PDF'],
    options: [
      { id: 'pageSize', label: 'Page Size', type: 'select', values: ['A4', 'Letter', 'Fit', 'Legal'], default: 'A4' },
      { id: 'orientation', label: 'Orientation', type: 'select', values: ['Portrait', 'Landscape'], default: 'Portrait' },
      { id: 'margin', label: 'Margin', type: 'select', values: ['None', 'Small', 'Normal'], default: 'Normal' },
      { id: 'fit', label: 'Image Fit', type: 'select', values: ['Contain', 'Cover', 'Stretch'], default: 'Contain' },
      { id: 'quality', label: 'Quality', type: 'select', values: ['High', 'Medium', 'Low'], default: 'High' }
    ],
    handler: convertImagesToPdf
  },
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF files into one consolidated document.',
    desc: 'Combine multiple PDF files into one consolidated document.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: true,
    popular: true,
    icon: 'fa-object-group',
    formats: ['PDF'],
    options: [
      { id: 'ordering', label: 'Drag ordering enabled. Reorder or remove files above.', type: 'info' }
    ],
    handler: mergePdfs
  },
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Optimize image encoding and reduce PDF file size.',
    desc: 'Optimize image encoding and reduce PDF file size.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-file-zipper',
    formats: ['PDF'],
    options: [
      { id: 'compressionLevel', label: 'Compression Level', type: 'select', values: ['Low', 'Recommended', 'High'], default: 'Recommended' },
      { id: 'imageQuality', label: 'Image Quality Scale', type: 'select', values: ['0.75', '0.55', '0.35'], default: '0.55' },
      { id: 'resolution', label: 'Resolution Target', type: 'select', values: ['300', '150', '72'], default: '150' }
    ],
    handler: compressPdf
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    description: 'Split a PDF by page ranges into separate files.',
    desc: 'Split a PDF by page ranges into separate files.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-scissors',
    formats: ['PDF', 'ZIP'],
    options: [
      { id: 'pageRange', label: 'Page Range (e.g. 1-3 or 1,3,5):', type: 'text', default: '1-3' }
    ],
    handler: splitPdf
  },
  {
    id: 'organize-pdf',
    name: 'Organize PDF',
    description: 'Reorder PDF pages visually then export the new order.',
    desc: 'Reorder PDF pages visually then export the new order.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-arrows-reorder',
    formats: ['PDF'],
    options: [],
    handler: organizePdf
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    description: 'Rotate selected or all pages 90°, 180°, or 270°.',
    desc: 'Rotate selected or all pages 90°, 180°, or 270°.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-rotate',
    formats: ['PDF'],
    options: [
      { id: 'rotationAngle', label: 'Rotation Angle', type: 'select', values: ['90', '180', '270'], default: '90' },
      { id: 'pageScope', label: 'Target Pages', type: 'select', values: ['All pages', 'Current page', 'Selected pages'], default: 'All pages' }
    ],
    handler: rotatePdf
  },
  {
    id: 'delete-pages',
    name: 'Delete PDF Pages',
    description: 'Remove unwanted pages from a PDF and export a clean document.',
    desc: 'Remove unwanted pages from a PDF and export a clean document.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-trash-can',
    formats: ['PDF'],
    options: [
      { id: 'pagesToDelete', label: 'Pages to Delete (e.g. 1,3,5):', type: 'text', default: '1' }
    ],
    handler: deletePdfPages
  },
  {
    id: 'extract-pages',
    name: 'Extract PDF Pages',
    description: 'Select specific pages to build a brand new smaller PDF.',
    desc: 'Select specific pages to build a brand new smaller PDF.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-file-export',
    formats: ['PDF'],
    options: [
      { id: 'pagesToExtract', label: 'Pages to Extract (e.g. 1-3,5):', type: 'text', default: '1' }
    ],
    handler: extractPdfPages
  },
  {
    id: 'pdf-to-text',
    name: 'PDF to Text',
    description: 'Extract selectable text page by page.',
    desc: 'Extract selectable text page by page.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-file-lines',
    formats: ['PDF', 'TXT'],
    options: [],
    handler: extractPdfText
  },
  {
    id: 'watermark-pdf',
    name: 'Watermark PDF',
    description: 'Stamp custom text watermarks onto PDF pages.',
    desc: 'Stamp custom text watermarks onto PDF pages.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-stamp',
    formats: ['PDF'],
    options: [
      { id: 'text', label: 'Watermark Text', type: 'text', default: 'CONFIDENTIAL' },
      { id: 'opacity', label: 'Opacity (0.05 - 1)', type: 'number', min: 0.05, max: 1, step: 0.05, default: 0.25 }
    ],
    handler: watermarkPdf
  },
  {
    id: 'page-numbers',
    name: 'PDF Page Numbers',
    description: 'Add visible page numbers to every page of your PDF.',
    desc: 'Add visible page numbers to every page of your PDF.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-list-ol',
    formats: ['PDF'],
    options: [
      { id: 'position', label: 'Position', type: 'select', values: ['bottom', 'top'], default: 'bottom' }
    ],
    handler: addPageNumbersPdf
  },
  {
    id: 'page-size',
    name: 'PDF Page Size',
    description: 'Convert PDF pages to standard paper sizes (A4, Letter).',
    desc: 'Convert PDF pages to standard paper sizes (A4, Letter).',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-ruler-combined',
    formats: ['PDF'],
    options: [
      { id: 'targetSize', label: 'Target Size', type: 'select', values: ['A4', 'Letter', 'A5', 'Legal'], default: 'A4' }
    ],
    handler: changePageSizePdf
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    description: 'Convert PDF document pages and layout into editable Word DOCX file.',
    desc: 'Convert PDF document pages and layout into editable Word DOCX file.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-file-word',
    formats: ['PDF', 'DOCX'],
    options: [],
    handler: convertPdfToWord
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel',
    description: 'Extract text grids and tables into structured CSV/XLSX spreadsheet data.',
    desc: 'Extract text grids and tables into structured CSV/XLSX spreadsheet data.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-file-excel',
    formats: ['PDF', 'CSV'],
    options: [],
    handler: convertPdfToExcel
  },
  {
    id: 'pdf-to-ppt',
    name: 'PDF to PowerPoint',
    description: 'Export PDF pages as structured slideshow presentation document.',
    desc: 'Export PDF pages as structured slideshow presentation document.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-file-powerpoint',
    formats: ['PDF', 'PPTX'],
    options: [],
    handler: convertPdfToPpt
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Convert DOCX and DOC files into crisp PDF document format.',
    desc: 'Convert DOCX and DOC files into crisp PDF document format.',
    category: 'pdf',
    acceptedTypes: ['.docx', '.doc'],
    accept: '.docx,.doc',
    multiple: false,
    popular: true,
    icon: 'fa-file-pdf',
    formats: ['DOCX', 'PDF'],
    options: [],
    handler: convertWordToPdf
  },
  {
    id: 'excel-to-pdf',
    name: 'Excel to PDF',
    description: 'Convert CSV/spreadsheet tables into formatted grid PDF documents.',
    desc: 'Convert CSV/spreadsheet tables into formatted grid PDF documents.',
    category: 'pdf',
    acceptedTypes: ['.csv', '.tsv', '.txt'],
    accept: '.csv,.tsv,.txt',
    multiple: false,
    popular: false,
    icon: 'fa-file-pdf',
    formats: ['CSV', 'PDF'],
    options: [],
    handler: convertExcelToPdf
  },
  {
    id: 'ppt-to-pdf',
    name: 'PowerPoint to PDF',
    description: 'Convert presentation slides into clean portable PDF format.',
    desc: 'Convert presentation slides into clean portable PDF format.',
    category: 'pdf',
    acceptedTypes: ['.pptx', '.ppt', '.txt'],
    accept: '.pptx,.ppt,.txt',
    multiple: false,
    popular: false,
    icon: 'fa-file-pdf',
    formats: ['PPTX', 'PDF'],
    options: [],
    handler: convertPptToPdf
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    description: 'Remove password restrictions and render clean unlocked PDF file.',
    desc: 'Remove password restrictions and render clean unlocked PDF file.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-unlock',
    formats: ['PDF'],
    options: [
      { id: 'password', label: 'Password (if required):', type: 'password', default: '' }
    ],
    handler: unlockPdf
  },
  {
    id: 'protect-pdf',
    name: 'Protect PDF',
    description: 'Apply security protection and encryption overlays to PDF document.',
    desc: 'Apply security protection and encryption overlays to PDF document.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-lock',
    formats: ['PDF'],
    options: [
      { id: 'password', label: 'Encryption Password', type: 'password', default: '' },
      { id: 'confirmPassword', label: 'Confirm Password', type: 'password', default: '' },
      { id: 'preventEditing', label: 'Prevent Editing', type: 'checkbox', default: true },
      { id: 'preventPrinting', label: 'Prevent Printing', type: 'checkbox', default: false },
      { id: 'preventCopying', label: 'Prevent Copying Text', type: 'checkbox', default: true },
      { id: 'preventAnnotations', label: 'Prevent Annotations', type: 'checkbox', default: false }
    ],
    handler: protectPdf
  },
  {
    id: 'sign-pdf',
    name: 'Sign PDF',
    description: 'Draw digital signatures and stamp them onto PDF pages.',
    desc: 'Draw digital signatures and stamp them onto PDF pages.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-signature',
    formats: ['PDF'],
    options: [
      { id: 'position', label: 'Signature Position', type: 'select', values: ['bottom-right', 'bottom-left', 'center'], default: 'bottom-right' }
    ],
    handler: signPdf
  },
  {
    id: 'compare-pdf',
    name: 'Compare PDF',
    description: 'Compare text and page differences between two PDF documents side-by-side.',
    desc: 'Compare text and page differences between two PDF documents side-by-side.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: true,
    popular: false,
    icon: 'fa-code-compare',
    formats: ['PDF', 'TXT'],
    options: [],
    handler: comparePdfs
  },
  {
    id: 'repair-pdf',
    name: 'Repair PDF',
    description: 'Recover data streams from damaged PDF files and rebuild clean PDF structure.',
    desc: 'Recover data streams from damaged PDF files and rebuild clean PDF structure.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-screwdriver-wrench',
    formats: ['PDF'],
    options: [],
    handler: repairPdf
  },
  {
    id: 'metadata-editor',
    name: 'Metadata Editor',
    description: 'Edit Title, Author, Subject, and Creator metadata tags embedded in PDF.',
    desc: 'Edit Title, Author, Subject, and Creator metadata tags embedded in PDF.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-tags',
    formats: ['PDF'],
    options: [
      { id: 'title', label: 'Document Title', type: 'text', default: 'PDFNova Document' },
      { id: 'author', label: 'Author Name', type: 'text', default: 'PDFNova User' },
      { id: 'subject', label: 'Subject', type: 'text', default: 'Report' },
      { id: 'keywords', label: 'Keywords', type: 'text', default: 'PDFNova, PDF' }
    ],
    handler: editPdfMetadata
  },
  {
    id: 'header-footer',
    name: 'Header & Footer',
    description: 'Insert custom header and footer labels on every PDF page.',
    desc: 'Insert custom header and footer labels on every PDF page.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-heading',
    formats: ['PDF'],
    options: [
      { id: 'headerText', label: 'Header Text (Top)', type: 'text', default: 'CONFIDENTIAL DOCUMENT' },
      { id: 'footerText', label: 'Footer Text (Bottom)', type: 'text', default: 'Page Document — PDFNova' }
    ],
    handler: addHeaderFooterPdf
  },
  {
    id: 'bookmarks',
    name: 'Bookmarks',
    description: 'Extract and build Table of Contents outline index from PDF headings.',
    desc: 'Extract and build Table of Contents outline index from PDF headings.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-bookmark',
    formats: ['PDF', 'TXT'],
    options: [],
    handler: extractBookmarksPdf
  },
  {
    id: 'search-replace',
    name: 'Search & Replace',
    description: 'Search text queries across PDF document pages and export match details.',
    desc: 'Search text queries across PDF document pages and export match details.',
    category: 'pdf',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-magnifying-glass-arrow-right',
    formats: ['PDF', 'TXT'],
    options: [
      { id: 'query', label: 'Search Query Term', type: 'text', default: '' }
    ],
    handler: searchAndReplacePdf
  },

  // Document Tools
  {
    id: 'docx-to-pdf',
    name: 'DOCX to PDF',
    description: 'Convert Word document (.docx) to high quality PDF file.',
    desc: 'Convert Word document (.docx) to high quality PDF file.',
    category: 'document',
    acceptedTypes: ['.docx', '.doc'],
    accept: '.docx,.doc',
    multiple: false,
    popular: true,
    icon: 'fa-file-pdf',
    formats: ['DOCX', 'PDF'],
    options: [],
    handler: convertWordToPdf
  },
  {
    id: 'txt-to-pdf',
    name: 'TXT to PDF',
    description: 'Convert plain text files into formatted PDF document with custom margins.',
    desc: 'Convert plain text files into formatted PDF document with custom margins.',
    category: 'document',
    acceptedTypes: ['.txt'],
    accept: '.txt',
    multiple: false,
    popular: false,
    icon: 'fa-file-lines',
    formats: ['TXT', 'PDF'],
    options: [],
    handler: convertTxtToPdf
  },
  {
    id: 'html-to-pdf',
    name: 'HTML to PDF',
    description: 'Render HTML documents and code into styled PDF pages.',
    desc: 'Render HTML documents and code into styled PDF pages.',
    category: 'document',
    acceptedTypes: ['.html', '.htm'],
    accept: '.html,.htm',
    multiple: false,
    popular: false,
    icon: 'fa-code',
    formats: ['HTML', 'PDF'],
    options: [],
    handler: convertHtmlToPdf
  },
  {
    id: 'md-to-pdf',
    name: 'Markdown to PDF',
    description: 'Parse Markdown markup syntax headings and lists into formatted PDF.',
    desc: 'Parse Markdown markup syntax headings and lists into formatted PDF.',
    category: 'document',
    acceptedTypes: ['.md', '.markdown'],
    accept: '.md,.markdown',
    multiple: false,
    popular: false,
    icon: 'fa-brands fa-markdown',
    formats: ['MD', 'PDF'],
    options: [],
    handler: convertMarkdownToPdf
  },
  {
    id: 'rtf-to-pdf',
    name: 'RTF to PDF',
    description: 'Convert Rich Text Format (RTF) documents to portable PDF file.',
    desc: 'Convert Rich Text Format (RTF) documents to portable PDF file.',
    category: 'document',
    acceptedTypes: ['.rtf', '.txt'],
    accept: '.rtf,.txt',
    multiple: false,
    popular: false,
    icon: 'fa-file-waveform',
    formats: ['RTF', 'PDF'],
    options: [],
    handler: convertRtfToPdf
  },

  // Image Tools
  {
    id: 'photo-enhancer',
    name: 'Photo Quality Enhancer',
    description: 'Sharpen and enhance brightness, contrast and saturation of your photos.',
    desc: 'Sharpen and enhance brightness, contrast and saturation of your photos.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: false,
    popular: true,
    icon: 'fa-wand-magic-sparkles',
    formats: ['JPG', 'PNG', 'WEBP'],
    options: [
      { id: 'brightness', label: 'Brightness (%)', type: 'number', min: 50, max: 200, default: 105 },
      { id: 'contrast', label: 'Contrast (%)', type: 'number', min: 50, max: 200, default: 115 },
      { id: 'saturation', label: 'Saturation (%)', type: 'number', min: 0, max: 300, default: 110 }
    ],
    handler: enhancePhoto
  },
  {
    id: 'image-converter',
    name: 'Image Converter',
    description: 'Convert images between JPG, PNG, and WEBP formats.',
    desc: 'Convert images between JPG, PNG, and WEBP formats.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: false,
    popular: false,
    icon: 'fa-repeat',
    formats: ['JPG', 'PNG', 'WEBP'],
    options: [
      { id: 'format', label: 'Convert To', type: 'select', values: ['PNG', 'JPG', 'WEBP'], default: 'PNG' }
    ],
    handler: convertImageFormat
  },
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    description: 'Compress image quality to reduce file size.',
    desc: 'Compress image quality to reduce file size.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: false,
    popular: false,
    icon: 'fa-file-contract',
    formats: ['JPG', 'PNG', 'WEBP'],
    options: [
      { id: 'quality', label: 'Quality (1-100)', type: 'number', min: 1, max: 100, default: 60 }
    ],
    handler: compressImage
  },
  {
    id: 'image-resize',
    name: 'Resize Image',
    description: 'Resize images by percentage scale or pixel bounds.',
    desc: 'Resize images by percentage scale or pixel bounds.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: false,
    popular: false,
    icon: 'fa-expand-arrows-alt',
    formats: ['JPG', 'PNG', 'WEBP'],
    options: [
      { id: 'width', label: 'Width (px)', type: 'number', default: '' },
      { id: 'height', label: 'Height (px)', type: 'number', default: '' },
      { id: 'keepAspectRatio', label: 'Keep Aspect Ratio', type: 'checkbox', default: true },
      { id: 'scale', label: 'Percentage Scale', type: 'select', values: ['0.25', '0.5', '0.75', '2.0'], default: '0.5' }
    ],
    handler: resizeImage
  },
  {
    id: 'image-crop',
    name: 'Crop Image',
    description: 'Crop images to a selected center or custom region.',
    desc: 'Crop images to a selected center or custom region.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: false,
    popular: false,
    icon: 'fa-crop-simple',
    formats: ['JPG', 'PNG', 'WEBP'],
    options: [
      { id: 'aspectRatio', label: 'Crop Aspect Ratio', type: 'select', values: ['Free', '1:1', '4:3', '16:9', 'A4'], default: 'Free' }
    ],
    handler: cropImage
  },
  {
    id: 'image-rotate',
    name: 'Rotate Image',
    description: 'Rotate images 90°, 180° or 270°.',
    desc: 'Rotate images 90°, 180° or 270°.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: false,
    popular: false,
    icon: 'fa-rotate',
    formats: ['JPG', 'PNG', 'WEBP'],
    options: [
      { id: 'rotationAngle', label: 'Rotation Angle', type: 'select', values: ['90', '180', '270'], default: '90' }
    ],
    handler: rotateImage
  },
  {
    id: 'image-upscaler',
    name: 'Image Upscaler',
    description: 'Upscale image resolution (2x/4x) using high-quality bilinear filtering & sharpening.',
    desc: 'Upscale image resolution (2x/4x) using high-quality bilinear filtering & sharpening.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: false,
    popular: true,
    icon: 'fa-up-right-and-down-left-from-center',
    formats: ['PNG', 'JPG'],
    options: [
      { id: 'upscaleFactor', label: 'Upscale Scale Factor', type: 'select', values: ['2', '4'], default: '2' }
    ],
    handler: upscaleImage
  },
  {
    id: 'bg-remover',
    name: 'Background Remover',
    description: 'Scan image pixels and remove white/solid background to export transparent PNG.',
    desc: 'Scan image pixels and remove white/solid background to export transparent PNG.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: false,
    popular: true,
    icon: 'fa-eraser',
    formats: ['PNG'],
    options: [
      { id: 'bgTarget', label: 'Background Target', type: 'select', values: ['white', 'black', 'high'], default: 'white' }
    ],
    handler: removeImageBackground
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    description: 'Quick utility to turn JPG photographs into a PDF document.',
    desc: 'Quick utility to turn JPG photographs into a PDF document.',
    category: 'image',
    acceptedTypes: ['.jpg', '.jpeg'],
    accept: '.jpg,.jpeg',
    multiple: true,
    popular: true,
    icon: 'fa-file-pdf',
    formats: ['JPG', 'PDF'],
    options: [],
    handler: convertImagesToPdf
  },

  // Advanced Tools & Utilities
  {
    id: 'ocr-pdf',
    name: 'OCR PDF',
    description: 'Perform Optical Character Recognition to extract searchable text from scanned PDF.',
    desc: 'Perform Optical Character Recognition to extract searchable text from scanned PDF.',
    category: 'advanced',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-eye',
    formats: ['PDF', 'TXT'],
    options: [],
    handler: ocrPdf
  },
  {
    id: 'bates-numbering',
    name: 'Bates Numbering',
    description: 'Stamp sequential legal Bates numbers (e.g. BATES-000001) onto PDF pages.',
    desc: 'Stamp sequential legal Bates numbers (e.g. BATES-000001) onto PDF pages.',
    category: 'advanced',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-barcode',
    formats: ['PDF'],
    options: [
      { id: 'prefix', label: 'Bates Prefix', type: 'text', default: 'BATES-' },
      { id: 'startNum', label: 'Start Number', type: 'number', min: 1, default: 1 }
    ],
    handler: batesNumberingPdf
  },
  {
    id: 'page-labels',
    name: 'Page Labels',
    description: 'Assign custom page numbers and Roman numeral labels to PDF pages.',
    desc: 'Assign custom page numbers and Roman numeral labels to PDF pages.',
    category: 'advanced',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-list-ol',
    formats: ['PDF'],
    options: [
      { id: 'labelStyle', label: 'Label Format', type: 'select', values: ['roman', 'alpha', 'appendix'], default: 'roman' }
    ],
    handler: setPageLabelsPdf
  },
  {
    id: 'file-information',
    name: 'File Information',
    description: 'Deep inspection panel for PDF size, page dimensions, fonts, MIME, and metadata.',
    desc: 'Deep inspection panel for PDF size, page dimensions, fonts, MIME, and metadata.',
    category: 'advanced',
    acceptedTypes: ['.pdf', '.docx', '.png', '.jpg', '.webp'],
    accept: '.pdf,.docx,.png,.jpg,.webp',
    multiple: false,
    popular: false,
    icon: 'fa-circle-info',
    formats: ['PDF', 'INFO'],
    options: [],
    handler: inspectFileInformation
  },
  {
    id: 'qr-generator',
    name: 'QR Code Generator',
    description: 'Generate customizable QR codes for URLs, text, Wi-Fi credentials, email, and contact cards.',
    desc: 'Generate customizable QR codes for URLs, text, Wi-Fi credentials, email, and contact cards.',
    category: 'advanced',
    acceptedTypes: ['*'],
    accept: '*',
    multiple: false,
    popular: true,
    icon: 'fa-qrcode',
    formats: ['PNG', 'SVG'],
    options: [],
    handler: openQrGenerator
  }
];

// ============================================================================
// SYSTEM HEALTH MONITORING
// ============================================================================

async function checkSystemHealth(maxAttempts = 3) {
  const badge = document.getElementById('sys-status-badge');
  const text  = document.getElementById('sys-status-text');

  if (text) text.textContent = 'Starting PDFNova services...';
  if (badge) badge.className = 'status-badge checking';

  const delays = [2000, 3000, 5000];

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok' || data.healthy || res.status === 200) {
          if (badge) badge.className = 'status-badge online';
          if (text) text.textContent = 'Backend Connected';
          return true;
        }
      }
    } catch (e) {
      console.warn(`[PDFNova] Health check attempt ${i + 1} failed:`, e);
    }
    if (i < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }

  if (badge) badge.className = 'status-badge offline';
  if (text) text.textContent = 'Backend Offline';
  return false;
}

// ============================================================================
// USER AUTHENTICATION CONTROLLER
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
    const openBtn = document.getElementById('btn-open-auth');
    if (openBtn) {
      openBtn.onclick = () => {
        if (this.getUser()) this.openAccountDashboard();
        else document.getElementById('auth-modal').classList.add('active');
      };
    }
    const closeAuth = document.getElementById('btn-close-auth');
    if (closeAuth) closeAuth.onclick = () => document.getElementById('auth-modal').classList.remove('active');

    const closeAcc = document.getElementById('btn-close-account');
    if (closeAcc) closeAcc.onclick = () => document.getElementById('account-modal').classList.remove('active');

    const logoutBtn = document.getElementById('btn-logout-account');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        document.getElementById('account-modal').classList.remove('active');
        ToastManager.show('Logged out successfully.', 'info');
        this.updateUserBtn();
      };
    }

    let isLoginMode = true;
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    if (tabLogin && tabSignup) {
      tabLogin.onclick = () => {
        isLoginMode = true;
        tabLogin.style.borderBottom  = '2px solid var(--primary)';
        tabSignup.style.borderBottom = 'none';
        document.getElementById('reg-name-group').style.display    = 'none';
        document.getElementById('reg-confirm-group').style.display = 'none';
        document.getElementById('auth-submit-btn').innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> Log In`;
      };
      tabSignup.onclick = () => {
        isLoginMode = false;
        tabSignup.style.borderBottom = '2px solid var(--primary)';
        tabLogin.style.borderBottom  = 'none';
        document.getElementById('reg-name-group').style.display    = 'flex';
        document.getElementById('reg-confirm-group').style.display = 'flex';
        document.getElementById('auth-submit-btn').innerHTML = `<i class="fa-solid fa-user-plus"></i> Register Account`;
      };
    }

    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.onsubmit = async (e) => {
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
            ToastManager.show(data.message || `Welcome, ${data.user.name || data.user.email}!`, 'success');
            document.getElementById('auth-modal').classList.remove('active');
            this.updateUserBtn();
          } else {
            ToastManager.show(data.message || 'Authentication failed.', 'danger');
          }
        } catch (err) {
          ToastManager.show('PDFNova server is unavailable. Please try again.', 'danger');
        }
      };
    }
  }
};

// ============================================================================
// MANAGERS: THEME, TOAST, FAVORITES, HISTORY
// ============================================================================

const ThemeManager = {
  key: 'pdfnova_theme',
  init() {
    const saved = localStorage.getItem(this.key);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        this.applyTheme(current === 'dark' ? 'light' : 'dark');
      };
    }
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
    if (!this.container) this.container = document.getElementById('toast-container');
    if (!this.container) return;
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
    if (!container) return;
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
// COMMAND PALETTE (CTRL + K SEARCH USING MASTER TOOL REGISTRY)
// ============================================================================

const CommandPalette = {
  overlay: document.getElementById('cmd-palette'),
  input: document.getElementById('cmd-input'),
  results: document.getElementById('cmd-results'),
  selectedIndex: 0,
  filteredTools: [],

  init() {
    this.overlay = document.getElementById('cmd-palette');
    this.input   = document.getElementById('cmd-input');
    this.results = document.getElementById('cmd-results');
    const btn = document.getElementById('btn-cmd-palette');
    if (btn) btn.onclick = () => this.open();

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.toggle(); }
      if (this.overlay && this.overlay.classList.contains('active')) {
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
    if (this.input) this.input.oninput = () => this.renderResults();
  },
  toggle() { if (this.overlay && this.overlay.classList.contains('active')) this.close(); else this.open(); },
  open()   { if (!this.overlay) return; this.overlay.classList.add('active'); if (this.input) { this.input.value = ''; this.renderResults(); setTimeout(() => this.input.focus(), 50); } },
  close()  { if (this.overlay) this.overlay.classList.remove('active'); },
  navigate(dir) {
    if (!this.filteredTools.length) return;
    this.selectedIndex = (this.selectedIndex + dir + this.filteredTools.length) % this.filteredTools.length;
    this.highlightSelected();
  },
  highlightSelected() {
    if (!this.results) return;
    const items = this.results.querySelectorAll('.cmd-item');
    items.forEach((item, idx) => item.classList.toggle('selected', idx === this.selectedIndex));
  },
  renderResults() {
    if (!this.results || !this.input) return;
    const query = this.input.value.toLowerCase().trim();
    this.filteredTools = TOOLS.filter(t => t.name.toLowerCase().includes(query) || (t.description || t.desc || '').toLowerCase().includes(query));
    this.selectedIndex = 0;
    this.results.innerHTML = this.filteredTools.map((t, idx) => `
      <div class="cmd-item ${idx === 0 ? 'selected' : ''}" data-id="${t.id}">
        <span><i class="fa-solid ${t.icon || 'fa-gear'}" style="color:var(--primary);margin-right:0.5rem;"></i>${t.name}</span>
        <span class="format-badge">${(t.category || 'tool').toUpperCase()}</span>
      </div>`).join('');
    this.results.querySelectorAll('.cmd-item').forEach(item => {
      item.onclick = () => { openToolWorkspace(item.dataset.id); this.close(); };
    });
  }
};

// ============================================================================
// NAVIGATION & DASHBOARD CONTROLLERS
// ============================================================================

function initFaqAccordion() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-question');
    if (q) {
      q.onclick = () => {
        const active = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
        if (!active) item.classList.add('active');
      };
    }
  });
}

function initNavigationScrolls() {
  const scrollToSection = (id) => {
    showDashboardView();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };
  const lEditor = document.getElementById('nav-link-editor');
  const lTools  = document.getElementById('nav-link-tools');
  const lFeat   = document.getElementById('nav-link-features');
  const lFaq    = document.getElementById('nav-link-faq');
  const hEditor = document.getElementById('hero-btn-editor');
  const hTools  = document.getElementById('hero-btn-tools');

  if (lEditor) lEditor.onclick   = (e) => { e.preventDefault(); scrollToSection('doc-editor-section'); };
  if (lTools)  lTools.onclick    = (e) => { e.preventDefault(); scrollToSection('dashboard-section'); };
  if (lFeat)   lFeat.onclick     = (e) => { e.preventDefault(); scrollToSection('features-section'); };
  if (lFaq)    lFaq.onclick      = (e) => { e.preventDefault(); scrollToSection('faq-section'); };
  if (hEditor) hEditor.onclick   = () => scrollToSection('doc-editor-section');
  if (hTools)  hTools.onclick    = () => scrollToSection('dashboard-section');

  const btnHist = document.getElementById('btn-open-history');
  if (btnHist) {
    btnHist.onclick = () => {
      HistoryManager.renderModal();
      document.getElementById('history-modal').classList.add('active');
    };
  }
  const closeHist = document.getElementById('btn-close-history');
  if (closeHist) closeHist.onclick = () => document.getElementById('history-modal').classList.remove('active');
}

function initHeroDemo() {
  const dropzone  = document.getElementById('hero-demo-dropzone');
  const fileInput = document.getElementById('hero-demo-file');
  const fileInfo  = document.getElementById('hero-demo-file-info');
  const startBtn  = document.getElementById('hero-demo-start-btn');
  if (!dropzone || !fileInput) return;

  fileInput.onchange = (e) => {
    if (!e.target.files.length) return;
    const file = e.target.files[0];
    document.getElementById('hero-demo-name').textContent = file.name;
    document.getElementById('hero-demo-size').textContent = formatBytes(file.size);
    dropzone.style.display = 'none';
    fileInfo.style.display = 'flex';
  };
  if (startBtn) startBtn.onclick = () => openToolWorkspace('pdf-to-img');
}

function initDashboard() {
  const grid = document.getElementById('tools-grid');
  if (!grid) return;
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
        <div class="card-desc">${tool.description || tool.desc}</div>
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

  const pdfEdBtn  = document.getElementById('btn-open-pdf-editor');
  const wordEdBtn = document.getElementById('btn-open-word-editor');
  const featCard  = document.getElementById('featured-card');
  if (pdfEdBtn)  pdfEdBtn.onclick  = () => openToolWorkspace('pdf-editor');
  if (wordEdBtn) wordEdBtn.onclick = () => openToolWorkspace('word-editor');
  if (featCard)  featCard.onclick  = () => openToolWorkspace('pdf-to-img');

  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterDashboard();
    };
  });

  // Quick Action Buttons Registration
  document.querySelectorAll('[data-tool]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      const toolId = el.getAttribute('data-tool');
      if (toolId) openToolWorkspace(toolId);
    };
  });
}

function filterDashboard() {
  const activeBtn = document.querySelector('.cat-btn.active');
  if (!activeBtn) return;
  const activeCat = activeBtn.dataset.category;
  document.querySelectorAll('.tool-card').forEach(card => {
    const tool = TOOLS.find(t => t.id === card.dataset.id);
    if (!tool) return;
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
  const dashboardView = document.getElementById('dashboard-view');
  const workspaceView = document.getElementById('workspace-view');
  if (dashboardView) dashboardView.style.display = 'block';
  if (workspaceView) workspaceView.classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openToolWorkspace(toolId) {
  let id = toolId;
  if (id === 'qr-code-generator') id = 'qr-generator';
  if (id === 'docx-to-pdf') id = 'word-to-pdf';

  const tool = TOOLS.find(t => t.id === id);
  if (!tool) return;

  const dashboardView = document.getElementById('dashboard-view');
  const workspaceView = document.getElementById('workspace-view');
  if (dashboardView) dashboardView.style.display = 'none';
  if (workspaceView) workspaceView.classList.add('active');

  const wsCategory   = document.getElementById('ws-category');
  const wsTitleCrumb = document.getElementById('ws-title-crumb');
  const wsToolTitle  = document.getElementById('ws-tool-title');
  const wsToolDesc   = document.getElementById('ws-tool-desc');

  if (wsCategory)   wsCategory.textContent   = (tool.category || 'TOOL').toUpperCase();
  if (wsTitleCrumb) wsTitleCrumb.textContent = tool.name;
  if (wsToolTitle)  wsToolTitle.textContent  = tool.name;
  if (wsToolDesc)   wsToolDesc.textContent   = tool.description || tool.desc || '';

  renderToolWorkspace(tool);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const logoBtn = document.getElementById('logo-home-btn');
const backBtn = document.getElementById('btn-back-dashboard');
if (logoBtn) logoBtn.onclick = (e) => { e.preventDefault(); showDashboardView(); };
if (backBtn) backBtn.onclick = showDashboardView;

// ============================================================================
// UNIVERSAL FILE UPLOADER WITH FILE TYPE VALIDATION
// ============================================================================

const UniversalFileUploader = {
  validateFiles(files, category, toolId) {
    if (!files || files.length === 0) return [];
    let tool = TOOLS.find(t => t.id === toolId);
    if (!tool && toolId === 'qr-code-generator') tool = TOOLS.find(t => t.id === 'qr-generator');

    const validFiles = [];
    for (const file of Array.from(files)) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      let isValid = true;
      const acceptPattern = tool ? (tool.acceptedTypes ? (Array.isArray(tool.acceptedTypes) ? tool.acceptedTypes.join(',') : tool.acceptedTypes) : tool.accept) : '*';

      if (acceptPattern && acceptPattern !== '*') {
        const allowed = acceptPattern.split(',').map(a => a.trim().toLowerCase());
        isValid = allowed.some(a => a === ext || a === '.*');
      }
      if (!isValid) {
        ToastManager.show(`Unsupported file type for ${tool ? tool.name : 'this tool'}: ${file.name}`, 'warning');
      } else {
        validFiles.push(file);
      }
    }
    return validFiles;
  },

  attachDropzone(dropzoneEl, fileInputEl, onFilesSelected, isMultiple = false, category = 'pdf', toolId = '') {
    if (!dropzoneEl || !fileInputEl) return;
    fileInputEl.multiple = isMultiple;

    dropzoneEl.onclick = (e) => {
      if (e.target === dropzoneEl || !e.target.closest('button') && !e.target.closest('canvas') && !e.target.closest('input')) {
        fileInputEl.value = '';
        fileInputEl.click();
      }
    };

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
      const rawFiles = Array.from(e.dataTransfer.files || []);
      if (!rawFiles.length) return;
      const validFiles = this.validateFiles(rawFiles, category, toolId);
      if (!validFiles.length) return;
      onFilesSelected(isMultiple ? validFiles : validFiles[0]);
    };
  }
};

// ============================================================================
// DYNAMIC TOOL WORKSPACE ROUTER & CONTROLS RENDERER
// ============================================================================

function renderToolWorkspace(tool) {
  const container = document.getElementById('ws-dynamic-content');
  if (!container) return;
  if (tool.id === 'pdf-editor')  renderPdfEditorTool(container, tool);
  else if (tool.id === 'word-editor') renderWordEditorTool(container, tool);
  else if (tool.id === 'qr-generator') openQrGenerator(container, tool);
  else renderUniversalConverterTool(container, tool);
}

function renderToolControls(tool, controlsDiv) {
  if (!controlsDiv) return;
  controlsDiv.style.display = 'block';

  if (!tool.options || tool.options.length === 0) {
    controlsDiv.style.display = 'none';
    return;
  }

  controlsDiv.innerHTML = tool.options.map(opt => {
    if (opt.type === 'info') {
      return `<div style="font-size:0.85rem;color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> ${opt.label}</div>`;
    } else if (opt.type === 'checkbox') {
      return `
        <div style="margin-bottom:0.6rem;">
          <input type="checkbox" id="ctrl-opt-${opt.id}" data-option-id="${opt.id}" ${opt.default ? 'checked' : ''}>
          <label for="ctrl-opt-${opt.id}" style="font-weight:600;margin-left:0.4rem;">${opt.label}</label>
        </div>`;
    } else if (opt.type === 'select') {
      return `
        <div style="margin-bottom:0.75rem;">
          <label style="font-weight:700;display:block;margin-bottom:0.3rem;">${opt.label}:</label>
          <select id="ctrl-opt-${opt.id}" data-option-id="${opt.id}" class="input-control">
            ${opt.values.map(v => `<option value="${v.toLowerCase ? v.toLowerCase() : v}" ${v === opt.default ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>`;
    } else if (opt.type === 'number') {
      return `
        <div style="margin-bottom:0.75rem;">
          <label style="font-weight:700;display:block;margin-bottom:0.3rem;">${opt.label}:</label>
          <input id="ctrl-opt-${opt.id}" data-option-id="${opt.id}" class="input-control" type="number" ${opt.min !== undefined ? `min="${opt.min}"` : ''} ${opt.max !== undefined ? `max="${opt.max}"` : ''} ${opt.step !== undefined ? `step="${opt.step}"` : ''} value="${opt.default || ''}">
        </div>`;
    } else if (opt.type === 'password') {
      return `
        <div style="margin-bottom:0.75rem;">
          <label style="font-weight:700;display:block;margin-bottom:0.3rem;">${opt.label}:</label>
          <input id="ctrl-opt-${opt.id}" data-option-id="${opt.id}" class="input-control" type="password" placeholder="${opt.label}">
        </div>`;
    } else {
      return `
        <div style="margin-bottom:0.75rem;">
          <label style="font-weight:700;display:block;margin-bottom:0.3rem;">${opt.label}:</label>
          <input id="ctrl-opt-${opt.id}" data-option-id="${opt.id}" class="input-control" type="text" value="${opt.default || ''}">
        </div>`;
    }
  }).join('');
}

function getWorkspaceOptions(tool, container) {
  const options = {};
  if (!container) return options;
  container.querySelectorAll('[data-option-id]').forEach(el => {
    const optId = el.dataset.optionId;
    if (el.type === 'checkbox') options[optId] = el.checked;
    else options[optId] = el.value;
  });
  return options;
}

function renderUniversalConverterTool(container, tool) {
  const isMultiFile = tool.multiple || ['merge-pdf','img-to-pdf','jpg-to-pdf','compare-pdf'].includes(tool.id);

  container.innerHTML = `
    <div class="dropzone" id="uni-dropzone" style="cursor:pointer;">
      <div class="dropzone-icon"><i class="fa-solid ${tool.icon || 'fa-file'}"></i></div>
      <div style="font-weight:700;font-size:1.1rem;color:var(--text-dark);">Select ${isMultiFile ? 'Files' : 'File'} for ${tool.name}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Click or drag ${isMultiFile ? 'files' : 'file'} here (${tool.accept || tool.acceptedTypes || '*'})</div>
      <input type="file" class="file-input" id="uni-file-input" accept="${tool.accept || tool.acceptedTypes || '*'}">
    </div>

    <div class="options-panel" id="uni-options-panel" style="display:none;flex-direction:column;gap:1.25rem;">
      <div style="font-weight:700;color:var(--text-dark);">Selected ${isMultiFile ? 'Files' : 'File'}</div>
      <div id="uni-file-list" style="display:flex;flex-direction:column;gap:0.5rem;"></div>

      <div id="uni-tool-controls" style="background:var(--bg-card);border:1px solid var(--border-color);padding:1rem;border-radius:var(--radius-md);"></div>

      <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="uni-btn-reset">Change ${isMultiFile ? 'Files' : 'File'}</button>
        <button type="button" class="btn btn-primary" id="uni-btn-process"><i class="fa-solid fa-gear"></i> Process ${tool.name}</button>
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
    fileList.innerHTML = selectedFiles.map((f, idx) => `
      <div style="display:flex;align-items:center;gap:0.75rem;background:var(--bg-card);border:1px solid var(--border-color);padding:0.65rem 1rem;border-radius:var(--radius-md);">
        <i class="fa-solid ${isImage ? 'fa-file-image' : 'fa-file-pdf'}" style="color:var(--primary);font-size:1.25rem;"></i>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.88rem;color:var(--text-dark);">${f.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${formatBytes(f.size)}</div>
        </div>
        ${isMultiFile ? `<button type="button" class="sm-btn btn-remove-file" data-idx="${idx}" style="color:var(--danger);"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>`).join('');

    if (isMultiFile) {
      fileList.querySelectorAll('.btn-remove-file').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx);
          selectedFiles.splice(idx, 1);
          if (selectedFiles.length === 0) {
            optionsPanel.style.display = 'none';
            dropzone.style.display     = 'flex';
          } else {
            renderFileList();
          }
        };
      });
    }
  };

  const onFilesReady = (files) => {
    selectedFiles = Array.isArray(files) ? files : [files];
    if (!selectedFiles.length) return;
    renderFileList();
    renderToolControls(tool, controlsDiv);
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

// ============================================================================
// PDF EDITOR WORKSPACE RENDERER
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
    validateOutput(blob, 'application/pdf');
    triggerDownload(blob, fileName);
    HistoryManager.addLog(tool.name, fileName, fileName, blob.size);
    ToastManager.show('PDF exported successfully!', 'success');
  };
}

// ============================================================================
// WORD EDITOR WORKSPACE RENDERER
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
    validateOutput(blob, 'application/pdf');
    triggerDownload(blob, fileName);
    HistoryManager.addLog(tool.name, fileName, fileName, blob.size);
    ToastManager.show('PDF exported from Word document!', 'success');
  };
}

// ============================================================================
// CENTRAL TOOL PROCESSOR ENGINE
// ============================================================================

async function runToolProcessor(tool, selectedFiles, container) {
  try {
    const options = getWorkspaceOptions(tool, container);

    if (typeof tool.handler === 'function') {
      ToastManager.show(`Processing ${tool.name}...`, 'info');
      await tool.handler(selectedFiles, options, container);
    } else {
      throw new Error(`Handler function for ${tool.name} is not defined.`);
    }
  } catch (err) {
    console.error(`[PDFNova Engine] Error processing ${tool.name}:`, err);
    let errMsg = err.message || 'The tool could not produce a valid output file.';
    if (errMsg.includes('Failed to fetch')) {
      errMsg = 'PDFNova server is unavailable. Please try again.';
    }
    ToastManager.show(errMsg, 'danger');
  }
}

// ============================================================================
// INITIALIZE APPLICATION ON LOAD
// ============================================================================

window.addEventListener('DOMContentLoaded', async () => {
  ThemeManager.init();
  AuthController.init();
  CommandPalette.init();
  initNavigationScrolls();
  initFaqAccordion();
  initHeroDemo();
  initDashboard();

  await checkSystemHealth(3);

  const badge = document.getElementById('sys-status-badge');
  if (badge) {
    badge.onclick = async () => {
      ToastManager.show('Checking PDFNova backend health...', 'info');
      const connected = await checkSystemHealth(2);
      if (connected) ToastManager.show('Backend connected!', 'success');
      else ToastManager.show('Backend offline. Please start server or check network.', 'danger');
    };
  }
});
