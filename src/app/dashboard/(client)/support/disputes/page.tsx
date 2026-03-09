import { redirect } from 'next/navigation'

export default function DisputesPage() {
  redirect('/dashboard/support?status=dispute')
}
