import { createUploadHandler } from './handler.ts'

const config = { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'public-test-key', imgbbKey: 'private-test-key' }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function imageRequest(type = 'image/png', bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])) {
  const form = new FormData()
  form.set('image', new File([bytes], 'test-image', { type }))
  return new Request('https://test/functions/v1/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-user-token' }, body: form })
}
function mockFetch(admin: boolean, calls: string[], uploadResult = Response.json({ success: true, data: { url: 'https://i.ibb.co/test/image.png' } })) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'test-user' })
    if (url.endsWith('/rest/v1/rpc/is_admin')) return Response.json(admin)
    assert(url === 'https://api.imgbb.com/1/upload', 'Unexpected upstream request')
    assert(init?.body instanceof FormData, 'Upload must use multipart form data')
    assert(init.body.get('key') === config.imgbbKey, 'Server must attach the API key')
    assert(!init.body.has('expiration'), 'Published images must not expire')
    assert(init.body.get('image') instanceof File, 'Server must forward the image')
    return uploadResult
  }) as typeof fetch
}
Deno.test('preflight succeeds without authentication or external calls', async () => {
  const handler = createUploadHandler(config, (() => { throw new Error('Unexpected network request') }) as typeof fetch)
  const response = await handler(new Request('https://test', { method: 'OPTIONS' }))
  assert(response.status === 204, 'Preflight must succeed')
  assert(response.headers.get('Access-Control-Allow-Headers')?.includes('authorization'), 'Allow session authorization')
})
Deno.test('missing or invalid sessions cannot reach ImgBB', async () => {
  let calls = 0
  const handler = createUploadHandler(config, (async () => { calls++; return Response.json({}, { status: 401 }) }) as typeof fetch)
  assert((await handler(new Request('https://test', { method: 'POST' }))).status === 401, 'Missing token must fail')
  assert(calls === 0, 'Missing token must not cause network calls')
  assert((await handler(imageRequest())).status === 401, 'Invalid session must fail')
  assert(Number(calls) === 1, 'Only the auth service should be called')
})
Deno.test('authenticated non-admin cannot upload', async () => {
  const calls: string[] = []
  const response = await createUploadHandler(config, mockFetch(false, calls))(imageRequest())
  assert(response.status === 403, 'Non-admin must be denied')
  assert(calls.length === 2, 'ImgBB must not be called')
})
Deno.test('unsupported or disguised file cannot reach ImgBB', async () => {
  for (const type of ['image/svg+xml', 'image/png']) {
    const calls: string[] = []
    const response = await createUploadHandler(config, mockFetch(true, calls))(imageRequest(type, new TextEncoder().encode('<svg></svg>')))
    assert(response.status === 400, 'Unsupported file must fail')
    assert(calls.length === 2, 'ImgBB must not be called')
  }
})
Deno.test('oversized body without Content-Length cannot reach ImgBB', async () => {
  const calls: string[] = []
  const response = await createUploadHandler(config, mockFetch(true, calls))(imageRequest('image/png', new Uint8Array(6 * 1024 * 1024)))
  assert(response.status === 413, 'Oversized body must fail')
  assert(calls.length === 2, 'ImgBB must not be called')
})
Deno.test('successful upload returns only the direct image URL', async () => {
  const calls: string[] = []
  const response = await createUploadHandler(config, mockFetch(true, calls))(imageRequest())
  assert(response.status === 200, 'Valid upload must succeed')
  const result = await response.json()
  assert(result.url === 'https://i.ibb.co/test/image.png', 'Return the direct URL')
  assert(Object.keys(result).length === 1, 'Do not return credentials or deletion links')
})
Deno.test('upstream errors do not leak credentials and viewer links are rejected', async () => {
  for (const result of [Response.json({ error: config.imgbbKey }, { status: 400 }), Response.json({ success: true, data: { url: 'https://ibb.co/viewer' } })]) {
    const response = await createUploadHandler(config, mockFetch(true, [], result))(imageRequest())
    assert(response.status === 502, 'Invalid upstream response must fail')
    assert(!(await response.text()).includes(config.imgbbKey), 'Do not expose credentials')
  }
})
