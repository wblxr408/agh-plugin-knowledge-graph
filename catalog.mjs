import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const serviceName = 'knowledge.atlas.read'
export const atlasFile = join(
  process.env.AGH_ATLAS_DATA_DIR || join(process.env.LOCALAPPDATA || homedir(), 'AgnesKnowledgeGraph'),
  'atlas.json',
)

export function atlasView(index, sources, input = {}) {
  const selected = Object.hasOwn(index, input.selected) ? input.selected : 'index'
  const page = index[selected]
  const location = sources[selected]
  const query = input.query?.trim().toLocaleLowerCase() || ''
  const entries = Object.entries(index)
  const toResult = ([id, item]) => ({ id, title: item.title, path: sources[id]?.path ?? '' })
  const matches = query
    ? entries.filter(([id, { title, content }]) =>
        String(title).toLocaleLowerCase().includes(query) ||
        sources[id]?.path?.toLocaleLowerCase().includes(query) ||
        content?.toLocaleLowerCase().includes(query),
      )
    : []
  const connected = new Set([
    ...page.links,
    ...entries.filter(([, item]) => item.links.includes(selected)).map(([id]) => id),
  ])
  const folderIds = new Map(entries
    .filter(([id]) => sources[id]?.state === 'folder')
    .map(([id]) => [sources[id].path, id]))
  return {
    status: 'ready',
    name: index.index.title,
    detail: {
      ...toResult([selected, page]),
      state: location?.state ?? 'metadata',
      text: (location?.text ?? page.content ?? '').slice(0, 12_000),
    },
    results: matches.slice(0, 40).map(toResult),
    total: matches.length,
    neighbors: [...connected].filter((id) => Object.hasOwn(index, id)).map((id) => toResult([id, index[id]])),
    ...(input.includeGraph === false
      ? {}
      : {
          index: Object.fromEntries(entries.map(([id, { title, links, tags }]) => {
            const path = sources[id]?.path ?? ''
            const parentPath = path.slice(0, Math.max(0, path.lastIndexOf('/')))
            return [id, {
              title: title.slice(0, 120), links, tags,
              folder: id === 'index' || sources[id]?.state === 'folder',
              parent: id === 'index' ? null : folderIds.get(parentPath) ?? 'index',
            }]
          })),
          counts: {
            files: entries.length - Object.values(sources).filter((item) => item.state === 'folder').length,
            edges: entries.reduce((count, [, item]) =>
              count + item.links.filter((id) => Object.hasOwn(index, id)).length, 0),
            text: Object.values(sources).filter((item) => item.state === 'text').length,
          },
        }),
  }
}

export function createAtlasReader(path = atlasFile) {
  let cache
  return async (input) => {
    try {
      const file = await stat(path)
      if (!file.isFile() || file.size > 96 * 1024 * 1024) return { status: 'invalid' }
      const revision = `${file.ino}:${file.size}:${file.mtimeMs}`
      if (cache?.revision !== revision) {
        const { index, sources } = JSON.parse(await readFile(path, 'utf8'))
        if (!index?.index || !sources) return { status: 'invalid' }
        cache = { revision, index, sources }
      }
      return atlasView(cache.index, cache.sources, input)
    } catch (error) {
      return { status: error?.code === 'ENOENT' ? 'missing' : 'invalid' }
    }
  }
}
