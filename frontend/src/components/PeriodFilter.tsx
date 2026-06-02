import type { PeriodPreset } from "../state/period";
import { usePeriod } from "../state/period";

const PRESET_LABELS: { value: PeriodPreset; label: string }[] = [
  { value: "current_month", label: "Bieżący miesiąc" },
  { value: "prev_month", label: "Poprzedni miesiąc" },
  { value: "current_quarter", label: "Bieżący kwartał" },
  { value: "current_year", label: "Bieżący rok" },
  { value: "custom", label: "Własny zakres" },
];

export function PeriodFilter() {
  const { preset, range, setPreset, setCustomRange } = usePeriod();

  return (
    <div className="card period-filter">
      <h2>Okres</h2>
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
              Od
              <input
                type="date"
                value={range.from}
                onChange={(e) =>
                  setCustomRange({ ...range, from: e.target.value })
                }
              />
            </label>
            <label>
              Do
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
