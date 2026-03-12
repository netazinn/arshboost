import { Wrench } from 'lucide-react'

/**
 * Full-screen maintenance page shown to non-admin visitors when
 * `is_maintenance_mode` is enabled in global_settings.
 */
export function MaintenanceScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 mb-6">
        <Wrench size={28} strokeWidth={1.5} className="text-white/60" />
      </div>
      <h1 className="font-sans text-3xl font-semibold tracking-[-0.07em] text-white">
        Under Maintenance
      </h1>
      <p className="mt-3 font-mono text-sm text-muted-foreground max-w-sm tracking-[-0.04em]">
        We are currently upgrading the platform. Please check back soon.
      </p>
    </div>
  )
}
