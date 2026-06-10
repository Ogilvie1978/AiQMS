'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type LeverandørStatus = 'Aktiv' | 'Suspenderet' | 'Udgået'
type LeverandørKategori = 'Råvare' | 'Ingrediens' | 'Emballage' | 'Service' | 'Udstyr' | 'Andet'

type Leverandør = {
  id: string
  navn: string
  kontakt_person: string
  email: string
  telefon: string
  adresse: string
  land: string
  kategori: LeverandørKategori
  status: LeverandørStatus
  godkendt: boolean
  godkendt_dato: string
  naeste_evaluering: string
  noter: string
  created_at: string
}

type Evaluering = {
  id: string
  leverandoer_id: string
  dato: string
  evaluator: string
  score_kvalitet: number
  score_levering: number
  score_dokumentation: number
  score_kommunikation: number
  kommentar: string
  godkendt: boolean
}

const STATUS_STYLE: Record<LeverandørStatus, string> = {
  Aktiv:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  Suspenderet: 'bg-amber-50 text-amber-700 border-amber-200',
  Udgået:      'bg-red-50 text-red-700 border-red-200',
}

const KATEGORI_STYLE: Record<LeverandørKategori, string> = {
  Råvare:     'bg-blue-50 text-blue-700',
  Ingrediens: 'bg-purple-50 text-purple-700',
  Emballage:  'bg-amber-50 text-amber-700',
  Service:    'bg-slate-50 text-slate-700',
  Udstyr:     'bg-orange-50 text-orange-700',
  Andet:      'bg-gray-50 text-gray-600',
}

const emptyLev = {
  navn: '', kontakt_person: '', email: '', telefon: '',
  adresse: '', land: 'Danmark',
  kategori: 'Råvare' as LeverandørKategori,
  status: 'Aktiv' as LeverandørStatus,
  godkendt: false, godkendt_dato: '', naeste_evaluering: '', noter: '',
}

const emptyEval = {
  dato: new Date().toISOString().split('T')[0],
  evaluator: '',
  score_kvalitet: 5,
  score_levering: 5,
  score_dokumentation: 5,
  score_kommunikation: 5,
  kommentar: '',
  godkendt: true,
}

// Farve fra rød (1) til grøn (10)
function scoreColor(score: number) {
  const pct = (score - 1) / 9
  const r = Math.round(220 - pct * (220 - 34))
  const g = Math.round(38 + pct * (197 - 38))
  const b = Math.round(38 + pct * (94 - 38))
  return `rgb(${r}, ${g}, ${b})`
}

function scoreLabel(score: number) {
  if (score >= 9) return 'Fremragende'
  if (score >= 7) return 'God'
  if (score >= 5) return 'Acceptabel'
  if (score >= 3) return 'Under middel'
  return 'Utilfredsstillende'
}

function ScoreBar({ score, onChange, label }: { score: number; onChange?: (n: number) => void; label: string }) {
  const color = scoreColor(score)
  const pct = ((score - 1) / 9) * 100

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{score}/10</span>
      </div>
      {onChange ? (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1} max={10} step={1}
            value={score}
            onChange={e => onChange(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${color} ${pct}%, #e5e7eb ${pct}%)`,
            }}
          />
        </div>
      ) : (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  )
}

function samletScore(e: Evaluering) {
  return (e.score_kvalitet + e.score_levering + e.score_dokumentation + e.score_kommunikation) / 4
}

