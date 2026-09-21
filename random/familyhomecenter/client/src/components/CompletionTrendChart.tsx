interface Props {
  data: Array<{ date: string; count: number }>;
  color: string;
}

/** A simple daily bar chart — direct value labels (not hover-only) since this is a touchscreen kiosk. */
export function CompletionTrendChart({ data, color }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="trend-chart">
      {data.map((d) => (
        <div key={d.date} className="trend-chart__col" title={`${d.date}: ${d.count} completed`}>
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
        </div>
      ))}
    </div>
  );
}
