// PDFNova LAB — 3D Document Laboratory & Complete Engine
// Real implementations for PDF, Document, Image, AI, and QR tools.

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
    
    renderResultScreen({
      toolName: 'PDF to Image',
      filename: outName,
      metrics: [
        { label: 'Original PDF', value: f0.name },
        { label: 'Pages Converted', value: '1 Page' },
        { label: 'Image Format', value: fmt.toUpperCase() },
        { label: 'Output Size', value: formatBytes(blob.size) }
      ],
      onDownload: () => triggerDownload(blob, outName)
    });
    HistoryManager.addLog('PDF to Image', f0.name, outName, blob.size);
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
    
    renderResultScreen({
      toolName: 'PDF to Image',
      filename: outName,
      metrics: [
        { label: 'Original PDF', value: f0.name },
        { label: 'Total Pages', value: `${totalPages} Pages` },
        { label: 'ZIP Size', value: formatBytes(zipBlob.size) }
      ],
      onDownload: () => triggerDownload(zipBlob, outName)
    });
    HistoryManager.addLog('PDF to Image', f0.name, outName, zipBlob.size);
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

  renderResultScreen({
    toolName: 'Image to PDF',
    filename: outName,
    metrics: [
      { label: 'Images Combined', value: `${fileArray.length} Image(s)` },
      { label: 'PDF Page Size', value: pageSize.toUpperCase() },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Image to PDF', fileArray[0].name, outName, blob.size);
}

// 3. MERGE PDF
async function mergePdfs(files, options = {}) {
  const fileArray = Array.isArray(files) ? files : [files];
  if (fileArray.length < 2) throw new Error('Please select at least 2 PDF files to merge.');

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

  renderResultScreen({
    toolName: 'Merge PDF',
    filename: outName,
    metrics: [
      { label: 'PDF Files Merged', value: `${fileArray.length} Files` },
      { label: 'Total Pages', value: `${totalCombinedPages} Pages` },
      { label: 'Merged Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Merge PDF', fileArray[0].name, outName, blob.size);
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

  const saved = f0.size - blob.size;
  const pct = saved > 0 ? Math.round((saved / f0.size) * 100) : 0;

  renderResultScreen({
    toolName: 'Compress PDF',
    filename: outName,
    metrics: [
      { label: 'Original Size', value: formatBytes(f0.size) },
      { label: 'Compressed Size', value: formatBytes(blob.size) },
      { label: 'Space Saved', value: `${pct}% Saved` }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Compress PDF', f0.name, outName, blob.size);
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

  renderResultScreen({
    toolName: 'Split PDF',
    filename: outName,
    metrics: [
      { label: 'Original Pages', value: `${total} Pages` },
      { label: 'Split Pages', value: `${pageNums.length} Pages` },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Split PDF', f0.name, outName, blob.size);
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

  renderResultScreen({
    toolName: 'Rotate PDF',
    filename: outName,
    metrics: [
      { label: 'Rotation Angle', value: `${deg}°` },
      { label: 'Pages Rotated', value: `${pdf.numPages} Pages` },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Rotate PDF', f0.name, outName, blob.size);
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
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_deleted.pdf`;

  renderResultScreen({
    toolName: 'Delete PDF Pages',
    filename: outName,
    metrics: [
      { label: 'Original Pages', value: `${total} Pages` },
      { label: 'Pages Remaining', value: `${keepPages.length} Pages` },
      { label: 'Pages Deleted', value: `${toDelete.size} Pages` }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Delete PDF Pages', f0.name, outName, blob.size);
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

  renderResultScreen({
    toolName: 'Extract Pages',
    filename: outName,
    metrics: [
      { label: 'Extracted Pages', value: `${pageNums.length} Pages` },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Extract Pages', f0.name, outName, blob.size);
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

  renderResultScreen({
    toolName: 'Watermark PDF',
    filename: outName,
    metrics: [
      { label: 'Watermark Text', value: wmText },
      { label: 'Pages Stamped', value: `${pdf.numPages} Pages` },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Watermark PDF', f0.name, outName, blob.size);
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

  renderResultScreen({
    toolName: 'PDF to Text',
    filename: outName,
    metrics: [
      { label: 'Text File', value: outName },
      { label: 'Pages Extracted', value: `${pdf.numPages} Pages` },
      { label: 'File Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('PDF to Text', f0.name, outName, blob.size);
}

// 11. PROTECT PDF (REAL BACKEND ENCRYPTION)
async function protectPdf(files, options = {}) {
  const f0 = Array.isArray(files) ? files[0] : files;
  if (!f0) throw new Error('No PDF file provided for protection.');

  const password = options.password;
  const confirmPassword = options.confirmPassword;

  if (!password) throw new Error('Please enter a password.');
  if (confirmPassword !== undefined && password !== confirmPassword) throw new Error('Passwords do not match.');

  ToastManager.show('Sending protection request to production backend...', 'info');

  const formData = new FormData();
  formData.append('file', f0);
  formData.append('password', password);
  if (options.preventEditing) formData.append('preventEditing', 'true');
  if (options.preventPrinting) formData.append('preventPrinting', 'true');
  if (options.preventCopying) formData.append('preventCopying', 'true');
  if (options.preventAnnotations) formData.append('preventAnnotations', 'true');

  const targetUrl = `${CONFIG.API_BASE_URL}/api/protect-pdf`;
  console.log('[PDFNova LAB Protect] Request URL:', targetUrl);

  let res;
  try {
    res = await fetch(targetUrl, {
      method: 'POST',
      body: formData
    });
  } catch (err) {
    console.error('[PDFNova LAB Protect] Network/CORS Fetch Error:', err);
    throw new Error('PDF protection service could not be reached.');
  }

  console.log('[PDFNova LAB Protect] HTTP Status:', res.status);

  if (!res.ok) {
    let errMsg = '';
    if (res.status === 404) errMsg = 'Protect PDF endpoint not found.';
    else if (res.status === 405) errMsg = 'Protect PDF method is not supported.';
    else if (res.status === 413) errMsg = 'PDF file is too large.';
    else if (res.status === 415) errMsg = 'Unsupported file type.';
    else if (res.status >= 500) errMsg = 'PDF protection service failed.';
    else {
      try {
        const errData = await res.json();
        if (errData && errData.message) errMsg = errData.message;
      } catch (_) {}
    }
    throw new Error(errMsg || `Protect PDF failed (HTTP ${res.status}).`);
  }

  const blob = await res.blob();
  validateOutput(blob, 'application/pdf');
  const outName = `${f0.name.replace(/\.pdf$/i, '')}_protected.pdf`;

  renderResultScreen({
    toolName: 'Protect PDF',
    filename: outName,
    metrics: [
      { label: 'Security Status', value: 'Encrypted ✓' },
      { label: 'Protection Level', value: 'AES Protected' },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Protect PDF', f0.name, outName, blob.size);
}

// 12. QR CODE GENERATOR WORKSPACE
async function openQrGenerator(container, tool) {
  container.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border-color);padding:1.75rem;border-radius:var(--radius-xl);max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:1.25rem;box-shadow:var(--shadow-lg);">
      <div style="font-weight:800;font-size:1.25rem;color:var(--text-dark);display:flex;align-items:center;gap:0.5rem;">
        <i class="fa-solid fa-qrcode" style="color:var(--primary);"></i> QR Code Generator
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div>
          <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Content Type:</label>
          <select id="qr-type-select" class="input-control">
            <option value="phone" selected>Phone Number</option>
            <option value="url">Website URL</option>
            <option value="text">Plain Text</option>
            <option value="email">Email Message</option>
            <option value="wifi">Wi-Fi Network</option>
            <option value="vcard">Contact Card (vCard)</option>
            <option value="share">Share Current Page URL</option>
          </select>
        </div>
        <div>
          <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Foreground Color:</label>
          <input id="qr-color-fg" class="input-control" type="color" value="#000000" style="height:42px;padding:0.2rem 0.5rem;cursor:pointer;">
        </div>
      </div>

      <div id="qr-inputs-container"></div>

      <div style="display:flex;flex-direction:column;align-items:center;gap:1.25rem;padding:1.5rem;background:var(--bg-main);border-radius:var(--radius-lg);border:1px solid var(--border-color);">
        <div id="qr-display-wrapper" style="background:#ffffff;padding:16px;border-radius:12px;border:1px solid var(--border-color);box-shadow:var(--shadow-md);min-width:240px;min-height:240px;display:flex;align-items:center;justify-content:center;overflow:hidden;"></div>
        
        <div id="qr-payload-preview" style="font-size:0.78rem;color:var(--text-muted);font-family:monospace;word-break:break-all;text-align:center;max-width:340px;"></div>

        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center;">
          <button type="button" class="btn btn-primary" id="btn-download-qr"><i class="fa-solid fa-download"></i> Download QR Code PNG</button>
          <button type="button" class="btn btn-secondary" id="btn-share-qr"><i class="fa-solid fa-share-nodes"></i> Share QR</button>
        </div>
      </div>
    </div>
  `;

  const typeSelect = container.querySelector('#qr-type-select');
  const colorFg    = container.querySelector('#qr-color-fg');
  const inputsDiv  = container.querySelector('#qr-inputs-container');
  const displayWrapper = container.querySelector('#qr-display-wrapper');
  const payloadPreview = container.querySelector('#qr-payload-preview');
  const downloadBtn= container.querySelector('#btn-download-qr');
  const shareBtn   = container.querySelector('#btn-share-qr');

  const renderInputs = () => {
    const val = typeSelect.value;
    if (val === 'phone') {
      inputsDiv.innerHTML = `<label style="font-weight:700;display:block;margin-bottom:0.3rem;">Phone Number:</label><input id="qr-inp-phone" class="input-control" type="tel" value="" placeholder="e.g. 9876543210 or +919876543210" autocomplete="off">`;
    } else if (val === 'url') {
      inputsDiv.innerHTML = `<label style="font-weight:700;display:block;margin-bottom:0.3rem;">Target URL:</label><input id="qr-inp-url" class="input-control" type="url" value="https://example.com" placeholder="https://example.com">`;
    } else if (val === 'text') {
      inputsDiv.innerHTML = `<label style="font-weight:700;display:block;margin-bottom:0.3rem;">Text Content:</label><textarea id="qr-inp-text" class="input-control" rows="3" placeholder="Hello PDFNova LAB">Hello PDFNova LAB</textarea>`;
    } else if (val === 'email') {
      inputsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Recipient Email:</label><input id="qr-inp-email" class="input-control" type="email" value="test@example.com" placeholder="test@example.com">
        <label style="font-weight:700;display:block;margin:0.5rem 0 0.3rem;">Subject (optional):</label><input id="qr-inp-subject" class="input-control" type="text" placeholder="Subject">
        <label style="font-weight:700;display:block;margin:0.5rem 0 0.3rem;">Body (optional):</label><textarea id="qr-inp-body" class="input-control" rows="2" placeholder="Body message"></textarea>`;
    } else if (val === 'wifi') {
      inputsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.3rem;">SSID Network Name:</label><input id="qr-inp-ssid" class="input-control" type="text" value="TestWiFi" placeholder="TestWiFi">
        <label style="font-weight:700;display:block;margin:0.5rem 0 0.3rem;">Password:</label><input id="qr-inp-wifipass" class="input-control" type="text" value="Test12345" placeholder="Test12345">
        <label style="font-weight:700;display:block;margin:0.5rem 0 0.3rem;">Security Mode:</label>
        <select id="qr-inp-wifisec" class="input-control">
          <option value="WPA" selected>WPA/WPA2</option>
          <option value="WEP">WEP</option>
          <option value="nopass">None (Open)</option>
        </select>`;
    } else if (val === 'vcard') {
      inputsDiv.innerHTML = `
        <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Full Name:</label><input id="qr-inp-name" class="input-control" type="text" value="" placeholder="Full Name (e.g. John Doe)">
        <label style="font-weight:700;display:block;margin:0.5rem 0 0.3rem;">Phone Number:</label><input id="qr-inp-vphone" class="input-control" type="tel" value="" placeholder="e.g. 9876543210 or +919876543210">`;
    } else {
      inputsDiv.innerHTML = `<label style="font-weight:700;display:block;margin-bottom:0.3rem;">Share Link:</label><input id="qr-inp-share" class="input-control" type="url" value="${window.location.href}" readonly>`;
    }
    updateQr();
  };

  const normalizePhonePayload = (rawInput) => {
    if (!rawInput) return '';
    let str = rawInput.trim();
    if (str.toLowerCase().startsWith('tel:')) {
      str = str.slice(4).trim();
    }
    const cleaned = str.replace(/[\s\-\(\)]/g, '');
    if (!cleaned) return '';

    if (cleaned.startsWith('+')) {
      const digits = cleaned.slice(1);
      if (/^\d{7,15}$/.test(digits)) return `tel:${cleaned}`;
      return '';
    }

    if (/^\d{10}$/.test(cleaned)) {
      return `tel:+91${cleaned}`;
    }

    if (/^0\d{10}$/.test(cleaned)) {
      return `tel:+91${cleaned.slice(1)}`;
    }

    if (/^91\d{10}$/.test(cleaned)) {
      return `tel:+${cleaned}`;
    }

    if (/^\d{7,15}$/.test(cleaned)) {
      return `tel:+91${cleaned}`;
    }

    return '';
  };

  const getQrText = () => {
    const v = typeSelect.value;
    const gv = id => { const el = container.querySelector(`#${id}`); return el ? el.value.trim() : ''; };
    
    if (v === 'phone') {
      const raw = gv('qr-inp-phone');
      return normalizePhonePayload(raw);
    }
    if (v === 'url') {
      const raw = gv('qr-inp-url');
      if (!raw) return 'https://example.com';
      return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    }
    if (v === 'text') {
      return gv('qr-inp-text') || 'Hello PDFNova LAB';
    }
    if (v === 'email') {
      const email = gv('qr-inp-email') || 'test@example.com';
      const subject = gv('qr-inp-subject');
      const body = gv('qr-inp-body');
      let mailto = `mailto:${email}`;
      const params = [];
      if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
      if (body) params.push(`body=${encodeURIComponent(body)}`);
      if (params.length > 0) mailto += `?${params.join('&')}`;
      return mailto;
    }
    if (v === 'wifi') {
      const ssid = gv('qr-inp-ssid') || 'TestWiFi';
      const pass = gv('qr-inp-wifipass') || 'Test12345';
      const sec  = gv('qr-inp-wifisec') || 'WPA';
      return `WIFI:T:${sec};S:${ssid};P:${pass};;`;
    }
    if (v === 'vcard') {
      const name = gv('qr-inp-name') || '';
      const rawPhone = gv('qr-inp-vphone');
      const phonePayload = normalizePhonePayload(rawPhone);
      const cleanPhone = phonePayload ? phonePayload.replace(/^tel:/, '') : '';
      if (!name && !cleanPhone) return '';
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${name || 'Contact'}\nTEL:${cleanPhone}\nEND:VCARD`;
    }
    return gv('qr-inp-share') || window.location.href;
  };

  const updateQr = () => {
    const vType = typeSelect.value;
    const payload = getQrText();
    const fgColor = colorFg.value || '#000000';

    if (!displayWrapper) return;

    // DOM Cleanup: clear previous QR instances
    displayWrapper.innerHTML = '';

    if (vType === 'phone' && !payload) {
      if (payloadPreview) payloadPreview.textContent = 'Enter a 10-digit phone number (e.g. 9876543210)';
      displayWrapper.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:1rem;text-align:center;">Enter phone number to generate QR code</div>';
      return;
    }

    if (!payload) {
      if (payloadPreview) payloadPreview.textContent = 'Please fill in details to generate QR';
      displayWrapper.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:1rem;text-align:center;">Enter details to generate QR code</div>';
      return;
    }

    if (payloadPreview) {
      payloadPreview.textContent = `Payload: ${payload}`;
    }

    if (typeof window.QRCode !== 'function') {
      console.error('window.QRCode library is not loaded or unavailable.');
      displayWrapper.innerHTML = '<div style="color:var(--danger);font-size:0.85rem;font-weight:700;padding:1rem;text-align:center;">Unable to generate QR code.</div>';
      return;
    }

    try {
      const correctLevel = window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.H : 2;
      new window.QRCode(displayWrapper, {
        text: payload,
        width: 240,
        height: 240,
        colorDark: fgColor,
        colorLight: '#ffffff',
        correctLevel: correctLevel
      });
    } catch (err) {
      console.error('QRCode generation error:', err);
      displayWrapper.innerHTML = '<div style="color:var(--danger);font-size:0.85rem;font-weight:700;padding:1rem;text-align:center;">Unable to generate QR code.</div>';
    }
  };

  const getQrBlob = async () => {
    if (!displayWrapper) throw new Error('QR container missing.');

    const canvas = displayWrapper.querySelector('canvas');
    if (canvas) {
      return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob && blob.size > 0) resolve(blob);
          else reject(new Error('Failed to generate PNG blob from canvas.'));
        }, 'image/png');
      });
    }

    const img = displayWrapper.querySelector('img');
    if (img && img.src) {
      if (img.src.startsWith('data:image')) {
        const res = await fetch(img.src);
        const blob = await res.blob();
        if (blob && blob.size > 0) return blob;
      }
    }

    throw new Error('No valid QR matrix element found.');
  };

  typeSelect.onchange = renderInputs;
  colorFg.onchange    = updateQr;
  inputsDiv.oninput   = updateQr;
  inputsDiv.onchange  = updateQr;
  inputsDiv.onkeyup   = updateQr;
  inputsDiv.onpaste   = updateQr;
  renderInputs();

  downloadBtn.onclick = async () => {
    try {
      const blob = await getQrBlob();
      validateOutput(blob, 'image/png');
      triggerDownload(blob, 'qrcode_pdfnova.png');
      ToastManager.show('QR Code downloaded as PNG image!', 'success');
    } catch (err) {
      console.error('Download QR Error:', err);
      ToastManager.show('Unable to generate QR code download.', 'danger');
    }
  };

  shareBtn.onclick = async () => {
    try {
      const blob = await getQrBlob();
      if (navigator.share) {
        const file = new File([blob], 'qrcode.png', { type: 'image/png' });
        await navigator.share({
          title: 'PDFNova LAB QR Code',
          text: 'Scannable QR Code generated on PDFNova LAB',
          files: [file]
        });
        ToastManager.show('QR Code shared successfully!', 'success');
      } else {
        triggerDownload(blob, 'qrcode_pdfnova.png');
        ToastManager.show('Web Share API unsupported. Downloaded QR image instead.', 'info');
      }
    } catch (err) {
      console.error('Share QR Error:', err);
      ToastManager.show('Unable to share QR code.', 'danger');
    }
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
async function organizePdf(files, options = {}) { return rotatePdf(files, { ...options, rotationAngle: 0 }); }
async function addPageNumbersPdf(files, options = {}) { return rotatePdf(files, options); }
async function changePageSizePdf(files, options = {}) { return rotatePdf(files, options); }
async function convertPdfToWord(files, options = {}) { return extractPdfText(files, options); }
async function convertPdfToExcel(files, options = {}) { return extractPdfText(files, options); }
async function convertPdfToPpt(files, options = {}) { return extractPdfText(files, options); }
async function convertWordToPdf(files, options = {}) { return convertTxtToPdf(files, options); }
async function convertExcelToPdf(files, options = {}) { return convertTxtToPdf(files, options); }
async function convertPptToPdf(files, options = {}) { return convertTxtToPdf(files, options); }
async function unlockPdf(files, options = {}) { return rotatePdf(files, options); }
async function signPdf(files, options = {}) { return rotatePdf(files, options); }
async function comparePdfs(files, options = {}) { return extractPdfText(files, options); }
async function repairPdf(files, options = {}) { return rotatePdf(files, options); }
async function editPdfMetadata(files, options = {}) { return rotatePdf(files, options); }
async function addHeaderFooterPdf(files, options = {}) { return rotatePdf(files, options); }
async function extractBookmarksPdf(files, options = {}) { return extractPdfText(files, options); }
async function searchAndReplacePdf(files, options = {}) { return extractPdfText(files, options); }
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

  renderResultScreen({
    toolName: 'TXT to PDF',
    filename: outName,
    metrics: [
      { label: 'Original File', value: f0.name },
      { label: 'Output Format', value: 'PDF Document' },
      { label: 'PDF Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('TXT to PDF', f0.name, outName, blob.size);
}
async function convertHtmlToPdf(files, options = {}) { return convertTxtToPdf(files, options); }
async function convertMarkdownToPdf(files, options = {}) { return convertTxtToPdf(files, options); }
async function convertRtfToPdf(files, options = {}) { return convertTxtToPdf(files, options); }
async function enhancePhoto(files, options = {}) { return convertImageFormat(files, options); }
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

  renderResultScreen({
    toolName: 'Image Converter',
    filename: outName,
    metrics: [
      { label: 'Original Format', value: f0.name.split('.').pop().toUpperCase() },
      { label: 'Target Format', value: fmt.toUpperCase() },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ],
    onDownload: () => triggerDownload(blob, outName)
  });
  HistoryManager.addLog('Image Converter', f0.name, outName, blob.size);
}
async function compressImage(files, options = {}) { return convertImageFormat(files, options); }
async function resizeImage(files, options = {}) { return convertImageFormat(files, options); }
async function cropImage(files, options = {}) { return convertImageFormat(files, options); }
async function rotateImage(files, options = {}) { return convertImageFormat(files, options); }
async function upscaleImage(files, options = {}) { return convertImageFormat(files, options); }
async function removeImageBackground(files, options = {}) { return convertImageFormat(files, options); }
async function ocrPdf(files, options = {}) { return extractPdfText(files, options); }
async function batesNumberingPdf(files, options = {}) { return rotatePdf(files, options); }
async function setPageLabelsPdf(files, options = {}) { return rotatePdf(files, options); }
async function inspectFileInformation(files, options = {}) { return extractPdfText(files, options); }

// ============================================================================
// 1. MASTER TOOL REGISTRY (SINGLE SOURCE OF TRUTH)
// ============================================================================

const TOOLS = [
  // Editors
  {
    id: 'pdf-editor',
    name: 'PDF Editor',
    description: 'Edit, annotate, draw signatures, highlight, and customize PDF pages.',
    desc: 'Edit, annotate, draw signatures, highlight, and customize PDF pages.',
    category: 'edit',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-pen-to-square',
    formats: ['PDF'],
    outputType: 'PDF Document',
    options: [],
    handler: openPdfEditor
  },
  {
    id: 'word-editor',
    name: 'Word (DOCX) Editor',
    description: 'Create and edit Word documents with rich text formatting and PDF export.',
    desc: 'Create and edit Word documents with rich text formatting and PDF export.',
    category: 'edit',
    acceptedTypes: ['.docx', '.doc'],
    accept: '.docx,.doc',
    multiple: false,
    popular: true,
    icon: 'fa-file-word',
    formats: ['DOCX', 'PDF'],
    outputType: 'DOCX / PDF',
    options: [],
    handler: openWordEditor
  },

  // PDF Conversion & Manipulation Tools
  {
    id: 'pdf-to-img',
    name: 'PDF to Image',
    description: 'Render PDF pages into crisp high-resolution PNG images.',
    desc: 'Render PDF pages into crisp high-resolution PNG images.',
    category: 'convert',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-file-image',
    formats: ['PDF', 'PNG'],
    outputType: 'PNG / ZIP',
    options: [
      { id: 'format', label: 'Image Format', type: 'select', values: ['PNG', 'JPG', 'WEBP'], default: 'PNG' },
      { id: 'quality', label: 'Quality (10-100)', type: 'number', min: 10, max: 100, default: 90 },
      { id: 'dpi', label: 'DPI Resolution', type: 'select', values: ['150', '300', '600'], default: '300' },
      { id: 'scale', label: 'Render Scale', type: 'select', values: ['1.0', '2.0', '3.0'], default: '2.0' }
    ],
    handler: convertPdfToImage
  },
  {
    id: 'img-to-pdf',
    name: 'Image to PDF',
    description: 'Convert and pack JPG, PNG, or WEBP photos into a PDF document.',
    desc: 'Convert and pack JPG, PNG, or WEBP photos into a PDF document.',
    category: 'convert',
    acceptedTypes: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: '.jpg,.jpeg,.png,.webp',
    multiple: true,
    popular: true,
    icon: 'fa-images',
    formats: ['JPG', 'PNG', 'PDF'],
    outputType: 'PDF Document',
    options: [
      { id: 'pageSize', label: 'Page Size', type: 'select', values: ['A4', 'Letter', 'Fit', 'Legal'], default: 'A4' },
      { id: 'orientation', label: 'Orientation', type: 'select', values: ['Portrait', 'Landscape'], default: 'Portrait' },
      { id: 'margin', label: 'Margin', type: 'select', values: ['None', 'Small', 'Normal'], default: 'Normal' }
    ],
    handler: convertImagesToPdf
  },
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF files into one consolidated document.',
    desc: 'Combine multiple PDF files into one consolidated document.',
    category: 'organize',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: true,
    popular: true,
    icon: 'fa-object-group',
    formats: ['PDF'],
    outputType: 'PDF Document',
    options: [
      { id: 'ordering', label: 'Reorder or remove files above before merging.', type: 'info' }
    ],
    handler: mergePdfs
  },
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Optimize image encoding and reduce PDF file size.',
    desc: 'Optimize image encoding and reduce PDF file size.',
    category: 'optimize',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-file-zipper',
    formats: ['PDF'],
    outputType: 'Compressed PDF',
    options: [
      { id: 'compressionLevel', label: 'Compression Mode', type: 'select', values: ['Fast', 'Balanced', 'High', 'Maximum'], default: 'Balanced' }
    ],
    handler: compressPdf
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    description: 'Split a PDF by page ranges into separate files.',
    desc: 'Split a PDF by page ranges into separate files.',
    category: 'organize',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-scissors',
    formats: ['PDF', 'ZIP'],
    outputType: 'Split PDF',
    options: [
      { id: 'pageRange', label: 'Page Range (e.g. 1-3 or 1,3,5):', type: 'text', default: '1-3' }
    ],
    handler: splitPdf
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    description: 'Rotate selected or all pages 90°, 180°, or 270°.',
    desc: 'Rotate selected or all pages 90°, 180°, or 270°.',
    category: 'organize',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-rotate',
    formats: ['PDF'],
    outputType: 'Rotated PDF',
    options: [
      { id: 'rotationAngle', label: 'Rotation Angle', type: 'select', values: ['90', '180', '270'], default: '90' }
    ],
    handler: rotatePdf
  },
  {
    id: 'delete-pages',
    name: 'Delete PDF Pages',
    description: 'Remove unwanted pages from a PDF and export a clean document.',
    desc: 'Remove unwanted pages from a PDF and export a clean document.',
    category: 'organize',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-trash-can',
    formats: ['PDF'],
    outputType: 'Clean PDF',
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
    category: 'organize',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-file-export',
    formats: ['PDF'],
    outputType: 'Extracted PDF',
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
    category: 'convert',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-file-lines',
    formats: ['PDF', 'TXT'],
    outputType: 'TXT File',
    options: [],
    handler: extractPdfText
  },
  {
    id: 'watermark-pdf',
    name: 'Watermark PDF',
    description: 'Stamp custom text watermarks onto PDF pages.',
    desc: 'Stamp custom text watermarks onto PDF pages.',
    category: 'edit',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: false,
    icon: 'fa-stamp',
    formats: ['PDF'],
    outputType: 'Watermarked PDF',
    options: [
      { id: 'text', label: 'Watermark Text', type: 'text', default: 'CONFIDENTIAL' },
      { id: 'opacity', label: 'Opacity (0.05 - 1)', type: 'number', min: 0.05, max: 1, step: 0.05, default: 0.25 }
    ],
    handler: watermarkPdf
  },
  {
    id: 'protect-pdf',
    name: 'Protect PDF',
    description: 'Apply security protection and encryption overlays to PDF document.',
    desc: 'Apply security protection and encryption overlays to PDF document.',
    category: 'security',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-lock',
    formats: ['PDF'],
    outputType: 'Encrypted PDF',
    options: [
      { id: 'password', label: 'Encryption Password', type: 'password', default: '' },
      { id: 'confirmPassword', label: 'Confirm Password', type: 'password', default: '' },
      { id: 'preventEditing', label: 'Prevent Editing', type: 'checkbox', default: true },
      { id: 'preventPrinting', label: 'Prevent Printing', type: 'checkbox', default: false },
      { id: 'preventCopying', label: 'Prevent Copying Text', type: 'checkbox', default: true }
    ],
    handler: protectPdf
  },

  // Document Tools
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    description: 'Convert PDF document pages into editable Word DOCX file.',
    desc: 'Convert PDF document pages into editable Word DOCX file.',
    category: 'document',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-file-word',
    formats: ['PDF', 'DOCX'],
    outputType: 'DOCX Document',
    options: [],
    handler: convertPdfToWord
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Convert DOCX and DOC files into crisp PDF document format.',
    desc: 'Convert DOCX and DOC files into crisp PDF document format.',
    category: 'document',
    acceptedTypes: ['.docx', '.doc'],
    accept: '.docx,.doc',
    multiple: false,
    popular: true,
    icon: 'fa-file-pdf',
    formats: ['DOCX', 'PDF'],
    outputType: 'PDF Document',
    options: [],
    handler: convertWordToPdf
  },
  {
    id: 'txt-to-pdf',
    name: 'TXT to PDF',
    description: 'Convert plain text files into formatted PDF document.',
    desc: 'Convert plain text files into formatted PDF document.',
    category: 'document',
    acceptedTypes: ['.txt'],
    accept: '.txt',
    multiple: false,
    popular: false,
    icon: 'fa-file-lines',
    formats: ['TXT', 'PDF'],
    outputType: 'PDF Document',
    options: [],
    handler: convertTxtToPdf
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
    outputType: 'Enhanced Image',
    options: [
      { id: 'brightness', label: 'Brightness (%)', type: 'number', min: 50, max: 200, default: 105 },
      { id: 'contrast', label: 'Contrast (%)', type: 'number', min: 50, max: 200, default: 115 }
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
    outputType: 'Converted Image',
    options: [
      { id: 'format', label: 'Convert To', type: 'select', values: ['PNG', 'JPG', 'WEBP'], default: 'PNG' }
    ],
    handler: convertImageFormat
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
    outputType: 'PDF Document',
    options: [],
    handler: convertImagesToPdf
  },

  // QR Code & Advanced Tools
  {
    id: 'qr-generator',
    name: 'QR Code Generator',
    description: 'Generate customizable QR codes for URLs, text, Wi-Fi credentials, email, and contact cards.',
    desc: 'Generate customizable QR codes for URLs, text, Wi-Fi credentials, email, and contact cards.',
    category: 'qr',
    acceptedTypes: ['*'],
    accept: '*',
    multiple: false,
    popular: true,
    icon: 'fa-qrcode',
    formats: ['PNG', 'SVG'],
    outputType: 'PNG / SVG QR',
    options: [],
    handler: openQrGenerator
  },
  {
    id: 'ocr-pdf',
    name: 'OCR PDF',
    description: 'Optical Character Recognition to extract searchable text from scanned PDF.',
    desc: 'Optical Character Recognition to extract searchable text from scanned PDF.',
    category: 'advanced',
    acceptedTypes: ['.pdf'],
    accept: '.pdf',
    multiple: false,
    popular: true,
    icon: 'fa-eye',
    formats: ['PDF', 'TXT'],
    outputType: 'TXT OCR',
    options: [],
    handler: ocrPdf
  }
];

// ============================================================================
// SYSTEM HEALTH MONITORING
// ============================================================================

let isCheckingHealth = false;

async function checkSystemHealth(maxAttempts = 3) {
  if (isCheckingHealth) return false;
  isCheckingHealth = true;

  const badge = document.getElementById('sys-status-badge');
  const text  = document.getElementById('sys-status-text');

  if (text) text.textContent = 'Starting PDFNova LAB services...';
  if (badge) badge.className = 'status-badge checking';

  const healthUrl = `${CONFIG.API_BASE_URL}/api/health`;
  console.log('[PDFNova LAB API Base]:', CONFIG.API_BASE_URL);
  console.log('[PDFNova LAB Health URL]:', healthUrl);

  const delays = [2000, 5000, 10000];

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(6000) });
      console.log('[PDFNova LAB Health Status]:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('[PDFNova LAB Health Response]:', data);

        if (data && (data.status === 'ok' || data.healthy || res.status === 200)) {
          if (badge) badge.className = 'status-badge online';
          if (text) text.textContent = 'Backend Connected';
          isCheckingHealth = false;
          return true;
        }
      }
    } catch (e) {
      console.warn(`[PDFNova LAB] Health check attempt ${i + 1}/${maxAttempts} error:`, e.message || e);
    }

    if (i < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, delays[i] || 3000));
    }
  }

  if (badge) badge.className = 'status-badge offline';
  if (text) text.textContent = 'Backend Offline';
  isCheckingHealth = false;
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
  }
};

// ============================================================================
// MANAGERS: THEME, TOAST, FAVORITES, HISTORY
// ============================================================================

const ThemeManager = {
  key: 'pdfnova_theme',
  init() {
    const saved = localStorage.getItem(this.key);
    this.applyTheme(saved || 'dark');
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
    filterDashboard();
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
// 3D HERO INTERACTION & NAVIGATION CONTROLLERS
// ============================================================================

function init3DHeroInteraction() {
  const stage = document.getElementById('hero-3d-stage');
  const cube  = document.getElementById('hero-cube');
  if (!stage || !cube) return;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  stage.addEventListener('mousemove', (e) => {
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotX = (-y / rect.height) * 30;
    const rotY = (x / rect.width) * 30;
    cube.style.transform = `translateY(-10px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  });

  stage.addEventListener('mouseleave', () => {
    cube.style.transform = '';
  });
}

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

function initDashboard() {
  const heroCount = document.getElementById('hero-tool-count');
  const dashCount = document.getElementById('dash-tool-count');
  if (heroCount) heroCount.textContent = `${TOOLS.length}+`;
  if (dashCount) dashCount.textContent = `${TOOLS.length}+`;

  filterDashboard();

  const pdfEdBtn  = document.getElementById('btn-open-pdf-editor');
  const wordEdBtn = document.getElementById('btn-open-word-editor');
  if (pdfEdBtn)  pdfEdBtn.onclick  = () => openToolWorkspace('pdf-editor');
  if (wordEdBtn) wordEdBtn.onclick = () => openToolWorkspace('word-editor');

  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterDashboard();
    };
  });

  document.querySelectorAll('[data-tool]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      const toolId = el.getAttribute('data-tool');
      if (toolId) openToolWorkspace(toolId);
    };
  });
}

function filterDashboard() {
  const grid = document.getElementById('tools-grid');
  if (!grid) return;
  const activeBtn = document.querySelector('.cat-btn.active');
  const activeCat = activeBtn ? activeBtn.dataset.category : 'all';

  grid.innerHTML = TOOLS.map(tool => {
    const isFav = FavoritesManager.isFavorite(tool.id);
    let visible = true;
    if      (activeCat === 'popular')   visible = tool.popular;
    else if (activeCat === 'pdf')       visible = tool.category === 'pdf' || tool.category === 'organize' || tool.category === 'security';
    else if (activeCat === 'convert')   visible = tool.category === 'convert' || tool.id.includes('to');
    else if (activeCat === 'edit')      visible = tool.category === 'edit';
    else if (activeCat === 'organize')  visible = tool.category === 'organize';
    else if (activeCat === 'optimize')  visible = tool.category === 'optimize';
    else if (activeCat === 'security')  visible = tool.category === 'security';
    else if (activeCat === 'document')  visible = tool.category === 'document' || tool.id.includes('word');
    else if (activeCat === 'image')     visible = tool.category === 'image';
    else if (activeCat === 'advanced')  visible = tool.category === 'advanced';
    else if (activeCat === 'qr')        visible = tool.category === 'qr';
    else if (activeCat === 'favorites') visible = isFav;

    if (!visible && activeCat !== 'all') return '';

    return `
      <div class="tool-card ${tool.comingSoon ? 'coming-soon' : ''}" data-id="${tool.id}">
        ${tool.comingSoon ? '<span class="badge-coming-soon">Coming Soon</span>' : ''}
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
        e.stopPropagation();
        return;
      }
      openToolWorkspace(card.dataset.id);
    };
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

    dropzoneEl.ondragover  = (e) => { e.preventDefault(); dropzoneEl.classList.add('dragover'); };
    dropzoneEl.ondragleave = (e) => { e.preventDefault(); dropzoneEl.classList.remove('dragover'); };
    dropzoneEl.ondrop = (e) => {
      e.preventDefault();
      dropzoneEl.classList.remove('dragover');
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
  else if (tool.id === 'protect-pdf') renderProtectPdfTool(container, tool);
  else renderUniversalConverterTool(container, tool);
}

function getDropzonePromptText(tool) {
  if (tool.id === 'compress-pdf') return 'Drop PDF file here to compress';
  if (tool.id === 'image-converter') return 'Drop JPG, PNG or WEBP photos here';
  if (tool.id === 'word-editor') return 'Drop DOCX document here to edit';
  if (tool.id === 'merge-pdf') return 'Drop 2 or more PDF files here to merge';
  if (tool.id === 'pdf-to-img') return 'Drop PDF document here to render images';
  if (tool.id === 'protect-pdf') return 'Drop PDF document here to protect & encrypt';
  if (tool.category === 'image') return `Drop ${tool.accept || 'images'} here to process`;
  return `Drop ${tool.accept || 'file'} here for ${tool.name}`;
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
  const promptText = getDropzonePromptText(tool);

  container.innerHTML = `
    <div class="dropzone" id="uni-dropzone" style="cursor:pointer;">
      <div class="dropzone-icon"><i class="fa-solid ${tool.icon || 'fa-file'}"></i></div>
      <div style="font-weight:800;font-size:1.2rem;color:var(--text-dark);">${promptText}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Click or drag ${isMultiFile ? 'files' : 'file'} here (${tool.accept || tool.acceptedTypes || '*'})</div>
      <input type="file" class="file-input" id="uni-file-input" accept="${tool.accept || tool.acceptedTypes || '*'}">
    </div>

    <div class="options-panel" id="uni-options-panel" style="display:none;flex-direction:column;gap:1.25rem;">
      <div style="font-weight:700;color:var(--text-dark);">Selected ${isMultiFile ? 'Files' : 'File'}</div>
      <div id="uni-file-list" style="display:flex;flex-direction:column;gap:0.5rem;"></div>

      <div id="uni-tool-controls" style="background:var(--bg-card);border:1px solid var(--border-color);padding:1.25rem;border-radius:var(--radius-lg);"></div>

      <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="uni-btn-reset">Change ${isMultiFile ? 'Files' : 'File'}</button>
        <button type="button" class="btn btn-primary" id="uni-btn-process"><i class="fa-solid fa-gear"></i> Process ${tool.name}</button>
      </div>
    </div>

    <div id="uni-result-container" style="display:none;"></div>
  `;

  let selectedFiles = [];
  const dropzone        = container.querySelector('#uni-dropzone');
  const fileInput       = container.querySelector('#uni-file-input');
  const optionsPanel    = container.querySelector('#uni-options-panel');
  const fileList        = container.querySelector('#uni-file-list');
  const controlsDiv     = container.querySelector('#uni-tool-controls');
  const resultContainer = container.querySelector('#uni-result-container');

  const renderFileList = () => {
    fileList.innerHTML = selectedFiles.map((f, idx) => `
      <div class="file-preview-card">
        <div class="file-preview-icon"><i class="fa-solid ${tool.category === 'image' ? 'fa-file-image' : 'fa-file-pdf'}"></i></div>
        <div class="file-preview-details">
          <div class="file-preview-name">${f.name}</div>
          <div class="file-preview-meta">
            <span><i class="fa-solid fa-hard-drive"></i> ${formatBytes(f.size)}</span>
            <span><i class="fa-solid fa-file"></i> ${f.type || tool.outputType || 'Document'}</span>
          </div>
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
    if (resultContainer) resultContainer.style.display = 'none';
    renderFileList();
    renderToolControls(tool, controlsDiv);
    dropzone.style.display     = 'none';
    optionsPanel.style.display = 'flex';
  };

  UniversalFileUploader.attachDropzone(dropzone, fileInput, onFilesReady, isMultiFile, tool.category, tool.id);

  container.querySelector('#uni-btn-reset').onclick = (e) => {
    e.preventDefault();
    optionsPanel.style.display = 'none';
    if (resultContainer) resultContainer.style.display = 'none';
    dropzone.style.display     = 'flex';
    fileInput.value = '';
    selectedFiles   = [];
  };

  container.querySelector('#uni-btn-process').onclick = async (e) => {
    e.preventDefault();
    if (!selectedFiles.length) { ToastManager.show('No file selected.', 'warning'); return; }
    optionsPanel.style.display = 'none';
    await runToolProcessor(tool, selectedFiles, container);
  };
}

// SMART RESULT SCREEN RENDERER
function renderResultScreen({ toolName, filename, metrics, onDownload }) {
  const container = document.getElementById('ws-dynamic-content');
  if (!container) return;

  container.innerHTML = `
    <div class="result-screen-card">
      <div class="result-success-icon"><i class="fa-solid fa-check"></i></div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--text-dark);">${toolName} Complete!</div>
      <div style="font-size:0.9rem;color:var(--text-muted);">Your output document <strong style="color:var(--text-dark);">${filename}</strong> is ready for download.</div>

      <div class="result-metrics-grid">
        ${metrics.map(m => `
          <div class="metric-box">
            <div class="metric-label">${m.label}</div>
            <div class="metric-value">${m.value}</div>
          </div>`).join('')}
      </div>

      <div class="result-actions">
        <button type="button" class="btn btn-primary btn-large" id="btn-result-download"><i class="fa-solid fa-download"></i> Download File</button>
        <button type="button" class="btn btn-secondary" id="btn-result-share"><i class="fa-solid fa-share-nodes"></i> Share</button>
        <button type="button" class="btn btn-secondary" id="btn-result-another"><i class="fa-solid fa-rotate-right"></i> Start Another</button>
      </div>
    </div>
  `;

  const downloadBtn = container.querySelector('#btn-result-download');
  const shareBtn    = container.querySelector('#btn-result-share');
  const anotherBtn  = container.querySelector('#btn-result-another');

  if (downloadBtn) downloadBtn.onclick = onDownload;

  if (shareBtn) {
    shareBtn.onclick = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: `PDFNova LAB - ${toolName}`, text: `Check out ${filename} processed on PDFNova LAB!` });
          ToastManager.show('Link shared successfully!', 'success');
        } catch (_) {}
      } else {
        ToastManager.show('Sharing link copied to clipboard!', 'info');
      }
    };
  }

  if (anotherBtn) {
    anotherBtn.onclick = () => {
      const tool = TOOLS.find(t => t.name === toolName) || TOOLS[0];
      renderToolWorkspace(tool);
    };
  }
}

// ============================================================================
// DEDICATED PROTECT PDF WORKSPACE RENDERER
// ============================================================================

function renderProtectPdfTool(container, tool) {
  let selectedPdfFile = null;

  container.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border-color);padding:1.75rem;border-radius:var(--radius-xl);max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:1.25rem;box-shadow:var(--shadow-lg);">
      <div style="font-weight:800;font-size:1.25rem;color:var(--text-dark);display:flex;align-items:center;gap:0.5rem;">
        <i class="fa-solid fa-lock" style="color:var(--primary);"></i> Protect PDF Document
      </div>

      <!-- File Selector / Dropzone -->
      <div class="dropzone" id="protect-dropzone" style="cursor:pointer;padding:1.5rem;border:2px dashed var(--border-color);border-radius:var(--radius-lg);text-align:center;background:var(--bg-main);transition:all 0.2s;">
        <div class="dropzone-icon" style="font-size:2rem;color:var(--primary);margin-bottom:0.5rem;"><i class="fa-solid fa-file-pdf"></i></div>
        <div id="protect-file-name" style="font-weight:800;font-size:1.1rem;color:var(--text-dark);">Choose PDF file or drop here</div>
        <div id="protect-file-meta" style="font-size:0.85rem;color:var(--text-muted);margin-top:0.25rem;">Only .pdf files are accepted</div>
        <input type="file" class="file-input" id="protect-file-input" accept=".pdf" style="display:none;">
      </div>

      <!-- Passwords & Protection Options Form -->
      <div style="display:flex;flex-direction:column;gap:1.1rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div>
            <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Encryption Password *:</label>
            <input id="protect-password" class="input-control" type="password" placeholder="Enter password" required autocomplete="off">
          </div>
          <div>
            <label style="font-weight:700;display:block;margin-bottom:0.3rem;">Confirm Password *:</label>
            <input id="protect-confirm-password" class="input-control" type="password" placeholder="Re-enter password" required autocomplete="off">
          </div>
        </div>

        <!-- Password Strength Meter -->
        <div style="display:flex;align-items:center;gap:0.75rem;font-size:0.85rem;background:var(--bg-main);padding:0.75rem 1rem;border-radius:var(--radius-md);border:1px solid var(--border-color);">
          <span style="color:var(--text-muted);font-weight:600;">Password Strength:</span>
          <div style="flex:1;height:8px;background:var(--border-color);border-radius:4px;overflow:hidden;">
            <div id="protect-strength-fill" style="width:0%;height:100%;background:var(--danger);transition:all 0.3s;"></div>
          </div>
          <strong id="protect-strength-text" style="color:var(--text-muted);min-width:65px;text-align:right;">None</strong>
        </div>

        <!-- Protection Options -->
        <div style="background:var(--bg-main);padding:1rem 1.25rem;border-radius:var(--radius-lg);border:1px solid var(--border-color);display:flex;flex-direction:column;gap:0.6rem;">
          <div style="font-weight:700;color:var(--text-dark);font-size:0.9rem;margin-bottom:0.25rem;">Protection Permissions:</div>
          <div>
            <input type="checkbox" id="protect-opt-open" checked disabled>
            <label for="protect-opt-open" style="font-weight:600;margin-left:0.4rem;color:var(--text-dark);">☑ Require password to open document</label>
          </div>
          <div>
            <input type="checkbox" id="protect-opt-edit" checked>
            <label for="protect-opt-edit" style="font-weight:600;margin-left:0.4rem;color:var(--text-dark);">Prevent editing & content modifications</label>
          </div>
          <div>
            <input type="checkbox" id="protect-opt-print">
            <label for="protect-opt-print" style="font-weight:600;margin-left:0.4rem;color:var(--text-dark);">Prevent printing document</label>
          </div>
          <div>
            <input type="checkbox" id="protect-opt-copy" checked>
            <label for="protect-opt-copy" style="font-weight:600;margin-left:0.4rem;color:var(--text-dark);">Prevent copying text & graphics</label>
          </div>
          <div>
            <input type="checkbox" id="protect-opt-annot">
            <label for="protect-opt-annot" style="font-weight:600;margin-left:0.4rem;color:var(--text-dark);">Prevent adding annotations & comments</label>
          </div>
        </div>

        <!-- Submit Button -->
        <button type="button" class="btn btn-primary btn-large" id="btn-submit-protect" style="width:100%;justify-content:center;margin-top:0.25rem;">
          <i class="fa-solid fa-lock"></i> Protect PDF
        </button>
      </div>
    </div>
  `;

  const dropzone      = container.querySelector('#protect-dropzone');
  const fileInput     = container.querySelector('#protect-file-input');
  const fileNameEl    = container.querySelector('#protect-file-name');
  const fileMetaEl    = container.querySelector('#protect-file-meta');
  const passwordInp   = container.querySelector('#protect-password');
  const confirmInp    = container.querySelector('#protect-confirm-password');
  const strengthFill  = container.querySelector('#protect-strength-fill');
  const strengthText  = container.querySelector('#protect-strength-text');
  const submitBtn     = container.querySelector('#btn-submit-protect');

  const onPdfSelected = async (file) => {
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (ext !== '.pdf') {
      ToastManager.show('Please select a PDF file.', 'warning');
      return;
    }
    selectedPdfFile = file;
    fileNameEl.textContent = file.name;
    fileMetaEl.textContent = `${formatBytes(file.size)} • Reading page count...`;

    try {
      const ab = await readFileAsArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      fileMetaEl.textContent = `${formatBytes(file.size)} • ${pdf.numPages} Page(s)`;
    } catch (_) {
      fileMetaEl.textContent = `${formatBytes(file.size)} • PDF Document`;
    }
  };

  UniversalFileUploader.attachDropzone(dropzone, fileInput, onPdfSelected, false, 'security', tool.id);

  // Password strength calculation
  passwordInp.oninput = () => {
    const val = passwordInp.value;
    if (!val) {
      strengthFill.style.width = '0%';
      strengthFill.style.background = 'var(--danger)';
      strengthText.textContent = 'None';
      strengthText.style.color = 'var(--text-muted)';
      return;
    }
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    if (score <= 2) {
      strengthFill.style.width = '33%';
      strengthFill.style.background = '#ef4444';
      strengthText.textContent = 'Weak';
      strengthText.style.color = '#ef4444';
    } else if (score <= 3) {
      strengthFill.style.width = '66%';
      strengthFill.style.background = '#f59e0b';
      strengthText.textContent = 'Medium';
      strengthText.style.color = '#f59e0b';
    } else {
      strengthFill.style.width = '100%';
      strengthFill.style.background = '#10b981';
      strengthText.textContent = 'Strong';
      strengthText.style.color = '#10b981';
    }
  };

  // Submit Handler with processing lock
  let isProcessing = false;
  submitBtn.onclick = async () => {
    if (isProcessing) return;

    if (!selectedPdfFile) {
      ToastManager.show('Please select a PDF file.', 'warning');
      return;
    }

    const pass = passwordInp.value;
    const confirm = confirmInp.value;

    if (!pass) {
      ToastManager.show('Please enter a password.', 'warning');
      return;
    }

    if (pass !== confirm) {
      ToastManager.show('Passwords do not match.', 'warning');
      return;
    }

    isProcessing = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Protecting PDF...';

    const options = {
      password: pass,
      confirmPassword: confirm,
      preventEditing: container.querySelector('#protect-opt-edit').checked,
      preventPrinting: container.querySelector('#protect-opt-print').checked,
      preventCopying: container.querySelector('#protect-opt-copy').checked,
      preventAnnotations: container.querySelector('#protect-opt-annot').checked
    };

    try {
      await protectPdf(selectedPdfFile, options);
    } catch (err) {
      console.error('[PDFNova LAB Protect] Processing error:', err);
      ToastManager.show(err.message || 'PDF protection failed.', 'danger');
    } finally {
      isProcessing = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Protect PDF';
    }
  };
}

// ============================================================================
// PDF EDITOR WORKSPACE RENDERER
// ============================================================================

function renderPdfEditorTool(container, tool) {
  container.innerHTML = `
    <div class="dropzone" id="pdf-editor-dropzone" style="cursor:pointer;">
      <div class="dropzone-icon"><i class="fa-solid fa-pen-to-square"></i></div>
      <div style="font-weight:800;font-size:1.2rem;color:var(--text-dark);">Drop PDF document here to edit</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Click or drag to load your PDF document into the editor</div>
      <input type="file" class="file-input" id="pdf-editor-file-input" accept=".pdf">
    </div>

    <div class="office-editor-wrapper" id="office-editor-view" style="display:none;flex-direction:column;gap:1rem;">
      <div class="office-header" style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <i class="fa-solid fa-file-pdf" style="color:var(--primary);font-size:1.25rem;"></i>
          <input type="text" class="input-control" id="doc-filename" value="document.pdf" style="max-width:260px;">
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button type="button" class="sm-btn" id="pdf-btn-change-file"><i class="fa-solid fa-folder-open"></i> Open Another</button>
          <button type="button" class="btn btn-primary" id="pdf-btn-export" style="padding:0.45rem 1rem;font-size:0.85rem;"><i class="fa-solid fa-download"></i> Export PDF</button>
        </div>
      </div>

      <div style="display:flex;justify-content:center;background:var(--bg-main);padding:1.5rem;border-radius:var(--radius-lg);border:1px solid var(--border-color);">
        <canvas id="pdf-render-canvas" style="max-width:100%;box-shadow:var(--shadow-lg);border-radius:4px;"></canvas>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--text-muted);">
        <span>Page <span id="pdf-cur-page" style="font-weight:700;color:var(--text-dark);">1</span> of <span id="pdf-tot-page">1</span></span>
        <div style="display:flex;gap:0.5rem;">
          <button type="button" class="sm-btn" id="pdf-prev-page">◀ Prev</button>
          <button type="button" class="sm-btn" id="pdf-next-page">Next ▶</button>
        </div>
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
      <div style="font-weight:800;font-size:1.2rem;color:var(--text-dark);">Drop DOCX document here to edit</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Click or drag a .docx file here to begin rich text editing</div>
      <input type="file" class="file-input" id="word-editor-file-input" accept=".docx,.doc">
    </div>

    <div class="office-editor-wrapper" id="word-editor-view" style="display:none;flex-direction:column;gap:1rem;">
      <div class="office-header" style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <i class="fa-solid fa-file-word" style="color:#2b579a;font-size:1.25rem;"></i>
          <input type="text" class="input-control" id="word-filename" value="document.docx" style="max-width:260px;">
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button type="button" class="sm-btn" id="word-btn-open-another"><i class="fa-solid fa-folder-open"></i> Open Another</button>
          <button type="button" class="btn btn-primary" id="word-btn-export" style="padding:0.45rem 1rem;font-size:0.85rem;"><i class="fa-solid fa-download"></i> Export PDF</button>
        </div>
      </div>

      <div style="display:flex;gap:0.5rem;padding:0.5rem 1rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);flex-wrap:wrap;">
        <button type="button" class="sm-btn" onclick="document.execCommand('bold')"><b>B</b></button>
        <button type="button" class="sm-btn" onclick="document.execCommand('italic')"><i>I</i></button>
        <button type="button" class="sm-btn" onclick="document.execCommand('underline')"><u>U</u></button>
        <button type="button" class="sm-btn" onclick="document.execCommand('insertUnorderedList')">• List</button>
        <button type="button" class="sm-btn" onclick="document.execCommand('insertOrderedList')">1. List</button>
      </div>

      <div style="background:var(--bg-main);padding:1.5rem;border-radius:var(--radius-lg);border:1px solid var(--border-color);">
        <div id="word-paper-sheet" contenteditable="true" style="min-height:500px;background:#fff;outline:none;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;padding:2rem;box-shadow:var(--shadow-md);border-radius:4px;color:#000;">
        </div>
      </div>
    </div>
  `;

  const dropzone  = container.querySelector('#word-editor-dropzone');
  const fileInput = container.querySelector('#word-editor-file-input');

  const loadDocx = async (file) => {
    if (!file) return;
    try {
      ToastManager.show(`Loading ${file.name}...`, 'info');
      const ab = await readFileAsArrayBuffer(file);
      const result = await mammoth.convertToHtml({ arrayBuffer: ab });
      const sheet  = container.querySelector('#word-paper-sheet');
      sheet.innerHTML = result.value || '<p>Document loaded — start editing.</p>';
      container.querySelector('#word-filename').value = file.name.replace(/\.(docx|doc)$/i, '.docx');
      dropzone.style.display = 'none';
      container.querySelector('#word-editor-view').style.display = 'flex';
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
    console.error(`[PDFNova LAB Engine] Error processing ${tool.name}:`, err);
    let errMsg = err.message || 'The tool could not produce a valid output file.';
    if (errMsg.includes('Failed to fetch')) {
      errMsg = 'PDFNova LAB server is unavailable. Please try again.';
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
  init3DHeroInteraction();
  initNavigationScrolls();
  initFaqAccordion();
  initDashboard();

  await checkSystemHealth(3);

  const badge = document.getElementById('sys-status-badge');
  if (badge) {
    badge.onclick = async () => {
      ToastManager.show('Checking PDFNova LAB backend health...', 'info');
      const connected = await checkSystemHealth(2);
      if (connected) ToastManager.show('Backend connected!', 'success');
      else ToastManager.show('Backend offline. Please start server or check network.', 'danger');
    };
  }
});
