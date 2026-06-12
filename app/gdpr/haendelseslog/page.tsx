'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

type Haendelse = {
  id: string
  titel: string
  beskrivelse: string
  opdaget_dato: string
  anmeldt_dato: string
  alvorlighed: string
  status: string
  berørte_personer: number
  datatyper: string
  aarsag: string
  afhjælpning: string
  anmeldt_til_datatilsynet: boolean
  ansvarlig: string
  noter: string
  created_at: string
}

const tomForm = {
  titel: '',
  beskrivelse: '',
  opdaget_dato: '',
  anmeldt_dato: '',
  alvorlighed: 'Lav',
  status: 'Åben',
  berørte_personer: '',
  datatyper: '',
  aarsag: '',
  afhjælpning: '',
  anmeldt_til_datatilsynet: false,
  ansvarlig: '',
  noter: '',
}

const alvorlighedOptions = ['Lav', 'Middel', 'Høj', 'Kritisk']
const statusOptions = ['Åben', 'Under behandling', 'Lukket']

function alvorlighedFarve(a: string) {
  switch (a) {
    case 'Kritisk': return 'bg-red-100 text-red-700'
    case 'Høj': return 'bg-orange-100 text-orange-700'
    case 'Middel': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-green-100 text-green-700'
  }
}

function statusFarve(s: string) {
  switch (s) {
    case 'Åben': return 'bg-red-100 text-red-700'
    case 'Under behandling': return 'bg-yellow-100 text-yellow-700'
    case 'Lukket': return 'bg-gray-100 text-gray-500'
    default: return 'bg-gray-100 text-gray-500'
  }
}

