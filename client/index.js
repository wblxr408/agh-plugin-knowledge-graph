import { createElement, useEffect, useRef } from 'react'
import { mountAtlas } from './atlas.js'

export function apply(ctx) {
  function AtlasPage() {
    const root = useRef(null)
    useEffect(() => mountAtlas(root.current, (input) => ctx.profile.services.query('knowledge.atlas.read', input)), [])
    return createElement('div', { ref: root, className: 'agh-atlas-host' })
  }
  const dispose = ctx.homeEntries.register({
    id: 'knowledge.atlas',
    placement: 'primary',
    titleKey: '知识图谱',
    icon: 'network',
    order: 95,
    component: AtlasPage,
  })
  ctx.effect(() => dispose)
}
