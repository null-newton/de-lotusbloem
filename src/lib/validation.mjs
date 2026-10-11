export function safeImageUrl(value) {
  if (!value) return ''
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : '' } catch { return '' }
}
export function validStockDelta(current, delta) {
  return Number.isSafeInteger(current) && Number.isSafeInteger(delta) && delta !== 0 && current + delta >= 0 && current + delta <= 2147483647
}
