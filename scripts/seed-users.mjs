/**
 * One-off script to seed test users in Supabase.
 * Run: node scripts/seed-users.mjs
 */

const SUPABASE_URL = 'https://rpnpqrgvbadjqhqijpmi.supabase.co'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbnBxcmd2YmFkanFocWlqcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3MzAwMSwiZXhwIjoyMDg3NDQ5MDAxfQ.VdRF6wt0zyyqspcH6TzP0Z9tqKoa8z8vzVm845g6ASI'

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
}

const USERS = [
  { email: 'client@arshboost.com',  password: 'client123',  role: 'client'  },
  { email: 'booster@arshboost.com', password: 'booster123', role: 'booster' },
  { email: 'support@arshboost.com', password: 'support123', role: 'support' },
]

async function createUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,   // skip email verification
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`createUser(${email}): ${data.message ?? JSON.stringify(data)}`)
  return data.id
}

async function setRole(userId, role) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ role }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`setRole(${userId}, ${role}): ${text}`)
  }
}

async function main() {
  for (const user of USERS) {
    process.stdout.write(`Creating ${user.email} … `)
    try {
      const id = await createUser(user.email, user.password)
      await setRole(id, user.role)
      console.log(`✓  (id: ${id.slice(0, 8)}, role: ${user.role})`)
    } catch (err) {
      console.log(`✗  ${err.message}`)
    }
  }
}

main()
