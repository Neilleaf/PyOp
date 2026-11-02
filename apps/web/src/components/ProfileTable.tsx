import { useState } from 'react';
import type { BenchmarkVariant, FunctionProfile } from '../types/benchmark';
import { formatDuration } from '../utils/metrics';

type SortKey = 'self_time_seconds' | 'cumulative_time_seconds' | 'total_calls';

export function ProfileTable({
  variants,
  optimizedName,
}: {
  variants: [BenchmarkVariant, BenchmarkVariant];
  optimizedName: string;
}) {
  const [selected, setSelected] = useState(0);
  const [sort, setSort] = useState<SortKey>('cumulative_time_seconds');
  const [descending, setDescending] = useState(true);
  const profile = [...variants[selected].profile].sort(
    (a, b) => (b[sort] - a[sort]) * (descending ? 1 : -1),
  );

  function changeSort(key: SortKey) {
    setDescending(key === sort ? !descending : true);
    setSort(key);
  }

  function heading(key: SortKey, label: string, help: string) {
    return (
      <th scope="col" aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}>
        <button title={help} onClick={() => changeSort(key)}>
          {label}
          <span aria-hidden="true"> {sort === key ? (descending ? '↓' : '↑') : '↕'}</span>
        </button>
      </th>
    );
  }

  const renderRow = (row: FunctionProfile, index: number) => (
    <tr key={`${row.filename}:${row.line}:${row.function}`}>
      <td className="row-number">{String(index + 1).padStart(2, '0')}</td>
      <th scope="row">
        <code>{row.function}</code>
        <span className="source-location">
          {row.filename}:{row.line}
        </span>
      </th>
      <td>
        {row.total_calls.toLocaleString('en-US')}{' '}
        <span className="muted">/ {row.primitive_calls.toLocaleString('en-US')}</span>
      </td>
      <td>{formatDuration(row.self_time_seconds * 1e9)}</td>
      <td>{formatDuration(row.cumulative_time_seconds * 1e9)}</td>
    </tr>
  );

  return (
    <section className="panel profile-panel" aria-labelledby="profile-title">
      <div className="panel-heading">
        <div>
          <h3 id="profile-title">Function profile</h3>
          <p className="muted small">
            Separate cProfile diagnostic run · includes instrumentation overhead
          </p>
        </div>
        <label className="profile-select">
          Implementation<span className="sr-only"> to profile</span>
          <select value={selected} onChange={(event) => setSelected(Number(event.target.value))}>
            <option value="0">Original · Naive</option>
            <option value="1">Optimized · {optimizedName}</option>
          </select>
        </label>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Function profile table">
        <table>
          <caption className="sr-only">
            Function metrics for {variants[selected].name}. Click Calls, Self time, or Cumulative to
            sort.
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Function / source</th>
              {heading(
                'total_calls',
                'Calls / primitive',
                'Total calls include recursion. Primitive calls exclude recursive re-entry.',
              )}
              {heading(
                'self_time_seconds',
                'Self time',
                'Time in this function, excluding subcalls.',
              )}
              {heading(
                'cumulative_time_seconds',
                'Cumulative',
                'Time in this function and all subcalls; do not sum across rows.',
              )}
            </tr>
          </thead>
          <tbody>{profile.map(renderRow)}</tbody>
        </table>
      </div>
      <div className="profile-help">
        <p>
          <strong>Self time</strong> excludes subcalls. <strong>Cumulative</strong> includes
          subcalls; overlapping times must not be added.
        </p>
        <p>
          <strong>Calls / primitive</strong> shows all calls / calls excluding recursive re-entry.
          Library functions and profiler overhead are included.
        </p>
      </div>
    </section>
  );
}
