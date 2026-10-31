import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchInstrumentHistory } from "../api/instrumentsApi";
import { InstrumentHistoryChart } from "../components/markets/InstrumentHistoryChart";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatMoney } from "../utils/format";

export function InstrumentDetailPage() {
  const { instrumentId: idParam } = useParams();
  const instrumentId = Number(idParam);
  const [months, setMonths] = useState(12);

  const loadHistory = useCallback(() => {
    if (!Number.isFinite(instrumentId) || instrumentId < 1) {
      return Promise.reject(new Error("Invalid instrument"));
    }
    return fetchInstrumentHistory(instrumentId, { months });
  }, [instrumentId, months]);

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
            months={months}
            onMonthsChange={setMonths}
          />
        </>
      )}
    </div>
  );
}
