"""Prepare the user-provided clips: python scripts/prepare-defeat-videos.py clash.mp4 mario.mp4 arrest.mp4."""
import subprocess
import sys
from pathlib import Path
import imageio_ffmpeg

root = Path(__file__).resolve().parents[1] / "src/client/public/assets/video"
for source, name, key, extra in [
    (sys.argv[1], "defeat-jijijija", "0x47fe00", ["-t", "5"]),
    (sys.argv[2], "defeat-mario", "0xfe9c06", []),
]:
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
        "-i", source, *extra, "-vf",
        ("trim=start=0.033333,setpts=PTS-STARTPTS," if name == "defeat-jijijija" else "")
        + f"format=rgba,colorkey={key}:0.22:0.08,scale=480:-2"
        + (",tpad=stop_mode=clone:stop_duration=5" if name == "defeat-jijijija" else ""),
        *(["-af", "atrim=start=0.033333,asetpts=PTS-STARTPTS,apad"] if name == "defeat-jijijija" else []),
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0",
        "-crf", "30", "-auto-alt-ref", "0", "-c:a", "libopus",
        str(root / f"{name}.webm"),
    ], check=True)
subprocess.run([
    imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", sys.argv[3],
    "-vf", "scale=480:-2", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34",
    "-c:a", "libopus", "-b:a", "64k", str(root / "defeat-arrest.webm"),
], check=True)
