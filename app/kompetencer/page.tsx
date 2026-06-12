'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ─── Typer ───────────────────────────────────────────────────────────────────

interface Kompetencekrav {
  id: string
  navn: string
  kategori: string
  gyldighedsperiode_maaneder: number | null
  obligatorisk: boolean
}

interface Uddannelse {
  id: string
  kursus_navn: string | null
  gennemfoert_dato: string
  udloebsdato: string | null
  bestaaet: boolean
  kompetencekrav: Kompetencekrav | null
}

interface Medarbejder {
  id: string
  navn: string
  stilling: string
  afdeling: string | null
  ansatdato: string | null
  email: string | null
  medarbejder_uddannelser: Uddannelse[]
}

// ─── Hjælpefunktioner ────────────────────────────────────────────────────────

function udloebsStatus(udloebsdato: string | null): 'ok' | 'snart' | 'udloebet' | 'ingen' {
  if (!udloebsdato) return 'ingen'
  const dato = new Date(udloebsdato)
  const nu = new Date()
  const dagetilbage = Math.floor((dato.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24))
  if (dagetilbage < 0) return 'udloebet'
  if (dagetilbage <= 60) return 'snart'
  return 'ok'
}

function kompetenceScore(medarbejder: Medarbejder): { ok: number; snart: number; udloebet: number } {
  let ok = 0, snart = 0, udloebet = 0
  for (const udd of medarbejder.medarbejder_uddannelser) {
    const status = udloebsStatus(udd.udloebsdato)
    if (status === 'udloebet') udloebet++
    else if (status === 'snart') snart++
    else ok++
  }
  return { ok, snart, udloebet }
}

