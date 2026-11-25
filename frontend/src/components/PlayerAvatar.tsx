import { useState } from 'react'

interface PlayerAvatarProps {
  src?: string | null
  name: string
  className?: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function PlayerAvatar({ src, name, className }: PlayerAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailedSrc(src)}
        className={`shrink-0 rounded border border-neutral-300 bg-neutral-100 object-contain ${className ?? 'h-24 w-auto'}`}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={`flex shrink-0 items-center justify-center rounded border border-neutral-300 bg-neutral-100 text-sm font-bold text-neutral-600 select-none ${className ?? 'h-24 w-20'}`}
    >
      {getInitials(name)}
    </div>
  )
}
