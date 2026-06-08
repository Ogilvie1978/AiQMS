'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

const modules = [
  { num: '01', title: 'Flowdiagrammer', desc: 'Administrer produktionsflows', href: '/dashboard/flows', color: 'bg-blue-50 border-blue-100', icon: '🔄', count: '0 flows' },
  { num: '02', title: 'Risikoanalyse', desc: 'HACCP og CCP-styring', href: '/dashboard/haccp', color: 'bg-purple-50 border-purple-100', icon: '⚠️', count: '0 analyser' },
  { num: '03', title: 'Dokumentstyring', desc: 'SOP\'er og arbejdsinstruktioner', href: '/dashboard/dokumenter', color: 'bg-amber-50 border-amber-100', icon: '📄', count: '0 dokumenter' },
  { num: '04', title: 'Afvigelser & CAPA', desc: 'Registrer og spor afvigelser', href: '/dashboard/capa', color: 'bg-red-50 border-red-100', icon: '🔧', count: '0 åbne' },
  { num: '05', title: 'Management Review', desc: 'Ledelsesgennemgang', href: '/dashboard/review', color: 'bg-green-50 border-green-100', icon: '📊', count: '0 reviews' },
  { num: '06', title: 'AI Audit-assistent', desc: 'Audit-readiness og gaps', href: '/dashboard/audit', color: 'bg-emerald-50 border-emerald-100', icon: '🤖', count: 'Klar' },
]

const kpis = [
  { label: 'Audit-score', value: '—', sub: 'Ingen data endnu', color: 'text-gray-400' },
  { label: 'Åbne afvigelser', value: '0', sub: 'Ingen åbne', color: 'text-emerald-600' },
  { label: 'Udløbne dokumenter', value: '0', sub: 'Alt er opdateret', color: 'text-emerald-600' },
  { label: 'Åbne CAPA\'er', value: '0', sub: 'Ingen åbne', color: 'text-emerald-600' },
]

export default function Dashboard() {
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        setLoading(false)
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

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
            <a href="/dashboard/capa" className="text-xs text-gray-400 hover:text-gray-700">Afvigelser</a>
            <a href="/dashboard/dokumenter" className="text-xs text-gray-400 hover:text-gray-700">Dokumenter</a>
            <a href="/dashboard/audit" className="text-xs text-gray-400 hover:text-gray-700">Audit</a>
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
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">Overblik</h1>
            <p className="text-sm text-gray-400">Velkommen til dit QMS dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <span className="text-xs font-medium text-emerald-700">AI Audit-assistent aktiv</span>
            </div>
          </div>
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

        {/* AI BANNER */}
        <div className="bg-slate-800 rounded-xl p-5 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-lg">🤖</div>
            <div>
              <div className="text-sm font-medium text-white mb-0.5">AI Audit-assistent</div>
              <div className="text-xs text-slate-400">Opret dit første flowdiagram for at aktivere AI-analyse og audit-scoring</div>
            </div>
          </div>
          <a href="/dashboard/flows" className="text-xs px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors font-medium whitespace-nowrap">
            Kom i gang →
          </a>
        </div>

        {/* MODULES */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Moduler</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {modules.map((mod) => (
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
                  {mod.count}
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