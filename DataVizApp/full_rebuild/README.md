# Correspondence Visualizer Rebuilt

This is a fresh standalone Vite/React/Tailwind app rebuilt from the fuller recovered source file.

Included feature groups:
- Full control panel shell
- Full inspector shell
- Timeline filtering and playback
- Export actions (SVG, PNG, nodes CSV, routes CSV)
- Theme presets
- Map overlays and navigation
- Top-level workspace composition

Excluded on purpose:
- Crowded-picker disambiguation overlay and its delayed-dismiss logic

## Run locally in PowerShell

```powershell
cd "C:\path\to\correspondence_visualizer_rebuilt"
npm.cmd install
npm.cmd run dev
```

Then open the local Vite URL, usually:

```text
http://localhost:5173/
```