function formatDato(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Nyt medarbejder-form ─────────────────────────────────────────────────────

function NyMedarbejderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    navn: '', stilling: '', afdeling: '', email: '', ansatdato: ''
  })
  const [gemmer, setGemmer] = useState(false)
  const [fejl, setFejl] = useState('')

  async function gem() {
    if (!form.navn.trim() || !form.stilling.trim()) {
      setFejl('Navn og stilling er påkrævet')
      return
    }
    setGemmer(true)
    try {
      const res = await fetch('/api/kompetencer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved()
      onClose()
    } catch (e: unknown) {
      setFejl(e instanceof Error ? e.message : 'Ukendt fejl')
    } finally {
      setGemmer(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tilføj medarbejder</h2>

        <div className="space-y-3">
          {[
            { label: 'Navn *', key: 'navn', type: 'text' },
            { label: 'Stilling *', key: 'stilling', type: 'text' },
            { label: 'Afdeling', key: 'afdeling', type: 'text' },
            { label: 'Email', key: 'email', type: 'email' },
            { label: 'Ansættelsdato', key: 'ansatdato', type: 'date' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        {fejl && <p className="mt-3 text-sm text-red-600">{fejl}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={gem}
            disabled={gemmer}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {gemmer ? 'Gemmer…' : 'Gem medarbejder'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Annuller
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Medarbejderkort ──────────────────────────────────────────────────────────

function MedarbejderKort({ medarbejder }: { medarbejder: Medarbejder }) {
  const score = kompetenceScore(medarbejder)
  const total = medarbejder.medarbejder_uddannelser.length

  return (
    <Link href={`/kompetencer/${medarbejder.id}`} className="block">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{medarbejder.navn}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{medarbejder.stilling}</p>
            {medarbejder.afdeling && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{medarbejder.afdeling}</p>
            )}
          </div>

          {/* Samlet status-badge */}
          {score.udloebet > 0 ? (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400">
              {score.udloebet} udløbet
            </span>
          ) : score.snart > 0 ? (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              {score.snart} snart
            </span>
          ) : total > 0 ? (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400">
              OK
            </span>
          ) : (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
              Ingen kurser
            </span>
          )}
        </div>

        {/* Kompetencer mini-liste */}
        {total > 0 ? (
          <div className="space-y-1">
            {medarbejder.medarbejder_uddannelser.slice(0, 3).map(udd => {
              const status = udloebsStatus(udd.udloebsdato)
              const navn = udd.kompetencekrav?.navn || udd.kursus_navn || 'Kursus'
              return (
                <div key={udd.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 truncate max-w-[180px]">{navn}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {udd.udloebsdato && (
                      <span className="text-gray-400 dark:text-gray-500">{formatDato(udd.udloebsdato)}</span>
                    )}
                    <span className={`w-2 h-2 rounded-full ${
                      status === 'udloebet' ? 'bg-red-500' :
                      status === 'snart' ? 'bg-amber-400' :
                      status === 'ok' ? 'bg-green-500' :
                      'bg-gray-300'
                    }`} />
                  </div>
                </div>
              )
            })}
            {total > 3 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 pt-0.5">+ {total - 3} flere</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">Ingen registrerede kurser endnu</p>
        )}

        {/* Ansættelsdato */}
        {medarbejder.ansatdato && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            Ansat: {formatDato(medarbejder.ansatdato)}
          </p>
        )}
      </div>
    </Link>
  )
}

// ─── Hoved-komponent ──────────────────────────────────────────────────────────

export default function KompetencerPage() {
  const [medarbejdere, setMedarbejdere] = useState<Medarbejder[]>([])
  const [loading, setLoading] = useState(true)
  const [fejl, setFejl] = useState('')
  const [visModal, setVisModal] = useState(false)
  const [filter, setFilter] = useState<'alle' | 'udloebet' | 'snart'>('alle')
  const [soeg, setSoeg] = useState('')

  const hentData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kompetencer')
      if (!res.ok) throw new Error('Kunne ikke hente data')
      const data = await res.json()
      setMedarbejdere(data)
    } catch (e: unknown) {
      setFejl(e instanceof Error ? e.message : 'Fejl ved indlæsning')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { hentData() }, [hentData])

  // Filtrer og søg
  const viste = medarbejdere.filter(m => {
    const score = kompetenceScore(m)
    if (filter === 'udloebet' && score.udloebet === 0) return false
    if (filter === 'snart' && score.snart === 0) return false
    if (soeg && !m.navn.toLowerCase().includes(soeg.toLowerCase()) &&
        !m.stilling.toLowerCase().includes(soeg.toLowerCase())) return false
    return true
  })

  // Samlet statistik
  const stats = medarbejdere.reduce(
    (acc, m) => {
      const s = kompetenceScore(m)
      return { udloebet: acc.udloebet + s.udloebet, snart: acc.snart + s.snart }
    },
    { udloebet: 0, snart: 0 }
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Kompetencer og uddannelse</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ISO 22000 klausul 7.2 og 7.3</p>
        </div>
        <button
          onClick={() => setVisModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span>+</span> Ny medarbejder
        </button>
      </div>

      {/* Advarsler */}
      {(stats.udloebet > 0 || stats.snart > 0) && (
        <div className="mb-6 space-y-2">
          {stats.udloebet > 0 && (
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <span className="text-base">⚠️</span>
              <span><strong>{stats.udloebet} kompetencer</strong> er udløbet og kræver fornyelse</span>
            </div>
          )}
          {stats.snart > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <span className="text-base">⏰</span>
              <span><strong>{stats.snart} kompetencer</strong> udløber inden for 60 dage</span>
            </div>
          )}
        </div>
      )}

      {/* Filter + søg */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Søg medarbejder eller stilling…"
          value={soeg}
          onChange={e => setSoeg(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          {(['alle', 'udloebet', 'snart'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {f === 'alle' ? 'Alle' : f === 'udloebet' ? '🔴 Udløbet' : '🟡 Snart udløber'}
            </button>
          ))}
        </div>
      </div>

      {/* Fejl */}
      {fejl && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 px-4 py-3 rounded-lg mb-4">{fejl}</div>
      )}

      {/* Indlæsning */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : viste.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">
            {soeg || filter !== 'alle' ? 'Ingen medarbejdere matcher filteret' : 'Ingen medarbejdere endnu'}
          </p>
          {!soeg && filter === 'alle' && (
            <p className="text-sm mt-1">Klik &quot;Ny medarbejder&quot; for at komme i gang</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {viste.map(m => <MedarbejderKort key={m.id} medarbejder={m} />)}
        </div>
      )}

      {/* ISO 22000 footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-600 mt-8 text-center">
        ISO 22000:2018 klausul 7.2 kræver dokumentation for kompetence baseret på uddannelse, træning eller erfaring.
        Klausul 7.3 kræver at relevante medarbejdere er bevidste om FSMS-politikken og deres bidrag til fødevaresikkerhed.
      </p>

      {/* Modal */}
      {visModal && (
        <NyMedarbejderModal
          onClose={() => setVisModal(false)}
          onSaved={hentData}
        />
      )}
    </div>
  )
}
