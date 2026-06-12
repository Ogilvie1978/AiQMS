// app/api/kompetencer/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET: Hent alle medarbejdere med deres uddannelsesstatus
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  // Hent virksomhed_id
  const { data: virksomhed } = await supabase
    .from('virksomhed')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!virksomhed) return NextResponse.json({ error: 'Ingen virksomhed fundet' }, { status: 404 })

  // Hent medarbejdere med uddannelser og kompetencekrav
  const { data: medarbejdere, error } = await supabase
    .from('medarbejdere')
    .select(`
      *,
      medarbejder_uddannelser (
        *,
        kompetencekrav (
          id,
          navn,
          kategori,
          gyldighedsperiode_maaneder,
          obligatorisk
        )
      )
    `)
    .eq('virksomhed_id', virksomhed.id)
    .eq('aktiv', true)
    .order('navn')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(medarbejdere)
}

// POST: Opret medarbejder
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const { data: virksomhed } = await supabase
    .from('virksomhed')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!virksomhed) return NextResponse.json({ error: 'Ingen virksomhed' }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('medarbejdere')
    .insert({ ...body, virksomhed_id: virksomhed.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PUT: Opdater medarbejder
export async function PUT(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const body = await request.json()
  const { id, ...fields } = body

  const { data, error } = await supabase
    .from('medarbejdere')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
