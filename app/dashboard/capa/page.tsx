'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type AfvigelsesType = 'Kvalitetsafvigelse' | 'Hygiejneafvigelse' | 'Leverandørafvigelse' | 'Procesafvigelse' | 'Dokumentafvigelse' | 'Andet'
type Alvorlighed = 'Lav' | 'Middel' | 'Høj' | 'Kritisk'
type Status = 'Åben' | 'Under behandling' | 'Afventer verifikation' | 'Lukket'

type Afvigelse = {
  id: string
  titel: string
  beskrivelse: string
  type: AfvigelsesType
  alvorlighed: Alvorlighed
  status: Status
  opdaget_dato: string
  opdaget_af: string
  ansvarlig: string
  rodaarsag: string
  capa_handling: string
  capa_deadline: string
  capa_ansvarlig: string
  lukket_dato: string
  created_at: string
}

const ALVORLIGHED_STYLE: Record<Alvorlighed, string> = {
  Lav:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  Middel:  'bg-amber-50 text-amber-700 border-amber-200',
  Høj:     'bg-orange-50 text-orange-700 border-orange-200',
  Kritisk: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_STYLE: Record<Status, string> = {
  'Åben':                  'bg-red-50 text-red-600 border-red-200',
  'Under behandling':      'bg-amber-50 text-amber-600 border-amber-200',
  'Afventer verifikation': 'bg-blue-50 text-blue-600 border-blue-200',
  'Lukket':                'bg-emerald-50 text-emerald-600 border-emerald-200',
}

const TYPE_STYLE: Record<AfvigelsesType, string> = {
  Kvalitetsafvigelse:  'bg-blue-50 text-blue-700',
  Hygiejneafvigelse:   'bg-purple-50 text-purple-700',
  Leverandørafvigelse: 'bg-slate-50 text-slate-700',
  Procesafvigelse:     'bg-orange-50 text-orange-700',
  Dokumentafvigelse:   'bg-amber-50 text-amber-700',
  Andet:               'bg-gray-50 text-gray-600',
}

const emptyForm = {
  titel: '',
  beskrivelse: '',
  type: 'Kvalitetsafvigelse' as AfvigelsesType,
  alvorlighed: 'Middel' as Alvorlighed,
  status: 'Åben' as Status,
  opdaget_dato: new Date().toISOString().split('T')[0],
  opdaget_af: '',
  ansvarlig: '',
  rodaarsag: '',
  capa_handling: '',
  capa_deadline: '',
  capa_ansvarlig: '',
  lukket_dato: '',
}

export default function CapaPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [afvigelser, setAfvigelser] = useState<Afvigelse[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Afvigelse | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [filterAlvorlighed, setFilterAlvorlighed] = useState('Alle')
  const [search, setSearch] = useState('')
  const [viewItem, setViewItem] = useState<Afvigelse | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)
    const { data } = await supabase
      .from('afvigelser')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setAfvigelser(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!user || !form.titel.trim()) return
    setSaving(true)
    if (selected) {
      await supabase.from('afvigelser').update({
        ...form,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id)
    } else {
      await supabase.from('afvigelser').insert({ ...form, user_id: user.id })
    }
    setSaving(false)
    setShowForm(false)
    setSelected(null)
    setForm(emptyForm)
    await load()
  }

  const openEdit = (a: Afvigelse) => {
    setSelected(a)
    setForm({
      titel: a.titel,
      beskrivelse: a.beskrivelse || '',
      type: a.type,
      alvorlighed: a.alvorlighed,
      status: a.status,
      opdaget_dato: a.opdaget_dato || '',
      opdaget_af: a.opdaget_af || '',
      ansvarlig: a.ansvarlig || '',
      rodaarsag: a.rodaarsag || '',
      capa_handling: a.capa_handling || '',
      capa_deadline: a.capa_deadline || '',
      capa_ansvarlig: a.capa_ansvarlig || '',
      lukket_dato: a.lukket_dato || '',
    })
    setViewItem(null)
    setShowForm(true)
  }

  const deleteAfvigelse = async (id: string) => {
    if (!confirm('Slet denne afvigelse?')) return
    await supabase.from('afvigelser').delete().eq('id', id)
    await load()
  }

  const filtered = afvigelser.filter(a => {
    if (filterStatus !== 'Alle' && a.status !== filterStatus) return false
    if (filterAlvorlighed !== 'Alle' && a.alvorlighed !== filterAlvorlighed) return false
    if (search && !a.titel.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // KPI counts
  const aabne = afvigelser.filter(a => a.status === 'Åben').length
  const underBehandling = afvigelser.filter(a => a.status === 'Under behandling').length
  const kritiske = afvigelser.filter(a => a.alvorlighed === 'Kritisk' && a.status !== 'Lukket').length
  const overskredet = afvigelser.filter(a => a.capa_deadline && new Date(a.capa_deadline) < new Date() && a.status !== 'Lukket').length

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
          <span className="text-sm font-semibold text-gray-900">Afvigelser & CAPA</span>
        </div>
        <button
          onClick={() => { setSelected(null); setForm(emptyForm); setShowForm(true) }}
          className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          + Ny afvigelse
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Åbne afvigelser</div>
            <div className={`text-3xl font-semibold ${aabne > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{aabne}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Under behandling</div>
            <div className={`text-3xl font-semibold ${underBehandling > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>{underBehandling}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Kritiske</div>
            <div className={`text-3xl font-semibold ${kritiske > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{kritiske}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Overskredet deadline</div>
            <div className={`text-3xl font-semibold ${overskredet > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{overskredet}</div>
          </div>
        </div>

        {/* FILTER */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søg i afvigelser..."
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
          />
          <div className="flex items-center gap-1">
            {['Alle', 'Åben', 'Under behandling', 'Afventer verifikation', 'Lukket'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${filterStatus === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {['Alle', 'Lav', 'Middel', 'Høj', 'Kritisk'].map(a => (
              <button key={a} onClick={() => setFilterAlvorlighed(a)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${filterAlvorlighed === a ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Indlæser...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">🔧</div>
            <p className="text-sm font-medium text-gray-400 mb-1">Ingen afvigelser endnu</p>
            <p className="text-xs text-gray-300 mb-4">Registrer din første afvigelse for at komme i gang</p>
            <button
              onClick={() => { setSelected(null); setForm(emptyForm); setShowForm(true) }}
              className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
              + Ny afvigelse
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(a => {
              const deadlineOverskredet = a.capa_deadline && new Date(a.capa_deadline) < new Date() && a.status !== 'Lukket'
              return (
                <div
                  key={a.id}
                  onClick={() => setViewItem(a)}
                  className={`bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer ${deadlineOverskredet ? 'border-red-200' : 'border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[a.type]}`}>{a.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ALVORLIGHED_STYLE[a.alvorlighed]}`}>{a.alvorlighed}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                        {deadlineOverskredet && <span className="text-xs text-red-500 font-medium">⚠️ Deadline overskredet</span>}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{a.titel}</h3>
                      {a.beskrivelse && <p className="text-xs text-gray-500 line-clamp-1 mb-2">{a.beskrivelse}</p>}
                      <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                        {a.opdaget_dato && <span>📅 {new Date(a.opdaget_dato).toLocaleDateString('da-DK')}</span>}
                        {a.opdaget_af && <span>👤 {a.opdaget_af}</span>}
                        {a.ansvarlig && <span>→ {a.ansvarlig}</span>}
                        {a.capa_deadline && <span>CAPA frist: {new Date(a.capa_deadline).toLocaleDateString('da-DK')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(a)}
                        className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                        Rediger
                      </button>
                      <button onClick={() => deleteAfvigelse(a.id)}
                        className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                        Slet
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* VIEW MODAL */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setViewItem(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{viewItem.titel}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[viewItem.type]}`}>{viewItem.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ALVORLIGHED_STYLE[viewItem.alvorlighed]}`}>{viewItem.alvorlighed}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[viewItem.status]}`}>{viewItem.status}</span>
                </div>
              </div>
              <button onClick={() => setViewItem(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {viewItem.beskrivelse && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Beskrivelse</div>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3">{viewItem.beskrivelse}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {viewItem.opdaget_dato && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-400 mb-0.5">Opdaget dato</div>
                    <div className="text-sm font-medium text-gray-800">{new Date(viewItem.opdaget_dato).toLocaleDateString('da-DK')}</div>
                  </div>
                )}
                {viewItem.opdaget_af && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-400 mb-0.5">Opdaget af</div>
                    <div className="text-sm font-medium text-gray-800">{viewItem.opdaget_af}</div>
                  </div>
                )}
                {viewItem.ansvarlig && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-400 mb-0.5">Ansvarlig</div>
                    <div className="text-sm font-medium text-gray-800">{viewItem.ansvarlig}</div>
                  </div>
                )}
              </div>

              {viewItem.rodaarsag && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Rodårsag</div>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3">{viewItem.rodaarsag}</p>
                </div>
              )}

              {(viewItem.capa_handling || viewItem.capa_deadline || viewItem.capa_ansvarlig) && (
                <div className="border border-amber-100 bg-amber-50 rounded-xl p-4">
                  <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">CAPA — Korrigerende handling</div>
                  {viewItem.capa_handling && <p className="text-sm text-gray-700 mb-3">{viewItem.capa_handling}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    {viewItem.capa_ansvarlig && (
                      <div>
                        <div className="text-xs text-amber-600 mb-0.5">Ansvarlig</div>
                        <div className="text-sm font-medium text-gray-800">{viewItem.capa_ansvarlig}</div>
                      </div>
                    )}
                    {viewItem.capa_deadline && (
                      <div>
                        <div className="text-xs text-amber-600 mb-0.5">Deadline</div>
                        <div className={`text-sm font-medium ${new Date(viewItem.capa_deadline) < new Date() && viewItem.status !== 'Lukket' ? 'text-red-600' : 'text-gray-800'}`}>
                          {new Date(viewItem.capa_deadline).toLocaleDateString('da-DK')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => setViewItem(null)} className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Luk</button>
              <button onClick={() => openEdit(viewItem)} className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Rediger</button>
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
              <h2 className="text-base font-semibold text-gray-900">{selected ? 'Rediger afvigelse' : 'Ny afvigelse'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                  placeholder="Kort beskrivelse af afvigelsen"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AfvigelsesType }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Kvalitetsafvigelse</option>
                    <option>Hygiejneafvigelse</option>
                    <option>Leverandørafvigelse</option>
                    <option>Procesafvigelse</option>
                    <option>Dokumentafvigelse</option>
                    <option>Andet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Alvorlighed</label>
                  <select value={form.alvorlighed} onChange={e => setForm(f => ({ ...f, alvorlighed: e.target.value as Alvorlighed }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Lav</option>
                    <option>Middel</option>
                    <option>Høj</option>
                    <option>Kritisk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Åben</option>
                    <option>Under behandling</option>
                    <option>Afventer verifikation</option>
                    <option>Lukket</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Opdaget dato</label>
                  <input type="date" value={form.opdaget_dato} onChange={e => setForm(f => ({ ...f, opdaget_dato: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Opdaget af</label>
                  <input value={form.opdaget_af} onChange={e => setForm(f => ({ ...f, opdaget_af: e.target.value }))}
                    placeholder="Navn"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ansvarlig</label>
                  <input value={form.ansvarlig} onChange={e => setForm(f => ({ ...f, ansvarlig: e.target.value }))}
                    placeholder="Navn"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse</label>
                <textarea value={form.beskrivelse} onChange={e => setForm(f => ({ ...f, beskrivelse: e.target.value }))}
                  placeholder="Beskriv hvad der skete..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rodårsag</label>
                <textarea value={form.rodaarsag} onChange={e => setForm(f => ({ ...f, rodaarsag: e.target.value }))}
                  placeholder="Hvad var den grundlæggende årsag?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>

              {/* CAPA */}
              <div className="border border-amber-100 rounded-xl p-4 bg-amber-50">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">CAPA — Korrigerende handling</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Korrigerende handling</label>
                    <textarea value={form.capa_handling} onChange={e => setForm(f => ({ ...f, capa_handling: e.target.value }))}
                      placeholder="Beskriv hvad der skal gøres for at forhindre gentagelse..."
                      rows={3}
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">CAPA ansvarlig</label>
                      <input value={form.capa_ansvarlig} onChange={e => setForm(f => ({ ...f, capa_ansvarlig: e.target.value }))}
                        placeholder="Navn"
                        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Deadline</label>
                      <input type="date" value={form.capa_deadline} onChange={e => setForm(f => ({ ...f, capa_deadline: e.target.value }))}
                        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              {form.status === 'Lukket' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lukket dato</label>
                  <input type="date" value={form.lukket_dato} onChange={e => setForm(f => ({ ...f, lukket_dato: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                Annuller
              </button>
              <button onClick={save} disabled={saving || !form.titel.trim()}
                className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Gemmer...' : selected ? 'Gem ændringer' : 'Opret afvigelse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
