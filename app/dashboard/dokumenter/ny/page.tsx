'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

type Virksomhed = {
  navn: string; cvr: string; adresse: string
  postnr: string; by: string; telefon: string; email: string
}

const SKABELONER = [
  {
    navn: 'Tom skabelon', icon: '📄',
    indhold: `<h2>Titel på dokument</h2><p>Skriv indhold her...</p>`
  },
  {
    navn: 'Standard SOP', icon: '📋',
    indhold: `<h2>1. Formål</h2>
<p>Beskriv formålet med denne procedure.</p>
<h2>2. Anvendelsesområde</h2>
<p>Beskriv hvem og hvad denne procedure gælder for.</p>
<h2>3. Ansvar</h2>
<p>Beskriv hvem der er ansvarlig for at udføre og overholde proceduren.</p>
<h2>4. Definitioner</h2>
<p>Definer relevante begreber og forkortelser.</p>
<h2>5. Procedure</h2>
<ol><li>Trin 1</li><li>Trin 2</li><li>Trin 3</li></ol>
<h2>6. Dokumentation</h2>
<p>Beskriv hvad der skal dokumenteres og hvor.</p>
<h2>7. Referencer</h2>
<p>Relevante standarder, lovkrav og interne dokumenter.</p>`
  },
  {
    navn: 'Arbejdsinstruktion', icon: '🔧',
    indhold: `<h2>Formål</h2>
<p>Beskriv hvad denne instruktion dækker.</p>
<h2>Nødvendigt udstyr og materialer</h2>
<ul><li>Udstyr 1</li><li>Udstyr 2</li></ul>
<h2>Sikkerhedsforskrifter</h2>
<p>Beskriv relevante sikkerhedsforhold inden opgaven påbegyndes.</p>
<h2>Udførelse — trin for trin</h2>
<ol><li>Trin 1</li><li>Trin 2</li><li>Trin 3</li></ol>
<h2>Kontrol og verifikation</h2>
<p>Beskriv hvad der skal kontrolleres efter udførelse.</p>
<h2>Afvigelser</h2>
<p>Beskriv hvad der gøres hvis noget går galt.</p>`
  },
  {
    navn: 'Rengøringsprocedure', icon: '🧹',
    indhold: `<h2>Formål</h2>
<p>Sikre at [udstyr/område] rengøres korrekt og i overensstemmelse med hygiejnekrav.</p>
<h2>Hyppighed</h2>
<p>Beskriv hvor ofte rengøringen skal udføres.</p>
<h2>Rengøringsmidler og koncentration</h2>
<ul><li>Rengøringsmiddel: [navn] — koncentration: [%]</li><li>Desinfektionsmiddel: [navn] — koncentration: [%]</li></ul>
<h2>Fremgangsmåde</h2>
<ol><li>Fjern løst snavs og madrester</li><li>Påfør rengøringsmiddel i korrekt koncentration</li><li>Skrub grundigt i minimum [X] minutter</li><li>Skyl grundigt med rent vand</li><li>Påfør desinfektionsmiddel og lad virke i [X] minutter</li><li>Skyl med rent vand</li></ol>
<h2>Dokumentation</h2>
<p>Udfyld rengøringslog ved afslutning. Angiv dato, tidspunkt og initialer.</p>`
  },
  {
    navn: 'Modtagekontrol', icon: '📦',
    indhold: `<h2>Formål</h2>
<p>Sikre at alle modtagne råvarer og ingredienser opfylder virksomhedens kvalitetskrav.</p>
<h2>Gælder for</h2>
<p>Alle indgående råvarer, ingredienser og hjælpestoffer.</p>
<h2>Ansvar</h2>
<p>Modtageansvarlig er ansvarlig for at udføre og dokumentere modtagekontrol.</p>
<h2>Kontrolpunkter ved modtagelse</h2>
<ol>
<li><strong>Temperatur:</strong> Mål og registrer kernetemperatur. Kølede varer max +5°C, frosne varer max -18°C.</li>
<li><strong>Emballage:</strong> Kontroller at emballage er ubeskadiget og ren.</li>
<li><strong>Mærkning:</strong> Kontroller at varen er korrekt mærket med indhold, allergen-info, holdbarhed og lotnummer.</li>
<li><strong>Lugt og udseende:</strong> Vurdér om varen er frisk og fri for fremmedlegemer.</li>
<li><strong>Leverandørdokumenter:</strong> Modtag og arkivér følgeseddel og evt. analysecertifikat.</li>
</ol>
<h2>Afvigelser</h2>
<p>Varer der ikke opfylder kravene skal afvises eller isoleres. Afvigelse registreres i afvigelsessystemet.</p>
<h2>Dokumentation</h2>
<p>Udfyld modtagekontrollog med dato, leverandør, varebeskrivelse, temperatur og lotnummer.</p>`
  },
  {
    navn: 'HACCP CCP-procedure', icon: '⚠️',
    indhold: `<h2>CCP-identifikation</h2>
<p>CCP nr.: [nummer] — Procestrin: [navn på procestrin]</p>
<h2>Identificeret fare</h2>
<p>Beskriv den biologiske, kemiske eller fysiske fare der kontrolleres ved dette CCP.</p>
<h2>Kritisk grænse</h2>
<p>Eksempel: Kernetemperatur minimum 75°C i minimum 2 minutter.</p>
<h2>Overvågning</h2>
<ul>
<li><strong>Hvad overvåges:</strong> [temperatur / pH / tid]</li>
<li><strong>Hvordan:</strong> [termometer / pH-måler / visuelt]</li>
<li><strong>Hyppighed:</strong> [hver batch / hvert X minut]</li>
<li><strong>Ansvarlig:</strong> [stilling / navn]</li>
</ul>
<h2>Korrigerende handlinger</h2>
<p>Beskriv hvad der gøres hvis den kritiske grænse overskrides.</p>
<h2>Verifikation</h2>
<p>Beskriv hvordan det verificeres at CCP'et er under kontrol.</p>
<h2>Dokumentation</h2>
<p>CCP-overvågningslog udfyldes ved hver kontrol.</p>`
  },
]

