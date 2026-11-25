import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatFeatureName } from '@/lib/format'
import type { ShapExplanation } from '@/lib/types'

interface ShapChartProps {
  shap: ShapExplanation | null
  maxItems?: number
}

interface ShapChartRow {
  feature: string
  label: string
  formattedValue: string
  shap_value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ShapChartRow }>
}

function formatShapValue(value: number | string): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
  }
  return String(value)
}

function ShapTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }
  const row = payload[0]?.payload
  if (!row) {
    return null
  }

  return (
    <div className="rounded border border-neutral-300 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-neutral-900">{row.label}</p>
      <p className="text-neutral-600">Feature Value: {row.formattedValue}</p>
      <p
        className={`font-medium tabular-nums ${
          row.shap_value >= 0 ? 'text-emerald-700' : 'text-rose-700'
        }`}
      >
        SHAP (log): {row.shap_value >= 0 ? '+' : ''}
        {row.shap_value.toFixed(4)}
      </p>
    </div>
  )
}

export function ShapChart({ shap, maxItems = 12 }: ShapChartProps) {
  if (!shap || shap.contributions.length === 0) {
    return (
      <div className="rounded border border-neutral-300 bg-white p-4 text-sm text-neutral-600">
        SHAP contributions are unavailable for this prediction.
      </div>
    )
  }

  const rows: ShapChartRow[] = [...shap.contributions]
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, maxItems)
    .map((item) => {
      const formattedValue = formatShapValue(item.value)
      return {
        feature: item.feature,
        label: `${formatFeatureName(item.feature)} (${formattedValue})`,
        formattedValue,
        shap_value: Number(item.shap_value.toFixed(4)),
      }
    })

  const chartHeight = Math.max(240, rows.length * 28 + 40)

  return (
    <div className="rounded border border-neutral-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            SHAP Feature Contributions (Top {rows.length})
          </h3>
          <p className="text-xs text-neutral-600">
            Log-scale impact relative to dataset baseline{' '}
            <span className="font-mono font-medium text-neutral-800">
              {shap.base_value_log.toFixed(4)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 bg-emerald-600" />
            Increases value
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 bg-rose-600" />
            Decreases value
          </span>
        </div>
      </div>

      <div style={{ height: `${chartHeight}px` }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#525252' }}
              stroke="#a3a3a3"
            />
            <YAxis
              type="category"
              dataKey="label"
              width={210}
              tick={{ fontSize: 11, fill: '#262626' }}
              stroke="#a3a3a3"
            />
            <Tooltip content={<ShapTooltip />} />
            <ReferenceLine x={0} stroke="#525252" />
            <Bar dataKey="shap_value" isAnimationActive={false}>
              {rows.map((entry) => (
                <Cell
                  key={entry.feature}
                  fill={entry.shap_value >= 0 ? '#059669' : '#e11d48'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
