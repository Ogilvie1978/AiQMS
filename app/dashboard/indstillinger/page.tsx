'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const CERTIFICERINGER = ['IFS', 'BRC', 'FSSC 22000', 'ISO 22000', 'ISO 9001', 'Økologisk', 'MSC', 'ASC', 'Andet']

const BRANCHER = [
  'Slagteri og kødforarbejdning',
  'Mejeri og osteproduktion',
  'Bageri og konfekture',
  'Frugt og grønt',
  'Fisk og seafood',
  'Drikkevareindustri',
  'Convenience og færdigretter',
  'Ingredienser og tilsætningsstoffer',
  'Emballage til fødevarer',
  'Engrossalg fødevarer',
  'Andet',
]

type VirksomhedForm = {
  navn: string
  cvr: string
  adresse: string
  postnr: string
  by: string
  telefon: string
  email: string
  branche: string
  antal_ansatte: string
  certificeringer: string[]
  logo_url: string
}

const empty: VirksomhedForm = {
  navn: '', cvr: '', adresse: '', postnr: '', by: '',
  telefon: '', email: '', branche: '', antal_ansatte: '',
  certificeringer: [], logo_url: '',
}

export default function IndstillingerPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [form, setForm] = useState<VirksomhedForm>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exists, setExists] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data } = await supabase
        .from('virksomhed')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setExists(true)
        setForm({
          navn: data.navn || '',
          cvr: data.cvr || '',
          adresse: data.adresse || '',
          postnr: data.postnr || '',
          by: data.by || '',
          telefon: data.telefon || '',
          email: data.email || '',
          branche: data.branche || '',
          antal_ansatte: data.antal_ansatte || '',
          certificeringer: data.certificeringer || [],
          logo_url: data.logo_url || '',
        })
      }
      setLoading(false)
    }
    init()
  }, [])

  const toggleCertificering = (cert: string) => {
    setForm(f => ({
      ...f,
      certificeringer: f.certificeringer.includes(cert)
        ? f.certificeringer.filter(c => c !== cert)
        : [...f.certificeringer, cert],
    }))
  }

  const save = async () => {
    if (!user) return
    setSaving(true)
    if (exists) {
      await supabase.from('virksomhed').update({
        ...form, updated_at: new Date().toISOString()
      }).eq('user_id', user.id)
    } else {
      await supabase.from('virksomhed').insert({ ...form, user_id: user.id })
      setExists(true)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

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
          <span className="text-sm font-semibold text-gray-900">Indstillinger</span>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Gemmer...' : saved ? '✓ Gemt' : 'Gem profil'}
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">Virksomhedsprofil</h1>
          <p className="text-sm text-gray-400">Disse oplysninger bruges i dokumenter, rapporter og audit-materiale</p>
        </div>

        <div className="space-y-6">

          {/* STAMDATA */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Stamdata</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Virksomhedsnavn</label>
                  <input
                    value={form.navn}
                    onChange={e => setForm(f => ({ ...f, navn: e.target.value }))}
                    placeholder="F.eks. Hansen Slagteri A/S"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CVR-nummer</label>
                  <input
                    value={form.cvr}
                    onChange={e => setForm(f => ({ ...f, cvr: e.target.value }))}
                    placeholder="12345678"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                <input
                  value={form.adresse}
                  onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                  placeholder="Gadenavn og nummer"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Postnummer</label>
                  <input
                    value={form.postnr}
                    onChange={e => setForm(f => ({ ...f, postnr: e.target.value }))}
                    placeholder="1234"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">By</label>
                  <input
                    value={form.by}
                    onChange={e => setForm(f => ({ ...f, by: e.target.value }))}
                    placeholder="København"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                  <input
                    value={form.telefon}
                    onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                    placeholder="+45 12 34 56 78"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                  <input
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="kontakt@virksomhed.dk"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BRANCHE OG STØRRELSE */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Branche og størrelse</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Branche</label>
                <select
                  value={form.branche}
                  onChange={e => setForm(f => ({ ...f, branche: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Vælg branche —</option>
                  {BRANCHER.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Antal ansatte</label>
                <select
                  value={form.antal_ansatte}
                  onChange={e => setForm(f => ({ ...f, antal_ansatte: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Vælg størrelse —</option>
                  <option>1–9 ansatte</option>
                  <option>10–49 ansatte</option>
                  <option>50–249 ansatte</option>
                  <option>250+ ansatte</option>
                </select>
              </div>
            </div>
          </div>

          {/* CERTIFICERINGER */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Certificeringer og standarder</h2>
            <p className="text-xs text-gray-400 mb-4">Vælg de standarder virksomheden arbejder efter eller er certificeret til</p>
            <div className="flex flex-wrap gap-2">
              {CERTIFICERINGER.map(cert => {
                const active = form.certificeringer.includes(cert)
                return (
                  <button
                    key={cert}
                    onClick={() => toggleCertificering(cert)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      active
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                  >
                    {active ? '✓ ' : ''}{cert}
                  </button>
                )
              })}
            </div>
          </div>

          {/* KONTO */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Konto</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-700">{user?.email}</div>
                <div className="text-xs text-gray-400 mt-0.5">Logget ind som</div>
              </div>
              <a
                href="/login"
                onClick={async e => {
                  e.preventDefault()
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
                className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
              >
                Log ud
              </a>
            </div>
          </div>

          {/* GEM KNAP */}
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Gemmer...' : saved ? '✓ Profil gemt' : 'Gem profil'}
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
