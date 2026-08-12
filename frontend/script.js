// VibeDownloader Frontend Script
// Handles backend communication, URL parsing, and real-time stream progress tracking.

const API_BASE = "http://localhost:8000";

// State
let videoMetadata = null;
let selectedFormat = "mp4";
let selectedQuality = "best";

// DOM Elements
const urlInput = document.getElementById("video-url");
const btnAnalyze = document.getElementById("btn-analyze");
const ffmpegStatus = document.getElementById("ffmpeg-status");
const platformTags = document.querySelectorAll(".platform-tag");

const loadingFetch = document.getElementById("loading-fetch");
const resultSection = document.getElementById("result-section");

const resThumbnail = document.getElementById("res-thumbnail");
const resDuration = document.getElementById("res-duration");
const resPlatformBadge = document.getElementById("res-platform-badge");
const resTitle = document.getElementById("res-title");

const formatContainer = document.getElementById("format-container");
const qualityContainer = document.getElementById("quality-container");
const btnDownload = document.getElementById("btn-download");

const progressContainer = document.getElementById("progress-container");
const progressFill = document.getElementById("progress-fill");
const progressStatus = document.getElementById("progress-status");
const progressStats = document.getElementById("progress-stats");
const toastContainer = document.getElementById("toast-container");

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  checkBackendHealth();
  // Check health periodically every 15 seconds
  setInterval(checkBackendHealth, 15000);
});

// Detect platform as the user types
urlInput.addEventListener("input", (e) => {
  const url = e.target.value.trim().toLowerCase();
  
  // Reset all badges first
  platformTags.forEach(tag => tag.classList.remove("active"));
  
  if (!url) return;
  
  let activePlatform = null;
  if (url.includes("youtube.com") || url.includes("youtu.be")) activePlatform = "youtube";
  else if (url.includes("instagram.com")) activePlatform = "instagram";
  else if (url.includes("tiktok.com")) activePlatform = "tiktok";
  else if (url.includes("facebook.com") || url.includes("fb.watch")) activePlatform = "facebook";
  else if (url.includes("twitter.com") || url.includes("x.com")) activePlatform = "twitter";
  else if (url.includes("vimeo.com")) activePlatform = "vimeo";
  
  if (activePlatform) {
    const badge = document.querySelector(`.platform-tag[data-domain="${activePlatform}"]`);
    if (badge) badge.classList.add("active");
  }
});

// Toast system
function showToast(title, message, type = "error") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icon = type === "success" ? "fa-circle-check" : "fa-triangle-exclamation";
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fa-solid ${icon}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Close action
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => toast.remove());
  
  // Auto remove
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = "toastSlideIn 0.35s reverse forwards";
      setTimeout(() => toast.remove(), 350);
    }
  }, 5000);
}

// Convert seconds to readable duration (MM:SS or HH:MM:SS)
function formatDuration(secs) {
  if (!secs) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  
  const pad = (n) => String(n).padStart(2, "0");
  
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

// Format byte counts into KB, MB etc.
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Check if backend is alive
async function checkBackendHealth() {
  try {
    const start = Date.now();
    const res = await fetch(`${API_BASE}/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "" })
    });
    
    // We expect a 400 response because url is blank, but it means server is up!
    if (res.status === 400 || res.ok) {
      ffmpegStatus.className = "header-status online";
      ffmpegStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Server Connected`;
    } else {
      throw new Error();
    }
  } catch (e) {
    ffmpegStatus.className = "header-status offline";
    ffmpegStatus.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Server Offline`;
  }
}

// --- FETCH VIDEO METADATA ---
btnAnalyze.addEventListener("click", handleAnalyze);
urlInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleAnalyze();
});

async function handleAnalyze() {
  const url = urlInput.value.trim();
  if (!url) {
    showToast("Input Empty", "Please paste a video link first.");
    return;
  }
  
  // Hide results, show loading spinner
  resultSection.style.display = "none";
  loadingFetch.style.display = "flex";
  btnAnalyze.disabled = true;
  
  try {
    const response = await fetch(`${API_BASE}/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || "Server failed to fetch metadata.");
    }
    
    videoMetadata = data;
    
    // Update FFmpeg warning
    if (!data.ffmpeg_installed) {
      showToast(
        "Ffmpeg Missing", 
        "Note: FFmpeg is not installed on the server. Audio conversions/merges might fail or use fallbacks.",
        "success"
      );
    }
    
    renderVideoResult(data);
  } catch (err) {
    console.error(err);
    showToast("Fetch Error", err.message || "Failed to contact downloader server.");
    resultSection.style.display = "none";
  } finally {
    loadingFetch.style.display = "none";
    btnAnalyze.disabled = false;
  }
}

function renderVideoResult(meta) {
  // Update texts
  resTitle.textContent = meta.title;
  resDuration.textContent = formatDuration(meta.duration);
  resThumbnail.src = meta.thumbnail || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=340&auto=format&fit=crop";
  
  // Setup Platform Badge
  const platformName = meta.platform.charAt(0).toUpperCase() + meta.platform.slice(1);
  let platformIconClass = "fa-brands fa-youtube";
  if (meta.platform === "instagram") platformIconClass = "fa-brands fa-instagram";
  else if (meta.platform === "tiktok") platformIconClass = "fa-solid fa-music";
  else if (meta.platform === "facebook") platformIconClass = "fa-brands fa-facebook";
  else if (meta.platform === "twitter") platformIconClass = "fa-brands fa-x-twitter";
  else if (meta.platform === "vimeo") platformIconClass = "fa-brands fa-vimeo-v";
  else if (meta.platform === "generic") platformIconClass = "fa-solid fa-globe";
  
  resPlatformBadge.innerHTML = `<i class="${platformIconClass}"></i> ${platformName}`;
  
  // Reset format selectors
  selectedFormat = "mp4";
  selectedQuality = "best";
  
  // Render format chips
  updateFormatChips();
  updateQualityChips();
  
  // Reset download button
  btnDownload.disabled = false;
  btnDownload.innerHTML = `<i class="fa-solid fa-arrow-down-to-bracket"></i> Download Now`;
  progressContainer.style.display = "none";
  
  // Show Section
  resultSection.style.display = "block";
  resultSection.scrollIntoView({ behavior: "smooth" });
}

