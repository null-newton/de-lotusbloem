import { createUploadHandler } from './handler.ts'

Deno.serve(createUploadHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  supabaseKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  imgbbKey: Deno.env.get('IMGBB_API_KEY') ?? '',
}))
