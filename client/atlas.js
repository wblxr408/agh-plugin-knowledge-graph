import { mountGraph } from '../dist/quartz-graph.js'
import { branchColors, scopeGraph } from './scope.js'
import { mountSphere } from './sphere.js'

const number = new Intl.NumberFormat('zh-CN')
const stateLabel = {
  folder: '目录', text: '正文', metadata: '文件索引',
  limited: '超过读取上限', empty: '未提取到正文', error: '正文读取失败',
}
const icon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m7 7 10 2M7 8l3 9m7-7-5 7"/><circle cx="5.5" cy="6.5" r="2.5"/><circle cx="18.5" cy="8.5" r="2.5"/><circle cx="11" cy="19" r="2.5"/></svg>'

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function mountAtlas(root, read) {
  root.innerHTML = `
    <section class="agh-atlas" aria-label="知识图谱">
      <header class="atlas-header">
        <div class="atlas-heading"><span class="atlas-mark">${icon}</span>
          <div><h1>知识图谱</h1><p data-ref="name">本地资料库</p></div>
        </div>
        <div class="atlas-counts" aria-label="索引统计">
          <div><strong data-ref="files">—</strong><span>资料</span></div>
          <div><strong data-ref="edges">—</strong><span>连接</span></div>
          <div><strong data-ref="text">—</strong><span>含正文</span></div>
        </div>
      </header>
      <div class="atlas-workspace">
        <aside class="atlas-browser">
          <label class="atlas-search"><span aria-hidden="true">⌕</span>
            <input data-ref="search" maxlength="120" type="search" placeholder="搜索文件名或正文" aria-label="搜索文件名或正文">
          </label>
          <div class="atlas-list-title"><h2 data-ref="listTitle">资料导航</h2>
            <button data-ref="home" type="button">返回总览</button>
          </div>
          <div class="atlas-list" data-ref="list"></div>
        </aside>
        <section class="atlas-map" aria-label="关系网络">
          <div class="atlas-map-bar">
            <div><h2>关系网络</h2><p class="atlas-scope" data-ref="scope"></p></div>
            <div class="atlas-controls">
              <label class="atlas-depth"><span>目录</span>
                <select data-ref="depth" aria-label="目录深度">
                  <option value="4">4 级</option>
                  <option value="5">5 级</option>
                  <option value="6" selected>6 级</option>
                </select>
              </label>
              <button data-ref="local" aria-pressed="true" type="button">局部</button>
              <button data-ref="global" aria-pressed="false" type="button">全部</button>
              <button data-ref="sphere" aria-pressed="true" type="button" title="切换球形或平面视图">球形</button>
              <button data-ref="reset" type="button" title="重置图谱视图" aria-label="重置图谱视图">↻</button>
            </div>
          </div>
          <div class="atlas-graph" data-ref="graph" aria-label="交互式图谱"></div>
          <div class="atlas-message" data-ref="message" role="status">正在载入资料图谱…</div>
          <div class="atlas-legend" data-ref="legend" aria-label="分支颜色"></div>
        </section>
        <aside class="atlas-inspector" aria-label="来源和详情" data-ref="detail"></aside>
      </div>
    </section>`
  const refs = Object.fromEntries([...root.querySelectorAll('[data-ref]')].map((node) => [node.dataset.ref, node]))
  const defaultCamera = () => ({ yaw: -12, pitch: 16, zoom: 1 })
  let camera = defaultCamera()
  let index, colors, current, global = false, spherical = true, active = true, latest = 0, timer, resizeTimer, disposeGraph

  function showLegend(nodes) {
    const current = element('span', '', '')
    current.append(element('i', 'atlas-current'), '当前节点')
    if (!spherical) {
      const folder = element('span', '', '')
      folder.append(element('i', 'atlas-folder'), '目录')
      const file = element('span', '', '')
      file.append(element('i'), '资料')
      refs.legend.replaceChildren(current, folder, file)
      return
    }
    const counts = new Map()
    for (const { branch } of nodes) {
      if (branch) counts.set(branch, (counts.get(branch) ?? 0) + 1)
    }
    const branches = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const legend = branches.map(([branch]) => {
      const item = element('span')
      const dot = element('i')
      const label = element('b', '', branch.label)
      item.title = branch.label
      dot.style.backgroundColor = branch.color
      item.append(dot, label)
      return item
    })
    if (counts.size > branches.length) legend.push(element('span', 'atlas-legend-more', '其他分支'))
    refs.legend.replaceChildren(current, ...legend)
  }

  function draw() {
    disposeGraph?.()
    if (!index || !current || refs.graph.clientWidth === 0) return
    const selected = current.detail.id
    const nodes = scopeGraph(index, selected, global ? null : Number(refs.depth.value))
      .map((node) => ({ ...node, branch: colors.get(node.id) }))
    const depth = nodes.reduce((max, node) => Math.max(max, node.level), 0)
    refs.scope.textContent = `${number.format(nodes.length)} 个节点 · ${depth} 级目录`
    showLegend(nodes)
    refs.graph.dataset.mode = global ? 'global' : 'local'
    if (spherical) {
      disposeGraph = mountSphere(refs.graph, nodes, selected, camera, select)
      return
    }
    refs.graph.dataset.cfg = JSON.stringify({
      drag: true, zoom: true, depth: -1,
      scale: global ? 0.38 : 1.06, repelForce: global ? 0.10 : 0.65,
      centerForce: 0.75, linkDistance: global ? 23 : 66, fontSize: 0.76,
      opacityScale: 1.06, removeTags: [], showTags: false, focusOnHover: true,
    })
    const scoped = Object.fromEntries(nodes.map((node) => [node.id, node]))
    disposeGraph = mountGraph(refs.graph, selected, scoped, select)
  }

  function showList() {
    const hasQuery = Boolean(refs.search.value.trim())
    refs.listTitle.textContent = hasQuery ? `搜索结果 · ${number.format(current.total)}` : '关联资料'
    const items = hasQuery ? current.results : current.neighbors
    const rows = items.map((item) => {
      const button = element('button', 'atlas-row')
      button.type = 'button'
      const dot = element('span', item.id.startsWith('n-') ? 'atlas-file-dot' : 'atlas-folder-dot', '')
      const branch = colors?.get(item.id)
      if (branch && spherical) dot.style.backgroundColor = branch.color
      if (item.id === current.detail.id) button.setAttribute('aria-current', 'true')
      button.append(dot, element('strong', 'atlas-row-label', item.title))
      button.addEventListener('click', () => select(item.id))
      return button
    })
    refs.list.replaceChildren(...(rows.length ? rows : [element('p', 'atlas-empty', hasQuery ? '无搜索结果' : '无关联资料')]))
  }

  function showDetail() {
    const detail = current.detail
    const heading = element('div', 'atlas-detail-title')
    heading.append(element('span', 'atlas-detail-icon', detail.state === 'folder' ? '▦' : '▤'),
      element('h2', '', detail.title))
    const location = element('div', 'atlas-source')
    location.append(element('h3', '', '来源路径'), element('p', '', detail.path || current.name))
    const parent = index?.[detail.id]?.parent
    if (parent) {
      const up = element('button', 'atlas-parent', '返回上一级')
      up.type = 'button'
      up.addEventListener('click', () => select(parent))
      location.append(up)
    }
    refs.detail.replaceChildren(
      element('div', 'atlas-detail-eyebrow', stateLabel[detail.state] || '资料'),
      heading, location,
    )
    if (detail.state !== 'folder' && detail.text) {
      const body = element('div', 'atlas-excerpt')
      body.append(element('h3', '', '正文预览'), element('p', 'atlas-passage', detail.text))
      refs.detail.append(body)
    }
  }

  async function update(selected) {
    const request = ++latest
    const hadGraph = Boolean(index)
    try {
      const view = await read({ selected, query: refs.search.value.trim(), includeGraph: !hadGraph })
      if (!active || request !== latest) return
      if (view.status !== 'ready') {
        refs.message.hidden = false
        refs.message.textContent = view.status === 'missing' ? '尚未生成图谱' : '无法读取图谱索引'
        return
      }
      refs.message.hidden = true
      if (view.index) {
        index = view.index
        colors = branchColors(index)
        refs.name.textContent = view.name
        for (const key of ['files', 'edges', 'text']) refs[key].textContent = number.format(view.counts[key])
      }
      const shouldDraw = !current || current.detail.id !== view.detail.id
      current = view
      showList()
      showDetail()
      if (shouldDraw) draw()
    } catch {
      if (active && request === latest) {
        refs.message.hidden = false
        refs.message.textContent = '图谱服务暂时无法连接。'
      }
    }
  }

  function select(id) {
    clearTimeout(timer)
    void update(id)
  }

  function mode(next) {
    global = next
    refs.local.setAttribute('aria-pressed', String(!global))
    refs.global.setAttribute('aria-pressed', String(global))
    refs.depth.disabled = global
    draw()
  }

  refs.search.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => update(current?.detail.id || 'index'), 150)
  })
  refs.home.addEventListener('click', () => {
    refs.search.value = ''
    mode(false)
    select('index')
  })
  refs.local.addEventListener('click', () => mode(false))
  refs.global.addEventListener('click', () => mode(true))
  refs.depth.addEventListener('change', draw)
  refs.sphere.addEventListener('click', () => {
    spherical = !spherical
    refs.sphere.setAttribute('aria-pressed', String(spherical))
    refs.sphere.textContent = spherical ? '球形' : '平面'
    if (current) showList()
    draw()
  })
  refs.reset.addEventListener('click', () => {
    camera = defaultCamera()
    if (index) draw()
    else select('index')
  })
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(draw, 100)
  })
  observer.observe(refs.graph)
  select('index')
  return () => {
    active = false
    clearTimeout(timer)
    clearTimeout(resizeTimer)
    observer.disconnect()
    disposeGraph?.()
    root.replaceChildren()
  }
}
