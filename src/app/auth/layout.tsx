export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <main className="flex flex-1">{children}</main>
    </div>
  )
}
