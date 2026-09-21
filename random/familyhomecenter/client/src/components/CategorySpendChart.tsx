interface Props {
  data: Array<{ category: string; total: number }>;
  color: string;
}

/** Horizontal bars, one per category, widest first — direct $ labels (touchscreen kiosk, not hover-only). */
export function CategorySpendChart({ data, color }: Props) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="category-chart">
      {data.map((d) => (
        <div key={d.category} className="category-chart__row">
          <div className="category-chart__label">{d.category}</div>
          <div className="category-chart__track">
            <div
              className="category-chart__bar"
              style={{ width: `${Math.max(4, (d.total / max) * 100)}%`, background: color }}
            />
          </div>
          <div className="category-chart__value">${d.total.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
