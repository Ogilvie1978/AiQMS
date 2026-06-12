// app/api/kompetencer/uddannelser/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// POST: Registrer uddannelse/kursus på medarbejder
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const body = await request.json()
  const {
    medarbejder_id,
    kompetencekrav_id,
    kursus_navn,
    gennemfoert_dato,
    gyldighedsperiode_maaneder,
    udbyder,
    certifikat_nr,
    dokumentation_url,
    bestaaet,
    noter,
  } = body

  // Beregn udløbsdato hvis gyldighedsperiode er sat
  let udloebsdato: string | null = null
  if (gennemfoert_dato && gyldighedsperiode_maaneder) {
    const dato = new Date(gennemfoert_dato)
    dato.setMonth(dato.getMonth() + Number(gyldighedsperiode_maaneder))
    udloebsdato = dato.toISOString().split('T')[0]
  }

  const { data, error } = await supabase
    .from('medarbejder_uddannelser')
    .insert({
      medarbejder_id,
      kompetencekrav_id: kompetencekrav_id || null,
      kursus_navn,
      gennemfoert_dato,
      udloebsdato,
      udbyder,
      certifikat_nr,
      dokumentation_url,
      bestaaet: bestaaet ?? true,
      noter,
      oprettet_af: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE: Slet uddannelsesregistrering
export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Mangler id' }, { status: 400 })

  const { error } = await supabase
    .from('medarbejder_uddannelser')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
