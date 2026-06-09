'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type ReviewStatus = 'Udkast' | 'Gennemført' | 'Godkendt'

type Review = {
  id: string
  titel: string
  dato: string
  periode: string
  deltagere: string
  status: ReviewStatus
  tidligere_handlinger: string
  interne_audits: string
  kunde_feedback: string
  procesperformance: string
  afvigelser_status: string
  ressourcer: string
  risici: string
  forbedringer: string
  ressource_behov: string
  konklusioner: string
  naeste_review: string
  created_at: string
}

type SwotData = {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

const STATUS_STYLE: Record<ReviewStatus, string> = {
  Udkast:     'bg-gray-100 text-gray-600 border-gray-200',
  Gennemført: 'bg-blue-50 text-blue-600 border-blue-200',
  Godkendt:   'bg-emerald-50 text-emerald-600 border-emerald-200',
}

const emptyForm = {
  titel: '',
  dato: new Date().toISOString().split('T')[0],
  periode: '',
  deltagere: '',
  status: 'Udkast' as ReviewStatus,
  tidligere_handlinger: '',
  interne_audits: '',
  kunde_feedback: '',
  procesperformance: '',
  afvigelser_status: '',
  ressourcer: '',
  risici: '',
  forbedringer: '',
  ressource_behov: '',
  konklusioner: '',
  naeste_review: '',
}

export default function ManagementReviewPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Review | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input')

  // SWOT
  const [showSwot, setShowSwot] = useState(false)
  const [swotLoading, setSwotLoading] = useState(false)
  const [swot, setSwot] = useState<SwotData | null>(null)
  const [swotContext, setSwotContext] = useState('')
  const [qmsData, setQmsData] = useState<{
    aabneAfvigelser: number
    kritiskeAfvigelser: number
    dokumenter: number
    flows: number
    haccpAnalyser: number
  } | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)

    const { data } = await supabase
      .from('management_reviews')
      .select('*')
      .eq('user_id', user.id)
      .order('dato', { ascending: false })
    setReviews(data || [])

    // Hent QMS-data til SWOT-kontekst
    const [afv, docs, flowsData, haccp] = await Promise.all([
      supabase.from('afvigelser').select('id, alvorlighed, status').eq('user_id', user.id),
      supabase.from('dokumenter').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('flows').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('haccp_analyser').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    const afvigelser = afv.data || []
    setQmsData({
      aabneAfvigelser: afvigelser.filter(a => a.status === 'Åben').length,
      kritiskeAfvigelser: afvigelser.filter(a => a.alvorlighed === 'Kritisk' && a.status !== 'Lukket').length,
      dokumenter: docs.count || 0,
      flows: flowsData.count || 0,
      haccpAnalyser: haccp.count || 0,
    })

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!user || !form.titel.trim()) return
    setSaving(true)
    if (selected) {
      await supabase.from('management_reviews').update({
        ...form, updated_at: new Date().toISOString()
      }).eq('id', selected.id)
    } else {
      await supabase.from('management_reviews').insert({ ...form, user_id: user.id })
    }
    setSaving(false)
    setShowForm(false)
    setSelected(null)
    setForm(emptyForm)
    await load()
  }

  const openEdit = (r: Review) => {
    setSelected(r)
    setForm({
      titel: r.titel, dato: r.dato, periode: r.periode || '',
      deltagere: r.deltagere || '', status: r.status,
      tidligere_handlinger: r.tidligere_handlinger || '',
      interne_audits: r.interne_audits || '',
      kunde_feedback: r.kunde_feedback || '',
      procesperformance: r.procesperformance || '',
      afvigelser_status: r.afvigelser_status || '',
      ressourcer: r.ressourcer || '', risici: r.risici || '',
      forbedringer: r.forbedringer || '',
      ressource_behov: r.ressource_behov || '',
      konklusioner: r.konklusioner || '',
      naeste_review: r.naeste_review || '',
    })
    setActiveTab('input')
    setShowForm(true)
  }

  const deleteReview = async (id: string) => {
    if (!confirm('Slet dette review?')) return
    await supabase.from('management_reviews').delete().eq('id', id)
    await load()
  }

  // ── AI SWOT ───────────────────────────────────────────────────────────────

  const genererSwot = async () => {
    setSwotLoading(true)
    setSwot(null)

    const kontekst = `
Du er en erfaren QMS-konsulent specialiseret i fødevaresikkerhed (IFS, BRC, FSSC 22000, ISO 22000).

Her er data fra virksomhedens QMS-system:
- Åbne afvigelser: ${qmsData?.aabneAfvigelser ?? 0}
- Kritiske åbne afvigelser: ${qmsData?.kritiskeAfvigelser ?? 0}
- Antal dokumenter i systemet: ${qmsData?.dokumenter ?? 0}
- Antal produktionsflows dokumenteret: ${qmsData?.flows ?? 0}
- Antal HACCP-fareanalyser: ${qmsData?.haccpAnalyser ?? 0}
${swotContext ? `\nYderligere kontekst fra ledelsen:\n${swotContext}` : ''}

Generer en SWOT-analyse for virksomhedens kvalitetsstyringssystem.
Vær konkret, handlingsorienteret og brug dansk sprog.
Hvert punkt skal være 1-2 sætninger.

Svar KUN med et JSON-objekt i dette format (ingen markdown, ingen forklaring):
{
  "strengths": ["punkt 1", "punkt 2", "punkt 3"],
  "weaknesses": ["punkt 1", "punkt 2", "punkt 3"],
  "opportunities": ["punkt 1", "punkt 2", "punkt 3"],
  "threats": ["punkt 1", "punkt 2", "punkt 3"]
}
`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: kontekst }],
        }),
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed: SwotData = JSON.parse(clean)
      setSwot(parsed)
    } catch (err) {
      console.error('SWOT fejl:', err)
    }

    setSwotLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-sm text-gray-400">Indlæser...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* NAV */}
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700">← Dashboard</a>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-900">Management Review</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSwot(true)}
            className="text-xs px-4 py-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50">
            🤖 AI SWOT-analyse
          </button>
          <button onClick={() => { setSelected(null); setForm(emptyForm); setActiveTab('input'); setShowForm(true) }}
            className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
            + Nyt review
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* KPI */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Totalt antal reviews</div>
            <div className="text-3xl font-semibold text-gray-700">{reviews.length}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Godkendte</div>
            <div className="text-3xl font-semibold text-emerald-600">{reviews.filter(r => r.status === 'Godkendt').length}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Seneste review</div>
            <div className="text-sm font-semibold text-gray-700 mt-1">
              {reviews[0] ? new Date(reviews[0].dato).toLocaleDateString('da-DK') : '—'}
            </div>
          </div>
        </div>

        {/* LIST */}
        {reviews.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm font-medium text-gray-400 mb-1">Ingen management reviews endnu</p>
            <p className="text-xs text-gray-300 mb-4">Opret dit første ledelsesgennemgang</p>
            <button onClick={() => { setSelected(null); setForm(emptyForm); setShowForm(true) }}
              className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
              + Nyt review
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                      {r.periode && <span className="text-xs text-gray-400">{r.periode}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{r.titel}</h3>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>📅 {new Date(r.dato).toLocaleDateString('da-DK')}</span>
                      {r.deltagere && <span>👥 {r.deltagere}</span>}
                      {r.naeste_review && <span>Næste: {new Date(r.naeste_review).toLocaleDateString('da-DK')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(r)}
                      className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                      Rediger
                    </button>
                    <button onClick={() => deleteReview(r.id)}
                      className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                      Slet
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* SWOT MODAL */}
      {showSwot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowSwot(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-gray-900">🤖 AI SWOT-analyse</h2>
                <p className="text-xs text-gray-400 mt-0.5">Baseret på dit QMS-data</p>
              </div>
              <button onClick={() => setShowSwot(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-5">

              {/* QMS Data overblik */}
              {qmsData && (
                <div className="bg-slate-50 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Data der analyseres</p>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Åbne afvigelser', value: qmsData.aabneAfvigelser, alert: qmsData.aabneAfvigelser > 0 },
                      { label: 'Kritiske', value: qmsData.kritiskeAfvigelser, alert: qmsData.kritiskeAfvigelser > 0 },
                      { label: 'Dokumenter', value: qmsData.dokumenter, alert: false },
                      { label: 'Flows', value: qmsData.flows, alert: false },
                      { label: 'HACCP-analyser', value: qmsData.haccpAnalyser, alert: false },
                    ].map(item => (
                      <div key={item.label} className="text-center">
                        <div className={`text-2xl font-semibold ${item.alert ? 'text-red-500' : 'text-gray-700'}`}>{item.value}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ekstra kontekst */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-600 mb-1">Tilføj kontekst (valgfrit)</label>
                <textarea
                  value={swotContext}
                  onChange={e => setSwotContext(e.target.value)}
                  placeholder="F.eks: Vi har netop skiftet leverandør af emballage. Vi planlægger en ny produktlinje til næste kvartal. Vi har haft en ekstern audit i denne periode..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <button
                onClick={genererSwot}
                disabled={swotLoading}
                className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 mb-6"
              >
                {swotLoading ? '🤖 Analyserer...' : '🤖 Generer SWOT-analyse'}
              </button>

              {/* SWOT resultat */}
              {swot && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-emerald-700 mb-3">💪 Styrker</h3>
                    <ul className="space-y-2">
                      {swot.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-emerald-800 flex gap-2">
                          <span className="text-emerald-400 flex-shrink-0">✓</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-3">⚠️ Svagheder</h3>
                    <ul className="space-y-2">
                      {swot.weaknesses.map((w, i) => (
                        <li key={i} className="text-xs text-red-800 flex gap-2">
                          <span className="text-red-400 flex-shrink-0">!</span>{w}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">🚀 Muligheder</h3>
                    <ul className="space-y-2">
                      {swot.opportunities.map((o, i) => (
                        <li key={i} className="text-xs text-blue-800 flex gap-2">
                          <span className="text-blue-400 flex-shrink-0">→</span>{o}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-amber-700 mb-3">🛡️ Trusler</h3>
                    <ul className="space-y-2">
                      {swot.threats.map((t, i) => (
                        <li key={i} className="text-xs text-amber-800 flex gap-2">
                          <span className="text-amber-400 flex-shrink-0">▲</span>{t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-gray-900">{selected ? 'Rediger review' : 'Nyt Management Review'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {/* TABS */}
            <div className="flex border-b border-gray-100 px-6">
              <button onClick={() => setActiveTab('input')}
                className={`text-xs py-3 px-4 font-medium border-b-2 transition-colors ${activeTab === 'input' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                Input
              </button>
              <button onClick={() => setActiveTab('output')}
                className={`text-xs py-3 px-4 font-medium border-b-2 transition-colors ${activeTab === 'output' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                Output & konklusioner
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">

              {activeTab === 'input' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                    <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                      placeholder="F.eks. Management Review Q1 2025"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dato</label>
                      <input type="date" value={form.dato} onChange={e => setForm(f => ({ ...f, dato: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Periode</label>
                      <input value={form.periode} onChange={e => setForm(f => ({ ...f, periode: e.target.value }))}
                        placeholder="Q1 2025"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ReviewStatus }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option>Udkast</option>
                        <option>Gennemført</option>
                        <option>Godkendt</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Deltagere</label>
                    <input value={form.deltagere} onChange={e => setForm(f => ({ ...f, deltagere: e.target.value }))}
                      placeholder="Navne på deltagere adskilt med komma"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>

                  {[
                    { key: 'tidligere_handlinger', label: 'Opfølgning på tidligere handlinger', placeholder: 'Status på handlinger fra forrige review...' },
                    { key: 'interne_audits', label: 'Interne audits og inspektioner', placeholder: 'Resultater fra interne audits...' },
                    { key: 'kunde_feedback', label: 'Kundeklager og feedback', placeholder: 'Oversigt over kundeklager og feedback...' },
                    { key: 'procesperformance', label: 'Procesperformance og produktoverensstemmelse', placeholder: 'Nøgletal og KPI\'er...' },
                    { key: 'afvigelser_status', label: 'Status på afvigelser og CAPA', placeholder: 'Oversigt over afvigelser og korrigerende handlinger...' },
                    { key: 'ressourcer', label: 'Ressourcer og kompetencer', placeholder: 'Behov for ressourcer, uddannelse...' },
                    { key: 'risici', label: 'Risikovurdering', placeholder: 'Identificerede risici og muligheder...' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                      <textarea
                        value={(form as any)[field.key]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                    </div>
                  ))}
                </>
              )}

              {activeTab === 'output' && (
                <>
                  {[
                    { key: 'forbedringer', label: 'Beslutninger om forbedringer', placeholder: 'Hvad skal forbedres...' },
                    { key: 'ressource_behov', label: 'Ressourcebehov', placeholder: 'Nødvendige ressourcer og investeringer...' },
                    { key: 'konklusioner', label: 'Konklusioner og handlingsplan', placeholder: 'Samlede konklusioner og næste skridt...' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                      <textarea
                        value={(form as any)[field.key]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Dato for næste review</label>
                    <input type="date" value={form.naeste_review} onChange={e => setForm(f => ({ ...f, naeste_review: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                Annuller
              </button>
              <div className="flex gap-2">
                {activeTab === 'input' && (
                  <button onClick={() => setActiveTab('output')}
                    className="text-xs px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                    Næste →
                  </button>
                )}
                <button onClick={save} disabled={saving || !form.titel.trim()}
                  className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                  {saving ? 'Gemmer...' : selected ? 'Gem ændringer' : 'Opret review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
