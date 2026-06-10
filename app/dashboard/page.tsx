'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

const MODULES = [
  { num: '01', title: 'Flowdiagrammer', desc: 'Administrer produktionsflows', href: '/dashboard/flows', color: 'bg-blue-50 border-blue-100', icon: '🔄', countKey: 'flows' },
  { num: '02', title: 'Risikoanalyse', desc: 'HACCP og CCP-styring', href: '/dashboard/haccp', color: 'bg-purple-50 border-purple-100', icon: '⚠️', countKey: 'haccp' },
  { num: '03', title: 'Dokumentstyring', desc: "SOP'er og arbejdsinstruktioner", href: '/dashboard/dokumenter', color: 'bg-amber-50 border-amber-100', icon: '📄', countKey: 'docs' },
  { num: '04', title: 'Afvigelser & CAPA', desc: 'Registrer og spor afvigelser', href: '/dashboard/capa', color: 'bg-red-50 border-red-100', icon: '🔧', countKey: 'capa' },
  { num: '05', title: 'Management Review', desc: 'Ledelsesgennemgang', href: '/dashboard/review', color: 'bg-green-50 border-green-100', icon: '📊', countKey: 'review' },
  { num: '06', title: 'Audit', desc: 'Planlæg og gennemfør audits', href: '/dashboard/audit', color: 'bg-slate-50 border-slate-100', icon: '🔍', countKey: 'audit' },
  { num: '07', title: 'Leverandørstyring', desc: 'Godkendelse og evaluering', href: '/dashboard/leverandoerer', color: 'bg-teal-50 border-teal-100', icon: '🏭', countKey: 'leverandoerer' },
  { num: '08', title: 'Indstillinger', desc: 'Virksomhedsprofil og konto', href: '/dashboard/indstillinger', color: 'bg-gray-50 border-gray-100', icon: '⚙️', countKey: 'indstillinger' },
]

export default function Dashboard() {
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [flowCount, setFlowCount] = useState(0)
  const [capaCount, setCapaCount] = useState(0)
  const [capaAaben, setCapaAaben] = useState(0)
  const [docCount, setDocCount] = useState(0)
  const [haccpCount, setHaccpCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [auditCount, setAuditCount] = useState(0)
  const [leverandoerCount, setLeverandoerCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const [flows, capa, capaAab, docs, haccp, reviews, audits, lev] = await Promise.all([
        supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('afvigelser').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('afvigelser').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'Åben'),
        supabase.from('dokumenter').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('haccp_analyser').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('management_reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('audits').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('leverandoerer').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ])

      setFlowCount(flows.count || 0)
      setCapaCount(capa.count || 0)
      setCapaAaben(capaAab.count || 0)
      setDocCount(docs.count || 0)
      setHaccpCount(haccp.count || 0)
      setReviewCount(reviews.count || 0)
      setAuditCount(audits.count || 0)
      setLeverandoerCount(lev.count || 0)
      setLoading(false)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getCount = (countKey: string) => {
    if (countKey === 'flows') return `${flowCount} flow${flowCount !== 1 ? 's' : ''}`
    if (countKey === 'capa') return `${capaCount} total · ${capaAaben} åbne`
    if (countKey === 'docs') return `${docCount} dokument${docCount !== 1 ? 'er' : ''}`
    if (countKey === 'haccp') return `${haccpCount} analyse${haccpCount !== 1 ? 'r' : ''}`
    if (countKey === 'review') return `${reviewCount} review${reviewCount !== 1 ? 's' : ''}`
    if (countKey === 'audit') return `${auditCount} audit${auditCount !== 1 ? 's' : ''}`
    if (countKey === 'leverandoerer') return `${leverandoerCount} leverandør${leverandoerCount !== 1 ? 'er' : ''}`
    if (countKey === 'indstillinger') return 'Virksomhedsprofil'
    return '—'
  }

  const kpis = [
    { label: 'Åbne afvigelser', value: String(capaAaben), sub: capaAaben === 0 ? 'Ingen åbne' : 'Kræver handling', color: capaAaben === 0 ? 'text-emerald-600' : 'text-red-500' },
    { label: 'Dokumenter', value: String(docCount), sub: docCount === 0 ? 'Ingen endnu' : 'I systemet', color: 'text-gray-700' },
    { label: 'Leverandører', value: String(leverandoerCount), sub: leverandoerCount === 0 ? 'Ingen endnu' : 'Registreret', color: 'text-gray-700' },
    { label: 'Audits', value: String(auditCount), sub: auditCount === 0 ? 'Ingen endnu' : 'I systemet', color: 'text-gray-700' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Indlæser...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* TOP NAV */}
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="text-lg font-semibold tracking-tight">
            Ai<span className="text-emerald-600">QMS</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <a href="/dashboard" className="text-xs font-medium text-gray-900 border-b-2 border-emerald-500 pb-0.5">Overblik</a>
            <a href="/dashboard/flows" className="text-xs text-gray-400 hover:text-gray-700">Flows</a>
            <a href="/dashboard/haccp" className="text-xs text-gray-400 hover:text-gray-700">HACCP</a>
            <a href="/dashboard/capa" className="text-xs text-gray-400 hover:text-gray-700">Afvigelser</a>
            <a href="/dashboard/dokumenter" className="text-xs text-gray-400 hover:text-gray-700">Dokumenter</a>
            <a href="/dashboard/review" className="text-xs text-gray-400 hover:text-gray-700">Review</a>
            <a href="/dashboard/audit" className="text-xs text-gray-400 hover:text-gray-700">Audit</a>
            <a href="/dashboard/leverandoerer" className="text-xs text-gray-400 hover:text-gray-700">Leverandører</a>
            <a href="/dashboard/indstillinger" className="text-xs text-gray-400 hover:text-gray-700">⚙️</a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Log ud
          </button>
        </div>
      </nav>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">Overblik</h1>
          <p className="text-sm text-gray-400">Velkommen til dit QMS dashboard</p>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-2">{kpi.label}</div>
              <div className={`text-3xl font-semibold tracking-tight mb-1 ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-gray-400">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* MODULES */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Moduler</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MODULES.map((mod) => (
              <a
                key={mod.num}
                href={mod.href}
                className={`block border rounded-xl p-5 hover:shadow-sm transition-all cursor-pointer ${mod.color}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-2xl">{mod.icon}</div>
                  <div className="text-xs text-gray-400 font-mono">{mod.num}</div>
                </div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">{mod.title}</h3>
                <p className="text-xs text-gray-500 mb-3">{mod.desc}</p>
                <div className="text-xs font-medium text-gray-400 bg-white/60 rounded-md px-2 py-1 inline-block">
                  {getCount(mod.countKey)}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Seneste aktivitet</h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-3xl mb-3">📋</div>
            <p className="text-sm text-gray-400 mb-1">Ingen aktivitet endnu</p>
            <p className="text-xs text-gray-300">Aktivitet vises her når du begynder at bruge systemet</p>
          </div>
        </div>

      </main>
    </div>
  )
}
