import {
  formatEurCompact,
  formatSignedEurCompact,
  formatSignedPct,
} from '@/lib/format'
import type { ModelPrediction } from '@/lib/types'

interface ModelComparisonTableProps {
  comparisons: ModelPrediction[]
  bestModelName: string
  actualMarketValueEur?: number | null
}

export function ModelComparisonTable({
  comparisons,
  bestModelName,
  actualMarketValueEur,
}: ModelComparisonTableProps) {
  const hasActual =
    actualMarketValueEur !== null &&
    actualMarketValueEur !== undefined &&
    actualMarketValueEur > 0

  return (
    <div className="overflow-x-auto rounded border border-neutral-300 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b border-neutral-300 bg-neutral-100 text-xs uppercase text-neutral-600">
          <tr>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 text-right font-medium">Predicted (€)</th>
            <th className="px-3 py-2 text-right font-medium">Log1p Value</th>
            {hasActual ? (
              <th className="px-3 py-2 text-right font-medium">
                Gap vs Actual
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {comparisons.map((item) => {
            const isBest = item.model_name === bestModelName
            const diffEur = hasActual
              ? item.predicted_value_eur - actualMarketValueEur
              : null
            const diffPct =
              hasActual && diffEur !== null
                ? (diffEur / actualMarketValueEur) * 100
                : null

            return (
              <tr
                key={item.model_name}
                className={isBest ? 'bg-neutral-50 font-medium' : ''}
              >
                <td className="px-3 py-2 text-neutral-900">
                  <span>{item.model_name}</span>
                  {isBest ? (
                    <span className="ml-2 rounded border border-neutral-400 bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-800">
                      Best
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-900">
                  {formatEurCompact(item.predicted_value_eur)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                  {item.predicted_log_value.toFixed(4)}
                </td>
                {hasActual ? (
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      diffEur !== null && diffEur >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {formatSignedEurCompact(diffEur)} (
                    {formatSignedPct(diffPct)})
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
