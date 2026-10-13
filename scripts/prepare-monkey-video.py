"""Prepare the user-supplied clip; requires pip install imageio-ffmpeg.

Usage: python scripts/prepare-monkey-video.py path/to/videoplayback.mp4
Only the derived transparent video is included in the game.
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

output = Path(__file__).resolve().parents[1] / "src/client/public/assets/video/monica-monkey.webm"
output.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([
    imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-ss", "1", "-i", sys.argv[1],
    "-t", "16", "-an", "-vf",
    "colorkey=0x00ff00:0.28:0.12,despill=green,scale=320:180",
    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0",
    "-crf", "34", "-auto-alt-ref", "0", str(output),
], check=True)
