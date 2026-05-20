'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

const navItems = [
  { href: '/sources', label: 'Sources', icon: '📁' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/explorer', label: 'Explorer', icon: '📊' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-48 flex-col border-r border-border bg-surface">
      <div className="px-4 py-5">
        <span className="text-sm font-bold text-accent">▸ UNIFIED MCP</span>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-1">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border-l-2 border-accent bg-border text-white'
                  : 'text-muted hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </aside>
  )
}
