import os
import uuid
import shutil
import yt_dlp

# Check if ffmpeg is available in the system path
HAS_FFMPEG = shutil.which("ffmpeg") is not None or shutil.which("ffmpeg.exe") is not None

def get_platform_name(url):
  url_lower = url.lower()
  if "youtube.com" in url_lower or "youtu.be" in url_lower:
    return "youtube"
  elif "instagram.com" in url_lower:
    return "instagram"
  elif "twitter.com" in url_lower or "x.com" in url_lower:
    return "twitter"
  elif "facebook.com" in url_lower or "fb.watch" in url_lower:
    return "facebook"
  elif "tiktok.com" in url_lower:
    return "tiktok"
  elif "vimeo.com" in url_lower:
    return "vimeo"
  return "generic"

def fetch_video_metadata(url):
  """
  Fetches video info using yt-dlp without downloading the file.
  Returns a clean metadata dict or raises an exception.
  """
  ydl_opts = {
    'noplaylist': True,
    'quiet': True,
    'no_warnings': True,
    'extract_flat': False
  }
  
  with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    try:
      info = ydl.extract_info(url, download=False)
      if not info:
        raise Exception("Failed to fetch video details. Check url.")
      
      # Handle playlist structure if returned
      if 'entries' in info:
        # If it's a playlist/folder, take the first item
        info = info['entries'][0]
        
      title = info.get('title', 'Untitled Video')
      duration = info.get('duration', 0) # in seconds
      thumbnail = info.get('thumbnail')
      
      # fallback for thumbnail search
      if not thumbnail and info.get('thumbnails'):
        thumbnail = info['thumbnails'][-1].get('url')
        
      platform = get_platform_name(url)
      
      # Compile standard available formats
      formats = [
        {"format_id": "best", "resolution": "Best Quality", "ext": "mp4", "note": "Best combination"},
        {"format_id": "1080p", "resolution": "1080p", "ext": "mp4", "note": "Full HD"},
        {"format_id": "720p", "resolution": "720p", "ext": "mp4", "note": "HD Quality"},
        {"format_id": "360p", "resolution": "360p", "ext": "mp4", "note": "Standard Quality"},
        {"format_id": "audio_mp3", "resolution": "Audio (MP3)", "ext": "mp3", "note": "192kbps Audio"},
        {"format_id": "audio_m4a", "resolution": "Audio (M4A)", "ext": "m4a", "note": "High Quality Audio"}
      ]
      
      return {
        "status": "success",
        "title": title,
        "thumbnail": thumbnail or "",
        "duration": duration,
        "platform": platform,
        "formats": formats
      }
    except Exception as e:
      raise Exception(f"yt-dlp error: {str(e)}")

def download_video_file(url, format_id, quality, output_dir):
  """
  Downloads the video/audio based on parameters and returns the local file path.
  """
  # Create unique directory for the task
  task_id = str(uuid.uuid4())
  task_dir = os.path.join(output_dir, task_id)
  os.makedirs(task_dir, exist_ok=True)
  
  ydl_opts = {
    'outtmpl': os.path.join(task_dir, '%(title)s.%(ext)s'),
    'restrictfilenames': True,
    'noplaylist': True,
    'quiet': True,
    'no_warnings': True,
  }
  
  # 1. Handle Audio extraction
  is_audio = format_id == "audio_mp3" or format_id == "audio_m4a" or quality == "audio"
  
  if is_audio:
    codec = "mp3" if (format_id == "audio_mp3" or quality == "mp3") else "m4a"
    ydl_opts['format'] = 'bestaudio/best'
    
    if HAS_FFMPEG:
      ydl_opts['postprocessors'] = [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': codec,
        'preferredquality': '192',
      }]
    else:
      # If no ffmpeg, yt-dlp will just download the default audio format without transcoding.
      pass
  else:
    # 2. Handle Video qualities
    if quality == "1080p":
      ydl_opts['format'] = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
    elif quality == "720p":
      ydl_opts['format'] = 'bestvideo[height<=720]+bestaudio/best[height<=720]/best'
    elif quality == "360p":
      ydl_opts['format'] = 'bestvideo[height<=360]+bestaudio/best[height<=360]/best'
    else: # best
      ydl_opts['format'] = 'bestvideo+bestaudio/best'
      
    # Merge output format if ffmpeg is available
    if HAS_FFMPEG:
      ydl_opts['merge_output_format'] = format_id if format_id in ['mp4', 'webm'] else 'mp4'
      
  with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=True)
    
  # Locate the downloaded file in the directory
  files = os.listdir(task_dir)
  if not files:
    raise Exception("Download completed but file could not be found.")
    
  # The output file is the only file in the directory
  file_path = os.path.join(task_dir, files[0])
  return file_path
