import { mountAtlas } from './atlas.js'

mountAtlas(document.getElementById('root'), async (input) => {
  const response = await fetch('/atlas?' + new URLSearchParams(input))
  if (!response.ok) throw new Error('Atlas request failed')
  return response.json()
})
