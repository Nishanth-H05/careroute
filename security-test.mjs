import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const { error: loginErr } = await sb.auth.signInWithPassword({
  email: process.env.TEST_B_EMAIL,
  password: process.env.TEST_B_PASSWORD,
})
if (loginErr) { console.log('LOGIN FAILED:', loginErr.message); process.exit(1) }
console.log('Logged in as Clinic B staff\n')

const { data: hosp } = await sb.from('hospitals').select('id').like('name', 'TEST Hospital%').single()
const { data: rows } = await sb.from('resources').select('id, available').eq('hospital_id', hosp.id).eq('category', 'ICU')
const target = rows[0]
console.log('Hospital A ICU available before:', target.available)

const { data: upd } = await sb.from('resources').update({ available: 0 }).eq('id', target.id).select()
console.log(upd && upd.length > 0 ? 'FAIL: edited another hospital!' : 'PASS: update blocked')

const { error: insErr } = await sb.from('resources').insert({ hospital_id: hosp.id, category: 'General', total: 1, available: 1 })
console.log(insErr ? 'PASS: insert blocked' : 'FAIL: inserted into another hospital!')

const { error: hErr } = await sb.from('hospitals').insert({ name: 'Fake', lat: 0, lng: 0 })
console.log(hErr ? 'PASS: hospital creation blocked' : 'FAIL: created a hospital!')

const { data: after } = await sb.from('resources').select('available').eq('id', target.id).single()
console.log('Hospital A ICU available after:', after.available)