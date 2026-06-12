'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  udbyder: string | null
  certifikat_nr: string | null
  dokumentation_url: string | null
  bestaaet: boolean
  noter: string | null
  kompetencekrav: Kompetencekrav | null
}

interface Medarbejder {
  id: string
  navn: string
  stilling: string
  afdeling: string | null
  ansatdato: string | null
  email: string | null
  noter: string | null
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

function formatDato(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusLabel = {
  ok: { tekst: 'Gyldig', klasse: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400' },
  snart: { tekst: 'Udløber snart', klasse: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400' },
  udloebet: { tekst: 'Udløbet', klasse: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400' },
  ingen: { tekst: 'Ingen udløbsdato', klasse: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
}

// ─── Tilføj kursus-modal ──────────────────────────────────────────────────────

function TilfoejKursusModal({
  medarbejderId,
  onClose,
  onSaved,
}: {
  medarbejderId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [kompetencekrav, setKompetencekrav] = useState<Kompetencekrav[]>([])
  const [form, setForm] = useState({
    kompetencekrav_id: '',
    kursus_navn: '',
    gennemfoert_dato: new Date().toISOString().split('T')[0],
    gyldighedsperiode_maaneder: '',
    udbyder: '',
    certifikat_nr: '',
    dokumentation_url: '',
    bestaaet: true,
    noter: '',
  })
  const [gemmer, setGemmer] = useState(false)
  const [fejl, setFejl] = useState('')

  useEffect(() => {
    fetch('/api/kompetencer/krav')
      .then(r => r.json())
      .then(setKompetencekrav)
      .catch(() => {})
  }, [])

  // Auto-udfyld gyldighedsperiode fra valgt krav
  useEffect(() => {
    if (form.kompetencekrav_id) {
      const krav = kompetencekrav.find(k => k.id === form.kompetencekrav_id)
      if (krav?.gyldighedsperiode_maaneder) {
        setForm(p => ({ ...p, gyldighedsperiode_maaneder: String(krav.gyldighedsperiode_maaneder), kursus_navn: krav.navn }))
      }
    }
  }, [form.kompetencekrav_id, kompetencekrav])

  async function gem() {
    if (!form.gennemfoert_dato) {
      setFejl('Gennemførtdato er påkrævet')
      return
    }
    if (!form.kursus_navn.trim() && !form.kompetencekrav_id) {
      setFejl('Angiv enten et kursusnavnet eller vælg et kompetencekrav')
      return
    }
    setGemmer(true)
    try {
      const res = await fetch('/api/kompetencer/uddannelser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, medarbejder_id: medarbejderId }),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved()
      onClose()
    } catch (e: unknown) {
      setFejl(e instanceof Error ? e.message : 'Fejl')
    } finally {
      setGemmer(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 my-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Registrer kursus / uddannelse</h2>

        <div className="space-y-3">
          {/* Link til kompetencekrav */}
          {kompetencekrav.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Tilknyt kompetencekrav (valgfrit)
              </label>
              <select
                value={form.kompetencekrav_id}
                onChange={e => setForm(p => ({ ...p, kompetencekrav_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Vælg krav (eller udfyld frit nedenfor) —</option>
                {kompetencekrav.map(k => (
                  <option key={k.id} value={k.id}>{k.navn} {k.obligatorisk ? '(obligatorisk)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Kursusnavn (frit) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Kursusnavn *
            </label>
            <input
              type="text"
              placeholder="fx HACCP grundkursus, Hygiejnetræning…"
              value={form.kursus_navn}
              onChange={e => setForm(p => ({ ...p, kursus_navn: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gennemført *</label>
              <input
                type="date"
                value={form.gennemfoert_dato}
                onChange={e => setForm(p => ({ ...p, gennemfoert_dato: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Gyldig i (måneder)
              </label>
              <input
                type="number"
                placeholder="fx 12 eller 24"
                value={form.gyldighedsperiode_maaneder}
                onChange={e => setForm(p => ({ ...p, gyldighedsperiode_maaneder: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Udbyder</label>
              <input
                type="text"
                placeholder="fx Fødevareinstituttet"
                value={form.udbyder}
                onChange={e => setForm(p => ({ ...p, udbyder: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Certifikatnr.</label>
              <input
                type="text"
                value={form.certifikat_nr}
                onChange={e => setForm(p => ({ ...p, certifikat_nr: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Link til dokumentation (URL)
            </label>
            <input
              type="url"
              placeholder="https://…"
              value={form.dokumentation_url}
              onChange={e => setForm(p => ({ ...p, dokumentation_url: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Noter</label>
            <textarea
              rows={2}
              value={form.noter}
              onChange={e => setForm(p => ({ ...p, noter: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.bestaaet}
              onChange={e => setForm(p => ({ ...p, bestaaet: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Bestået</span>
          </label>
        </div>

        {fejl && <p className="mt-3 text-sm text-red-600">{fejl}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={gem}
            disabled={gemmer}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {gemmer ? 'Gemmer…' : 'Registrer kursus'}
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

// ─── Hoved-komponent ──────────────────────────────────────────────────────────

export default function MedarbejderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [medarbejder, setMedarbejder] = useState<Medarbejder | null>(null)
  const [loading, setLoading] = useState(true)
  const [fejl, setFejl] = useState('')
  const [visKursusModal, setVisKursusModal] = useState(false)
  const [sletterUdd, setSletterUdd] = useState<string | null>(null)

  const hentData = useCallback(async () => {
    try {
      const res = await fetch('/api/kompetencer')
      if (!res.ok) throw new Error('Fejl')
      const alle = await res.json()
      const fundet = alle.find((m: Medarbejder) => m.id === id)
      if (!fundet) throw new Error('Medarbejder ikke fundet')
      setMedarbejder(fundet)
    } catch (e: unknown) {
      setFejl(e instanceof Error ? e.message : 'Fejl')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { hentData() }, [hentData])

  async function sletUddannelse(uddId: string) {
    if (!confirm('Slet denne uddannelsesregistrering?')) return
    setSletterUdd(uddId)
    try {
      await fetch(`/api/kompetencer/uddannelser?id=${uddId}`, { method: 'DELETE' })
      await hentData()
    } finally {
      setSletterUdd(null)
    }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-4" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )

  if (fejl || !medarbejder) return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-red-600">{fejl || 'Ikke fundet'}</div>
  )

  // Sortér uddannelser: nyeste øverst
  const sortedUdd = [...medarbejder.medarbejder_uddannelser].sort(
    (a, b) => new Date(b.gennemfoert_dato).getTime() - new Date(a.gennemfoert_dato).getTime()
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Tilbage */}
      <Link
        href="/dashboard/kompetencer"
        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 flex items-center gap-1"
      >
        ← Tilbage til oversigt
      </Link>

      {/* Medarbejder-header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{medarbejder.navn}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{medarbejder.stilling}</p>
            {medarbejder.afdeling && <p className="text-xs text-gray-400 dark:text-gray-500">{medarbejder.afdeling}</p>}
          </div>
          <button
            onClick={() => router.push(`/dashboard/kompetencer/${id}/rediger`)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Rediger
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {medarbejder.email && (
            <div>
              <span className="text-xs text-gray-400 block">Email</span>
              <span className="text-gray-700 dark:text-gray-300">{medarbejder.email}</span>
            </div>
          )}
          {medarbejder.ansatdato && (
            <div>
              <span className="text-xs text-gray-400 block">Ansat</span>
              <span className="text-gray-700 dark:text-gray-300">{formatDato(medarbejder.ansatdato)}</span>
            </div>
          )}
          <div>
            <span className="text-xs text-gray-400 block">Kurser registreret</span>
            <span className="text-gray-700 dark:text-gray-300">{medarbejder.medarbejder_uddannelser.length}</span>
          </div>
        </div>

        {medarbejder.noter && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">
            {medarbejder.noter}
          </p>
        )}
      </div>

      {/* Uddannelseshistorik */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Uddannelser og certifikater</h2>
        <button
          onClick={() => setVisKursusModal(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + Registrer kursus
        </button>
      </div>

      {sortedUdd.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">Ingen kurser registreret endnu</p>
          <p className="text-xs mt-1">Klik &quot;Registrer kursus&quot; for at tilføje</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedUdd.map(udd => {
            const status = udloebsStatus(udd.udloebsdato)
            const { tekst, klasse } = statusLabel[status]
            const navn = udd.kompetencekrav?.navn || udd.kursus_navn || 'Kursus'

            return (
              <div
                key={udd.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm text-gray-900 dark:text-white">{navn}</h3>
                      {udd.kompetencekrav?.obligatorisk && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded">
                          Obligatorisk
                        </span>
                      )}
                      {!udd.bestaaet && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-950 text-red-600 rounded">
                          Ikke bestået
                        </span>
                      )}
                    </div>

                    {udd.kompetencekrav?.kategori && (
                      <p className="text-xs text-gray-400 mt-0.5">{udd.kompetencekrav.kategori}</p>
                    )}

                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Gennemført: {formatDato(udd.gennemfoert_dato)}</span>
                      {udd.udloebsdato && <span>Udløber: {formatDato(udd.udloebsdato)}</span>}
                      {udd.udbyder && <span>Udbyder: {udd.udbyder}</span>}
                      {udd.certifikat_nr && <span>Cert.nr: {udd.certifikat_nr}</span>}
                    </div>

                    {udd.noter && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 italic">{udd.noter}</p>}

                    {udd.dokumentation_url && (
                      <a
                        href={udd.dokumentation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 mt-1 block"
                      >
                        📎 Se dokumentation
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${klasse}`}>{tekst}</span>
                    <button
                      onClick={() => sletUddannelse(udd.id)}
                      disabled={sletterUdd === udd.id}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      {sletterUdd === udd.id ? '…' : 'Slet'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ISO note */}
      <p className="text-xs text-gray-400 dark:text-gray-600 mt-8">
        ISO 22000:2018 §7.2 — Dokumenteret information for kompetence skal opbevares som bevis.
      </p>

      {/* Modal */}
      {visKursusModal && (
        <TilfoejKursusModal
          medarbejderId={id}
          onClose={() => setVisKursusModal(false)}
          onSaved={hentData}
        />
      )}
    </div>
  )
}