export default function LeverandoerPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [leverandoerer, setLeverandoerer] = useState<Leverandør[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Leverandør | null>(null)
  const [form, setForm] = useState(emptyLev)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [filterKategori, setFilterKategori] = useState('Alle')
  const [search, setSearch] = useState('')

  const [viewLev, setViewLev] = useState<Leverandør | null>(null)
  const [evalueringer, setEvalueringer] = useState<Evaluering[]>([])
  const [showEvalForm, setShowEvalForm] = useState(false)
  const [evalForm, setEvalForm] = useState(emptyEval)
  const [savingEval, setSavingEval] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)
    const { data } = await supabase
      .from('leverandoerer')
      .select('*')
      .eq('user_id', user.id)
      .order('navn', { ascending: true })
    setLeverandoerer(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const loadEvalueringer = async (levId: string) => {
    const { data } = await supabase
      .from('leverandoer_evalueringer')
      .select('*')
      .eq('leverandoer_id', levId)
      .order('dato', { ascending: false })
    setEvalueringer(data || [])
    return data || []
  }

  const save = async () => {
    if (!user || !form.navn.trim()) return
    setSaving(true)
    if (selected) {
      await supabase.from('leverandoerer').update({
        ...form, updated_at: new Date().toISOString()
      }).eq('id', selected.id)
    } else {
      await supabase.from('leverandoerer').insert({ ...form, user_id: user.id })
    }
    setSaving(false)
    setShowForm(false)
    setSelected(null)
    setForm(emptyLev)
    await load()
  }

  const openEdit = (l: Leverandør) => {
    setSelected(l)
    setForm({
      navn: l.navn, kontakt_person: l.kontakt_person || '',
      email: l.email || '', telefon: l.telefon || '',
      adresse: l.adresse || '', land: l.land || 'Danmark',
      kategori: l.kategori, status: l.status,
      godkendt: l.godkendt, godkendt_dato: l.godkendt_dato || '',
      naeste_evaluering: l.naeste_evaluering || '', noter: l.noter || '',
    })
    setShowForm(true)
  }

  const openView = async (l: Leverandør) => {
    setViewLev(l)
    await loadEvalueringer(l.id)
  }

  const deleteLev = async (id: string) => {
    if (!confirm('Slet denne leverandør og alle evalueringer?')) return
    await supabase.from('leverandoer_evalueringer').delete().eq('leverandoer_id', id)
    await supabase.from('leverandoerer').delete().eq('id', id)
    await load()
  }

  const saveEval = async () => {
    if (!user || !viewLev) return
    setSavingEval(true)
    await supabase.from('leverandoer_evalueringer').insert({
      ...evalForm,
      leverandoer_id: viewLev.id,
      user_id: user.id,
    })
    setSavingEval(false)
    setShowEvalForm(false)
    setEvalForm(emptyEval)
    await loadEvalueringer(viewLev.id)
  }

  const deleteEval = async (id: string) => {
    await supabase.from('leverandoer_evalueringer').delete().eq('id', id)
    if (viewLev) await loadEvalueringer(viewLev.id)
  }

  const printRapport = (lev: Leverandør, evals: Evaluering[]) => {
    const gennemsnit = evals.length > 0
      ? evals.reduce((s, e) => s + samletScore(e), 0) / evals.length : 0

    const barHtml = (score: number) => {
      const pct = ((score - 1) / 9) * 100
      const p = (score - 1) / 9
      const r = Math.round(220 - p * (220 - 34))
      const g = Math.round(38 + p * (197 - 38))
      const b = Math.round(38 + p * (94 - 38))
      const color = `rgb(${r},${g},${b})`
      return `<div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:4px"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:${color};width:24px">${score}</span>
      </div>`
    }

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Leverandørrapport — ${lev.navn}</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; }
      h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
      .meta-item { background: #f9fafb; border-radius: 8px; padding: 10px 14px; }
      .meta-item .label { font-size: 11px; color: #9ca3af; margin-bottom: 2px; }
      .meta-item .value { font-size: 13px; font-weight: 600; }
      .section-title { font-size: 14px; font-weight: 700; color: #374151; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
      .eval-row { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
      .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
      .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
      @media print { body { margin: 20px; } }
    </style></head><body>
    <div style="border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="font-size:12px;color:#6b7280">LEVERANDØRRAPPORT · AiQMS</div>
      <h1>${lev.navn}</h1>
      <div style="font-size:13px;color:#6b7280">${lev.kategori} · ${lev.land || 'Danmark'} · ${lev.status}</div>
    </div>

    <div class="meta-grid">
      ${lev.kontakt_person ? `<div class="meta-item"><div class="label">Kontaktperson</div><div class="value">${lev.kontakt_person}</div></div>` : ''}
      ${lev.email ? `<div class="meta-item"><div class="label">Email</div><div class="value">${lev.email}</div></div>` : ''}
      ${lev.godkendt_dato ? `<div class="meta-item"><div class="label">Godkendt dato</div><div class="value">${new Date(lev.godkendt_dato).toLocaleDateString('da-DK')}</div></div>` : ''}
      <div class="meta-item"><div class="label">Antal evalueringer</div><div class="value">${evals.length}</div></div>
    </div>

    ${evals.length > 0 ? `
      <div class="section-title">Gennemsnitlige scores</div>
      <div class="score-grid">
        <div><div style="font-size:11px;color:#6b7280;margin-bottom:4px">Kvalitet</div>${barHtml(Math.round(evals.reduce((s,e)=>s+e.score_kvalitet,0)/evals.length))}</div>
        <div><div style="font-size:11px;color:#6b7280;margin-bottom:4px">Levering</div>${barHtml(Math.round(evals.reduce((s,e)=>s+e.score_levering,0)/evals.length))}</div>
        <div><div style="font-size:11px;color:#6b7280;margin-bottom:4px">Dokumentation</div>${barHtml(Math.round(evals.reduce((s,e)=>s+e.score_dokumentation,0)/evals.length))}</div>
        <div><div style="font-size:11px;color:#6b7280;margin-bottom:4px">Kommunikation</div>${barHtml(Math.round(evals.reduce((s,e)=>s+e.score_kommunikation,0)/evals.length))}</div>
      </div>

      <div class="section-title">Evalueringshistorik</div>
      ${evals.map(e => `
        <div class="eval-row">
          <div style="display:flex;justify-content:space-between;margin-bottom:10px">
            <strong style="font-size:13px">${new Date(e.dato).toLocaleDateString('da-DK')}</strong>
            <span style="font-size:12px;color:#6b7280">${e.evaluator || ''} · Samlet: ${samletScore(e).toFixed(1)}/10</span>
          </div>
          <div class="score-grid">
            <div><div style="font-size:11px;color:#6b7280;margin-bottom:4px">Kvalitet</div>${barHtml(e.score_kvalitet)}</div>
            <div><div style="font-size:11px;color:#6b7280;margin-bottom:4px">Levering</div>${barHtml(e.score_levering)}</div>
            <div><div style="font-size:11px;color:#6b7280;margin-bottom:4px">Dokumentation</div>${barHtml(e.score_dokumentation)}</div>
            <div><div style="font-size:11px;color:#6b7280;margin-bottom:4px">Kommunikation</div>${barHtml(e.score_kommunikation)}</div>
          </div>
          ${e.kommentar ? `<div style="font-size:12px;color:#374151;margin-top:8px;padding-top:8px;border-top:1px solid #f3f4f6">${e.kommentar}</div>` : ''}
        </div>
      `).join('')}
    ` : '<p style="color:#9ca3af;font-size:13px">Ingen evalueringer endnu.</p>'}

    <div class="footer">
      <span>AiQMS Leverandørstyring · Genereret ${new Date().toLocaleDateString('da-DK')}</span>
    </div>
    </body></html>`)
    w.document.close()
    w.print()
  }

  const filtered = leverandoerer.filter(l => {
    if (filterStatus !== 'Alle' && l.status !== filterStatus) return false
    if (filterKategori !== 'Alle' && l.kategori !== filterKategori) return false
    if (search && !l.navn.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const godkendte = leverandoerer.filter(l => l.godkendt).length
  const aktive = leverandoerer.filter(l => l.status === 'Aktiv').length
  const snartEval = leverandoerer.filter(l => {
    if (!l.naeste_evaluering) return false
    const diff = new Date(l.naeste_evaluering).getTime() - new Date().getTime()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }).length

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
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-900">Leverandørstyring</span>
        </div>
        <button onClick={() => { setSelected(null); setForm(emptyLev); setShowForm(true) }}
          className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
          + Ny leverandør
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Aktive leverandører</div>
            <div className="text-3xl font-semibold text-gray-700">{aktive}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Godkendte</div>
            <div className="text-3xl font-semibold text-emerald-600">{godkendte}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Evaluering snart</div>
            <div className={`text-3xl font-semibold ${snartEval > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>{snartEval}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Søg leverandør..."
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
          <div className="flex items-center gap-1">
            {['Alle', 'Aktiv', 'Suspenderet', 'Udgået'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${filterStatus === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {['Alle', 'Råvare', 'Ingrediens', 'Emballage', 'Service', 'Udstyr'].map(k => (
              <button key={k} onClick={() => setFilterKategori(k)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${filterKategori === k ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {k}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">🏭</div>
            <p className="text-sm font-medium text-gray-400 mb-1">Ingen leverandører endnu</p>
            <p className="text-xs text-gray-300 mb-4">Tilføj din første leverandør</p>
            <button onClick={() => { setSelected(null); setForm(emptyLev); setShowForm(true) }}
              className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
              + Ny leverandør
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(l => {
              const snart = l.naeste_evaluering && (() => {
                const diff = new Date(l.naeste_evaluering).getTime() - new Date().getTime()
                return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
              })()
              return (
                <div key={l.id} onClick={() => openView(l)}
                  className={`bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer ${snart ? 'border-amber-200' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KATEGORI_STYLE[l.kategori]}`}>{l.kategori}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                        {l.godkendt && <span className="text-xs text-emerald-600 font-medium">✓ Godkendt</span>}
                        {snart && <span className="text-xs text-amber-500 font-medium">⏰ Evaluering snart</span>}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{l.navn}</h3>
                      <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                        {l.kontakt_person && <span>👤 {l.kontakt_person}</span>}
                        {l.email && <span>✉️ {l.email}</span>}
                        {l.naeste_evaluering && <span>Næste eval: {new Date(l.naeste_evaluering).toLocaleDateString('da-DK')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(l)}
                        className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Rediger</button>
                      <button onClick={() => deleteLev(l.id)}
                        className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">Slet</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* VIEW MODAL */}
      {viewLev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setViewLev(null); setShowEvalForm(false) }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{viewLev.navn}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KATEGORI_STYLE[viewLev.kategori]}`}>{viewLev.kategori}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[viewLev.status]}`}>{viewLev.status}</span>
                  {viewLev.godkendt && <span className="text-xs text-emerald-600 font-medium">✓ Godkendt</span>}
                </div>
              </div>
              <button onClick={() => { setViewLev(null); setShowEvalForm(false) }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Kontaktperson', value: viewLev.kontakt_person },
                  { label: 'Email', value: viewLev.email },
                  { label: 'Telefon', value: viewLev.telefon },
                  { label: 'Land', value: viewLev.land },
                  { label: 'Godkendt dato', value: viewLev.godkendt_dato ? new Date(viewLev.godkendt_dato).toLocaleDateString('da-DK') : null },
                  { label: 'Næste evaluering', value: viewLev.naeste_evaluering ? new Date(viewLev.naeste_evaluering).toLocaleDateString('da-DK') : null },
                ].filter(i => i.value).map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                    <div className="text-sm font-medium text-gray-800">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Gennemsnit */}
              {evalueringer.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Gennemsnitlig score ({evalueringer.length} evalueringer)</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Kvalitet', key: 'score_kvalitet' },
                      { label: 'Levering', key: 'score_levering' },
                      { label: 'Dokumentation', key: 'score_dokumentation' },
                      { label: 'Kommunikation', key: 'score_kommunikation' },
                    ].map(({ label, key }) => {
                      const avg = evalueringer.reduce((s, e) => s + (e as any)[key], 0) / evalueringer.length
                      return <ScoreBar key={key} label={label} score={Math.round(avg * 10) / 10} />
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">Samlet gennemsnit</span>
                      <span className="text-sm font-bold" style={{ color: scoreColor(Math.round(evalueringer.reduce((s, e) => s + samletScore(e), 0) / evalueringer.length)) }}>
                        {(evalueringer.reduce((s, e) => s + samletScore(e), 0) / evalueringer.length).toFixed(1)}/10 — {scoreLabel(evalueringer.reduce((s, e) => s + samletScore(e), 0) / evalueringer.length)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Evalueringer */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Evalueringer ({evalueringer.length})</p>
                  <button onClick={() => setShowEvalForm(true)}
                    className="text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                    + Ny evaluering
                  </button>
                </div>

                {showEvalForm && (
                  <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Dato</label>
                        <input type="date" value={evalForm.dato}
                          onChange={e => setEvalForm(f => ({ ...f, dato: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Evaluator</label>
                        <input value={evalForm.evaluator}
                          onChange={e => setEvalForm(f => ({ ...f, evaluator: e.target.value }))}
                          placeholder="Navn"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                      </div>
                    </div>

                    <div className="space-y-4 mb-4">
                      {[
                        { label: 'Kvalitet', key: 'score_kvalitet' },
                        { label: 'Levering', key: 'score_levering' },
                        { label: 'Dokumentation', key: 'score_dokumentation' },
                        { label: 'Kommunikation', key: 'score_kommunikation' },
                      ].map(({ label, key }) => (
                        <ScoreBar
                          key={key}
                          label={label}
                          score={(evalForm as any)[key]}
                          onChange={n => setEvalForm(f => ({ ...f, [key]: n }))}
                        />
                      ))}
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Kommentar</label>
                      <textarea value={evalForm.kommentar}
                        onChange={e => setEvalForm(f => ({ ...f, kommentar: e.target.value }))}
                        placeholder="Noter fra evalueringen..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white" />
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => setShowEvalForm(false)}
                        className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100">Annuller</button>
                      <button onClick={saveEval} disabled={savingEval}
                        className="text-xs px-4 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                        {savingEval ? 'Gemmer...' : 'Gem evaluering'}
                      </button>
                    </div>
                  </div>
                )}

                {evalueringer.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Ingen evalueringer endnu</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {evalueringer.map(e => {
                      const score = samletScore(e)
                      return (
                        <div key={e.id} className="border border-gray-100 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-xs font-medium text-gray-700">{new Date(e.dato).toLocaleDateString('da-DK')}</span>
                              {e.evaluator && <span className="text-xs text-gray-400 ml-2">· {e.evaluator}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold" style={{ color: scoreColor(score) }}>
                                {score.toFixed(1)}/10 — {scoreLabel(score)}
                              </span>
                              <button onClick={() => deleteEval(e.id)} className="text-gray-300 hover:text-red-400 text-sm ml-1">×</button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {[
                              { label: 'Kvalitet', score: e.score_kvalitet },
                              { label: 'Levering', score: e.score_levering },
                              { label: 'Dokumentation', score: e.score_dokumentation },
                              { label: 'Kommunikation', score: e.score_kommunikation },
                            ].map(s => (
                              <ScoreBar key={s.label} label={s.label} score={s.score} />
                            ))}
                          </div>
                          {e.kommentar && <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-50">{e.kommentar}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => printRapport(viewLev, evalueringer)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                🖨️ Print rapport
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setViewLev(null); openEdit(viewLev) }}
                  className="text-xs px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Rediger</button>
                <button onClick={() => { setViewLev(null); setShowEvalForm(false) }}
                  className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Luk</button>
              </div>
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
              <h2 className="text-base font-semibold text-gray-900">{selected ? 'Rediger leverandør' : 'Ny leverandør'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Navn *</label>
                  <input value={form.navn} onChange={e => setForm(f => ({ ...f, navn: e.target.value }))}
                    placeholder="Leverandørens navn"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kategori</label>
                  <select value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value as LeverandørKategori }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Råvare</option><option>Ingrediens</option><option>Emballage</option>
                    <option>Service</option><option>Udstyr</option><option>Andet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LeverandørStatus }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Aktiv</option><option>Suspenderet</option><option>Udgået</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Godkendt dato</label>
                  <input type="date" value={form.godkendt_dato} onChange={e => setForm(f => ({ ...f, godkendt_dato: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Næste evaluering</label>
                  <input type="date" value={form.naeste_evaluering} onChange={e => setForm(f => ({ ...f, naeste_evaluering: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="godkendt" checked={form.godkendt}
                  onChange={e => setForm(f => ({ ...f, godkendt: e.target.checked }))} className="rounded" />
                <label htmlFor="godkendt" className="text-xs font-medium text-gray-600 cursor-pointer">Leverandør er godkendt</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kontaktperson</label>
                  <input value={form.kontakt_person} onChange={e => setForm(f => ({ ...f, kontakt_person: e.target.value }))}
                    placeholder="Navn"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="kontakt@leverandoer.dk"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                  <input value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                    placeholder="+45 12 34 56 78"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Land</label>
                  <input value={form.land} onChange={e => setForm(f => ({ ...f, land: e.target.value }))}
                    placeholder="Danmark"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                  placeholder="Gadenavn og nummer, postnr by"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Noter</label>
                <textarea value={form.noter} onChange={e => setForm(f => ({ ...f, noter: e.target.value }))}
                  placeholder="Interne noter om leverandøren..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Annuller</button>
              <button onClick={save} disabled={saving || !form.navn.trim()}
                className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Gemmer...' : selected ? 'Gem ændringer' : 'Opret leverandør'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        input[type=range] { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 4px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: white; border: 2px solid #6b7280; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: white; border: 2px solid #6b7280; cursor: pointer; }
      `}</style>
    </div>
  )
}