function updateFormatChips() {
  const formats = ["mp4", "webm", "mp3", "m4a"];
  formatContainer.innerHTML = formats.map(f => {
    const icon = f === "mp3" || f === "m4a" ? '<i class="fa-solid fa-music"></i>' : '<i class="fa-solid fa-video"></i>';
    const activeClass = f === selectedFormat ? "active" : "";
    return `
      <button class="chip ${activeClass}" onclick="selectFormat('${f}')">
        ${icon} ${f.toUpperCase()}
      </button>
    `;
  }).join("");
}

window.selectFormat = function(format) {
  selectedFormat = format;
  updateFormatChips();
  
  // If format is audio, force quality to 'audio'
  if (format === "mp3" || format === "m4a") {
    selectedQuality = "audio";
  } else {
    // If returning back to video from audio, reset to best
    if (selectedQuality === "audio") {
      selectedQuality = "best";
    }
  }
  updateQualityChips();
};

function updateQualityChips() {
  const isAudio = selectedFormat === "mp3" || selectedFormat === "m4a";
  
  if (isAudio) {
    qualityContainer.innerHTML = `
      <button class="chip active" data-quality="audio">
        <i class="fa-solid fa-headphones"></i> Audio Only (192kbps)
      </button>
    `;
  } else {
    const qualities = [
      { id: "best", label: "Best Available" },
      { id: "1080p", label: "1080p (Full HD)" },
      { id: "720p", label: "720p (HD)" },
      { id: "360p", label: "360p (SD)" }
    ];
    
    qualityContainer.innerHTML = qualities.map(q => {
      const activeClass = q.id === selectedQuality ? "active" : "";
      return `
        <button class="chip ${activeClass}" onclick="selectQuality('${q.id}')">
          ${q.label}
        </button>
      `;
    }).join("");
  }
}

window.selectQuality = function(quality) {
  selectedQuality = quality;
  updateQualityChips();
};


// --- DOWNLOAD TRIGGERS (STREAMING READER) ---
btnDownload.addEventListener("click", async () => {
  if (!videoMetadata) return;
  
  const url = urlInput.value.trim();
  const format = selectedFormat;
  const quality = selectedQuality;
  
  btnDownload.disabled = true;
  btnDownload.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing on Server...`;
  
  progressContainer.style.display = "block";
  progressFill.style.width = "0%";
  progressStatus.textContent = "Requesting download task...";
  progressStats.textContent = "Preparing file...";
  
  try {
    const isAudioOnlyEndpoint = format === "mp3";
    const endpoint = isAudioOnlyEndpoint ? "audio" : "download";
    
    // Body construction
    const bodyObj = isAudioOnlyEndpoint ? { url: url } : { url: url, format: format, quality: quality };
    
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj)
    });
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Server downloader encountered an error.");
    }
    
    progressStatus.textContent = "Downloading to browser...";
    
    const contentLength = response.headers.get("content-length");
    const disposition = response.headers.get("content-disposition");
    
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    let loadedBytes = 0;
    
    const reader = response.body.getReader();
    const chunks = [];
    const startTime = Date.now();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      loadedBytes += value.length;
      
      // Calculate speed and percent
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const speed = elapsedSeconds > 0 ? (loadedBytes / elapsedSeconds) : 0;
      
      let percent = 0;
      if (totalBytes > 0) {
        percent = Math.round((loadedBytes / totalBytes) * 100);
        progressFill.style.width = `${percent}%`;
        progressStatus.textContent = `Downloading: ${percent}%`;
        progressStats.textContent = `${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)} (${formatBytes(speed)}/s)`;
      } else {
        progressFill.style.width = `100%`; // Undefined length progress fallback
        progressStatus.textContent = `Downloading...`;
        progressStats.textContent = `${formatBytes(loadedBytes)} loaded (${formatBytes(speed)}/s)`;
      }
    }
    
    progressStatus.textContent = "Download Complete!";
    showToast("Success", "Your media has been downloaded successfully.", "success");
    
    // Assemble the file blob
    const fileBlob = new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
    
    // Extract filename
    let downloadFilename = `download.${format}`;
    if (disposition && disposition.includes("filename")) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (matches && matches[1]) {
        downloadFilename = matches[1].replace(/['"]/g, "");
      }
    }
    
    // Trigger download
    const blobUrl = URL.createObjectURL(fileBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = blobUrl;
    downloadLink.download = downloadFilename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(blobUrl);
    
  } catch (err) {
    console.error(err);
    showToast("Download Failed", err.message || "An error occurred during download.");
    progressStatus.textContent = "Failed.";
    progressStats.textContent = "Error during file transfer.";
  } finally {
    btnDownload.disabled = false;
    btnDownload.innerHTML = `<i class="fa-solid fa-arrow-down-to-bracket"></i> Download Now`;
  }
});
