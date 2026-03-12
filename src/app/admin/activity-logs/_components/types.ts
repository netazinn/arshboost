export interface ActivityLog {
  id:          number
  admin_id:    string
  action_type: string
  target_id:   string | null
  details:     Record<string, unknown>
  created_at:  string
  admin: {
    id:       string
    username: string | null
    email:    string
  } | null
}
