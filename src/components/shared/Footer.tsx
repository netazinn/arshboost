import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-8 py-10">
      <small className="font-mono text-xs tracking-[-0.1em] text-[#aaaaaa]">
        ARSHBOOST Copyright &copy; 2026 All rights Reserved.
      </small>
      <Link
        href="/sitemap"
        className="font-mono text-xs tracking-[-0.1em] text-[#aaaaaa] transition-colors duration-200 ease-in-out hover:text-white"
      >
        SITE MAP &amp; HELP &rarr;
      </Link>
      </div>
    </footer>
  )
}
