'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

type Aftale = {
  id: string
  leverandoer: string
  beskrivelse: string
  kontaktperson: string
  email: string
  aftaledato: string
  udloebsdato: string
  status: string
  datatyper: string
  overfoersel_tredjelande: boolean
  noter: string
  created_at: string
}

const tomForm = {
  leverandoer: '',
  beskrivelse: '',
  kontaktperson: '',
  email: '',
  aftaledato: '',
  udloebsdato: '',
  status: 'Aktiv',
  datatyper: '',
  overfoersel_tredjelande: false,
  noter: '',
}

const statusOptions = ['Aktiv', 'Udløbet', 'Under forhandling', 'Opsagt']

function statusFarve(status: string) {
  switch (status) {
    case 'Aktiv': return 'bg-green-100 text-green-700'
    case 'Udløbet': return 'bg-red-100 text-red-700'
    case 'Under forhandling': return 'bg-yellow-100 text-yellow-700'
    case 'Opsagt': return 'bg-gray-100 text-gray-500'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function udloeberSnart(dato: string) {
  if (!dato) return false
  const dage = (new Date(dato).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return dage >= 0 && dage <= 30
}

export default function DatabehandleraftelerPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [data, setData] = useState<Aftale[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(tomForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { hentData() }, [])

  async function hentData() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('databehandleraftaler')
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

  function åbnRediger(a: Aftale) {
    setForm({
      leverandoer: a.leverandoer ?? '',
      beskrivelse: a.beskrivelse ?? '',
      kontaktperson: a.kontaktperson ?? '',
      email: a.email ?? '',
      aftaledato: a.aftaledato ?? '',
      udloebsdato: a.udloebsdato ?? '',
      status: a.status ?? 'Aktiv',
      datatyper: a.datatyper ?? '',
      overfoersel_tredjelande: a.overfoersel_tredjelande ?? false,
      noter: a.noter ?? '',
    })
    setEditId(a.id)
    setError(null)
    setShowModal(true)
  }

  async function gem() {
    if (!form.leverandoer.trim()) {
      setError('Leverandør er påkrævet')
      return
    }
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      ...form,
      aftaledato: form.aftaledato || null,
      udloebsdato: form.udloebsdato || null,
      updated_at: new Date().toISOString(),
    }

    if (editId) {
      const { error } = await supabase.from('databehandleraftaler').update(payload).eq('id', editId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('databehandleraftaler').insert({ ...payload, user_id: user.id })
      if (error) { setError(error.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    hentData()
  }

  async function slet(id: string) {
    if (!confirm('Er du sikker på, at du vil slette denne aftale?')) return
    await supabase.from('databehandleraftaler').delete().eq('id', id)
    hentData()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Databehandleraftaler</h1>
          <p className="text-sm text-gray-500 mt-1">Oversigt over aftaler med databehandlere jf. GDPR art. 28</p>
        </div>
        <button
          onClick={åbnOpret}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} />
          Ny aftale
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Henter data...</p>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Ingen databehandleraftaler endnu</p>
          <p className="text-sm mt-1">Klik "Ny aftale" for at registrere en aftale</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800">{a.leverandoer}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusFarve(a.status)}`}>
                      {a.status}
                    </span>
                    {udloeberSnart(a.udloebsdato) && (
                      <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={11} />
                        Udløber snart
                      </span>
                    )}
                    {a.overfoersel_tredjelande && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        Tredjelande
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{a.beskrivelse || 'Ingen beskrivelse'}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => åbnRediger(a)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => slet(a.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={15} />
                  </button>
                  <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    {expandedId === a.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {expandedId === a.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {[
                    ['Kontaktperson', a.kontaktperson],
                    ['Email', a.email],
                    ['Aftaledato', a.aftaledato],
                    ['Udløbsdato', a.udloebsdato],
                    ['Datatyper behandlet', a.datatyper],
                    ['Overførsel til tredjelande', a.overfoersel_tredjelande ? 'Ja' : 'Nej'],
                    ['Noter', a.noter],
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
                {editId ? 'Rediger aftale' : 'Ny databehandleraftale'}
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

              <Felt label="Leverandør *" value={form.leverandoer} onChange={v => setForm({ ...form, leverandoer: v })} />
              <Felt label="Beskrivelse" value={form.beskrivelse} onChange={v => setForm({ ...form, beskrivelse: v })} multiline />
              <Felt label="Kontaktperson" value={form.kontaktperson} onChange={v => setForm({ ...form, kontaktperson: v })} />
              <Felt label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="kontakt@leverandoer.dk" />

              <div className="grid grid-cols-2 gap-4">
                <Felt label="Aftaledato" value={form.aftaledato} onChange={v => setForm({ ...form, aftaledato: v })} type="date" />
                <Felt label="Udløbsdato" value={form.udloebsdato} onChange={v => setForm({ ...form, udloebsdato: v })} type="date" />
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

              <Felt label="Datatyper behandlet" value={form.datatyper} onChange={v => setForm({ ...form, datatyper: v })} placeholder="fx navn, adresse, CPR" />

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="tredjelande"
                  checked={form.overfoersel_tredjelande}
                  onChange={e => setForm({ ...form, overfoersel_tredjelande: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="tredjelande" className="text-sm text-gray-700">
                  Overførsel til tredjelande (uden for EU/EØS)
                </label>
              </div>

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
