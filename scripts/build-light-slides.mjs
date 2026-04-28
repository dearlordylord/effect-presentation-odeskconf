import { mkdir, writeFile, readFile } from "node:fs/promises"

const source = await readFile("slides.md", "utf8")

const light = source
  .replace("backgroundColor: #1e1e2e", "backgroundColor: #ffffff")
  .replace("color: #cdd6f4", "color: #1f2937")
  .replaceAll("#89b4fa", "#2563eb")
  .replaceAll("#313244", "#f3f4f6")
  .replaceAll("#a6e3a1", "#047857")
  .replaceAll("#181825", "#f8fafc")
  .replaceAll("#f9e2af", "#b45309")
  .replaceAll("#cba6f7", "#7c3aed")
  .replaceAll("#a6adc8", "#4b5563")
  .replaceAll("#fab387", "#c2410c")
  .replaceAll("assets/igor-avatar.png", "../assets/igor-avatar.png")
  .replaceAll("assets/internet-explorer.svg", "../assets/internet-explorer.svg")
  .replaceAll("assets/grafana-trace.png", "../assets/grafana-trace.png")
  .replaceAll("assets/effect-type.svg", "../assets/light/effect-type.svg")
  .replaceAll("assets/layer-dependency.svg", "../assets/light/layer-dependency.svg")
  .replaceAll("assets/layer-combinations.svg", "../assets/light/layer-combinations.svg")
  .replaceAll("assets/agent-feedback.svg", "../assets/light/agent-feedback.svg")

await mkdir(".generated", { recursive: true })
await writeFile(".generated/slides-light.md", light)
console.log("slides.md -> .generated/slides-light.md")
