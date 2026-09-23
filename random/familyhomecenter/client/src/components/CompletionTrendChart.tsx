interface Props {
  data: Array<{ date: string; count: number }>;
  color: string;
  /** When provided, each day becomes a tappable button (e.g. to drill into what was/wasn't done
   *  that day) instead of a plain, inert column. */
  onSelectDate?: (date: string) => void;
}

/** A simple daily bar chart — direct value labels (not hover-only) since this is a touchscreen kiosk. */
export function CompletionTrendChart({ data, color, onSelectDate }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="trend-chart">
      {data.map((d) => {
        const col = (
          <>
            <div className="trend-chart__value">{d.count || ''}</div>
            <div className="trend-chart__track">
              {d.count > 0 && (
                <div
                  className="trend-chart__bar"
                  style={{ height: `${Math.max(8, (d.count / max) * 100)}%`, background: color }}
                />
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
            title={`${d.date}: ${d.count} completed — tap for details`}
            onClick={() => onSelectDate(d.date)}
          >
            {col}
          </button>
        ) : (
          <div key={d.date} className="trend-chart__col" title={`${d.date}: ${d.count} completed`}>
            {col}
          </div>
        );
      })}
    </div>
  );
}
