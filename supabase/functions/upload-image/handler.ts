const maxFileBytes = 5 * 1024 * 1024
const maxRequestBytes = maxFileBytes + 64 * 1024
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
type Config = { supabaseUrl: string; supabaseKey: string; imgbbKey: string }

function matchesImage(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  if (type === 'image/gif') return ['GIF87a', 'GIF89a'].includes(new TextDecoder().decode(bytes.slice(0, 6)))
  if (type === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  return false
}

export function createUploadHandler(config: Config, requestFetch: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const json = (status: number, data: unknown) => Response.json(data, { status, headers: corsHeaders })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    if (request.method !== 'POST') return json(405, { error: 'Gebruik POST om een afbeelding te uploaden.' })
    const authorization = request.headers.get('Authorization')
    if (!authorization?.match(/^Bearer \S+$/i)) return json(401, { error: 'Log opnieuw in om een afbeelding te uploaden.' })
    if (!config.supabaseUrl || !config.supabaseKey || !config.imgbbKey) return json(503, { error: 'Afbeeldingen uploaden is nog niet ingesteld.' })
    try {
      const headers = { Authorization: authorization, apikey: config.supabaseKey }
      const userResponse = await requestFetch(`${config.supabaseUrl}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) })
      if (!userResponse.ok) return json(401, { error: 'Log opnieuw in om een afbeelding te uploaden.' })
      const user = await userResponse.json()
      if (!user?.id) return json(401, { error: 'Log opnieuw in om een afbeelding te uploaden.' })
      const adminResponse = await requestFetch(`${config.supabaseUrl}/rest/v1/rpc/is_admin`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000),
      })
      if (!adminResponse.ok || await adminResponse.json() !== true) return json(403, { error: 'Alleen beheerders kunnen afbeeldingen uploaden.' })
      if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data')) return json(400, { error: 'Kies een afbeelding om te uploaden.' })
      if (Number(request.headers.get('Content-Length')) > maxRequestBytes) return json(413, { error: 'De afbeelding mag maximaal 5 MB zijn.' })
      // Limit the body while reading, even when Content-Length is absent or inaccurate.
      const reader = request.body?.getReader()
      if (!reader) return json(400, { error: 'Kies een afbeelding om te uploaden.' })
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > maxRequestBytes) { await reader.cancel(); return json(413, { error: 'De afbeelding mag maximaal 5 MB zijn.' }) }
        chunks.push(value)
      }
      const body = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
      let form: FormData
      try { form = await new Response(body, { headers: { 'Content-Type': request.headers.get('Content-Type')! } }).formData() }
      catch { return json(400, { error: 'De afbeelding kon niet worden gelezen.' }) }
      const file = form.get('image')
      if (!(file instanceof File) || !file.size) return json(400, { error: 'Kies een afbeelding om te uploaden.' })
      if (file.size > maxFileBytes) return json(413, { error: 'De afbeelding mag maximaal 5 MB zijn.' })
      if (!matchesImage(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type)) return json(400, { error: 'Gebruik een JPG-, PNG-, GIF- of WebP-afbeelding.' })
      const upload = new FormData()
      upload.set('key', config.imgbbKey)
      upload.set('image', file)
      // No expiration: the image must remain available after the post is published.
      const response = await requestFetch('https://api.imgbb.com/1/upload', { method: 'POST', body: upload, signal: AbortSignal.timeout(45000) })
      if (!response.ok) return json(502, { error: 'Uploaden naar ImgBB is niet gelukt. Probeer opnieuw.' })
      const result = await response.json()
      let url: URL
      try { url = new URL(result.data?.url) }
      catch { return json(502, { error: 'ImgBB heeft geen geldige afbeeldingslink teruggestuurd.' }) }
      if (!result.success || url.protocol !== 'https:' || url.hostname !== 'i.ibb.co') return json(502, { error: 'ImgBB heeft geen geldige afbeeldingslink teruggestuurd.' })
      return json(200, { url: url.href })
    } catch {
      // Never expose upstream responses, API keys or deletion URLs in errors.
      return json(502, { error: 'De upload kon niet worden voltooid. Probeer opnieuw.' })
    }
  }
}
