interface Props {
  data: Array<{ date: string; count: number; notCompleted?: number }>;
  color: string;
  /** When provided, each day becomes a tappable button (e.g. to drill into what was/wasn't done
   *  that day) instead of a plain, inert column. */
  onSelectDate?: (date: string) => void;
}

/**
 * A simple daily bar chart — direct value labels (not hover-only) since this is a touchscreen
 * kiosk. When `notCompleted` is given (the completions chart, not the late-completions one),
 * each bar stacks a muted "not completed" segment above the solid "completed" one, so a day with
 * assigned-but-undone tasks still reads as "something was going on" instead of looking identical
 * to a day with nothing assigned at all.
 */
export function CompletionTrendChart({ data, color, onSelectDate }: Props) {
  const totals = data.map((d) => d.count + (d.notCompleted ?? 0));
  const max = Math.max(1, ...totals);
  const showSplit = data.some((d) => d.notCompleted !== undefined);

  return (
    <div className="trend-chart">
      {data.map((d) => {
        const total = d.count + (d.notCompleted ?? 0);
        const label = showSplit && total > 0 ? `${d.count}/${total}` : d.count || '';
        const title = showSplit
          ? `${d.date}: ${d.count} completed, ${d.notCompleted ?? 0} not — tap for details`
          : `${d.date}: ${d.count} completed`;
        const col = (
          <>
            <div className="trend-chart__value">{label}</div>
            <div className="trend-chart__track">
              {total > 0 && (
                <div className="trend-chart__stack" style={{ height: `${Math.max(8, (total / max) * 100)}%` }}>
                  {(d.notCompleted ?? 0) > 0 && (
                    <div
                      className="trend-chart__bar trend-chart__bar--pending"
                      style={{ flex: d.notCompleted }}
                    />
                  )}
                  {d.count > 0 && <div className="trend-chart__bar" style={{ flex: d.count, background: color }} />}
                </div>
              )}
            </div>
            <div className="trend-chart__date">
              {new Date(`${d.date}T00:00`).toLocaleDateString(undefined, { day: 'numeric' })}
            </div>
          </>
        );
        return onSelectDate ? (
          <button
            key={d.date}
            type="button"
            className="trend-chart__col trend-chart__col--clickable"
            title={title}
            onClick={() => onSelectDate(d.date)}
          >
            {col}
          </button>
        ) : (
          <div key={d.date} className="trend-chart__col" title={title}>
            {col}
          </div>
        );
      })}
    </div>
  );
}
