'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type AuditType = 'Intern audit' | 'Leverandøraudit' | 'Systemaudit' | 'Procesaudit' | 'Hygiejneaudit'
type AuditStandard = 'IFS' | 'BRC' | 'FSSC 22000' | 'ISO 22000' | 'Intern' | 'Andet'
type AuditStatus = 'Planlagt' | 'Igangværende' | 'Gennemført' | 'Lukket'
type FundType = 'Major' | 'Minor' | 'Observation' | 'Positiv praksis'

type Audit = {
  id: string
  titel: string
  type: AuditType
  standard: AuditStandard
  status: AuditStatus
  planlagt_dato: string
  gennemfoert_dato: string
  auditor: string
  auditee: string
  omraade: string
  formaal: string
  konklusion: string
  created_at: string
}

type AuditFund = {
  id: string
  audit_id: string
  type: FundType
  beskrivelse: string
  krav_reference: string
  capa_kraevet: boolean
  lukket: boolean
}

const STATUS_STYLE: Record<AuditStatus, string> = {
  Planlagt:      'bg-blue-50 text-blue-600 border-blue-200',
  Igangværende:  'bg-amber-50 text-amber-600 border-amber-200',
  Gennemført:    'bg-purple-50 text-purple-600 border-purple-200',
  Lukket:        'bg-emerald-50 text-emerald-600 border-emerald-200',
}

