'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Typer ────────────────────────────────────────────────────────────────────

type Standard = 'IFS' | 'BRC' | 'FSSC 22000' | 'ISO 22000'

type StandardKrav = {
  id: string
  standard: Standard
  version: string
  kapitel: string
  kravnummer: string
  titel: string
  beskrivelse: string
  dokument_type: string
  kritikalitet: string
}

type GapItem = {
  kravnummer: string
  titel: string
  kapitel: string
  status: 'Opfyldt' | 'Mangler' | 'Delvist'
  begrundelse: string
  anbefaling: string
}

type GapResultat = {
  standard: string
  samlet_score: number
  opfyldt: number
  mangler: number
  delvist: number
  gaps: GapItem[]
}

// ─── Hjælpefunktioner ─────────────────────────────────────────────────────────

function safeParseJSON(text: string): unknown {
  // Fjern markdown fences
  let clean = text.replace(/```json|```/g, '').trim()
  // Fjern ugyldige kontroltegn (men behold newlines og tabs)
  clean = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  // Prøv direkte parse
  try {
    return JSON.parse(clean)
  } catch {
    // Prøv at udtrække JSON-objekt
    const objMatch = clean.match(/\{[\s\S]*\}/)
    if (objMatch) return JSON.parse(objMatch[0])
    // Prøv at udtrække JSON-array
    const arrMatch = clean.match(/\[[\s\S]*\]/)
    if (arrMatch) return JSON.parse(arrMatch[0])
    throw new Error('Kunne ikke parse AI-svar')
  }
}

// ─── Kompetencer ──────────────────────────────────────────────────────────────

const STANDARD_META: Record<Standard, { farve: string; beskrivelse: string }> = {
  'IFS':        { farve: 'blue',    beskrivelse: 'International Featured Standard' },
  'BRC':        { farve: 'purple',  beskrivelse: 'British Retail Consortium' },
  'FSSC 22000': { farve: 'emerald', beskrivelse: 'Food Safety System Certification' },
  'ISO 22000':  { farve: 'amber',   beskrivelse: 'International Organization for Standardization' },
}

const STANDARD_KLASSER: Record<string, string> = {
  blue:    'border-blue-300 bg-blue-50 text-blue-700',
  purple:  'border-purple-300 bg-purple-50 text-purple-700',
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  amber:   'border-amber-300 bg-amber-50 text-amber-700',
}

// ─── Hoved-komponent ──────────────────────────────────────────────────────────

