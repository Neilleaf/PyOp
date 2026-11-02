export function TechnicalNotes() {
  return (
    <section id="methodology" className="methodology" aria-labelledby="methodology-title">
      <div className="section-heading">
        <span className="step">04</span>
        <h2 id="methodology-title">Understand the measurements</h2>
      </div>
      <div className="notes-grid">
        <article>
          <span className="note-number">01 / CONTEXT</span>
          <h3>Evidence from one machine.</h3>
          <p>
            Hardware, Python version, system load, and scheduling affect results. These demos are
            real recorded runs, not predictions for your machine or universal speedup claims.
          </p>
        </article>
        <article>
          <span className="note-number">02 / VARIABILITY</span>
          <h3>One measurement is not enough.</h3>
          <p>
            The median describes a typical run. Standard deviation measures overall spread; MAD is
            the median distance from the median and is less sensitive to outliers. Neither is a
            confidence interval.
          </p>
        </article>
        <article>
          <span className="note-number">03 / METHODOLOGY</span>
          <h3>Time first. Profile separately.</h3>
          <p>
            Timing samples use perf_counter_ns without profiling. A separate cProfile run reveals
            function costs but adds overhead. Its diagnostic times should not be compared with the
            timing samples.
          </p>
        </article>
      </div>
    </section>
  );
}
