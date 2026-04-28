import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

const encodeMermaid = (source) =>
  Buffer.from(source, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchWithRetry = async (url, input) => {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (response.ok) return response
      lastError = new Error(
        `${response.status} ${response.statusText}`
      )
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timeout)
    }

    if (attempt < 4) {
      await sleep(attempt * 750)
    }
  }

  throw new Error(`Failed to render ${input}: ${lastError.message}`)
}

const diagramFiles = (await readdir("diagrams"))
  .filter((file) => file.endsWith(".mmd"))
  .sort()

const lightTheme = {
  primaryColor: "#f8fafc",
  primaryTextColor: "#1f2937",
  primaryBorderColor: "#2563eb",
  lineColor: "#374151",
  tertiaryColor: "#ffffff",
}

const withLightTheme = (source) =>
  source
    .replace(/"primaryColor": "#313244"/g, `"primaryColor": "${lightTheme.primaryColor}"`)
    .replace(/"primaryTextColor": "#cdd6f4"/g, `"primaryTextColor": "${lightTheme.primaryTextColor}"`)
    .replace(/"primaryBorderColor": "#89b4fa"/g, `"primaryBorderColor": "${lightTheme.primaryBorderColor}"`)
    .replace(/"lineColor": "#cdd6f4"/g, `"lineColor": "${lightTheme.lineColor}"`)
    .replace(/"tertiaryColor": "#1e1e2e"/g, `"tertiaryColor": "${lightTheme.tertiaryColor}"`)

const renderDiagram = async ({ input, output, source }) => {
  const encoded = encodeMermaid(source)
  const url = `https://mermaid.ink/svg/${encoded}?bgColor=transparent`

  const response = await fetchWithRetry(url, input)

  const svg = (await response.text()).replace(
    /<style xmlns="http:\/\/www\.w3\.org\/1999\/xhtml">@import url\("[^"]+"\);<\/style>/,
    ""
  )
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, svg)
  console.log(`${input} -> ${output}`)
}

for (const file of diagramFiles) {
  const input = join("diagrams", file)
  const source = await readFile(input, "utf8")
  const name = `${basename(file, ".mmd")}.svg`

  await renderDiagram({
    input,
    output: join("assets", name),
    source,
  })

  await renderDiagram({
    input,
    output: join("assets", "light", name),
    source: withLightTheme(source),
  })
}