export default function GapAnalysePage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [fane, setFane]           = useState<'analyse' | 'krav'>('analyse')

  // Analyse state
  const [valgtStandard, setValgtStandard] = useState<Standard>('FSSC 22000')
  const [dokumenter, setDokumenter]       = useState<{ id: string; titel: string; type: string; status: string }[]>([])
  const [alleKrav, setAlleKrav]           = useState<StandardKrav[]>([])
  const [analyserer, setAnalyserer]       = useState(false)
  const [resultat, setResultat]           = useState<GapResultat | null>(null)
  const [filterStatus, setFilterStatus]   = useState<string>('Alle')
  const [fejl, setFejl]                   = useState('')
  const [draftLoading, setDraftLoading]   = useState<string | null>(null)

  // Kravdatabase state
  const [kravFane, setKravFane]           = useState<Standard>('FSSC 22000')
  const [visKravForm, setVisKravForm]     = useState(false)
  const [gemmerKrav, setGemmerKrav]       = useState(false)
  const [genererLoading, setGenererLoading] = useState(false)
  const [kravForm, setKravForm]           = useState({
    standard: 'FSSC 22000' as Standard,
    version: '',
    kapitel: '',
    kravnummer: '',
    titel: '',
    beskrivelse: '',
    dokument_type: '',
    kritikalitet: 'Krav',
  })

  // ─── Init ──────────────────────────────────────────────────────────────────

  const hentAlleKrav = useCallback(async () => {
    const { data } = await supabase
      .from('standard_krav')
      .select('*')
      .order('standard')
      .order('kravnummer')
    setAlleKrav(data || [])
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('dokumenter')
        .select('id, titel, type, status')
        .eq('user_id', user.id)
      setDokumenter(data || [])
      await hentAlleKrav()
      setLoading(false)
    }
    init()
  }, [])

  // ─── Gap-analyse ───────────────────────────────────────────────────────────

  const startAnalyse = async () => {
    setAnalyserer(true)
    setResultat(null)
    setFejl('')

    const { data: kravListe } = await supabase
      .from('standard_krav')
      .select('*')
      .eq('standard', valgtStandard)
      .order('kravnummer')

    if (!kravListe || kravListe.length === 0) {
      setFejl(`Ingen krav fundet for ${valgtStandard}. Tilføj krav under "Kravdatabase".`)
      setAnalyserer(false)
      return
    }

    const dokListe = dokumenter.length > 0
      ? dokumenter.map(d => `- ${d.titel} (${d.type}, ${d.status})`).join('\n')
      : 'Ingen dokumenter registreret endnu'

    const kravTekst = kravListe.slice(0, 60).map(k =>
      `${k.kravnummer}: ${k.titel}`
    ).join('\n')

    const prompt = `Du er en certificeret ${valgtStandard} auditor. Analyser gap mellem virksomhedens dokumenter og standardens krav.

VIRKSOMHEDENS DOKUMENTER (${dokumenter.length} total):
${dokListe}

${valgtStandard} KRAV (${kravListe.length} krav):
${kravTekst}${kravListe.length > 60 ? `\n... og ${kravListe.length - 60} krav mere` : ''}

Returner KUN et JSON-objekt uden markdown eller forklaring:
{"samlet_score":75,"opfyldt":10,"mangler":5,"delvist":3,"gaps":[{"kravnummer":"4.1","titel":"Kontekst","kapitel":"ISO 22000","status":"Opfyldt","begrundelse":"Dækket af eksisterende dokumenter","anbefaling":""},{"kravnummer":"5.2","titel":"Politik","kapitel":"ISO 22000","status":"Mangler","begrundelse":"Ingen politik fundet","anbefaling":"Opret en foedevaresikkerhedspolitik"}]}`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(JSON.stringify(data.error))
      const text = data.content?.[0]?.text || ''
      if (!text) throw new Error('Tomt svar fra AI')
      const parsed = safeParseJSON(text) as GapResultat
      setResultat({ ...parsed, standard: valgtStandard })
    } catch (err) {
      console.error('Gap analyse fejl:', err)
      setFejl('Fejl ved gap-analyse. Prøv igen.')
    }

    setAnalyserer(false)
  }

  // ─── Opret dokument-udkast ────────────────────────────────────────────────

  const genererDraft = async (gap: GapItem) => {
    if (!userId) return
    setDraftLoading(gap.kravnummer)

    const prompt = `Du er QMS-ekspert i ${resultat?.standard}. Skriv et kort professionelt dokument-udkast på dansk.

Krav ${gap.kravnummer}: ${gap.titel}
Kapitel: ${gap.kapitel}

Brug HTML med <h2>, <p>, <ul>, <li> og <strong> tags.
Sektioner: 1. Formaal, 2. Anvendelsesomraade, 3. Ansvar, 4. Procedure, 5. Dokumentation.
Svar KUN med HTML uden html/body tags.`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(JSON.stringify(data.error))
      const htmlIndhold = data.content?.[0]?.text || ''
      if (!htmlIndhold) throw new Error('Tomt svar')

      const { data: nytDok, error } = await supabase.from('dokumenter').insert({
        user_id: userId,
        titel: `${gap.kravnummer} - ${gap.titel}`,
        indhold: htmlIndhold,
        type: 'SOP',
        status: 'Udkast',
        version: '1.0',
        beskrivelse: `Auto-genereret udkast baseret paa ${resultat?.standard} krav ${gap.kravnummer}`,
      }).select().single()

      if (error) throw new Error(error.message)
      window.open(`/dashboard/dokumenter/ny?id=${nytDok.id}`, '_blank')
    } catch (err) {
      alert('Fejl ved generering: ' + String(err))
    }
    setDraftLoading(null)
  }

  // ─── Kravdatabase ─────────────────────────────────────────────────────────

  const gemKrav = async () => {
    if (!kravForm.kravnummer.trim() || !kravForm.titel.trim()) return
    setGemmerKrav(true)
    await supabase.from('standard_krav').insert(kravForm)
    setGemmerKrav(false)
    setVisKravForm(false)
    setKravForm(f => ({ ...f, kravnummer: '', titel: '', beskrivelse: '', dokument_type: '' }))
    await hentAlleKrav()
  }

  const sletKrav = async (id: string) => {
    if (!confirm('Slet dette krav?')) return
    await supabase.from('standard_krav').delete().eq('id', id)
    await hentAlleKrav()
  }

  const genererKravMedAI = async (standard: Standard) => {
    setGenererLoading(true)
    const prompt = `Du er ekspert i ${standard} for foedevarevirksomheder.
Generer de 15 vigtigste krav fra ${standard} standarden.
Svar KUN med JSON array uden markdown:
[{"standard":"${standard}","version":"latest","kapitel":"<kapitel>","kravnummer":"<nummer>","titel":"<max 8 ord>","beskrivelse":"<max 10 ord>","dokument_type":"<SOP|Procedure|Politik|Andet>","kritikalitet":"Krav"}]`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(JSON.stringify(data.error))
      const text = data.content?.[0]?.text || ''
      const parsed = safeParseJSON(text) as StandardKrav[]
      for (const k of parsed) {
        await supabase.from('standard_krav').insert(k)
      }
      await hentAlleKrav()
      alert(`${parsed.length} krav tilfojet for ${standard}`)
    } catch (err) {
      alert('Fejl: ' + String(err))
    }
    setGenererLoading(false)
  }

  // ─── Filtrering ───────────────────────────────────────────────────────────

  const filtredeGaps = resultat?.gaps.filter(g =>
    filterStatus === 'Alle' || g.status === filterStatus
  ) || []

  const kravForFane = alleKrav.filter(k => k.standard === kravFane)

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Indlæser...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Topbar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Dashboard</a>
          <span className="text-gray-200">|</span>
          <span className="text-sm font-semibold text-gray-800">Gap-analyse</span>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setFane('analyse')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${fane === 'analyse' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Analyse
          </button>
          <button
            onClick={() => setFane('krav')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${fane === 'krav' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Kravdatabase
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* ══════════════════════════════════════════════════════════════
            FANE: ANALYSE
        ══════════════════════════════════════════════════════════════ */}
        {fane === 'analyse' && (
          <div className="space-y-6">

            {/* Standard-vælger */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Vælg standard</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {(Object.keys(STANDARD_META) as Standard[]).map(std => {
                  const antal = alleKrav.filter(k => k.standard === std).length
                  const meta  = STANDARD_META[std]
                  const aktiv = valgtStandard === std
                  return (
                    <button
                      key={std}
                      onClick={() => { setValgtStandard(std); setResultat(null) }}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${aktiv ? `${STANDARD_KLASSER[meta.farve]} border-current` : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                    >
                      <div className="text-sm font-bold text-gray-900">{std}</div>
                      <div className="text-xs text-gray-400 mt-1 leading-tight">{meta.beskrivelse}</div>
                      <div className={`text-xs font-medium mt-2 ${aktiv ? '' : 'text-gray-400'}`}>{antal} krav</div>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-400">
                  {dokumenter.length} dokumenter · {alleKrav.filter(k => k.standard === valgtStandard).length} {valgtStandard}-krav klar
                </div>
                <button
                  onClick={startAnalyse}
                  disabled={analyserer}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  {analyserer ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Analyserer...</>
                  ) : (
                    <>🔍 Kør gap-analyse</>
                  )}
                </button>
              </div>
            </div>

            {/* Fejlbesked */}
            {fejl && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {fejl}
              </div>
            )}

            {/* Ingen analyse endnu */}
            {!resultat && !analyserer && !fejl && (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-base font-semibold text-gray-700 mb-1">Vælg en standard og kør analysen</p>
                <p className="text-sm text-gray-400">AI'en sammenligner dine dokumenter med standardens krav</p>
              </div>
            )}

            {/* Analyserer */}
            {analyserer && (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-500">Analyserer {valgtStandard}-krav mod dine dokumenter...</p>
              </div>
            )}

            {/* Resultat */}
            {resultat && !analyserer && (
              <div className="space-y-4">

                {/* Score-kort */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Score</p>
                    <div>
                      <div className={`text-5xl font-black ${resultat.samlet_score >= 70 ? 'text-emerald-500' : resultat.samlet_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {resultat.samlet_score}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">ud af 100</div>
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
                    <p className="text-xs font-semibold text-emerald-600 mb-2">Opfyldt</p>
                    <p className="text-4xl font-bold text-emerald-700">{resultat.opfyldt}</p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
                    <p className="text-xs font-semibold text-amber-600 mb-2">Delvist</p>
                    <p className="text-4xl font-bold text-amber-700">{resultat.delvist}</p>
                  </div>
                  <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
                    <p className="text-xs font-semibold text-red-600 mb-2">Mangler</p>
                    <p className="text-4xl font-bold text-red-700">{resultat.mangler}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 gap-0.5">
                    <div
                      className="bg-emerald-400 rounded-l-full transition-all duration-700"
                      style={{ width: `${(resultat.opfyldt / resultat.gaps.length) * 100}%` }}
                    />
                    <div
                      className="bg-amber-400 transition-all duration-700"
                      style={{ width: `${(resultat.delvist / resultat.gaps.length) * 100}%` }}
                    />
                    <div
                      className="bg-red-400 rounded-r-full transition-all duration-700"
                      style={{ width: `${(resultat.mangler / resultat.gaps.length) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-5 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />{resultat.opfyldt} opfyldt</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />{resultat.delvist} delvist</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />{resultat.mangler} mangler</span>
                  </div>
                </div>

                {/* Filter-knapper */}
                <div className="flex gap-2 flex-wrap">
                  {['Alle', 'Mangler', 'Delvist', 'Opfyldt'].map(s => {
                    const antal = s === 'Alle' ? resultat.gaps.length : resultat.gaps.filter(g => g.status === s).length
                    return (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${filterStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                      >
                        {s} <span className="opacity-60 ml-1">({antal})</span>
                      </button>
                    )
                  })}
                </div>

                {/* Gap-liste */}
                <div className="space-y-2">
                  {filtredeGaps.map((gap, i) => (
                    <div
                      key={i}
                      className={`bg-white rounded-xl border p-4 transition-all ${
                        gap.status === 'Mangler' ? 'border-red-100' :
                        gap.status === 'Delvist' ? 'border-amber-100' :
                        'border-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{gap.kravnummer}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              gap.status === 'Opfyldt' ? 'bg-emerald-100 text-emerald-700' :
                              gap.status === 'Mangler' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{gap.status}</span>
                            {gap.kapitel && <span className="text-xs text-gray-400 truncate">{gap.kapitel}</span>}
                          </div>
                          <p className="text-sm font-semibold text-gray-800 mb-1">{gap.titel}</p>
                          <p className="text-xs text-gray-500">{gap.begrundelse}</p>
                          {gap.anbefaling && gap.status !== 'Opfyldt' && (
                            <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                              <span className="text-xs font-semibold text-amber-700">Anbefaling: </span>
                              <span className="text-xs text-amber-700">{gap.anbefaling}</span>
                            </div>
                          )}
                        </div>
                        {gap.status !== 'Opfyldt' && (
                          <button
                            onClick={() => genererDraft(gap)}
                            disabled={draftLoading === gap.kravnummer}
                            className="flex-shrink-0 text-xs px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                          >
                            {draftLoading === gap.kravnummer ? (
                              <><span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" /> Opretter...</>
                            ) : (
                              <>✍️ Opret udkast</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            FANE: KRAVDATABASE
        ══════════════════════════════════════════════════════════════ */}
        {fane === 'krav' && (
          <div className="space-y-5">

            {/* Topbar med faner og handlinger */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-1.5 flex-wrap">
                {(Object.keys(STANDARD_META) as Standard[]).map(std => (
                  <button
                    key={std}
                    onClick={() => setKravFane(std)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${kravFane === std ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    {std} ({alleKrav.filter(k => k.standard === std).length})
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => genererKravMedAI(kravFane)}
                  disabled={genererLoading}
                  className="text-xs px-4 py-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 disabled:opacity-50 font-medium"
                >
                  {genererLoading ? '⏳ Genererer...' : `🤖 Auto-generer krav`}
                </button>
                <button
                  onClick={() => { setKravForm(f => ({ ...f, standard: kravFane })); setVisKravForm(true) }}
                  className="text-xs px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  + Tilføj krav
                </button>
              </div>
            </div>

            {/* Krav-liste */}
            {kravForFane.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Ingen krav for {kravFane}</p>
                <p className="text-xs text-gray-400 mb-5">Brug auto-generer for at komme i gang</p>
                <button
                  onClick={() => genererKravMedAI(kravFane)}
                  disabled={genererLoading}
                  className="text-xs px-5 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 disabled:opacity-50 font-semibold"
                >
                  {genererLoading ? '⏳ Genererer...' : `🤖 Auto-generer ${kravFane} krav`}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {kravForFane.map(k => (
                  <div key={k.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-start justify-between gap-4 hover:border-gray-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{k.kravnummer}</span>
                        {k.kapitel && <span className="text-xs text-gray-400">{k.kapitel}</span>}
                        {k.dokument_type && <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">📄 {k.dokument_type}</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{k.titel}</p>
                      {k.beskrivelse && <p className="text-xs text-gray-500 mt-0.5">{k.beskrivelse}</p>}
                    </div>
                    <button
                      onClick={() => sletKrav(k.id)}
                      className="flex-shrink-0 text-xs px-2.5 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Slet
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── Modal: Tilføj krav ── */}
      {visKravForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setVisKravForm(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Tilføj krav</h2>
              <button onClick={() => setVisKravForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Standard</label>
                  <select
                    value={kravForm.standard}
                    onChange={e => setKravForm(f => ({ ...f, standard: e.target.value as Standard }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option>IFS</option>
                    <option>BRC</option>
                    <option>FSSC 22000</option>
                    <option>ISO 22000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kravnummer *</label>
                  <input
                    value={kravForm.kravnummer}
                    onChange={e => setKravForm(f => ({ ...f, kravnummer: e.target.value }))}
                    placeholder="F.eks. 2.5.1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kapitel</label>
                  <input
                    value={kravForm.kapitel}
                    onChange={e => setKravForm(f => ({ ...f, kapitel: e.target.value }))}
                    placeholder="F.eks. ISO 22000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dokumenttype</label>
                  <input
                    value={kravForm.dokument_type}
                    onChange={e => setKravForm(f => ({ ...f, dokument_type: e.target.value }))}
                    placeholder="SOP, Politik..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                <input
                  value={kravForm.titel}
                  onChange={e => setKravForm(f => ({ ...f, titel: e.target.value }))}
                  placeholder="Kort beskrivelse af kravet"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse</label>
                <textarea
                  value={kravForm.beskrivelse}
                  onChange={e => setKravForm(f => ({ ...f, beskrivelse: e.target.value }))}
                  placeholder="Yderligere detaljer..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
              <button
                onClick={() => setVisKravForm(false)}
                className="text-sm px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
              >
                Annuller
              </button>
              <button
                onClick={gemKrav}
                disabled={gemmerKrav || !kravForm.kravnummer.trim() || !kravForm.titel.trim()}
                className="text-sm px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium"
              >
                {gemmerKrav ? 'Gemmer...' : 'Gem krav'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
