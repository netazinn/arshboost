import { createClient as createServiceClient } from '@supabase/supabase-js'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Fire-and-forget audit log insert.
 * Never throws and never blocks the calling server action.
 *
 * @param adminId    - UUID of the staff member performing the action.
 * @param actionType - Dot-separated action identifier (e.g. 'user.banned').
 * @param targetId   - String ID of the affected entity, or null.
 * @param details    - Freeform JSONB payload (old/new values, notes, etc.).
 */
export function logAdminAction(
  adminId:    string,
  actionType: string,
  targetId:   string | null,
  details:    Record<string, unknown>,
): void {
  adminClient()
    .from('activity_logs')
    .insert({ admin_id: adminId, action_type: actionType, target_id: targetId, details })
    .then(({ error }) => {
      if (error) console.error('[logAdminAction]', actionType, error.message)
    })
}