export default function HaendelseslogPage() {
  const supabase = createClientComponentClient()
  const [data, setData] = useState<Haendelse[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<any>(tomForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { hentData() }, [])

  async function hentData() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('haendelseslog')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && rows) setData(rows)
    setLoading(false)
  }

  function åbnOpret() {
    setForm(tomForm)
    setEditId(null)
    setError(null)
    setShowModal(true)
  }

  function åbnRediger(h: Haendelse) {
    setForm({
      titel: h.titel ?? '',
      beskrivelse: h.beskrivelse ?? '',
      opdaget_dato: h.opdaget_dato ?? '',
      anmeldt_dato: h.anmeldt_dato ?? '',
      alvorlighed: h.alvorlighed ?? 'Lav',
      status: h.status ?? 'Åben',
      berørte_personer: h.berørte_personer ?? '',
      datatyper: h.datatyper ?? '',
      aarsag: h.aarsag ?? '',
      afhjælpning: h.afhjælpning ?? '',
      anmeldt_til_datatilsynet: h.anmeldt_til_datatilsynet ?? false,
      ansvarlig: h.ansvarlig ?? '',
      noter: h.noter ?? '',
    })
    setEditId(h.id)
    setError(null)
    setShowModal(true)
  }

  async function gem() {
    if (!form.titel.trim()) { setError('Titel er påkrævet'); return }
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      ...form,
      berørte_personer: form.berørte_personer ? parseInt(form.berørte_personer) : null,
      opdaget_dato: form.opdaget_dato || null,
      anmeldt_dato: form.anmeldt_dato || null,
      updated_at: new Date().toISOString(),
    }

    if (editId) {
      const { error } = await supabase.from('haendelseslog').update(payload).eq('id', editId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('haendelseslog').insert({ ...payload, user_id: user.id })
      if (error) { setError(error.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    hentData()
  }

  async function slet(id: string) {
    if (!confirm('Er du sikker på, at du vil slette denne hændelse?')) return
    await supabase.from('haendelseslog').delete().eq('id', id)
    hentData()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Hændelseslog</h1>
          <p className="text-sm text-gray-500 mt-1">Log over databrud og sikkerhedshændelser jf. GDPR art. 33-34</p>
        </div>
        <button
          onClick={åbnOpret}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} />
          Ny hændelse
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Henter data...</p>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Ingen hændelser registreret</p>
          <p className="text-sm mt-1">Klik "Ny hændelse" for at registrere et databrud</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((h) => (
            <div key={h.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800">{h.titel}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${alvorlighedFarve(h.alvorlighed)}`}>
                      {h.alvorlighed}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusFarve(h.status)}`}>
                      {h.status}
                    </span>
                    {h.anmeldt_til_datatilsynet && (
                      <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={11} />
                        Anmeldt til Datatilsynet
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {h.opdaget_dato ? `Opdaget: ${h.opdaget_dato}` : 'Dato ikke angivet'}
                    {h.berørte_personer ? ` · ${h.berørte_personer} berørte personer` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => åbnRediger(h)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => slet(h.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={15} />
                  </button>
                  <button onClick={() => setExpandedId(expandedId === h.id ? null : h.id)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    {expandedId === h.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {expandedId === h.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {[
                    ['Beskrivelse', h.beskrivelse],
                    ['Opdaget dato', h.opdaget_dato],
                    ['Anmeldt dato', h.anmeldt_dato],
                    ['Berørte personer', h.berørte_personer?.toString()],
                    ['Datatyper', h.datatyper],
                    ['Årsag', h.aarsag],
                    ['Afhjælpning', h.afhjælpning],
                    ['Anmeldt til Datatilsynet', h.anmeldt_til_datatilsynet ? 'Ja' : 'Nej'],
                    ['Ansvarlig', h.ansvarlig],
                    ['Noter', h.noter],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className="text-gray-700 mt-0.5">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editId ? 'Rediger hændelse' : 'Ny hændelse'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <Felt label="Titel *" value={form.titel} onChange={v => setForm({ ...form, titel: v })} />
              <Felt label="Beskrivelse" value={form.beskrivelse} onChange={v => setForm({ ...form, beskrivelse: v })} multiline />

              <div className="grid grid-cols-2 gap-4">
                <Felt label="Opdaget dato" value={form.opdaget_dato} onChange={v => setForm({ ...form, opdaget_dato: v })} type="date" />
                <Felt label="Anmeldt dato" value={form.anmeldt_dato} onChange={v => setForm({ ...form, anmeldt_dato: v })} type="date" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alvorlighed</label>
                  <select
                    value={form.alvorlighed}
                    onChange={e => setForm({ ...form, alvorlighed: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {alvorlighedOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <Felt label="Antal berørte personer" value={form.berørte_personer} onChange={v => setForm({ ...form, berørte_personer: v })} type="number" />
              <Felt label="Datatyper involveret" value={form.datatyper} onChange={v => setForm({ ...form, datatyper: v })} placeholder="fx navn, CPR, helbredsoplysninger" />
              <Felt label="Årsag til hændelsen" value={form.aarsag} onChange={v => setForm({ ...form, aarsag: v })} multiline />
              <Felt label="Afhjælpende foranstaltninger" value={form.afhjælpning} onChange={v => setForm({ ...form, afhjælpning: v })} multiline />

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="datatilsynet"
                  checked={form.anmeldt_til_datatilsynet}
                  onChange={e => setForm({ ...form, anmeldt_til_datatilsynet: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="datatilsynet" className="text-sm text-gray-700">
                  Anmeldt til Datatilsynet (krav inden 72 timer ved alvorlige brud)
                </label>
              </div>

              <Felt label="Ansvarlig" value={form.ansvarlig} onChange={v => setForm({ ...form, ansvarlig: v })} />
              <Felt label="Noter" value={form.noter} onChange={v => setForm({ ...form, noter: v })} multiline />
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition"
              >
                Annuller
              </button>
              <button
                onClick={gem}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {saving ? 'Gemmer...' : 'Gem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Felt({
  label, value, onChange, placeholder, multiline, type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      ) : (
        <input
          type={type ?? 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  )
}
