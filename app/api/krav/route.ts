// app/api/kompetencer/krav/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET: Hent alle kompetencekrav for virksomheden
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const { data: virksomhed } = await supabase
    .from('virksomhed')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!virksomhed) return NextResponse.json([], { status: 200 })

  const { data, error } = await supabase
    .from('kompetencekrav')
    .select('*')
    .eq('virksomhed_id', virksomhed.id)
    .order('kategori', { ascending: true })
    .order('navn', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: Opret nyt kompetencekrav
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const { data: virksomhed } = await supabase
    .from('virksomhed')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!virksomhed) return NextResponse.json({ error: 'Ingen virksomhed' }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('kompetencekrav')
    .insert({ ...body, virksomhed_id: virksomhed.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE: Slet kompetencekrav
export async function DELETE(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Mangler id' }, { status: 400 })

  const { error } = await supabase.from('kompetencekrav').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
