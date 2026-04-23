from pathlib import Path
import shutil
import subprocess
import zipfile
import sys

project_root = Path(r"C:\Users\haley\OneDrive\Desktop\CorrespondenceVisualizer")
dist_dir = project_root / "dist"
out_dir = project_root / "itch_upload"
zip_path = out_dir / "correspondence-visualizer-itch.zip"

if not (project_root / "package.json").exists():
    raise SystemExit(f"Could not find package.json in {project_root}")

print("Building production app...")
result = subprocess.run(
    ["npm.cmd", "run", "build"],
    cwd=project_root,
    text=True,
)
if result.returncode != 0:
    raise SystemExit(result.returncode)

if not dist_dir.exists():
    raise SystemExit(f"Build completed but dist folder was not found: {dist_dir}")

out_dir.mkdir(exist_ok=True)

if zip_path.exists():
    zip_path.unlink()

print(f"Creating ZIP package at: {zip_path}")
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for path in dist_dir.rglob("*"):
        if path.is_file():
            arcname = path.relative_to(dist_dir)
            zf.write(path, arcname)

if not any(p.name == "index.html" for p in dist_dir.iterdir()):
    raise SystemExit("dist/index.html was not found; ZIP may not be valid for itch.io")

print("Done.")
print(f"ZIP ready: {zip_path}")
print("Upload that ZIP to itch.io as an HTML project.")
