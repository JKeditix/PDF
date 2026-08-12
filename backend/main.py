import os
import time
import asyncio
import shutil
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from downloader import fetch_video_metadata, download_video_file, HAS_FFMPEG

app = FastAPI(title="Video & Audio Downloader API")

# Enable CORS for frontend connection
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
  expose_headers=["Content-Length", "Content-Disposition"]
)

DOWNLOADS_DIR = "downloads"
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

class FetchRequest(BaseModel):
  url: str

class DownloadRequest(BaseModel):
  url: str
  format: str # mp4, webm, mp3, m4a
  quality: str # 360p, 720p, 1080p, best, audio

# --- BACKGROUND CLEANUP TASK ---
async def cleanup_downloads_periodically():
  """
  Periodically checks the downloads folder and deletes files older than 5 minutes.
  """
  while True:
    try:
      await asyncio.sleep(60) # check every minute
      now = time.time()
      if os.path.exists(DOWNLOADS_DIR):
        for item in os.listdir(DOWNLOADS_DIR):
          item_path = os.path.join(DOWNLOADS_DIR, item)
          # check if folder/file modification time is older than 300 seconds (5 minutes)
          if os.path.getmtime(item_path) < now - 300:
            try:
              if os.path.isdir(item_path):
                shutil.rmtree(item_path)
              else:
                os.remove(item_path)
              print(f"[Cleanup] Deleted expired folder/file: {item}")
            except Exception as delete_error:
              print(f"[Cleanup] Error deleting {item_path}: {delete_error}")
    except Exception as loop_error:
      print(f"[Cleanup] Error in cleanup loop: {loop_error}")

@app.on_event("startup")
async def startup_event():
  # Start the background cleanup task
  asyncio.create_task(cleanup_downloads_periodically())

# --- API ENDPOINTS ---

@app.post("/fetch")
async def api_fetch(request: FetchRequest):
  if not request.url:
    raise HTTPException(status_code=400, detail="URL is required.")
  try:
    meta = fetch_video_metadata(request.url)
    # Append system notice if ffmpeg is missing
    meta["ffmpeg_installed"] = HAS_FFMPEG
    return meta
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

@app.post("/download")
async def api_download(request: DownloadRequest, background_tasks: BackgroundTasks):
  if not request.url:
    raise HTTPException(status_code=400, detail="URL is required.")
  try:
    file_path = download_video_file(
      request.url,
      request.format,
      request.quality,
      DOWNLOADS_DIR
    )
    
    filename = os.path.basename(file_path)
    
    # We can also schedule a deletion task after download completes
    # using FastAPI BackgroundTasks as secondary cleanup
    def delete_file_after_delay(path):
      # Wait a brief moment to ensure download starts/transfers completely
      time.sleep(10)
      try:
        parent_dir = os.path.dirname(path)
        if os.path.exists(parent_dir) and parent_dir != DOWNLOADS_DIR:
          shutil.rmtree(parent_dir)
          print(f"[API Cleanup] Deleted task folder: {parent_dir}")
      except Exception as e:
        print(f"[API Cleanup] Failed to delete file: {e}")
        
    background_tasks.add_task(delete_file_after_delay, file_path)
    
    return FileResponse(
      path=file_path,
      media_type="application/octet-stream",
      filename=filename
    )
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

@app.post("/audio")
async def api_audio(request: FetchRequest, background_tasks: BackgroundTasks):
  if not request.url:
    raise HTTPException(status_code=400, detail="URL is required.")
  try:
    # Forces audio extraction to MP3
    file_path = download_video_file(
      request.url,
      "audio_mp3",
      "audio",
      DOWNLOADS_DIR
    )
    
    filename = os.path.basename(file_path)
    
    def delete_file_after_delay(path):
      time.sleep(10)
      try:
        parent_dir = os.path.dirname(path)
        if os.path.exists(parent_dir) and parent_dir != DOWNLOADS_DIR:
          shutil.rmtree(parent_dir)
      except Exception as e:
        print(f"[API Cleanup] Failed to delete audio file: {e}")
        
    background_tasks.add_task(delete_file_after_delay, file_path)
    
    return FileResponse(
      path=file_path,
      media_type="audio/mpeg",
      filename=filename
    )
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
