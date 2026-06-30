import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type PeriodPreset =
  | "current_month"
  | "prev_month"
  | "current_quarter"
  | "current_year"
  | "last_12_months"
  | "custom";

export type DateRange = {
  from: string;
  to: string;
};

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rangeForPreset(preset: PeriodPreset): DateRange {
  const now = new Date();

  if (preset === "current_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: formatDateLocal(from), to: formatDateLocal(to) };
  }

  if (preset === "prev_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: formatDateLocal(from), to: formatDateLocal(to) };
  }

  if (preset === "current_quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    const to = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { from: formatDateLocal(from), to: formatDateLocal(to) };
  }

  if (preset === "current_year") {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear(), 11, 31);
    return { from: formatDateLocal(from), to: formatDateLocal(to) };
  }

  if (preset === "last_12_months") {
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return { from: formatDateLocal(from), to: formatDateLocal(to) };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: formatDateLocal(from), to: formatDateLocal(to) };
}

type PeriodContextValue = {
  preset: PeriodPreset;
  range: DateRange;
  yearMonth: string;
  setPreset: (preset: PeriodPreset) => void;
  setCustomRange: (range: DateRange) => void;
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider(props: { children: React.ReactNode; initialPreset?: PeriodPreset }) {
  const initial = props.initialPreset ?? "current_month";
  const [preset, setPresetState] = useState<PeriodPreset>(initial);
  const [customRange, setCustomRangeState] = useState<DateRange>(() => rangeForPreset(initial));

  const range = useMemo(() => {
    if (preset === "custom") return customRange;
    return rangeForPreset(preset);
  }, [preset, customRange]);

  const setPreset = useCallback((next: PeriodPreset) => {
    setPresetState(next);
    if (next !== "custom") {
      setCustomRangeState(rangeForPreset(next));
    }
  }, []);

  const setCustomRange = useCallback((next: DateRange) => {
    setPresetState("custom");
    setCustomRangeState(next);
  }, []);

  const yearMonth = range.from.slice(0, 7);

  const value = useMemo(
    () => ({ preset, range, yearMonth, setPreset, setCustomRange }),
    [preset, range, yearMonth, setPreset, setCustomRange],
  );

  return <PeriodContext.Provider value={value}>{props.children}</PeriodContext.Provider>;
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used within PeriodProvider");
  return ctx;
}

export function usePeriodOptional() {
  return useContext(PeriodContext);
}