function DokumentEditorInner() {
  const [titel, setTitel] = useState('')
  const [indhold, setIndhold] = useState('')
  const [virksomhed, setVirksomhed] = useState<Virksomhed | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [version, setVersion] = useState('1.0')
  const [sidstRedigeret, setSidstRedigeret] = useState(new Date().toLocaleDateString('da-DK'))
  const [showSkabeloner, setShowSkabeloner] = useState(false)
  const [dokId, setDokId] = useState<string | null>(null)

  const [meta, setMeta] = useState({
    type: 'SOP',
    status: 'Udkast',
    ansvarlig: '',
    godkendt_af: '',
    gyldig_fra: '',
    gyldig_til: '',
    beskrivelse: '',
  })

  const editorRef = useRef<HTMLDivElement>(null)
  const indholdRef = useRef('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: vData } = await supabase
        .from('virksomhed').select('*').eq('user_id', user.id).maybeSingle()
      if (vData) setVirksomhed(vData)

      const id = searchParams.get('id')
      if (id) {
        const { data: dok } = await supabase
          .from('dokumenter').select('*').eq('id', id).single()
        if (dok) {
          setDokId(dok.id)
          setTitel(dok.titel || '')
          setVersion(dok.version || '1.0')
          setMeta({
            type: dok.type || 'SOP',
            status: dok.status || 'Udkast',
            ansvarlig: dok.ansvarlig || '',
            godkendt_af: dok.godkendt_af || '',
            gyldig_fra: dok.gyldig_fra || '',
            gyldig_til: dok.gyldig_til || '',
            beskrivelse: dok.beskrivelse || '',
          })
          if (dok.indhold) {
            const cleaned = dok.indhold.replace(/<p[^>]*style="[^"]*border-bottom[^"]*"[^>]*>[\s\S]*?<\/p>/i, '').trim()
            indholdRef.current = cleaned
            setIndhold(cleaned)
            setTimeout(() => {
              if (editorRef.current) editorRef.current.innerHTML = cleaned
            }, 100)
          }
        }
      } else {
        setShowSkabeloner(true)
      }

      setLoading(false)
    }
    init()
  }, [])

  const applySkabelon = (skabelon: typeof SKABELONER[0]) => {
    const nyIndhold = skabelon.indhold
    indholdRef.current = nyIndhold
    setIndhold(nyIndhold)
    if (editorRef.current) editorRef.current.innerHTML = nyIndhold
    setShowSkabeloner(false)
  }

  const format = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    if (editorRef.current) setIndhold(editorRef.current.innerHTML)
  }

  const save = async () => {
    if (!titel.trim()) { setSaveError('Indtast venligst en dokumenttitel'); return }
    setSaveError('')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const currentIndhold = editorRef.current?.innerHTML || indholdRef.current || indhold

    if (dokId) {
      const { data: existing } = await supabase.from('dokumenter').select('version').eq('id', dokId).single()
      const parts = (existing?.version || '1.0').split('.')
      const nyVersion = `${parts[0]}.${parseInt(parts[1] || '0') + 1}`
      const { error } = await supabase.from('dokumenter').update({
        titel: titel.trim(), indhold: currentIndhold, version: nyVersion,
        ...meta, updated_at: new Date().toISOString()
      }).eq('id', dokId)
      if (error) { setSaveError('Fejl: ' + error.message); setSaving(false); return }
      setVersion(nyVersion)
    } else {
      const { data, error } = await supabase.from('dokumenter').insert({
        user_id: user.id, titel: titel.trim(), indhold: currentIndhold,
        version: '1.0', ...meta
      }).select().single()
      if (error) { setSaveError('Fejl: ' + error.message); setSaving(false); return }
      if (data) setDokId(data.id)
    }

    setSaving(false)
    setSaved(true)
    setSidstRedigeret(new Date().toLocaleDateString('da-DK'))
    setTimeout(() => setSaved(false), 3000)
  }

  const print = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const vNavn = virksomhed?.navn || ''
    const vCvr = virksomhed?.cvr ? ` · CVR: ${virksomhed.cvr}` : ''
    const vAdresse = virksomhed?.adresse ? `${virksomhed.adresse}, ${virksomhed.postnr || ''} ${virksomhed.by || ''}`.trim() : ''

    w.document.write(`<!DOCTYPE html><html><head><title>${titel}</title>
    <style>
      @page { margin: 20mm; size: A4; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; max-width: 100%; margin: 0; padding: 0; color: #111; font-size: 13px; }

      .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 20px; }
      .doc-header-left .company { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 2px; }
      .doc-header-left .address { font-size: 11px; color: #6b7280; }
      .doc-header-right { text-align: right; }
      .doc-header-right .doc-type { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
      .doc-header-right .doc-version { font-size: 12px; font-weight: 600; color: #374151; }

      h1.doc-title { font-size: 22px; font-weight: 700; margin: 0 0 20px 0; color: #111827; }

      .meta-bar { display: flex; gap: 20px; flex-wrap: wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 24px; font-size: 11px; color: #6b7280; }
      .meta-bar span strong { color: #374151; }

      .doc-body h1 { font-size: 18px; font-weight: 700; margin-top: 24px; margin-bottom: 8px; color: #111827; }
      .doc-body h2 { font-size: 14px; font-weight: 700; margin-top: 20px; margin-bottom: 6px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
      .doc-body p { margin-bottom: 8px; line-height: 1.7; color: #374151; }
      .doc-body ul, .doc-body ol { padding-left: 20px; margin-bottom: 12px; }
      .doc-body li { margin-bottom: 4px; line-height: 1.6; color: #374151; }
      .doc-body strong, .doc-body b { font-weight: 700; }

      .doc-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
    </style></head><body>

    <div class="doc-header">
      <div class="doc-header-left">
        ${vNavn ? `<div class="company">${vNavn}${vCvr}</div>` : '<div class="company">AiQMS</div>'}
        ${vAdresse ? `<div class="address">${vAdresse}</div>` : ''}
      </div>
      <div class="doc-header-right">
        <div class="doc-type">${meta.type}</div>
        <div class="doc-version">Version ${version}</div>
        ${meta.status ? `<div style="font-size:11px;color:#6b7280">${meta.status}</div>` : ''}
      </div>
    </div>

    <h1 class="doc-title">${titel}</h1>

    <div class="meta-bar">
      ${meta.ansvarlig ? `<span><strong>Ansvarlig:</strong> ${meta.ansvarlig}</span>` : ''}
      ${meta.godkendt_af ? `<span><strong>Godkendt af:</strong> ${meta.godkendt_af}</span>` : ''}
      ${meta.gyldig_fra ? `<span><strong>Gyldig fra:</strong> ${new Date(meta.gyldig_fra).toLocaleDateString('da-DK')}</span>` : ''}
      ${meta.gyldig_til ? `<span><strong>Gyldig til:</strong> ${new Date(meta.gyldig_til).toLocaleDateString('da-DK')}</span>` : ''}
      <span><strong>Sidst redigeret:</strong> ${new Date().toLocaleDateString('da-DK')}</span>
    </div>

    <div class="doc-body">
      ${(editorRef.current?.innerHTML || indholdRef.current || indhold).replace(/<p[^>]*style="[^"]*border-bottom[^"]*"[^>]*>[\s\S]*?<\/p>/i, '').trim()}
    </div>

    <div class="doc-footer">
      <span>${vNavn || 'AiQMS'} · ${meta.type} · Version ${version}</span>
      <span>Udskrevet ${new Date().toLocaleDateString('da-DK')}</span>
    </div>

    </body></html>`)
    w.document.close()
    w.print()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-sm text-gray-400">Indlæser...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* NAV */}
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard/dokumenter" className="text-sm text-gray-400 hover:text-gray-700">← Dokumenter</a>
          <div className="w-px h-4 bg-gray-200" />
          <input value={titel} onChange={e => setTitel(e.target.value)}
            placeholder="Dokumenttitel..."
            className="text-sm font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none bg-transparent px-1 py-0.5 w-64" />
          {saveError && <span className="text-xs text-red-500">⚠️ {saveError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSkabeloner(true)}
            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            Skabeloner
          </button>
          <button onClick={print} disabled={!titel}
            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            🖨️ Print
          </button>
          <button onClick={save} disabled={saving}
            className="text-xs px-4 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Gemmer...' : saved ? '✓ Gemt' : 'Gem dokument'}
          </button>
        </div>
      </nav>

      {/* TOOLBAR */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-1 flex-wrap">
        {[
          { label: 'B', cmd: 'bold', title: 'Fed', style: 'font-bold' },
          { label: 'I', cmd: 'italic', title: 'Kursiv', style: 'italic' },
          { label: 'U', cmd: 'underline', title: 'Understreget', style: 'underline' },
        ].map(btn => (
          <button key={btn.cmd} onClick={() => format(btn.cmd)} title={btn.title}
            className={`w-7 h-7 text-xs border border-gray-200 rounded hover:bg-gray-100 ${btn.style}`}>
            {btn.label}
          </button>
        ))}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button onClick={() => format('formatBlock', 'h2')} className="px-2 h-7 text-xs border border-gray-200 rounded hover:bg-gray-100 font-semibold">Overskrift</button>
        <button onClick={() => format('formatBlock', 'p')} className="px-2 h-7 text-xs border border-gray-200 rounded hover:bg-gray-100">Tekst</button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button onClick={() => format('insertUnorderedList')} className="px-2 h-7 text-xs border border-gray-200 rounded hover:bg-gray-100">• Liste</button>
        <button onClick={() => format('insertOrderedList')} className="px-2 h-7 text-xs border border-gray-200 rounded hover:bg-gray-100">1. Liste</button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button onClick={() => format('undo')} className="px-2 h-7 text-xs border border-gray-200 rounded hover:bg-gray-100">↩ Fortryd</button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* EDITOR */}
        <div className="flex-1 overflow-auto bg-white">
          <div className="max-w-3xl mx-auto px-12 py-10">
            <div className="text-xs text-gray-400 mb-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-medium text-gray-600">{virksomhed?.navn || '[Virksomhedsnavn]'}</span>
              <span className="flex items-center gap-4 text-gray-500">
                <span>Version <strong>{version}</strong></span>
                <span>Sidst redigeret: <strong>{sidstRedigeret}</strong></span>
              </span>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                if (editorRef.current) {
                  indholdRef.current = editorRef.current.innerHTML
                  setIndhold(editorRef.current.innerHTML)
                }
              }}
              className="dok-editor min-h-96 outline-none"
              style={{ lineHeight: '1.8', fontSize: '14px' }}
              data-placeholder="Vælg en skabelon eller begynd at skrive..."
            />
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="w-64 bg-white border-l border-gray-100 p-4 overflow-y-auto flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dokumentoplysninger</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={meta.type} onChange={e => setMeta(m => ({ ...m, type: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option>SOP</option>
                <option>Arbejdsinstruktion</option>
                <option>Skabelon</option>
                <option>Politik</option>
                <option>Procedure</option>
                <option>Andet</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={meta.status} onChange={e => setMeta(m => ({ ...m, status: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option>Udkast</option>
                <option>Til godkendelse</option>
                <option>Godkendt</option>
                <option>Udgået</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ansvarlig</label>
              <input value={meta.ansvarlig} onChange={e => setMeta(m => ({ ...m, ansvarlig: e.target.value }))}
                placeholder="Navn"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Godkendt af</label>
              <input value={meta.godkendt_af} onChange={e => setMeta(m => ({ ...m, godkendt_af: e.target.value }))}
                placeholder="Navn"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gyldig fra</label>
              <input type="date" value={meta.gyldig_fra} onChange={e => setMeta(m => ({ ...m, gyldig_fra: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gyldig til</label>
              <input type="date" value={meta.gyldig_til} onChange={e => setMeta(m => ({ ...m, gyldig_til: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kort beskrivelse</label>
              <textarea value={meta.beskrivelse} onChange={e => setMeta(m => ({ ...m, beskrivelse: e.target.value }))}
                placeholder="Dokumentets formål..."
                rows={3}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            </div>

            <div className="pt-3 border-t border-gray-100">
              <button onClick={save} disabled={saving}
                className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Gemmer...' : saved ? '✓ Gemt' : 'Gem dokument'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SKABELONER MODAL */}
      {showSkabeloner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowSkabeloner(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Vælg skabelon</h2>
              <button onClick={() => setShowSkabeloner(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {SKABELONER.map(s => (
                <button key={s.navn} onClick={() => applySkabelon(s)}
                  className="text-left px-4 py-3 border border-gray-100 rounded-xl hover:border-emerald-200 hover:bg-emerald-50 transition-all">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-sm font-medium text-gray-800">{s.navn}</div>
                </button>
              ))}
            </div>
            {!virksomhed?.navn && (
              <div className="mx-4 mb-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs text-amber-700">
                  💡 <a href="/dashboard/indstillinger" className="underline font-medium">Udfyld virksomhedsprofil</a> for at få firmanavn og CVR indsat automatisk.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .dok-editor:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        .dok-editor h2 { font-size: 17px !important; font-weight: 700 !important; margin-top: 28px !important; margin-bottom: 10px !important; color: #111827 !important; display: block !important; }
        .dok-editor h1 { font-size: 22px !important; font-weight: 700 !important; margin-bottom: 16px !important; color: #111827 !important; display: block !important; }
        .dok-editor p { margin-bottom: 8px; color: #374151; display: block; }
        .dok-editor ul, .dok-editor ol { padding-left: 24px; margin-bottom: 12px; }
        .dok-editor li { margin-bottom: 4px; color: #374151; }
        .dok-editor strong, .dok-editor b { font-weight: 700; }
      `}</style>
    </div>
  )
}

export default function DokumentEditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-sm text-gray-400">Indlæser...</div></div>}>
      <DokumentEditorInner />
    </Suspense>
  )
}
