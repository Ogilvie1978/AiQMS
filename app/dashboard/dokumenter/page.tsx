'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type DokumentType = 'SOP' | 'Arbejdsinstruktion' | 'Skabelon' | 'Politik' | 'Procedure' | 'Andet'
type DokumentStatus = 'Udkast' | 'Til godkendelse' | 'Godkendt' | 'Udgået'

type Dokument = {
  id: string
  titel: string
  type: DokumentType
  version: string
  status: DokumentStatus
  ansvarlig: string
  godkendt_af: string
  gyldig_fra: string
  gyldig_til: string
  beskrivelse: string
  fil_url: string
  indhold: string
  created_at: string
}

const TYPE_STYLE: Record<DokumentType, string> = {
  SOP: 'bg-blue-50 text-blue-700',
  Arbejdsinstruktion: 'bg-purple-50 text-purple-700',
  Skabelon: 'bg-amber-50 text-amber-700',
  Politik: 'bg-slate-50 text-slate-700',
  Procedure: 'bg-teal-50 text-teal-700',
  Andet: 'bg-gray-50 text-gray-600',
}

const STATUS_STYLE: Record<DokumentStatus, string> = {
  Udkast: 'bg-gray-100 text-gray-600 border-gray-200',
  'Til godkendelse': 'bg-amber-50 text-amber-600 border-amber-200',
  Godkendt: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Udgået: 'bg-red-50 text-red-500 border-red-200',
}

const empty = {
  titel: '', type: 'SOP' as DokumentType, version: '1.0',
  status: 'Udkast' as DokumentStatus, ansvarlig: '', godkendt_af: '',
  gyldig_fra: '', gyldig_til: '', beskrivelse: '', fil_url: '',
}

function isUdloebt(gyldig_til: string) {
  if (!gyldig_til) return false
  return new Date(gyldig_til) < new Date()
}

