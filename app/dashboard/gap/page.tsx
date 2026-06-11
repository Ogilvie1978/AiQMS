'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

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

const STANDARD_COLORS: Record<string, string> = {
  'IFS':       'bg-blue-50 text-blue-700 border-blue-200',
  'BRC':       'bg-purple-50 text-purple-700 border-purple-200',
  'FSSC 22000':'bg-emerald-50 text-emerald-700 border-emerald-200',
  'ISO 22000': 'bg-amber-50 text-amber-700 border-amber-200',
}

const STATUS_COLORS = {
  'Opfyldt': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Mangler':  'bg-red-50 text-red-700 border-red-200',
  'Delvist':  'bg-amber-50 text-amber-700 border-amber-200',
}

export default function GapAnalysePage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'analyse' | 'krav'>('analyse')

  // Gap analyse state
  const [valgStandard, setValgStandard] = useState<Standard>('IFS')
  const [krav, setKrav] = useState<StandardKrav[]>([])
  const [dokumenter, setDokumenter] = useState<{ id: string; titel: string; type: string; status: string }[]>([])
  const [analyserer, setAnalyserer] = useState(false)
  const [resultat, setResultat] = useState<GapResultat | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('Alle')

  // Admin krav state
  const [alleKrav, setAlleKrav] = useState<StandardKrav[]>([])
  const [kravFilter, setKravFilter] = useState<Standard>('IFS')
  const [showKravForm, setShowKravForm] = useState(false)
  const [kravForm, setKravForm] = useState({
    standard: 'IFS' as Standard,
    version: '',
    kapitel: '',
    kravnummer: '',
    titel: '',
    beskrivelse: '',
    dokument_type: '',
    kritikalitet: 'Krav',
  })
  const [gemmerKrav, setGemmerKrav] = useState(false)
  const [genererLoading, setGenererLoading] = useState(false)
  const [draftLoading, setDraftLoading] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      await Promise.all([loadDokumenter(user.id), loadAlleKrav()])
      setLoading(false)
    }
    init()
  }, [])

  const loadDokumenter = async (userId: string) => {
    const { data } = await supabase.from('dokumenter').select('id, titel, type, status').eq('user_id', userId)
    setDokumenter(data || [])
  }

  const loadAlleKrav = async () => {
    const { data } = await supabase.from('standard_krav').select('*').order('standard').order('kravnummer')
    setAlleKrav(data || [])
  }

  const loadKravForStandard = async (standard: Standard) => {
    const { data } = await supabase.from('standard_krav').select('*').eq('standard', standard).order('kravnummer')
    setKrav(data || [])
    return data || []
  }

  const startAnalyse = async () => {
    setAnalyserer(true)
    setResultat(null)

    const kravListe = await loadKravForStandard(valgStandard)

    if (kravListe.length === 0) {
      setAnalyserer(false)
      alert(`Ingen krav fundet for ${valgStandard}. Tilføj krav under "Kravdatabase" fanen.`)
      return
    }

    const dokListe = dokumenter.map(d => `- ${d.titel} (${d.type}, ${d.status})`).join('\n')
    const kravSammenfatning = kravListe.slice(0, 50).map(k =>
      `${k.kravnummer}: ${k.titel}${k.dokument_type ? ` [Kræver: ${k.dokument_type}]` : ''}`
    ).join('\n')

    const prompt = `Du er en certificeret ${valgStandard} auditor. Analyser gap mellem virksomhedens dokumenter og standardens krav.

VIRKSOMHEDENS DOKUMENTER (${dokumenter.length} total):
${dokListe || 'Ingen dokumenter endnu'}

${valgStandard} KRAV (${kravListe.length} krav):
${kravSammenfatning}${kravListe.length > 50 ? `\n... og ${kravListe.length - 50} krav mere` : ''}

Analyser hvilke krav der er opfyldt, mangler eller delvist opfyldt baseret på dokumenternes titler og typer.

Svar KUN med JSON (ingen markdown):
{
  "samlet_score": <0-100>,
  "opfyldt": <antal>,
  "mangler": <antal>,
  "delvist": <antal>,
  "gaps": [
    {
      "kravnummer": "<nummer>",
      "titel": "<titel>",
      "kapitel": "<kapitel>",
      "status": "Opfyldt"|"Mangler"|"Delvist",
      "begrundelse": "<kort begrundelse>",
      "anbefaling": "<konkret anbefaling hvis mangler/delvist>"
    }
  ]
}`

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setResultat({ ...parsed, standard: valgStandard })
    } catch (err) {
      console.error('Gap analyse fejl:', err)
      alert('Fejl ved gap-analyse. Prøv igen.')
    }

    setAnalyserer(false)
  }

  const gemKrav = async () => {
    if (!kravForm.kravnummer.trim() || !kravForm.titel.trim()) return
    setGemmerKrav(true)
    await supabase.from('standard_krav').insert(kravForm)
    setGemmerKrav(false)
    setShowKravForm(false)
    setKravForm({ standard: kravFilter, version: '', kapitel: '', kravnummer: '', titel: '', beskrivelse: '', dokument_type: '', kritikalitet: 'Krav' })
    await loadAlleKrav()
  }

  const sletKrav = async (id: string) => {
    if (!confirm('Slet dette krav?')) return
    await supabase.from('standard_krav').delete().eq('id', id)
    await loadAlleKrav()
  }

  const genererKravMedAI = async (standard: Standard) => {
    setGenererLoading(true)
    const prompt = `Du er en ekspert i ${standard} standarden for fødevaresikkerhed.

Generer de vigtigste krav fra ${standard} standarden som en QMS-konsulent ville fokusere på for en dansk fødevarevirksomhed.
Inkluder de 15 vigtigste krav på tværs af kapitlerne. Hold beskrivelser meget korte (max 10 ord).

Svar KUN med JSON array (ingen markdown, ingen forklaring):
[
  {
    "standard": "${standard}",
    "version": "latest",
    "kapitel": "<kapitel>",
    "kravnummer": "<f.eks. 3.1.1>",
    "titel": "<kort titel max 8 ord>",
    "beskrivelse": "<max 10 ord>",
    "dokument_type": "<SOP|Procedure|Politik|Andet>",
    "kritikalitet": "Krav"
  }
]`

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await response.json()
      console.log('AI response:', JSON.stringify(data).slice(0, 500))
      if (data.error) throw new Error(JSON.stringify(data.error))
      const text = data.content?.[0]?.text || ''
      if (!text) throw new Error('Empty response: ' + JSON.stringify(data).slice(0, 200))
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      // Insert all generated requirements
      for (const krav of parsed) {
        await supabase.from('standard_krav').insert(krav)
      }
      await loadAlleKrav()
      alert(`✅ ${parsed.length} krav tilføjet for ${standard}`)
    } catch (err) {
      console.error('Generer krav fejl:', err)
      alert('Fejl ved generering af krav.')
    }
    setGenererLoading(false)
  }

  const genererDraft = async (gap: GapItem) => {
    setDraftLoading(gap.kravnummer)

    const prompt = `Du er en QMS-ekspert specialiseret i ${resultat?.standard} for fødevarevirksomheder.

Lav et komplet professionelt dokument-udkast på dansk for følgende krav:
Krav ${gap.kravnummer}: ${gap.titel}
Kapitel: ${gap.kapitel}

Strukturér dokumentet med disse sektioner i HTML-format:
<h2>1. Formål</h2>
<h2>2. Anvendelsesområde</h2>
<h2>3. Ansvar</h2>
<h2>4. Procedure</h2>
<h2>5. Dokumentation og registrering</h2>
<h2>6. Referencer</h2>

Brug <p>, <ul>, <ol>, <li> og <strong> tags. Gør indholdet konkret og praktisk.
Svar KUN med HTML-indholdet uden html/body tags.`

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await response.json()
      if (data.error) throw new Error(JSON.stringify(data.error))
      const htmlIndhold = data.content?.[0]?.text || ''
      if (!htmlIndhold) throw new Error('Tomt svar')

      // Gem direkte som dokument i Supabase
      const { data: nytDok, error } = await supabase.from('dokumenter').insert({
        user_id: user!.id,
        titel: `${gap.kravnummer} — ${gap.titel}`,
        indhold: htmlIndhold,
        type: 'SOP',
        status: 'Udkast',
        version: '1.0',
        beskrivelse: `Auto-genereret udkast baseret på ${resultat?.standard} krav ${gap.kravnummer}`,
      }).select().single()

      if (error) throw new Error(error.message)

      // Åbn direkte i dokumenteditoren
      window.open(`/dashboard/dokumenter/ny?id=${nytDok.id}`, '_blank')

    } catch (err) {
      console.error('Draft fejl:', err)
      alert('Fejl ved generering af udkast: ' + String(err))
    }
    setDraftLoading(null)
  }

  const filtredeGaps = resultat?.gaps.filter(g =>
    filterStatus === 'Alle' || g.status === filterStatus
  ) || []

  const filtredeKrav = alleKrav.filter(k => k.standard === kravFilter)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-sm text-gray-400">Indlæser...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700">← Dashboard</a>
          <div className="w-px h-4 bg-gray-200"/>
          <span className="text-sm font-semibold text-gray-900">Gap-analyse & Kravdatabase</span>
        </div>
      </nav>

      {/* TABS */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-6">
          {(['analyse', 'krav'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`text-sm py-3 font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {tab === 'analyse' ? '🔍 Gap-analyse' : '📋 Kravdatabase'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* ── GAP ANALYSE ── */}
        {activeTab === 'analyse' && (
          <div>
            {/* Standard vælger */}
            <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Vælg standard</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {(['IFS', 'BRC', 'FSSC 22000', 'ISO 22000'] as Standard[]).map(std => {
                  const count = alleKrav.filter(k => k.standard === std).length
                  return (
                    <button key={std} onClick={() => setValgStandard(std)}
                      className={`px-4 py-3 rounded-xl border-2 text-left transition-all ${valgStandard === std ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="text-sm font-semibold text-gray-800">{std}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{count} krav i databasen</div>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  {dokumenter.length} dokumenter i systemet · {alleKrav.filter(k => k.standard === valgStandard).length} {valgStandard}-krav klar
                </div>
                <button onClick={startAnalyse} disabled={analyserer}
                  className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-2">
                  {analyserer ? (
                    <><span className="animate-spin">⏳</span> Analyserer...</>
                  ) : (
                    <>🤖 Kør gap-analyse</>
                  )}
                </button>
              </div>
            </div>

            {/* Resultat */}
            {resultat && (
              <div>
                {/* Score overview */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-white border border-gray-100 rounded-xl p-4 col-span-1">
                    <div className="text-xs text-gray-400 mb-1">Compliance score</div>
                    <div className={`text-4xl font-bold ${resultat.samlet_score >= 70 ? 'text-emerald-600' : resultat.samlet_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                      {resultat.samlet_score}%
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{resultat.standard}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <div className="text-xs text-emerald-600 mb-1">Opfyldt</div>
                    <div className="text-3xl font-semibold text-emerald-700">{resultat.opfyldt}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <div className="text-xs text-amber-600 mb-1">Delvist</div>
                    <div className="text-3xl font-semibold text-amber-700">{resultat.delvist}</div>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <div className="text-xs text-red-600 mb-1">Mangler</div>
                    <div className="text-3xl font-semibold text-red-700">{resultat.mangler}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6">
                  <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                    <div className="bg-emerald-400 transition-all" style={{ width: `${(resultat.opfyldt / resultat.gaps.length) * 100}%` }}/>
                    <div className="bg-amber-400 transition-all" style={{ width: `${(resultat.delvist / resultat.gaps.length) * 100}%` }}/>
                    <div className="bg-red-400 transition-all" style={{ width: `${(resultat.mangler / resultat.gaps.length) * 100}%` }}/>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>{resultat.opfyldt} opfyldt</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>{resultat.delvist} delvist</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>{resultat.mangler} mangler</span>
                  </div>
                </div>

                {/* Filter + gaps liste */}
                <div className="flex items-center gap-2 mb-4">
                  {['Alle', 'Mangler', 'Delvist', 'Opfyldt'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterStatus === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {s}
                      {s !== 'Alle' && <span className="ml-1 opacity-60">
                        ({resultat.gaps.filter(g => g.status === s).length})
                      </span>}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  {filtredeGaps.map((gap, i) => (
                    <div key={i} className={`bg-white border rounded-xl p-4 ${gap.status === 'Mangler' ? 'border-red-100' : gap.status === 'Delvist' ? 'border-amber-100' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400">{gap.kravnummer}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[gap.status]}`}>{gap.status}</span>
                            {gap.kapitel && <span className="text-xs text-gray-400">{gap.kapitel}</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-800 mb-1">{gap.titel}</p>
                          <p className="text-xs text-gray-500 mb-2">{gap.begrundelse}</p>
                          {gap.anbefaling && gap.status !== 'Opfyldt' && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2">
                              <span className="text-xs font-medium text-amber-700">💡 Anbefaling: </span>
                              <span className="text-xs text-amber-700">{gap.anbefaling}</span>
                            </div>
                          )}
                          {gap.status !== 'Opfyldt' && (
                            <button
                              onClick={() => genererDraft(gap)}
                              disabled={draftLoading === gap.kravnummer}
                              className="text-xs px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 flex items-center gap-1.5">
                              {draftLoading === gap.kravnummer ? (
                                <><span className="animate-spin inline-block">⏳</span> Genererer og åbner...</>
                              ) : (
                                <>✍️ Opret dokument-udkast</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!resultat && !analyserer && (
              <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-sm font-medium text-gray-400 mb-1">Ingen analyse endnu</p>
                <p className="text-xs text-gray-300">Vælg en standard og klik "Kør gap-analyse"</p>
              </div>
            )}
          </div>
        )}

        {/* ── KRAVDATABASE ── */}
        {activeTab === 'krav' && (
          <div>
            {/* Standard filter + handlinger */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex gap-2">
                {(['IFS', 'BRC', 'FSSC 22000', 'ISO 22000'] as Standard[]).map(std => (
                  <button key={std} onClick={() => setKravFilter(std)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${kravFilter === std ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {std} ({alleKrav.filter(k => k.standard === std).length})
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => genererKravMedAI(kravFilter)} disabled={genererLoading}
                  className="text-xs px-4 py-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 disabled:opacity-50">
                  {genererLoading ? '⏳ Genererer...' : `🤖 Auto-generer ${kravFilter} krav`}
                </button>
                <button onClick={() => { setKravForm(f => ({ ...f, standard: kravFilter })); setShowKravForm(true) }}
                  className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                  + Tilføj krav
                </button>
              </div>
            </div>

            {filtredeKrav.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm font-medium text-gray-400 mb-1">Ingen krav for {kravFilter}</p>
                <p className="text-xs text-gray-300 mb-4">Brug auto-generer for at få et første udkast</p>
                <button onClick={() => genererKravMedAI(kravFilter)} disabled={genererLoading}
                  className="text-xs px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-50">
                  {genererLoading ? '⏳ Genererer...' : `🤖 Auto-generer ${kravFilter} krav`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtredeKrav.map(k => (
                  <div key={k.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium text-gray-500">{k.kravnummer}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STANDARD_COLORS[k.standard]}`}>{k.standard}</span>
                        {k.kapitel && <span className="text-xs text-gray-400">{k.kapitel}</span>}
                        {k.kritikalitet === 'Anbefaling' && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Anbefaling</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{k.titel}</p>
                      {k.beskrivelse && <p className="text-xs text-gray-500 mt-0.5">{k.beskrivelse}</p>}
                      {k.dokument_type && <p className="text-xs text-gray-400 mt-1">📄 Kræver: {k.dokument_type}</p>}
                    </div>
                    <button onClick={() => sletKrav(k.id)}
                      className="text-xs px-2.5 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 flex-shrink-0">
                      Slet
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tilføj krav form */}
            {showKravForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowKravForm(false)}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"/>
                <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Tilføj krav</h2>
                    <button onClick={() => setShowKravForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  <div className="px-6 py-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Standard</label>
                        <select value={kravForm.standard} onChange={e => setKravForm(f => ({ ...f, standard: e.target.value as Standard }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <option>IFS</option><option>BRC</option><option>FSSC 22000</option><option>ISO 22000</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
                        <input value={kravForm.version} onChange={e => setKravForm(f => ({ ...f, version: e.target.value }))}
                          placeholder="F.eks. 8.0"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Kravnummer *</label>
                        <input value={kravForm.kravnummer} onChange={e => setKravForm(f => ({ ...f, kravnummer: e.target.value }))}
                          placeholder="F.eks. 3.1.1"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Kapitel</label>
                        <input value={kravForm.kapitel} onChange={e => setKravForm(f => ({ ...f, kapitel: e.target.value }))}
                          placeholder="F.eks. Ledelsessystemer"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                      <input value={kravForm.titel} onChange={e => setKravForm(f => ({ ...f, titel: e.target.value }))}
                        placeholder="Kort beskrivelse af kravet"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse</label>
                      <textarea value={kravForm.beskrivelse} onChange={e => setKravForm(f => ({ ...f, beskrivelse: e.target.value }))}
                        placeholder="Detaljeret beskrivelse..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Krævet dokumenttype</label>
                        <input value={kravForm.dokument_type} onChange={e => setKravForm(f => ({ ...f, dokument_type: e.target.value }))}
                          placeholder="F.eks. SOP, Politik, Procedure"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Kritikalitet</label>
                        <select value={kravForm.kritikalitet} onChange={e => setKravForm(f => ({ ...f, kritikalitet: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <option>Krav</option><option>Anbefaling</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
                    <button onClick={() => setShowKravForm(false)} className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Annuller</button>
                    <button onClick={gemKrav} disabled={gemmerKrav || !kravForm.kravnummer.trim() || !kravForm.titel.trim()}
                      className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                      {gemmerKrav ? 'Gemmer...' : 'Gem krav'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
