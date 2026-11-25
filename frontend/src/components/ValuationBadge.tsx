import { getValuationStatusStyles } from '@/lib/format'
import type { ValuationStatus } from '@/lib/types'

interface ValuationBadgeProps {
  status: ValuationStatus
}

export function ValuationBadge({ status }: ValuationBadgeProps) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getValuationStatusStyles(status)}`}
    >
      {status}
    </span>
  )
}
