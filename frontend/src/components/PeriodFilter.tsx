import type { PeriodPreset } from "../state/period";
import { usePeriod } from "../state/period";

const PRESET_LABELS: { value: PeriodPreset; label: string }[] = [
  { value: "current_month", label: "Current month" },
  { value: "prev_month", label: "Previous month" },
  { value: "current_quarter", label: "Current quarter" },
  { value: "current_year", label: "Current year" },
  { value: "custom", label: "Custom range" },
];

export function PeriodFilter() {
  const { preset, range, setPreset, setCustomRange } = usePeriod();

  return (
    <div className="card period-filter">
      <h2>Period</h2>
      <div className="period-filter-row">
        <label>
          Preset
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PeriodPreset)}
          >
            {PRESET_LABELS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {preset === "custom" && (
          <>
            <label>
              From
              <input
                type="date"
                value={range.from}
                onChange={(e) =>
                  setCustomRange({ ...range, from: e.target.value })
                }
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={range.to}
                onChange={(e) =>
                  setCustomRange({ ...range, to: e.target.value })
                }
              />
            </label>
          </>
        )}
        {preset !== "custom" && (
          <span className="period-filter-summary">
            {range.from} — {range.to}
          </span>
        )}
      </div>
    </div>
  );
}
