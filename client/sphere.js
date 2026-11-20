import { drag, geoGraticule10, geoOrthographic, geoPath, geoRotation, select, stratify } from '../dist/quartz-graph.js'

const radians = Math.PI / 180
const graticule = geoGraticule10()
const globe = { type: 'Sphere' }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function sphericalPositions(nodes) {
  const tree = stratify().id((node) => node.id).parentId((node) => node.parent)(nodes)
  const branches = (tree.children ?? []).map((branch) => {
    const ordered = []
    branch.eachBefore((node) => ordered.push(node))
    return ordered
  })
  const total = branches.reduce((sum, branch) => sum + Math.sqrt(branch.length), 0)
  const positions = [{ ...tree.data, coordinate: [-4, 0] }]
  let longitude = -180
  for (const branch of branches) {
    const arc = Math.sqrt(branch.length) / total * 360
    for (const [order, { data, depth }] of branch.entries()) {
      const ratio = (order + 0.5) / branch.length
      const latitude = Math.asin(2 * ((0.5 + order * 0.61803398875) % 1) - 1) / radians
      positions.push({ ...data, coordinate: [longitude + arc * ratio, latitude], depth })
    }
    longitude += arc
  }
  return positions
}

export function mountSphere(container, nodes, selected, camera, onSelect) {
  const canvas = document.createElement('canvas')
  canvas.className = 'atlas-sphere'
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', '球形知识图谱，方向键旋转，加号和减号缩放')
  const context = canvas.getContext('2d')
  if (!context) return () => {}
  container.append(canvas)
  const width = container.clientWidth
  const height = container.clientHeight
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  context.scale(pixelRatio, pixelRatio)

  const points = sphericalPositions(nodes)
  const byId = new Map(points.map((point) => [point.id, point]))
  const links = points.flatMap((point) => point.links
    .filter((id) => byId.has(id) && id !== point.id)
    .map((id) => [point, byId.get(id)]))
  const colors = new Map()
  for (const link of links) {
    const [from, to] = link
    const color = to.branch?.color ?? from.branch?.color ?? '#6fa8e8'
    if (!colors.has(color)) colors.set(color, [])
    colors.get(color).push(link)
  }
  const geometry = geoOrthographic().translate([width / 2, height / 2]).clipAngle(90)
  const trace = geoPath(geometry, context)
  let hovered, frame

  function drawEdges(front) {
    context.globalAlpha = front ? 0.23 : 0.055
    context.lineWidth = 0.7
    for (const [color, edges] of colors) {
      context.beginPath()
      for (const [from, to] of edges) {
        if ((from.z > 0 && to.z > 0) !== front) continue
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
      }
      context.strokeStyle = color
      context.stroke()
    }
  }

  function drawPoints(front) {
    for (const point of points) {
      if ((point.z > 0) !== front) continue
      const emphasized = point.id === selected || point === hovered
      const radius = emphasized ? 4.7 : point.folder ? (point.depth === 1 ? 3.8 : 2.5) : 1.7
      if (emphasized) {
        context.beginPath()
        context.arc(point.x, point.y, radius + 5, 0, Math.PI * 2)
        context.fillStyle = point.branch?.color ?? '#6983fc'
        context.globalAlpha = 0.28
        context.fill()
      }
      context.beginPath()
      context.arc(point.x, point.y, radius, 0, Math.PI * 2)
      context.fillStyle = emphasized ? '#e6e7ea' : point.branch?.color ?? '#6fa8e8'
      context.globalAlpha = emphasized ? 1 : front ? 0.60 + 0.40 * point.z : 0.19
      context.fill()
      if (emphasized) {
        context.strokeStyle = '#6983fc'
        context.lineWidth = 2
        context.stroke()
      }
    }
  }

  function drawLabels() {
    const labels = [hovered, byId.get(selected), ...points.filter((point) => point.depth === 1 && point.folder)]
    const bounds = []
    context.font = '600 11px "Microsoft YaHei UI", "Segoe UI", sans-serif'
    context.textBaseline = 'middle'
    context.globalAlpha = 1
    for (const point of new Set(labels)) {
      if (!point || point.z <= 0) continue
      const title = point.title.length > 21 ? point.title.slice(0, 20) + '…' : point.title
      const labelWidth = context.measureText(title).width + 14
      const x = clamp(point.x + 8, 3, Math.max(3, width - labelWidth - 3))
      const y = point.y - 12
      if (y < 3 || y > height - 26 || bounds.some((box) =>
        x < box.right && x + labelWidth > box.left && Math.abs(y - box.top) < 25)) continue
      bounds.push({ left: x, right: x + labelWidth, top: y })
      context.beginPath()
      context.roundRect(x, y, labelWidth, 22, 6)
      context.fillStyle = '#15161a'
      context.fill()
      context.strokeStyle = point.branch?.color ?? '#6983fc'
      context.lineWidth = 1
      context.stroke()
      context.fillStyle = '#e6e7ea'
      context.fillText(title, x + 7, y + 11)
    }
  }

  function draw() {
    frame = undefined
    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(width, height) * 0.425 * camera.zoom
    const rotation = [camera.yaw, camera.pitch, 0]
    geometry.scale(radius).rotate(rotation)
    const rotate = geoRotation(rotation)
    for (const point of points) {
      ;[point.x, point.y] = geometry(point.coordinate)
      const [lng, lat] = rotate(point.coordinate)
      point.z = Math.cos(lng * radians) * Math.cos(lat * radians)
    }
    context.clearRect(0, 0, width, height)
    context.globalAlpha = 1
    context.beginPath()
    trace(globe)
    const shade = context.createRadialGradient(cx - radius * 0.26, cy - radius * 0.35, 0, cx, cy, radius * 1.05)
    shade.addColorStop(0, '#253a53')
    shade.addColorStop(0.63, '#1b2d42')
    shade.addColorStop(1, '#15161a')
    context.fillStyle = shade
    context.fill()
    context.strokeStyle = '#6983fc'
    context.globalAlpha = 0.45
    context.lineWidth = 1.2
    context.stroke()
    context.beginPath()
    trace(graticule)
    context.globalAlpha = 0.11
    context.lineWidth = 0.6
    context.stroke()
    context.beginPath()
    for (const [from, to] of links) {
      if (!hovered || (hovered !== from && hovered !== to) || from.z <= 0 || to.z <= 0) continue
      context.moveTo(from.x, from.y)
      context.lineTo(to.x, to.y)
    }
    context.strokeStyle = hovered?.branch?.color ?? '#A5ACFF'
    context.globalAlpha = 0.75
    context.lineWidth = 1.25
    context.stroke()
    drawEdges(false)
    drawPoints(false)
    drawEdges(true)
    drawPoints(true)
    drawLabels()
  }

  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(draw)
  }

  function pointAt(x, y) {
    let choice
    let nearest = 144
    for (const point of points) {
      if (point.z <= 0) continue
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2
      if (distance >= nearest) continue
      choice = point
      nearest = distance
    }
    return choice
  }

  function rotateBy(x, y) {
    camera.yaw = (camera.yaw + x) % 360
    camera.pitch = clamp(camera.pitch - y, -89, 89)
    hovered = undefined
    schedule()
  }

  const surface = select(canvas)
  surface.call(drag().clickDistance(4).on('drag', ({ dx, dy }) => rotateBy(dx * 0.38, dy * 0.38)))
  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons) return
    hovered = pointAt(event.offsetX, event.offsetY)
    canvas.classList.toggle('atlas-sphere-node', Boolean(hovered))
    schedule()
  })
  canvas.addEventListener('pointerleave', () => {
    hovered = undefined
    canvas.classList.remove('atlas-sphere-node')
    schedule()
  })
  canvas.addEventListener('click', (event) => {
    const point = pointAt(event.offsetX, event.offsetY)
    if (point) onSelect(point.id)
  })
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault()
    camera.zoom = clamp(camera.zoom * Math.exp(-event.deltaY * 0.001), 0.55, 3)
    schedule()
  }, { passive: false })
  canvas.addEventListener('keydown', (event) => {
    const directions = { ArrowLeft: [-9, 0], ArrowRight: [9, 0], ArrowUp: [0, -9], ArrowDown: [0, 9] }
    if (Object.hasOwn(directions, event.key)) rotateBy(...directions[event.key])
    else if (event.key === '+' || event.key === '-') {
      camera.zoom = clamp(camera.zoom * (event.key === '+' ? 1.15 : 1 / 1.15), 0.55, 3)
      schedule()
    } else return
    event.preventDefault()
  })
  draw()
  return () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    surface.on('.drag', null)
    canvas.remove()
  }
}
