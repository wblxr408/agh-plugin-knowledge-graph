import { readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

const [run, data] = process.argv.slice(2)
const staging = await realpath(run)
if (dirname(staging) !== await realpath(data) || !/^build-[a-f0-9]{32}$/.test(basename(staging))) {
  throw new Error('Invalid staging directory')
}
const index = JSON.parse(await readFile(join(run, 'out/static/contentIndex.json'), 'utf8'))
const sources = JSON.parse(await readFile(join(run, 'sources.json'), 'utf8'))
if (!index.index || !Object.keys(index).every((id) => Object.hasOwn(sources, id))) {
  throw new Error('Quartz output and source provenance disagree')
}
const staged = join(run, 'atlas.json')
await writeFile(staged, JSON.stringify({ index, sources }), { mode: 0o600 })
await rename(staged, join(data, 'atlas.json'))
const states = {}
for (const { state } of Object.values(sources)) states[state] = (states[state] ?? 0) + 1
console.log(JSON.stringify({ states, edges: Object.values(index).reduce((sum, item) => sum + item.links.length, 0) }))
await rm(staging, { recursive: true })
