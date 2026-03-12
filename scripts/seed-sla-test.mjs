/**
 * Creates 2 test orders to verify SLA warning UI:
 *   - CRITICAL: pending, created 49h ago (past 48h auto_cancel_hours)
 *   - WARNING:  pending, created 40h ago (83% of 48h limit)
 *
 * Run:    node scripts/seed-sla-test.mjs
 * Delete: node scripts/seed-sla-test.mjs --delete <id1> <id2>
 */

import https from 'node:https'

const HOST = 'rpnpqrgvbadjqhqijpmi.supabase.co'
const KEY  =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbnBxcmd2YmFkanFocWlqcG1pIiwicm9sZSI6InNlcn' +
  'ZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3MzAwMSwiZXhwIjoyMDg3NDQ5MDAxfQ.' +
  'VdRF6wt0zyyqspcH6TzP0Z9tqKoa8z8vzVm845g6ASI'

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
    const r = https.request(options, (res) => {
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    r.on('error', reject)
    if (payload) r.write(payload)
    r.end()
  })
}

// ── Delete mode ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
if (args[0] === '--delete') {
  const ids = args.slice(1)
  if (ids.length === 0) {
    console.error('Usage: node scripts/seed-sla-test.mjs --delete <id1> [id2]')
    process.exit(1)
  }
  for (const id of ids) {
    await req('DELETE', `/rest/v1/orders?id=eq.${id}`)
    console.log(`  ✓ Deleted order ${id}`)
  }
  process.exit(0)
}

// ── Seed mode ──────────────────────────────────────────────────────────────────

async function main() {
  // 1. Resolve client
  const profiles = await req('GET', '/rest/v1/profiles?select=id,email&email=eq.client%40arshboost.com')
  const client = profiles[0]
  if (!client) throw new Error('client@arshboost.com not found in profiles')
  console.log(`Client:  ${client.email} (${client.id.slice(0, 8)})`)

  // 2. Resolve Valorant game
  const games = await req('GET', '/rest/v1/games?select=id,name&slug=eq.valorant')
  const game = games[0]
  if (!game) throw new Error('Valorant game not found')
  console.log(`Game:    ${game.name} (${game.id.slice(0, 8)})`)

  // 3. Resolve Rank Boost service
  const services = await req('GET', `/rest/v1/games_services?select=id,type,label&game_id=eq.${game.id}&type=eq.rank_boost`)
  const service = services[0]
  if (!service) throw new Error('Rank Boost service not found')
  console.log(`Service: ${service.label} (${service.id.slice(0, 8)})\n`)

  const now = Date.now()
  const HR  = 3_600_000

  // 4. CRITICAL order — 49 hours ago
  const criticalAt = new Date(now - 49 * HR).toISOString()
  const r1 = await req('POST', '/rest/v1/orders', {
    client_id:  client.id,
    booster_id: null,
    game_id:    game.id,
    service_id: service.id,
    status:     'pending',
    price:      19.99,
    details: { current_rank: 'Silver 3', target_rank: 'Gold 1', queue_type: 'Solo/Duo' },
    created_at: criticalAt,
    updated_at: criticalAt,
  })
  const critical = Array.isArray(r1) ? r1[0] : r1

  // 5. WARNING order — 40 hours ago
  const warnAt = new Date(now - 40 * HR).toISOString()
  const r2 = await req('POST', '/rest/v1/orders', {
    client_id:  client.id,
    booster_id: null,
    game_id:    game.id,
    service_id: service.id,
    status:     'pending',
    price:      14.99,
    details: { current_rank: 'Bronze 2', target_rank: 'Silver 4', queue_type: 'Solo/Duo' },
    created_at: warnAt,
    updated_at: warnAt,
  })
  const warning = Array.isArray(r2) ? r2[0] : r2

  console.log('✓  Test orders created!\n')
  console.log(`  🔴 CRITICAL  id=${critical?.id}`)
  console.log(`               Created 49h ago — past the 48h auto-cancel limit`)
  console.log(`  🟡 WARNING   id=${warning?.id}`)
  console.log(`               Created 40h ago — 83 % of 48h limit\n`)
  console.log('  To delete when done:')
  console.log(`  node scripts/seed-sla-test.mjs --delete ${critical?.id} ${warning?.id}`)
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
