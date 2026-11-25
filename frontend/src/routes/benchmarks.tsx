import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { formatFeatureName } from '@/lib/format'
import { metadataQueryOptions } from '@/lib/queries'

const ACADEMIC_REFERENCES = [
  {
    citation: 'Fotache, M., et al. (2026)',
    title:
      "Machine Learning for the Prediction of Football Players' Market Value (MDPI Applied Sciences)",
    role: 'Primary methodological benchmark: Transfermarkt dataset, Linear Regression vs. Random Forest vs. XGBoost comparison, RMSE & R² metrics, and SHAP interpretability.',
  },
  {
    citation: 'Müller, O., Simons, A., & Weinmann, M. (2017)',
    title:
      'Beyond Crowd Judgments: Data-Driven Estimation of Market Value in Association Football (European Journal of Operational Research, 263(2), 611–624)',
    role: 'Foundational problem framing: overcoming Transfermarkt crowd-sourcing subjectivity with objective data-driven Moneyball scouting.',
  },
  {
    citation: 'Al-Asadi, M. A., & Tasdemir, S. (2022)',
    title:
      'Predict the Value of Football Players Using FIFA Video Game Data and Machine Learning Techniques (IEEE Access, Vol. 10, 22631–22645)',
    role: 'Theoretical basis for regression algorithm benchmarking and domain justification for age, position, and performance features.',
  },
  {
    citation: 'Lubis, et al.',
    title: 'Multidimensional Football Scouting Assessment Framework',
    role: 'Methodological justification that player scouting must integrate physical, technical, positional role, and disciplinary dimensions.',
  },
] as const

function formatMetricValue(value: string | number | undefined): string {
  if (value === undefined) {
    return '—'
  }
  if (typeof value === 'string') {
    return value
  }
  if (!Number.isFinite(value)) {
    return '—'
  }
  if (Math.abs(value) >= 1000) {
    return Math.round(value).toLocaleString()
  }
  return value.toFixed(4)
}

function BenchmarksPage() {
  const metadataQuery = useQuery(metadataQueryOptions())

  if (metadataQuery.isPending) {
    return (
      <div className="rounded border border-neutral-300 bg-white p-6 text-sm text-neutral-600">
        Loading model evaluation metrics and metadata…
      </div>
    )
  }

  if (metadataQuery.isError) {
    return (
      <ErrorBanner
        title="Failed to load model metadata"
        error={metadataQuery.error}
        onRetry={() => void metadataQuery.refetch()}
      />
    )
  }

  const metadata = metadataQuery.data
  const metricRows = Array.isArray(metadata.evaluation_metrics)
    ? metadata.evaluation_metrics
    : []
  const metricKeys = Array.from(
    new Set(
      metricRows.flatMap((row) =>
        Object.keys(row).filter((key) => key !== 'Model'),
      ),
    ),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">
          Model Lab — Benchmarks, Parameters & Methodology
        </h1>
        <p className="text-xs text-neutral-600">
          Live metadata from trained artifacts (best model:{' '}
          <strong className="text-neutral-900">
            {metadata.best_model_name}
          </strong>
          ). Target variable trained on log1p(market_value_in_eur) and inverted
          via expm1.
        </p>
      </div>

      {/* Evaluation Metrics */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Evaluation Metrics
        </h2>
        <div className="overflow-x-auto rounded border border-neutral-300 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-neutral-300 bg-neutral-100 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">Model</th>
                {metricKeys.map((key) => (
                  <th key={key} className="px-3 py-2 text-right font-medium">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {metricRows.map((row) => {
                const modelName = row.Model
                const isBest = modelName === metadata.best_model_name
                return (
                  <tr
                    key={modelName}
                    className={isBest ? 'bg-neutral-50 font-medium' : ''}
                  >
                    <td className="px-3 py-2 text-neutral-900">
                      {modelName}
                      {isBest ? (
                        <span className="ml-2 rounded border border-neutral-400 bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-800">
                          Best
                        </span>
                      ) : null}
                    </td>
                    {metricKeys.map((key) => (
                      <td
                        key={key}
                        className="px-3 py-2 text-right tabular-nums text-neutral-800"
                      >
                        {formatMetricValue(row[key])}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Best Hyperparameters */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Best Hyperparameters
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Object.entries(metadata.best_params).map(([modelName, params]) => {
            const entries = Object.entries(params ?? {})
            return (
              <div
                key={modelName}
                className="rounded border border-neutral-300 bg-white p-3"
              >
                <h3 className="border-b border-neutral-200 pb-1.5 text-sm font-semibold text-neutral-900">
                  {modelName}
                </h3>
                {entries.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-500">
                    Default parameters (no tuning grid).
                  </p>
                ) : (
                  <dl className="mt-2 space-y-1 text-xs">
                    {entries.map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between gap-2"
                      >
                        <dt className="font-mono text-neutral-600">{k}</dt>
                        <dd className="font-mono font-medium text-neutral-900">
                          {String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Feature List */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Feature Schema ({metadata.numeric_features.length} Numeric +{' '}
          {metadata.categorical_features.length} Categorical)
        </h2>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="overflow-x-auto rounded border border-neutral-300 bg-white lg:col-span-2">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-neutral-300 bg-neutral-100 uppercase text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Numeric Feature</th>
                  <th className="px-3 py-2 font-medium">Column Key</th>
                  <th className="px-3 py-2 text-right font-medium">Min</th>
                  <th className="px-3 py-2 text-right font-medium">Median</th>
                  <th className="px-3 py-2 text-right font-medium">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {metadata.numeric_features.map((feat) => {
                  const range = metadata.feature_ranges[feat]
                  return (
                    <tr key={feat}>
                      <td className="px-3 py-1.5 font-medium text-neutral-900">
                        {formatFeatureName(feat)}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-neutral-600">
                        {feat}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-neutral-700">
                        {range ? range.min.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-neutral-900">
                        {range ? Number(range.median.toFixed(2)).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-neutral-700">
                        {range ? range.max.toLocaleString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            {metadata.categorical_features.map((cat) => {
              const options = metadata.categorical_options[cat] ?? []
              return (
                <div
                  key={cat}
                  className="rounded border border-neutral-300 bg-white p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase text-neutral-800">
                      {formatFeatureName(cat)}
                    </h3>
                    <span className="font-mono text-[11px] text-neutral-500">
                      {cat}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {options.map((opt) => (
                      <span
                        key={opt}
                        className="rounded border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-800"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Academic References */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Academic References
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ACADEMIC_REFERENCES.map((ref) => (
            <div
              key={ref.citation}
              className="rounded border border-neutral-300 bg-white p-3 text-xs"
            >
              <p className="font-semibold text-neutral-900">{ref.citation}</p>
              <p className="mt-0.5 italic text-neutral-700">{ref.title}</p>
              <p className="mt-1.5 text-neutral-600">{ref.role}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export const Route = createFileRoute('/benchmarks')({
  component: BenchmarksPage,
})