function udloebSnart(gyldig_til: string) {
  if (!gyldig_til) return false
  const diff = new Date(gyldig_til).getTime() - new Date().getTime()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

export default function DokumenterPage() {
  const [dokumenter, setDokumenter] = useState<Dokument[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Dokument | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [viewDoc, setViewDoc] = useState<Dokument | null>(null)
  const [filterType, setFilterType] = useState('Alle')
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [search, setSearch] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data } = await supabase
      .from('dokumenter')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setDokumenter(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const printDoc = (d: Dokument) => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${d.titel}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; }
          h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 24px; border-bottom: 1px solid #eee; padding-bottom: 16px; }
          .meta span { margin-right: 20px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #f0fdf4; color: #16a34a; margin-right: 8px; }
          .section { margin-bottom: 20px; }
          .section h2 { font-size: 13px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
          .section p { font-size: 14px; color: #333; line-height: 1.6; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
          .footer-meta { display: flex; gap: 24px; font-size: 11px; color: #aaa; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>${d.titel}</h1>
        <div class="meta">
          <span class="badge">${d.type}</span>
          <span class="badge" style="background:#f0f9ff;color:#0369a1">${d.status}</span>
          ${d.ansvarlig ? `<span>Ansvarlig: ${d.ansvarlig}</span>` : ''}
          ${d.godkendt_af ? `<span>Godkendt af: ${d.godkendt_af}</span>` : ''}
        </div>
        ${d.indhold ? d.indhold : d.beskrivelse ? `<div class="section"><h2>Beskrivelse</h2><p>${d.beskrivelse}</p></div>` : ''}
        ${d.fil_url ? `<div class="section"><h2>Dokument link</h2><p><a href="${d.fil_url}">${d.fil_url}</a></p></div>` : ''}
        <div class="footer">
          <span>AiQMS Dokumentstyring · Udskrevet ${new Date().toLocaleDateString('da-DK')}</span>
          <div class="footer-meta">
            <span>Version ${d.version}</span>
            ${d.gyldig_fra ? `<span>Gyldig fra: ${new Date(d.gyldig_fra).toLocaleDateString('da-DK')}</span>` : ''}
            ${d.gyldig_til ? `<span>Gyldig til: ${new Date(d.gyldig_til).toLocaleDateString('da-DK')}</span>` : ''}
          </div>
        </div>
      </body>
      </html>
    `)
    w.document.close()
    w.print()
  }

  const nextVersion = (version: string) => {
    const parts = version.split('.')
    if (parts.length === 2) {
      const major = parseInt(parts[0]) || 1
      const minor = parseInt(parts[1]) || 0
      return `${major}.${minor + 1}`
    }
    return version
  }

  const save = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (selected) {
      const nyVersion = nextVersion(form.version)
      await supabase.from('dokumenter').update({
        ...form,
        version: nyVersion,
        updated_at: new Date().toISOString()
      }).eq('id', selected.id)
    } else {
      await supabase.from('dokumenter').insert({ ...form, user_id: user.id })
    }
    setSaving(false)
    setShowForm(false)
    setSelected(null)
    setForm(empty)
    await load()
  }

  const openEdit = (d: Dokument) => {
    setSelected(d)
    setForm({
      titel: d.titel, type: d.type, version: d.version,
      status: d.status, ansvarlig: d.ansvarlig, godkendt_af: d.godkendt_af,
      gyldig_fra: d.gyldig_fra || '', gyldig_til: d.gyldig_til || '',
      beskrivelse: d.beskrivelse, fil_url: d.fil_url,
    })
    setShowForm(true)
  }

  const deleteDokument = async (id: string) => {
    if (!confirm('Slet dette dokument?')) return
    await supabase.from('dokumenter').delete().eq('id', id)
    await load()
  }

  const filtered = dokumenter.filter(d => {
    if (filterType !== 'Alle' && d.type !== filterType) return false
    if (filterStatus !== 'Alle' && d.status !== filterStatus) return false
    if (search && !d.titel.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const godkendte = dokumenter.filter(d => d.status === 'Godkendt').length
  const udkast = dokumenter.filter(d => d.status === 'Udkast').length
  const udloebt = dokumenter.filter(d => isUdloebt(d.gyldig_til)).length
  const snart = dokumenter.filter(d => udloebSnart(d.gyldig_til)).length

  return (
    <div className="min-h-screen bg-gray-50">

      {/* NAV */}
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700">← Dashboard</a>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-900">Dokumentstyring</span>
        </div>
        <button
          onClick={() => router.push('/dashboard/dokumenter/ny')}
          className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          + Nyt dokument
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* KPI */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Godkendte</div>
            <div className="text-3xl font-semibold text-emerald-600">{godkendte}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Udkast</div>
            <div className="text-3xl font-semibold text-gray-500">{udkast}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Udløbet</div>
            <div className={`text-3xl font-semibold ${udloebt > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{udloebt}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Udløber snart</div>
            <div className={`text-3xl font-semibold ${snart > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>{snart}</div>
          </div>
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søg i dokumenter..."
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
          />
          <div className="flex items-center gap-1">
            {['Alle', 'SOP', 'Arbejdsinstruktion', 'Skabelon', 'Politik', 'Procedure'].map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${filterType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {['Alle', 'Godkendt', 'Til godkendelse', 'Udkast', 'Udgået'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${filterStatus === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Indlæser...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm font-medium text-gray-400 mb-1">Ingen dokumenter endnu</p>
            <p className="text-xs text-gray-300 mb-4">Tilføj dit første dokument for at komme i gang</p>
            <button onClick={() => router.push('/dashboard/dokumenter/ny')}
              className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
              + Nyt dokument
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(d => (
              <div key={d.id} onClick={() => router.push('/dashboard/dokumenter/ny?id=' + d.id)} className={`bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer ${isUdloebt(d.gyldig_til) ? 'border-red-200' : udloebSnart(d.gyldig_til) ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[d.type]}`}>{d.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[d.status]}`}>{d.status}</span>
                      <span className="text-xs text-gray-400">v{d.version}</span>
                      {isUdloebt(d.gyldig_til) && <span className="text-xs text-red-500 font-medium">⚠️ Udløbet</span>}
                      {udloebSnart(d.gyldig_til) && !isUdloebt(d.gyldig_til) && <span className="text-xs text-amber-500 font-medium">⏰ Udløber snart</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{d.titel}</h3>
                    {d.beskrivelse && <p className="text-xs text-gray-500 line-clamp-1 mb-2">{d.beskrivelse}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      {d.ansvarlig && <span>👤 {d.ansvarlig}</span>}
                      {d.godkendt_af && <span>✓ Godkendt af {d.godkendt_af}</span>}
                      {d.gyldig_fra && <span>Fra {new Date(d.gyldig_fra).toLocaleDateString('da-DK')}</span>}
                      {d.gyldig_til && <span>Til {new Date(d.gyldig_til).toLocaleDateString('da-DK')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {d.fil_url && (
                      <a href={d.fil_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">
                        Åbn fil
                      </a>
                    )}
                    <button onClick={() => router.push('/dashboard/dokumenter/ny?id=' + d.id)}
                      className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                      Rediger
                    </button>
                    <button onClick={() => deleteDokument(d.id)}
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

      {/* VIEW MODAL */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setViewDoc(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{viewDoc.titel}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[viewDoc.type]}`}>{viewDoc.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[viewDoc.status]}`}>{viewDoc.status}</span>
                  <span className="text-xs text-gray-400">v{viewDoc.version}</span>
                </div>
              </div>
              <button onClick={() => setViewDoc(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {viewDoc.ansvarlig && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-400 mb-0.5">Ansvarlig</div>
                    <div className="text-sm font-medium text-gray-800">{viewDoc.ansvarlig}</div>
                  </div>
                )}
                {viewDoc.godkendt_af && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-400 mb-0.5">Godkendt af</div>
                    <div className="text-sm font-medium text-gray-800">{viewDoc.godkendt_af}</div>
                  </div>
                )}
                {viewDoc.gyldig_fra && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-400 mb-0.5">Gyldig fra</div>
                    <div className="text-sm font-medium text-gray-800">{new Date(viewDoc.gyldig_fra).toLocaleDateString('da-DK')}</div>
                  </div>
                )}
                {viewDoc.gyldig_til && (
                  <div className={`rounded-lg px-4 py-3 ${isUdloebt(viewDoc.gyldig_til) ? 'bg-red-50' : udloebSnart(viewDoc.gyldig_til) ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <div className="text-xs text-gray-400 mb-0.5">Gyldig til</div>
                    <div className={`text-sm font-medium ${isUdloebt(viewDoc.gyldig_til) ? 'text-red-600' : udloebSnart(viewDoc.gyldig_til) ? 'text-amber-600' : 'text-gray-800'}`}>
                      {new Date(viewDoc.gyldig_til).toLocaleDateString('da-DK')}
                      {isUdloebt(viewDoc.gyldig_til) && ' ⚠️ Udløbet'}
                      {udloebSnart(viewDoc.gyldig_til) && !isUdloebt(viewDoc.gyldig_til) && ' ⏰ Udløber snart'}
                    </div>
                  </div>
                )}
              </div>

              {viewDoc.beskrivelse && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Beskrivelse</div>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-4 py-3">{viewDoc.beskrivelse}</p>
                </div>
              )}

              {viewDoc.indhold && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Indhold</div>
                  <div
                    className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-5 py-4 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: viewDoc.indhold }}
                    style={{ lineHeight: '1.8' }}
                  />
                </div>
              )}

              {viewDoc.fil_url && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-blue-500 mb-0.5">Tilknyttet fil</div>
                    <div className="text-sm text-blue-700 font-medium truncate max-w-xs">{viewDoc.fil_url}</div>
                  </div>
                  <a href={viewDoc.fil_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-shrink-0">
                    Åbn →
                  </a>
                </div>
              )}

              <div className="text-xs text-gray-400">
                Oprettet {new Date(viewDoc.created_at).toLocaleDateString('da-DK')}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => printDoc(viewDoc)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
                🖨️ Print
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setViewDoc(null); router.push('/dashboard/dokumenter/ny?id=' + viewDoc.id) }}
                  className="text-xs px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                  Rediger
                </button>
                <button onClick={() => setViewDoc(null)}
                  className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                  Luk
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-gray-900">
                {selected ? 'Rediger dokument' : 'Nyt dokument'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                  placeholder="Dokumentets titel"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DokumentType }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>SOP</option>
                    <option>Arbejdsinstruktion</option>
                    <option>Skabelon</option>
                    <option>Politik</option>
                    <option>Procedure</option>
                    <option>Andet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
                  <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                    placeholder="1.0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DokumentStatus }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Udkast</option>
                    <option>Til godkendelse</option>
                    <option>Godkendt</option>
                    <option>Udgået</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ansvarlig</label>
                  <input value={form.ansvarlig} onChange={e => setForm(f => ({ ...f, ansvarlig: e.target.value }))}
                    placeholder="Navn på ansvarlig"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Godkendt af</label>
                  <input value={form.godkendt_af} onChange={e => setForm(f => ({ ...f, godkendt_af: e.target.value }))}
                    placeholder="Navn på godkender"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gyldig fra</label>
                  <input type="date" value={form.gyldig_fra} onChange={e => setForm(f => ({ ...f, gyldig_fra: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gyldig til</label>
                  <input type="date" value={form.gyldig_til} onChange={e => setForm(f => ({ ...f, gyldig_til: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse</label>
                <textarea value={form.beskrivelse} onChange={e => setForm(f => ({ ...f, beskrivelse: e.target.value }))}
                  placeholder="Kort beskrivelse af dokumentets formål"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Link til fil (URL)</label>
                <input value={form.fil_url} onChange={e => setForm(f => ({ ...f, fil_url: e.target.value }))}
                  placeholder="https://... (link til SharePoint, Google Drive etc.)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <p className="text-xs text-gray-400 mt-1">Indsæt et link til det faktiske dokument</p>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                Annuller
              </button>
              <button onClick={save} disabled={saving || !form.titel}
                className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Gemmer...' : selected ? 'Gem ændringer' : 'Opret dokument'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}