'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'

type Behandling = {
  id: string
  navn: string
  formaal: string
  kategorier: string
  persongrupper: string
  datatyper: string
  opbevaringssted: string
  opbevaringsperiode: string
  modtagere: string
  retsgrundlag: string
  ansvarlig: string
  created_at: string
}

const tomForm = {
  navn: '',
  formaal: '',
  kategorier: '',
  persongrupper: '',
  datatyper: '',
  opbevaringssted: '',
  opbevaringsperiode: '',
  modtagere: '',
  retsgrundlag: '',
  ansvarlig: '',
}

const retsgrundlagOptions = [
  'Samtykke (art. 6, stk. 1, litra a)',
  'Kontrakt (art. 6, stk. 1, litra b)',
  'Retlig forpligtelse (art. 6, stk. 1, litra c)',
  'Vitale interesser (art. 6, stk. 1, litra d)',
  'Offentlig opgave (art. 6, stk. 1, litra e)',
  'Legitime interesser (art. 6, stk. 1, litra f)',
]

export default function BehandlingsaktiviteterPage() {
  const supabase = createClientComponentClient()
  const [data, setData] = useState<Behandling[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(tomForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    hentData()
  }, [])

  async function hentData() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('behandlingsaktiviteter')
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

  function åbnRediger(b: Behandling) {
    setForm({
      navn: b.navn ?? '',
      formaal: b.formaal ?? '',
      kategorier: b.kategorier ?? '',
      persongrupper: b.persongrupper ?? '',
      datatyper: b.datatyper ?? '',
      opbevaringssted: b.opbevaringssted ?? '',
      opbevaringsperiode: b.opbevaringsperiode ?? '',
      modtagere: b.modtagere ?? '',
      retsgrundlag: b.retsgrundlag ?? '',
      ansvarlig: b.ansvarlig ?? '',
    })
    setEditId(b.id)
    setError(null)
    setShowModal(true)
  }

  async function gem() {
    if (!form.navn.trim()) {
      setError('Navn er påkrævet')
      return
    }
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (editId) {
      const { error } = await supabase
        .from('behandlingsaktiviteter')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase
        .from('behandlingsaktiviteter')
        .insert({ ...form, user_id: user.id })
      if (error) { setError(error.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    hentData()
  }

  async function slet(id: string) {
    if (!confirm('Er du sikker på, at du vil slette denne aktivitet?')) return
    await supabase.from('behandlingsaktiviteter').delete().eq('id', id)
    hentData()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Behandlingsaktiviteter</h1>
          <p className="text-sm text-gray-500 mt-1">GDPR artikel 30 — register over behandlingsaktiviteter</p>
        </div>
        <button
          onClick={åbnOpret}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} />
          Ny aktivitet
        </button>
      </div>

      {/* Tabel */}
      {loading ? (
        <p className="text-gray-400 text-sm">Henter data...</p>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Ingen behandlingsaktiviteter endnu</p>
          <p className="text-sm mt-1">Klik "Ny aktivitet" for at komme i gang</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((b) => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Række header */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{b.navn}</p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{b.retsgrundlag || 'Retsgrundlag ikke angivet'}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-xs text-gray-400 hidden sm:block">{b.ansvarlig}</span>
                  <button
                    onClick={() => åbnRediger(b)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => slet(b.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  >
                    {expandedId === b.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {/* Udvidet detaljer */}
              {expandedId === b.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {[
                    ['Formål', b.formaal],
                    ['Kategorier af registrerede', b.kategorier],
                    ['Persongrupper', b.persongrupper],
                    ['Datatyper', b.datatyper],
                    ['Opbevaringssted', b.opbevaringssted],
                    ['Opbevaringsperiode', b.opbevaringsperiode],
                    ['Modtagere / videregivelse', b.modtagere],
                    ['Retsgrundlag', b.retsgrundlag],
                    ['Ansvarlig', b.ansvarlig],
                  ].map(([label, value]) => (
                    <div key={label}>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editId ? 'Rediger aktivitet' : 'Ny behandlingsaktivitet'}
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

              <Felt label="Aktivitetsnavn *" value={form.navn} onChange={v => setForm({ ...form, navn: v })} />
              <Felt label="Formål med behandlingen" value={form.formaal} onChange={v => setForm({ ...form, formaal: v })} multiline />
              <Felt label="Kategorier af registrerede" value={form.kategorier} onChange={v => setForm({ ...form, kategorier: v })} placeholder="fx ansatte, kunder, leverandører" />
              <Felt label="Persongrupper" value={form.persongrupper} onChange={v => setForm({ ...form, persongrupper: v })} />
              <Felt label="Datatyper" value={form.datatyper} onChange={v => setForm({ ...form, datatyper: v })} placeholder="fx navn, adresse, CPR, helbredsoplysninger" />
              <Felt label="Opbevaringssted" value={form.opbevaringssted} onChange={v => setForm({ ...form, opbevaringssted: v })} placeholder="fx Supabase, lokalt server, papirarkiv" />
              <Felt label="Opbevaringsperiode" value={form.opbevaringsperiode} onChange={v => setForm({ ...form, opbevaringsperiode: v })} placeholder="fx 5 år efter ansættelsesophør" />
              <Felt label="Modtagere / videregivelse" value={form.modtagere} onChange={v => setForm({ ...form, modtagere: v })} placeholder="fx revisor, myndigheder, databehandlere" />

              {/* Retsgrundlag dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retsgrundlag</label>
                <select
                  value={form.retsgrundlag}
                  onChange={e => setForm({ ...form, retsgrundlag: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Vælg retsgrundlag</option>
                  {retsgrundlagOptions.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <Felt label="Ansvarlig" value={form.ansvarlig} onChange={v => setForm({ ...form, ansvarlig: v })} placeholder="fx Kvalitetschef" />
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
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
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
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  )
}
