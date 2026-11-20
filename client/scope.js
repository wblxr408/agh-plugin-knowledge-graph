const palette = ['#6FA8E8', '#5CC28A', '#E0A84A', '#EF7B74', '#A5ACFF', '#6BC6C8', '#E8A4BC', '#6983FC']

function childrenByParent(index) {
  const children = new Map()
  for (const [id, node] of Object.entries(index)) {
    if (!node.parent) continue
    if (!children.has(node.parent)) children.set(node.parent, [])
    children.get(node.parent).push(id)
  }
  return children
}

export function branchColors(index) {
  const result = new Map()
  const children = childrenByParent(index)
  const groups = []
  const createBranch = (id) => {
    const branch = { label: index[id].title, size: 0 }
    groups.push(branch)
    return branch
  }
  for (const group of children.get('index') ?? []) {
    const mainBranch = createBranch(group)
    mainBranch.size++
    result.set(group, mainBranch)
    for (const course of children.get(group) ?? []) {
      const branch = index[course].folder ? createBranch(course) : mainBranch
      const pending = [course]
      for (const id of pending) {
        branch.size++
        result.set(id, branch)
        pending.push(...(children.get(id) ?? []))
      }
    }
  }
  groups.sort((a, b) => b.size - a.size)
  for (const [rank, group] of groups.entries()) group.color = palette[rank % palette.length]
  return result
}

export function scopeGraph(index, selected, depth) {
  const root = depth === null ? 'index' : index[selected]?.folder ? selected : index[selected]?.parent ?? 'index'
  const children = childrenByParent(index)
  const nodes = [{ id: root, ...index[root], parent: null, level: 0 }]
  for (const node of nodes) {
    for (const id of children.get(node.id) ?? []) {
      const child = index[id]
      const level = node.level + Number(child.folder)
      if (depth !== null && level > depth) continue
      nodes.push({ id, ...child, level })
    }
  }
  return nodes
}
