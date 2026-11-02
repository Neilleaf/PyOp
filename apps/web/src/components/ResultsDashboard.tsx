import { benchmarks } from '../data/benchmarks';
import type { SuccessfulResult } from '../types/benchmark';
import { calculateSpeedup, formatDuration, formatRatio } from '../utils/metrics';
import { PerformanceChart } from './PerformanceChart';
import { ProfileTable } from './ProfileTable';

export function ResultsDashboard({ result }: { result: SuccessfulResult }) {
  const benchmark = benchmarks[result.benchmark_id];
  const ratio = calculateSpeedup(
    result.variants[0].timing.median_ns,
    result.variants[1].timing.median_ns,
  );
  const ratioMessage =
    ratio === null
      ? 'A finite ratio is unavailable for zero or invalid durations.'
      : ratio > 1
        ? 'The optimized median is lower in this recorded run.'
        : ratio < 1
          ? 'The optimized median is higher in this recorded run.'
          : 'Both medians are equal in this recorded run.';

  return (
    <div className="results-stack">
      <section aria-labelledby="results-title">
        <div className="results-heading">
          <div>
            <span className="eyebrow">BENCHMARK REPORT</span>
            <h2 id="results-title">{benchmark.label}</h2>
          </div>
          <span className="badge">Demo Results</span>
        </div>
        <p className="result-config">
          {result.input_size.toLocaleString('en-US')} {benchmark.sizeUnit}
          <span>·</span>
          {result.repetitions} repetitions<span>·</span>
          {result.warmups} warmup<span>·</span>Python {result.python_version}
        </p>
        <div className="metric-grid">
          {result.variants.map((variant, i) => (
            <article className={`metric-card ${i === 1 ? 'optimized' : ''}`} key={variant.name}>
              <span className="eyebrow">
                <i className={`dot series-${i}`} />
                {i === 0 ? 'ORIGINAL' : 'OPTIMIZED'}
              </span>
              <p className="implementation">
                {i === 0 ? 'Naive implementation' : benchmark.optimizedName}
              </p>
              <strong className="metric-value">{formatDuration(variant.timing.median_ns)}</strong>
              <span className="metric-label">median execution time</span>
              <dl className="variability">
                <div>
                  <dt title="Population standard deviation of the recorded timing samples">
                    Std. deviation
                  </dt>
                  <dd>{formatDuration(variant.timing.stdev_ns)}</dd>
                </div>
                <div>
                  <dt title="Median absolute deviation from the median">MAD</dt>
                  <dd>{formatDuration(variant.timing.mad_ns)}</dd>
                </div>
              </dl>
            </article>
          ))}
          <article className="metric-card ratio-card">
            <span className="eyebrow">OBSERVED SPEEDUP</span>
            <p className="implementation">Original ÷ optimized median</p>
            <strong className="metric-value">{formatRatio(ratio)}</strong>
            <span className="metric-label">ratio of median times</span>
            <p className="ratio-note">{ratioMessage}</p>
          </article>
        </div>
        <p className="correctness-note">
          <span aria-hidden="true">✓</span> Both implementations passed correctness checks before
          timing. Ratios above 1 favor the optimized implementation; below 1 favor the original.
        </p>
      </section>
      <PerformanceChart variants={result.variants} optimizedName={benchmark.optimizedName} />
      <ProfileTable variants={result.variants} optimizedName={benchmark.optimizedName} />
    </div>
  );
}
