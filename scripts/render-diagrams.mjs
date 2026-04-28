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

for (const file of diagramFiles) {
  const input = join("diagrams", file)
  const output = join("assets", `${basename(file, ".mmd")}.svg`)
  const source = await readFile(input, "utf8")
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
