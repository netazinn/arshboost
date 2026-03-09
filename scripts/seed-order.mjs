/**
 * Creates one test order for client@arshboost.com
 * Run: node scripts/seed-order.mjs
 */

import https from 'node:https'

const HOST = 'rpnpqrgvbadjqhqijpmi.supabase.co'
const KEY  =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbnBxcmd2YmFkanFocWlqcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3MzAwMSwiZXhwIjoyMDg3NDQ5MDAxfQ.VdRF6wt0zyyqspcH6TzP0Z9tqKoa8z8vzVm845g6ASI'

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
  // 1. Get client profile id
  const profiles = await req('GET', '/rest/v1/profiles?select=id,email,role&email=eq.client%40arshboost.com')
  const client = profiles[0]
  if (!client) throw new Error('client@arshboost.com not found in profiles')
  console.log(`Client: ${client.email} (${client.id.slice(0,8)})`)

  // 2. Get Valorant game id
  const games = await req('GET', '/rest/v1/games?select=id,name,slug&slug=eq.valorant')
  const game = games[0]
  if (!game) throw new Error('Valorant game not found')
  console.log(`Game:   ${game.name} (${game.id.slice(0,8)})`)

  // 3. Get Rank Boost service id
  const services = await req('GET', `/rest/v1/games_services?select=id,type,label&game_id=eq.${game.id}&type=eq.rank_boost`)
  const service = services[0]
  if (!service) throw new Error('Rank Boost service not found')
  console.log(`Service:${service.label} (${service.id.slice(0,8)})`)

  // 4. Create the order — status in_progress, no booster (so it shows in job board)
  const orders = await req('POST', '/rest/v1/orders', {
    client_id:  client.id,
    booster_id: null,
    game_id:    game.id,
    service_id: service.id,
    status:     'in_progress',
    price:      24.99,
    details: {
      current_rank:  'Gold 2',
      target_rank:   'Platinum 1',
      queue_type:    'Solo/Duo',
      priority:      false,
      stream_games:  false,
    },
  })

  const order = Array.isArray(orders) ? orders[0] : orders
  if (!order?.id) throw new Error(`Order creation failed: ${JSON.stringify(orders)}`)

  console.log(`\n✓ Order created!`)
  console.log(`  ID:     ${order.id}`)
  console.log(`  Status: ${order.status}`)
  console.log(`  Price:  $${order.price}`)
  console.log(`\n → Client dashboard:  /dashboard/orders/${order.id}`)
  console.log(` → Booster job board: /dashboard/jobs  (Claim → /dashboard/jobs/${order.id})`)
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
