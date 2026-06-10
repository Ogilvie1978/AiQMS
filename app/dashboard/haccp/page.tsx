'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type Flow = {
  id: string
  name: string
  data: {
    nodes?: { id: string; data?: { label?: string } }[]
  }
}

type HaccpRække = {
  id?: string
  processkridt: string
  faretype: 'Biologisk' | 'Kemisk' | 'Fysisk'
  fare_beskrivelse: string
  sandsynlighed: number
  alvorlighed: number
  kontrolforanstaltning: string
}

const tomRække = (): HaccpRække => ({
  processkridt: '',
  faretype: 'Biologisk',
  fare_beskrivelse: '',
  sandsynlighed: 1,
  alvorlighed: 1,
  kontrolforanstaltning: '',
})

const risikoFarve = (score: number) => {
  if (score <= 4) return 'bg-emerald-100 text-emerald-700'
  if (score <= 9) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

const risikoLabel = (score: number) => {
  if (score <= 4) return 'Lav'
  if (score <= 9) return 'Middel'
  return 'Høj'
}

export default function HaccpPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [flows, setFlows] = useState<Flow[]>([])
  const [valgtFlow, setValgtFlow] = useState<Flow | null>(null)
  const [processkridt, setProcesskridt] = useState<string[]>([])
  const [rækker, setRækker] = useState<HaccpRække[]>([tomRække()])
  const [gemteAnalyser, setGemteAnalyser] = useState<any[]>([])
  const [gemmer, setGemmer] = useState(false)
  const [gemt, setGemt] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: flowData } = await supabase
        .from('flows')
        .select('id, name, data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setFlows(flowData || [])

      const { data: analyser } = await supabase
        .from('haccp_analyser')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setGemteAnalyser(analyser || [])

      setLoading(false)
    }
    init()
  }, [])

  const vælgFlow = (flowId: string) => {
    const flow = flows.find(f => f.id === flowId)
    if (!flow) return
    setValgtFlow(flow)
    const nodes = flow.data?.nodes || []
    const labels = nodes
      .map(n => n.data?.label || '')
      .filter(l => l.trim() !== '')
    setProcesskridt(labels)
    setRækker([{ ...tomRække(), processkridt: labels[0] || '' }])
    setGemt(false)
  }

  const opdaterRække = (index: number, felt: keyof HaccpRække, værdi: any) => {
    setRækker(prev => prev.map((r, i) => i === index ? { ...r, [felt]: værdi } : r))
  }

  const tilføjRække = () => {
    setRækker(prev => [...prev, { ...tomRække(), processkridt: processkridt[0] || '' }])
  }

  const sletRække = (index: number) => {
    setRækker(prev => prev.filter((_, i) => i !== index))
  }

  const gem = async () => {
    if (!user || !valgtFlow) return
    setGemmer(true)
    const rows = rækker.map(r => ({
      user_id: user.id,
      flow_id: valgtFlow.id,
      flow_navn: valgtFlow.name,
      processkridt: r.processkridt,
      faretype: r.faretype,
      fare_beskrivelse: r.fare_beskrivelse,
      sandsynlighed: r.sandsynlighed,
      alvorlighed: r.alvorlighed,
      kontrolforanstaltning: r.kontrolforanstaltning,
    }))
    const { error } = await supabase.from('haccp_analyser').insert(rows)
    if (!error) {
      setGemt(true)
      const { data } = await supabase
        .from('haccp_analyser')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setGemteAnalyser(data || [])
      setRækker([tomRække()])
      setValgtFlow(null)
    }
    setGemmer(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Indlæser...</div>
      </div>
    )
  }

  // Grupper gemte analyser per flow
  const analyserPerFlow = gemteAnalyser.reduce((acc: Record<string, any[]>, r) => {
    const key = r.flow_navn || 'Ukendt flow'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">

      {/* TOP NAV */}
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="text-lg font-semibold tracking-tight">
            Ai<span className="text-emerald-600">QMS</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-700">Overblik</a>
            <a href="/dashboard/flows" className="text-xs text-gray-400 hover:text-gray-700">Flows</a>
            <a href="/dashboard/haccp" className="text-xs font-medium text-gray-900 border-b-2 border-emerald-500 pb-0.5">Risikoanalyse</a>
            <a href="/dashboard/capa" className="text-xs text-gray-400 hover:text-gray-700">Afvigelser</a>
            <a href="/dashboard/dokumenter" className="text-xs text-gray-400 hover:text-gray-700">Dokumenter</a>
            <a href="/dashboard/audit" className="text-xs text-gray-400 hover:text-gray-700">Audit</a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{user?.email}</span>
          <a href="/dashboard" className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            ← Dashboard
          </a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* HEADER */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">Risikoanalyse</h1>
            <p className="text-sm text-gray-400">HACCP fareanalyse baseret på dine produktionsflows</p>
          </div>
          <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-purple-700">⚠️ HACCP / ISO 22000</span>
          </div>
        </div>

        {/* NY ANALYSE */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ny fareanalyse</h2>

          {/* VÆLG FLOW */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 mb-2 block">Vælg produktionsflow</label>
            {flows.length === 0 ? (
              <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">
                Ingen flows endnu. <a href="/dashboard/flows" className="text-emerald-600 underline">Opret et flow først →</a>
              </div>
            ) : (
              <select
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={valgtFlow?.id || ''}
                onChange={e => vælgFlow(e.target.value)}
              >
                <option value="">— Vælg flow —</option>
                {flows.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* TABEL */}
          {valgtFlow && (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-3 min-w-[140px]">Processkridt</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-3 min-w-[100px]">Faretype</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-3 min-w-[180px]">Fare / beskrivelse</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-3 w-16">Sand. (1-5)</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-3 w-16">Alv. (1-5)</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-3 w-20">Score</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-3 min-w-[180px]">Kontrolforanstaltning</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rækker.map((række, i) => {
                      const score = række.sandsynlighed * række.alvorlighed
                      return (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 pr-3">
                            {processkridt.length > 0 ? (
                              <select
                                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                value={række.processkridt}
                                onChange={e => opdaterRække(i, 'processkridt', e.target.value)}
                              >
                                {processkridt.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            ) : (
                              <input
                                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                value={række.processkridt}
                                onChange={e => opdaterRække(i, 'processkridt', e.target.value)}
                                placeholder="Skriv skridt..."
                              />
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              value={række.faretype}
                              onChange={e => opdaterRække(i, 'faretype', e.target.value as any)}
                            >
                              <option>Biologisk</option>
                              <option>Kemisk</option>
                              <option>Fysisk</option>
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              value={række.fare_beskrivelse}
                              onChange={e => opdaterRække(i, 'fare_beskrivelse', e.target.value)}
                              placeholder="Beskriv faren..."
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              value={række.sandsynlighed}
                              onChange={e => opdaterRække(i, 'sandsynlighed', Number(e.target.value))}
                            >
                              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              value={række.alvorlighed}
                              onChange={e => opdaterRække(i, 'alvorlighed', Number(e.target.value))}
                            >
                              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold ${risikoFarve(score)}`}>
                              {score} <span className="font-normal opacity-70">{risikoLabel(score)}</span>
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              value={række.kontrolforanstaltning}
                              onChange={e => opdaterRække(i, 'kontrolforanstaltning', e.target.value)}
                              placeholder="Hvad gøres der?"
                            />
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() => sletRække(i)}
                              className="text-gray-300 hover:text-red-400 transition-colors text-base"
                              title="Slet række"
                            >×</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={tilføjRække}
                  className="text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                >
                  + Tilføj fare
                </button>
                <button
                  onClick={gem}
                  disabled={gemmer || rækker.some(r => !r.fare_beskrivelse.trim())}
                  className="text-xs px-4 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {gemmer ? 'Gemmer...' : 'Gem analyse'}
                </button>
                {gemt && <span className="text-xs text-emerald-600">✓ Gemt</span>}
              </div>
            </>
          )}
        </div>

        {/* GEMTE ANALYSER */}
        {Object.keys(analyserPerFlow).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Tidligere analyser</h2>
            {Object.entries(analyserPerFlow).map(([flowNavn, rækker]) => (
              <div key={flowNavn} className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-gray-700">{flowNavn}</span>
                  <span className="text-xs text-gray-400">{rækker.length} fare{rækker.length !== 1 ? 'r' : ''}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${risikoFarve(Math.max(...rækker.map((r: any) => r.risikoscore)))}`}>
                    Højeste score: {Math.max(...rækker.map((r: any) => r.risikoscore))}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-gray-400 font-medium pb-2 pr-3">Processkridt</th>
                        <th className="text-left text-gray-400 font-medium pb-2 pr-3">Faretype</th>
                        <th className="text-left text-gray-400 font-medium pb-2 pr-3">Fare</th>
                        <th className="text-left text-gray-400 font-medium pb-2 pr-3">S</th>
                        <th className="text-left text-gray-400 font-medium pb-2 pr-3">A</th>
                        <th className="text-left text-gray-400 font-medium pb-2 pr-3">Score</th>
                        <th className="text-left text-gray-400 font-medium pb-2">Kontrolforanstaltning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rækker.map((r: any) => (
                        <tr key={r.id} className="border-b border-gray-50">
                          <td className="py-1.5 pr-3 text-gray-600">{r.processkridt}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              r.faretype === 'Biologisk' ? 'bg-blue-50 text-blue-600' :
                              r.faretype === 'Kemisk' ? 'bg-orange-50 text-orange-600' :
                              'bg-gray-50 text-gray-600'
                            }`}>{r.faretype}</span>
                          </td>
                          <td className="py-1.5 pr-3 text-gray-600">{r.fare_beskrivelse}</td>
                          <td className="py-1.5 pr-3 text-gray-500">{r.sandsynlighed}</td>
                          <td className="py-1.5 pr-3 text-gray-500">{r.alvorlighed}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`px-1.5 py-0.5 rounded font-semibold ${risikoFarve(r.risikoscore)}`}>
                              {r.risikoscore}
                            </span>
                          </td>
                          <td className="py-1.5 text-gray-500">{r.kontrolforanstaltning || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TOM STATE */}
        {Object.keys(analyserPerFlow).length === 0 && !valgtFlow && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-sm text-gray-400 mb-1">Ingen fareanalyser endnu</p>
            <p className="text-xs text-gray-300">Vælg et flow ovenfor for at starte din første HACCP-analyse</p>
          </div>
        )}

      </main>
    </div>
  )
}
