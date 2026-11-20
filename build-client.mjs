import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const plugin = dirname(fileURLToPath(import.meta.url))
const quartz = resolve(process.argv[2])
const require = createRequire(join(quartz, 'package.json'))
const { build } = require('esbuild')
const sourcePath = join(quartz, 'quartz/components/scripts/graph.inline.ts')
const original = await readFile(sourcePath, 'utf8')
const entry = original.indexOf('\nfunction renderGlobalGraph()')
const storage = original.indexOf('const localStorageKey')
const render = original.indexOf('async function renderGraph')
if (storage < 0 || render < storage || entry < render) throw new Error('Expected Quartz v4.2.4 graph source')
let port = original.slice(0, storage) + original.slice(render, entry)
const replace = (expected, replacement) => {
  if (!port.includes(expected)) throw new Error('Quartz v4.2.4 adapter anchor missing: ' + expected)
  port = port.replace(expected, replacement)
}

// Map Quartz's page lifecycle and content-index fetch to the AGH page lifecycle and query.
replace('ContentDetails, ContentIndex', 'ContentDetails')
replace('registerEscapeHandler, removeAllChildren', 'removeAllChildren')
replace('getFullSlug, resolveRelative, simplifySlug', 'simplifySlug')
replace('async function renderGraph(container: string, fullSlug: FullSlug) {',
  'export function mountGraph(graph: HTMLElement, fullSlug: FullSlug, fetchData: Record<string, ContentDetails>, onSelect: (id: string) => void) {')
replace('  const visited = getVisited()\n  const graph = document.getElementById(container)\n  if (!graph) return',
  '  const visited = new Set<SimpleSlug>()')
replace('Object.entries<ContentDetails>(await fetchData)', 'Object.entries<ContentDetails>(fetchData)')
replace('.select<HTMLElement, NodeData>("#" + container)', '.select<HTMLElement, NodeData>(graph)')
replace('  // calculate color', `  graphNode.attr("data-kind", (d) =>
    d.id === slug ? "selected" : d.id.startsWith("n-") ? "document" : "folder")
  // calculate color`)
replace('    .on("click", (_, d) => {\n      const targ = resolveRelative(fullSlug, d.id)\n      window.spaNavigate(new URL(targ, window.location.toString()))\n    })',
  `    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => d.text)
    .on("click", (_, d) => onSelect(d.id || "index"))
    .on("keydown", (event, d) => {
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      onSelect(d.id || "index")
    })`)
// Keep Quartz hover selectors inside this plugin so AGH's DOM remains independent.
port = port.replaceAll('d3.selectAll<HTMLElement, NodeData>(', 'svg.selectAll<HTMLElement, NodeData>(')
  .replaceAll('const linkNodes = d3', 'const linkNodes = svg')
replace('\n  })\n}\n', '\n  })\n  return () => {\n    simulation.stop()\n    svg.selectAll("*").interrupt()\n    svg.remove()\n  }\n}\n')

const dist = join(plugin, 'dist')
await mkdir(dist, { recursive: true })
port += '\nexport { drag, geoGraticule10, geoOrthographic, geoPath, geoRotation, select, stratify } from "d3"\n'
const result = await build({
  absWorkingDir: quartz,
  stdin: { contents: port, loader: 'ts', resolveDir: dirname(sourcePath), sourcefile: 'quartz-graph-adapter.ts' },
  bundle: true,
  minify: true,
  format: 'esm',
  legalComments: 'inline',
  metafile: true,
  outfile: join(dist, 'quartz-graph.js'),
})

const packages = new Set(Object.keys(result.metafile.inputs)
  .map((path) => path.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\//)?.[1]).filter(Boolean))
const notices = [await readFile(join(quartz, 'LICENSE.txt'), 'utf8')]
for (const name of [...packages].sort()) {
  const { version, license } = JSON.parse(await readFile(join(quartz, 'node_modules', name, 'package.json'), 'utf8'))
  const fs = await import('node:fs/promises')
  const directory = join(quartz, 'node_modules', name)
  const licenseFile = (await fs.readdir(directory)).find((file) => /^(licen[cs]e|copying)([.-]|$)/i.test(file))
  if (!licenseFile) throw new Error('Missing upstream license for ' + name)
  notices.push(name + '@' + version + ' (' + license + ')\n\n' + await readFile(join(directory, licenseFile), 'utf8'))
}
await writeFile(join(dist, 'QUARTZ-NOTICES.txt'), notices.join('\n\n---\n\n'))
