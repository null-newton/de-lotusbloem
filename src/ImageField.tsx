import { useRef, useState, type ChangeEvent } from 'react'
import { Upload, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import { safeImageUrl } from './lib/validation.mjs'

export function ImageField({ value, onChange, onBusyChange, disabled, demo }: {
  value: string
  onChange: (url: string) => void
  onBusyChange: (busy: boolean) => void
  disabled: boolean
  demo: boolean
}) {
  const picker = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = safeImageUrl(value)
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setError('Gebruik een JPG-, PNG-, GIF- of WebP-afbeelding.'); return }
    if (!file.size || file.size > 5 * 1024 * 1024) { setError('Kies een afbeelding van maximaal 5 MB.'); return }
    if (!supabase || demo) { setError('Log in op de beheeromgeving om afbeeldingen te uploaden.'); return }
    setUploading(true)
    onBusyChange(true)
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) throw new Error('Log opnieuw in om een afbeelding te uploaden.')
      const body = new FormData()
      body.set('image', file)
      const { data, error: uploadError } = await supabase.functions.invoke('upload-image', { body })
      if (uploadError) {
        let message = 'Uploaden is niet gelukt. Controleer of de uploadfunctie ingesteld is en probeer opnieuw.'
        if (uploadError.context instanceof Response) {
          try { const details = await uploadError.context.json(); if (typeof details.error === 'string') message = details.error } catch { /* Keep the fallback message. */ }
        }
        throw new Error(message)
      }
      if (!data?.url || !safeImageUrl(data.url)) throw new Error('De upload heeft geen geldige afbeeldingslink teruggestuurd.')
      onChange(data.url)
      setFailedUrl(null)
    } catch (error) { setError(error instanceof Error ? error.message : 'Uploaden is niet gelukt. Probeer opnieuw.') }
    finally { setUploading(false); onBusyChange(false) }
  }
  return <div className="image-field">
    <span className="image-field-title">Afbeelding · optioneel</span>
    <input ref={picker} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => void upload(event)} disabled={disabled || uploading || demo} aria-label="Afbeelding kiezen" />
    <button type="button" className="button outline" disabled={disabled || uploading || demo} onClick={() => picker.current?.click()}><Upload size={17} />{uploading ? 'Uploaden…' : 'Afbeelding uploaden'}</button>
    <p className="small-text">{demo ? 'Uploaden is beschikbaar na inloggen. Je kunt hier wel een afbeeldingslink proberen.' : 'JPG, PNG, WebP of GIF · maximaal 5 MB'}</p>
    {uploading && <p role="status" className="small-text">Je afbeelding wordt geüpload…</p>}
    {url && <div className="image-field-preview">{failedUrl !== url ? <img src={url} alt="Voorbeeld van de gekozen afbeelding" onError={() => setFailedUrl(url)} /> : <p>De afbeelding kan niet worden geladen.</p>}<button type="button" aria-label="Afbeelding verwijderen" disabled={disabled || uploading} onClick={() => { onChange(''); setError('') }}><X size={18} /></button></div>}
    <label>Of plak een afbeeldingslink<input type="url" placeholder="https://…" value={value} disabled={disabled || uploading} onChange={event => { onChange(event.target.value); setError('') }} /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>
}
