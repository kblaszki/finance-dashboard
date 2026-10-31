import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchInstrumentHistory } from "../api/instrumentsApi";
import {
  InstrumentHistoryChart,
  type HistoryViewMode,
} from "../components/markets/InstrumentHistoryChart";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatMoney } from "../utils/format";

function currentUtcYear(): number {
  return new Date().getUTCFullYear();
}

export function InstrumentDetailPage() {
  const { instrumentId: idParam } = useParams();
  const instrumentId = Number(idParam);
  const [mode, setMode] = useState<HistoryViewMode>("months");
  const [months, setMonths] = useState(12);
  const [year, setYear] = useState(currentUtcYear);

  const loadHistory = useCallback(() => {
    if (!Number.isFinite(instrumentId) || instrumentId < 1) {
      return Promise.reject(new Error("Invalid instrument"));
    }
    if (mode === "year") {
      return fetchInstrumentHistory(instrumentId, { year });
    }
    return fetchInstrumentHistory(instrumentId, { months });
  }, [instrumentId, mode, months, year]);

  const {
    data: history,
    error,
    loading,
  } = useAsyncData(loadHistory);

  if (!Number.isFinite(instrumentId) || instrumentId < 1) {
    return (
      <div className="page-stack">
        <p className="error-banner" role="alert">
          Invalid instrument
        </p>
        <Link to="/markets">← Markets</Link>
      </div>
    );
  }

  const instrument = history?.instrument;
  const last = history?.series?.length
    ? history.series[history.series.length - 1]
    : null;

  return (
    <div className="page-stack">
      <p className="muted">
        <Link to="/markets">← Markets</Link>
      </p>
      <StatusBlock
        loading={loading && !history}
        error={error}
        empty={false}
        loadingMessage="Loading instrument…"
      />
      {history && instrument && (
        <>
          <PageHeader
            title={instrument.symbol}
            subtitle={
              <>
                {instrument.name}
                {instrument.exchange ? ` · ${instrument.exchange}` : ""}
                {instrument.assetClass ? ` · ${instrument.assetClass}` : ""}
                {last != null
                  ? ` · Last close ${formatMoney(last.close, history.currency)} (${last.asOf})`
                  : ""}
              </>
            }
          />
          <InstrumentHistoryChart
            history={history}
            loading={loading}
            error={error}
            mode={mode}
            months={months}
            year={year}
            onModeChange={(next) => {
              setMode(next);
              if (next === "year") {
                const anchor =
                  history.newestYear ?? history.oldestYear ?? currentUtcYear();
                setYear(anchor);
              }
            }}
            onMonthsChange={setMonths}
            onYearChange={setYear}
          />
        </>
      )}
    </div>
  );
}
