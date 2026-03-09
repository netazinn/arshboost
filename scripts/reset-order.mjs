/**
 * Deletes all existing orders and creates a fresh Diamond 3 → Immortal test order
 * Run: node scripts/reset-order.mjs
 */

import https from 'node:https'

const HOST = 'rpnpqrgvbadjqhqijpmi.supabase.co'
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbnBxcmd2YmFkanFocWlqcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3MzAwMSwiZXhwIjoyMDg3NDQ5MDAxfQ.VdRF6wt0zyyqspcH6TzP0Z9tqKoa8z8vzVm845g6ASI'

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
  Prefer: 'return=representation',
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined
    const options = {
      hostname: HOST,
      path,
      method,
      headers: {
        ...HEADERS,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }
    let data = ''
    const request = https.request(options, (res) => {
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    request.on('error', reject)
    if (payload) request.write(payload)
    request.end()
  })
}

async function main() {
  // 1. Delete all existing orders
  await req('DELETE', '/rest/v1/orders?id=neq.00000000-0000-0000-0000-000000000000')
  console.log('✓ Deleted all existing orders')

  // 2. Fetch required IDs in parallel
  const [clients, boosters, games] = await Promise.all([
    req('GET', '/rest/v1/profiles?select=id,email&email=eq.client%40arshboost.com'),
    req('GET', '/rest/v1/profiles?select=id,email&email=eq.booster%40arshboost.com'),
    req('GET', '/rest/v1/games?select=id,name,slug&slug=eq.valorant'),
  ])

  const client  = clients[0]
  const booster = boosters[0]
  const game    = games[0]

  if (!client)  throw new Error('client@arshboost.com not found')
  if (!booster) throw new Error('booster@arshboost.com not found')
  if (!game)    throw new Error('Valorant game not found')

  const services = await req('GET', `/rest/v1/games_services?select=id,type,label&game_id=eq.${game.id}&type=eq.rank_boost`)
  const service  = services[0]
  if (!service) throw new Error('rank_boost service not found')

  console.log(`  client:  ${client.email}  (${client.id.slice(0, 8)})`)
  console.log(`  booster: ${booster.email} (${booster.id.slice(0, 8)})`)
  console.log(`  game:    ${game.name}      (${game.id.slice(0, 8)})`)
  console.log(`  service: ${service.label}  (${service.id.slice(0, 8)})`)

  // 3. Create new order — booster already assigned so both client & booster can see it
  const orders = await req('POST', '/rest/v1/orders', {
    client_id:  client.id,
    booster_id: booster.id,
    game_id:    game.id,
    service_id: service.id,
    status:     'in_progress',
    price:      89.99,
    details: {
      current_rank: 'Diamond 3',
      target_rank:  'Immortal 1',
      start_rr:     '0-20',
      queue_type:   'Solo/Duo',
      server:       'Europe',
      priority:     true,
      stream_games: false,
    },
  })

  const order = Array.isArray(orders) ? orders[0] : orders
  if (!order?.id) throw new Error(`Order creation failed: ${JSON.stringify(orders)}`)

  console.log(`\n✓ Order created!`)
  console.log(`  ID:     ${order.id}`)
  console.log(`  Price:  $${order.price}`)
  console.log(`  Status: ${order.status}`)
  console.log(`\n  Client  → /dashboard/orders/${order.id}`)
  console.log(`  Booster → /dashboard/jobs/${order.id}`)
  console.log(`  Detail  → /dashboard/orders/${order.id}  (order detail page)`)
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