const FUND_STYLE: Record<FundType, string> = {
  Major:            'bg-red-50 text-red-700 border-red-200',
  Minor:            'bg-amber-50 text-amber-700 border-amber-200',
  Observation:      'bg-blue-50 text-blue-700 border-blue-200',
  'Positiv praksis': 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const emptyAudit = {
  titel: '',
  type: 'Intern audit' as AuditType,
  standard: 'Intern' as AuditStandard,
  status: 'Planlagt' as AuditStatus,
  planlagt_dato: new Date().toISOString().split('T')[0],
  gennemfoert_dato: '',
  auditor: '',
  auditee: '',
  omraade: '',
  formaal: '',
  konklusion: '',
}

const emptyFund = {
  type: 'Minor' as FundType,
  beskrivelse: '',
  krav_reference: '',
  capa_kraevet: false,
  lukket: false,
}

export default function AuditPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Audit | null>(null)
  const [form, setForm] = useState(emptyAudit)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'detaljer' | 'fund'>('detaljer')

  // Fund
  const [fund, setFund] = useState<AuditFund[]>([])
  const [showFundForm, setShowFundForm] = useState(false)
  const [fundForm, setFundForm] = useState(emptyFund)
  const [savingFund, setSavingFund] = useState(false)

  // Detail view
  const [viewAudit, setViewAudit] = useState<Audit | null>(null)
  const [viewFund, setViewFund] = useState<AuditFund[]>([])

  const router = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)
    const { data } = await supabase
      .from('audits')
      .select('*')
      .eq('user_id', user.id)
      .order('planlagt_dato', { ascending: false })
    setAudits(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const loadFund = async (auditId: string) => {
    const { data } = await supabase
      .from('audit_fund')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: true })
    setFund(data || [])
    return data || []
  }

  const save = async () => {
    if (!user || !form.titel.trim()) return
    setSaving(true)
    if (selected) {
      await supabase.from('audits').update({
        ...form, updated_at: new Date().toISOString()
      }).eq('id', selected.id)
    } else {
      await supabase.from('audits').insert({ ...form, user_id: user.id })
    }
    setSaving(false)
    setShowForm(false)
    setSelected(null)
    setForm(emptyAudit)
    await load()
  }

  const openEdit = (a: Audit) => {
    setSelected(a)
    setForm({
      titel: a.titel, type: a.type, standard: a.standard,
      status: a.status, planlagt_dato: a.planlagt_dato,
      gennemfoert_dato: a.gennemfoert_dato || '',
      auditor: a.auditor || '', auditee: a.auditee || '',
      omraade: a.omraade || '', formaal: a.formaal || '',
      konklusion: a.konklusion || '',
    })
    loadFund(a.id)
    setActiveTab('detaljer')
    setShowForm(true)
  }

  const openView = async (a: Audit) => {
    setViewAudit(a)
    const f = await loadFund(a.id)
    setViewFund(f)
  }

  const deleteAudit = async (id: string) => {
    if (!confirm('Slet denne audit?')) return
    await supabase.from('audit_fund').delete().eq('audit_id', id)
    await supabase.from('audits').delete().eq('id', id)
    await load()
  }

  const saveFund = async () => {
    if (!user || !selected || !fundForm.beskrivelse.trim()) return
    setSavingFund(true)
    await supabase.from('audit_fund').insert({
      ...fundForm,
      audit_id: selected.id,
      user_id: user.id,
    })
    setSavingFund(false)
    setFundForm(emptyFund)
    setShowFundForm(false)
    await loadFund(selected.id)
  }

  const deleteFund = async (id: string) => {
    await supabase.from('audit_fund').delete().eq('id', id)
    if (selected) await loadFund(selected.id)
  }

  const printReport = (audit: Audit, fundListe: AuditFund[]) => {
    const majors = fundListe.filter(f => f.type === 'Major')
    const minors = fundListe.filter(f => f.type === 'Minor')
    const obs = fundListe.filter(f => f.type === 'Observation')
    const pos = fundListe.filter(f => f.type === 'Positiv praksis')

    const fundSection = (titel: string, color: string, items: AuditFund[]) =>
      items.length === 0 ? '' : `
        <h3 style="font-size:13px;font-weight:700;color:${color};margin:16px 0 8px">${titel} (${items.length})</h3>
        ${items.map((f, i) => `
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:8px">
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">${f.krav_reference ? `Krav: ${f.krav_reference}` : ''}</div>
            <div style="font-size:13px;color:#111827">${f.beskrivelse}</div>
            ${f.capa_kraevet ? '<div style="font-size:11px;color:#d97706;margin-top:4px">⚠️ CAPA krævet</div>' : ''}
          </div>
        `).join('')}
      `

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Auditrapport — ${audit.titel}</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; }
      .header { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
      .header h1 { font-size: 22px; margin: 0 0 4px; }
      .header .sub { font-size: 13px; color: #6b7280; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
      .meta-item { background: #f9fafb; border-radius: 8px; padding: 10px 14px; }
      .meta-item .label { font-size: 11px; color: #9ca3af; margin-bottom: 2px; }
      .meta-item .value { font-size: 13px; font-weight: 600; color: #111; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }
      .summary-box { text-align: center; padding: 12px; border-radius: 8px; }
      .section-title { font-size: 14px; font-weight: 700; color: #374151; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
      .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
      @media print { body { margin: 20px; } }
    </style></head><body>
    <div class="header">
      <div class="sub">AUDITRAPPORT · AiQMS</div>
      <h1>${audit.titel}</h1>
      <div class="sub">${audit.type}${audit.standard ? ' · ' + audit.standard : ''}</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><div class="label">Planlagt dato</div><div class="value">${new Date(audit.planlagt_dato).toLocaleDateString('da-DK')}</div></div>
      ${audit.gennemfoert_dato ? `<div class="meta-item"><div class="label">Gennemført dato</div><div class="value">${new Date(audit.gennemfoert_dato).toLocaleDateString('da-DK')}</div></div>` : ''}
      ${audit.auditor ? `<div class="meta-item"><div class="label">Auditor</div><div class="value">${audit.auditor}</div></div>` : ''}
      ${audit.auditee ? `<div class="meta-item"><div class="label">Auditee</div><div class="value">${audit.auditee}</div></div>` : ''}
      ${audit.omraade ? `<div class="meta-item"><div class="label">Område</div><div class="value">${audit.omraade}</div></div>` : ''}
      <div class="meta-item"><div class="label">Status</div><div class="value">${audit.status}</div></div>
    </div>

    ${audit.formaal ? `<div class="section-title">Formål</div><p style="font-size:13px;color:#374151">${audit.formaal}</p>` : ''}

    <div class="section-title">Opsummering af fund</div>
    <div class="summary">
      <div class="summary-box" style="background:#fef2f2"><div style="font-size:24px;font-weight:700;color:#dc2626">${majors.length}</div><div style="font-size:11px;color:#dc2626">Major</div></div>
      <div class="summary-box" style="background:#fffbeb"><div style="font-size:24px;font-weight:700;color:#d97706">${minors.length}</div><div style="font-size:11px;color:#d97706">Minor</div></div>
      <div class="summary-box" style="background:#eff6ff"><div style="font-size:24px;font-weight:700;color:#2563eb">${obs.length}</div><div style="font-size:11px;color:#2563eb">Observationer</div></div>
      <div class="summary-box" style="background:#f0fdf4"><div style="font-size:24px;font-weight:700;color:#16a34a">${pos.length}</div><div style="font-size:11px;color:#16a34a">Positive</div></div>
    </div>

    ${fundSection('Major afvigelser', '#dc2626', majors)}
    ${fundSection('Minor afvigelser', '#d97706', minors)}
    ${fundSection('Observationer', '#2563eb', obs)}
    ${fundSection('Positiv praksis', '#16a34a', pos)}

    ${audit.konklusion ? `<div class="section-title">Konklusion</div><p style="font-size:13px;color:#374151">${audit.konklusion}</p>` : ''}

    <div class="footer">
      <span>AiQMS Auditmodul · Genereret ${new Date().toLocaleDateString('da-DK')}</span>
      <span>${audit.standard || ''}</span>
    </div>
    </body></html>`)
    w.document.close()
    w.print()
  }

  // KPI
  const planlagte = audits.filter(a => a.status === 'Planlagt').length
  const igangvaerende = audits.filter(a => a.status === 'Igangværende').length
  const gennemfoerte = audits.filter(a => a.status === 'Gennemført' || a.status === 'Lukket').length

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
          <span className="text-sm font-semibold text-gray-900">Audit</span>
        </div>
        <button
          onClick={() => { setSelected(null); setForm(emptyAudit); setFund([]); setActiveTab('detaljer'); setShowForm(true) }}
          className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          + Ny audit
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* KPI */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Planlagte</div>
            <div className="text-3xl font-semibold text-blue-600">{planlagte}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Igangværende</div>
            <div className="text-3xl font-semibold text-amber-500">{igangvaerende}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Gennemførte</div>
            <div className="text-3xl font-semibold text-emerald-600">{gennemfoerte}</div>
          </div>
        </div>

        {/* LIST */}
        {audits.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm font-medium text-gray-400 mb-1">Ingen audits endnu</p>
            <p className="text-xs text-gray-300 mb-4">Planlæg din første audit</p>
            <button
              onClick={() => { setSelected(null); setForm(emptyAudit); setShowForm(true) }}
              className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
              + Ny audit
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {audits.map(a => (
              <div key={a.id}
                onClick={() => openView(a)}
                className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                      <span className="text-xs text-gray-400">{a.type}</span>
                      {a.standard && <span className="text-xs text-gray-400">· {a.standard}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{a.titel}</h3>
                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      <span>📅 {new Date(a.planlagt_dato).toLocaleDateString('da-DK')}</span>
                      {a.auditor && <span>👤 {a.auditor}</span>}
                      {a.omraade && <span>📍 {a.omraade}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(a)}
                      className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                      Rediger
                    </button>
                    <button onClick={() => deleteAudit(a.id)}
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
      {viewAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setViewAudit(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{viewAudit.titel}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[viewAudit.status]}`}>{viewAudit.status}</span>
                  <span className="text-xs text-gray-400">{viewAudit.type}</span>
                  {viewAudit.standard && <span className="text-xs text-gray-400">· {viewAudit.standard}</span>}
                </div>
              </div>
              <button onClick={() => setViewAudit(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Planlagt dato', value: new Date(viewAudit.planlagt_dato).toLocaleDateString('da-DK') },
                  { label: 'Gennemført dato', value: viewAudit.gennemfoert_dato ? new Date(viewAudit.gennemfoert_dato).toLocaleDateString('da-DK') : null },
                  { label: 'Auditor', value: viewAudit.auditor },
                  { label: 'Auditee', value: viewAudit.auditee },
                  { label: 'Område', value: viewAudit.omraade },
                ].filter(i => i.value).map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                    <div className="text-sm font-medium text-gray-800">{item.value}</div>
                  </div>
                ))}
              </div>

              {viewAudit.formaal && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Formål</div>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3">{viewAudit.formaal}</p>
                </div>
              )}

              {/* Fund */}
              {viewFund.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Fund ({viewFund.length})</div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {(['Major', 'Minor', 'Observation', 'Positiv praksis'] as FundType[]).map(type => {
                      const count = viewFund.filter(f => f.type === type).length
                      return (
                        <div key={type} className={`text-center p-2 rounded-lg border ${FUND_STYLE[type]}`}>
                          <div className="text-xl font-semibold">{count}</div>
                          <div className="text-xs">{type}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex flex-col gap-2">
                    {viewFund.map(f => (
                      <div key={f.id} className={`border rounded-lg p-3 ${FUND_STYLE[f.type]}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">{f.type}</span>
                          {f.krav_reference && <span className="text-xs opacity-70">{f.krav_reference}</span>}
                          {f.capa_kraevet && <span className="text-xs">⚠️ CAPA</span>}
                        </div>
                        <p className="text-xs">{f.beskrivelse}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewAudit.konklusion && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Konklusion</div>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3">{viewAudit.konklusion}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button
                onClick={() => printReport(viewAudit, viewFund)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                🖨️ Print rapport
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setViewAudit(null); openEdit(viewAudit) }}
                  className="text-xs px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                  Rediger
                </button>
                <button onClick={() => setViewAudit(null)}
                  className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                  Luk
                </button>
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
              <h2 className="text-base font-semibold text-gray-900">{selected ? 'Rediger audit' : 'Ny audit'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="flex border-b border-gray-100 px-6">
              <button onClick={() => setActiveTab('detaljer')}
                className={`text-xs py-3 px-4 font-medium border-b-2 transition-colors ${activeTab === 'detaljer' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                Detaljer
              </button>
              {selected && (
                <button onClick={() => setActiveTab('fund')}
                  className={`text-xs py-3 px-4 font-medium border-b-2 transition-colors ${activeTab === 'fund' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  Fund ({fund.length})
                </button>
              )}
            </div>

            <div className="px-6 py-5 space-y-4">

              {activeTab === 'detaljer' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                    <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                      placeholder="F.eks. Intern audit Q2 — Produktion"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AuditType }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option>Intern audit</option>
                        <option>Leverandøraudit</option>
                        <option>Systemaudit</option>
                        <option>Procesaudit</option>
                        <option>Hygiejneaudit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Standard</label>
                      <select value={form.standard} onChange={e => setForm(f => ({ ...f, standard: e.target.value as AuditStandard }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option>Intern</option>
                        <option>IFS</option>
                        <option>BRC</option>
                        <option>FSSC 22000</option>
                        <option>ISO 22000</option>
                        <option>Andet</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AuditStatus }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option>Planlagt</option>
                        <option>Igangværende</option>
                        <option>Gennemført</option>
                        <option>Lukket</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Planlagt dato</label>
                      <input type="date" value={form.planlagt_dato} onChange={e => setForm(f => ({ ...f, planlagt_dato: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Gennemført dato</label>
                      <input type="date" value={form.gennemfoert_dato} onChange={e => setForm(f => ({ ...f, gennemfoert_dato: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Auditor</label>
                      <input value={form.auditor} onChange={e => setForm(f => ({ ...f, auditor: e.target.value }))}
                        placeholder="Navn"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Auditee</label>
                      <input value={form.auditee} onChange={e => setForm(f => ({ ...f, auditee: e.target.value }))}
                        placeholder="Navn/afdeling"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Område</label>
                      <input value={form.omraade} onChange={e => setForm(f => ({ ...f, omraade: e.target.value }))}
                        placeholder="F.eks. Produktion"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Formål</label>
                    <textarea value={form.formaal} onChange={e => setForm(f => ({ ...f, formaal: e.target.value }))}
                      placeholder="Beskriv formålet med auditten..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Konklusion</label>
                    <textarea value={form.konklusion} onChange={e => setForm(f => ({ ...f, konklusion: e.target.value }))}
                      placeholder="Samlede konklusioner fra auditten..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  </div>
                </>
              )}

              {activeTab === 'fund' && selected && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fund og observationer</p>
                    <button onClick={() => setShowFundForm(true)}
                      className="text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                      + Tilføj fund
                    </button>
                  </div>

                  {showFundForm && (
                    <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                          <select value={fundForm.type} onChange={e => setFundForm(f => ({ ...f, type: e.target.value as FundType }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                            <option>Minor</option>
                            <option>Major</option>
                            <option>Observation</option>
                            <option>Positiv praksis</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Krav reference</label>
                          <input value={fundForm.krav_reference} onChange={e => setFundForm(f => ({ ...f, krav_reference: e.target.value }))}
                            placeholder="F.eks. IFS 3.2.1"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse *</label>
                        <textarea value={fundForm.beskrivelse} onChange={e => setFundForm(f => ({ ...f, beskrivelse: e.target.value }))}
                          placeholder="Beskriv fundet..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white" />
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={fundForm.capa_kraevet}
                            onChange={e => setFundForm(f => ({ ...f, capa_kraevet: e.target.checked }))}
                            className="rounded" />
                          CAPA krævet
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowFundForm(false)}
                          className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100">
                          Annuller
                        </button>
                        <button onClick={saveFund} disabled={savingFund || !fundForm.beskrivelse.trim()}
                          className="text-xs px-4 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                          {savingFund ? 'Gemmer...' : 'Tilføj fund'}
                        </button>
                      </div>
                    </div>
                  )}

                  {fund.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">Ingen fund endnu — klik "+ Tilføj fund"</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {fund.map(f => (
                        <div key={f.id} className={`border rounded-xl p-3 ${FUND_STYLE[f.type]}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold">{f.type}</span>
                                {f.krav_reference && <span className="text-xs opacity-70">{f.krav_reference}</span>}
                                {f.capa_kraevet && <span className="text-xs">⚠️ CAPA</span>}
                              </div>
                              <p className="text-xs">{f.beskrivelse}</p>
                            </div>
                            <button onClick={() => deleteFund(f.id)}
                              className="text-xs opacity-50 hover:opacity-100 ml-2">×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                Annuller
              </button>
              <div className="flex gap-2">
                {selected && activeTab === 'detaljer' && (
                  <button onClick={() => { setActiveTab('fund'); setShowFundForm(false) }}
                    className="text-xs px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                    Fund →
                  </button>
                )}
                {selected && (
                  <button onClick={() => printReport(selected, fund)}
                    className="text-xs px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                    🖨️ Rapport
                  </button>
                )}
                <button onClick={save} disabled={saving || !form.titel.trim()}
                  className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                  {saving ? 'Gemmer...' : selected ? 'Gem ændringer' : 'Opret audit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
