import { useState } from 'react';
import type { BenchmarkVariant } from '../types/benchmark';
import { formatDuration } from '../utils/metrics';

interface Props {
  variants: [BenchmarkVariant, BenchmarkVariant];
  optimizedName: string;
}

export function PerformanceChart({ variants, optimizedName }: Props) {
  const [mode, setMode] = useState<'median' | 'samples'>('median');
  const [sample, setSample] = useState(0);
  const names = ['Original · Naive', `Optimized · ${optimizedName}`];
  const max = Math.max(...variants.flatMap((variant) => variant.timing.samples_ns), 1);
  const count = Math.min(...variants.map((variant) => variant.timing.samples_ns.length));
  const x = (index: number) => 38 + index * (640 / Math.max(count - 1, 1));
  const y = (ns: number) => 170 - (ns / max) * 140;

  return (
    <section className="panel chart-panel" aria-labelledby="chart-title">
      <div className="panel-heading">
        <div>
          <h3 id="chart-title">Execution time</h3>
          <p className="muted small">Uninstrumented measurements · lower is better</p>
        </div>
        <div className="segmented" role="group" aria-label="Chart view">
          <button onClick={() => setMode('median')} aria-pressed={mode === 'median'}>
            Medians
          </button>
          <button onClick={() => setMode('samples')} aria-pressed={mode === 'samples'}>
            All samples
          </button>
        </div>
      </div>
      <figure>
        {mode === 'median' ? (
          <div className="bar-chart">
            {variants.map((variant, index) => (
              <div className="bar-row" key={variant.name}>
                <div className="bar-label">
                  <span>
                    <i className={`dot series-${index}`} />
                    {names[index]}
                  </span>
                  <strong>{formatDuration(variant.timing.median_ns)}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className={`bar series-${index}`}
                    style={{ width: `${(variant.timing.median_ns / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="chart-scale">
              <span>0 ns</span>
              <span>{formatDuration(max)}</span>
            </div>
          </div>
        ) : (
          <div className="samples-chart">
            <div className="chart-scale">
              <span>{formatDuration(max)}</span>
              <span>Linear scale · {count} repetitions</span>
            </div>
            <svg viewBox="0 0 716 200" aria-hidden="true">
              {[30, 100, 170].map((row) => (
                <line key={row} x1="38" x2="678" y1={row} y2={row} className="grid-line" />
              ))}
              <line x1={x(sample)} x2={x(sample)} y1="20" y2="180" className="sample-guide" />
              {variants.map((variant, index) => (
                <g key={variant.name} className={`plot-${index}`}>
                  <polyline
                    fill="none"
                    strokeWidth="2.5"
                    points={variant.timing.samples_ns
                      .map((value, i) => `${x(i)},${y(value)}`)
                      .join(' ')}
                  />
                  {variant.timing.samples_ns.map((value, i) => (
                    <circle key={i} cx={x(i)} cy={y(value)} r={i === sample ? 5 : 3} />
                  ))}
                </g>
              ))}
              <text x="38" y="198">
                1
              </text>
              <text x="678" y="198">
                {count}
              </text>
            </svg>
            <label className="sample-control" htmlFor="sample">
              Inspect repetition {sample + 1}
              <input
                id="sample"
                type="range"
                min="0"
                max={count - 1}
                value={sample}
                onChange={(event) => setSample(Number(event.target.value))}
              />
            </label>
            <div className="sample-values" aria-live="polite">
              {variants.map((variant, i) => (
                <span key={variant.name}>
                  <i className={`dot series-${i}`} />
                  {names[i]}: <strong>{formatDuration(variant.timing.samples_ns[sample])}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
        <figcaption>
          Linear scale starting at zero. Very short durations may be hard to see; inspect the table
          for exact nanosecond values.
        </figcaption>
      </figure>
      <details className="data-details">
        <summary>View chart data as a table</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Chart data">
          <table>
            <caption className="sr-only">Recorded execution times for each repetition</caption>
            <thead>
              <tr>
                <th scope="col">Repetition</th>
                {names.map((name) => (
                  <th key={name} scope="col">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: count }, (_, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  {variants.map((variant) => (
                    <td key={variant.name}>
                      {formatDuration(variant.timing.samples_ns[i])}
                      <span className="source-location">
                        {variant.timing.samples_ns[i].toLocaleString('en-US')} ns
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
