import { useCallback, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  createBondPosition,
  deleteBondPosition,
  fetchBondPositions,
  type BondCouponFrequency,
  type BondRateKind,
} from "../../api/bondPositionsApi";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatMoney } from "../../utils/format";
import { StatusBlock } from "../ui/StatusBlock";
import {
  dateInputToIso,
  defaultOccurredAtValue,
  formatOccurredAt,
} from "./occurredAt";

type Props = {
  accountId: number;
  currency: string;
  onChanged: () => void;
};

export function TreasuryBondsPanel(props: Props) {
  const { accountId, currency, onChanged } = props;
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [seriesCode, setSeriesCode] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [unitPurchasePrice, setUnitPurchasePrice] = useState("100");
  const [purchasedAt, setPurchasedAt] = useState(defaultOccurredAtValue);
  const [rateKind, setRateKind] = useState<BondRateKind>("FIXED");
  const [currentAnnualRatePct, setCurrentAnnualRatePct] = useState("6.5");
  const [couponFrequency, setCouponFrequency] =
    useState<BondCouponFrequency>("ANNUAL");
  const [periodStart, setPeriodStart] = useState(defaultOccurredAtValue);
  const [maturityDate, setMaturityDate] = useState("");
  const [earlyExitFeePerUnit, setEarlyExitFeePerUnit] = useState("1");
  const [notes, setNotes] = useState("");

  const load = useCallback(() => fetchBondPositions(accountId), [accountId]);
  const { data, error, loading, reload } = useAsyncData(load);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const qty = Number(quantity);
    const purchase = Number(unitPurchasePrice);
    const rate = Number(currentAnnualRatePct);
    const fee = Number(earlyExitFeePerUnit);
    if (!seriesCode.trim()) {
      setFormError("seriesCode is required");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("quantity must be positive");
      return;
    }
    if (!Number.isFinite(purchase) || purchase < 0) {
      setFormError("unitPurchasePrice must be ≥ 0");
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setFormError("currentAnnualRatePct must be ≥ 0");
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      setFormError("earlyExitFeePerUnit must be ≥ 0");
      return;
    }
    if (!maturityDate.trim()) {
      setFormError("maturityDate is required");
      return;
    }

    let purchasedAtIso: string;
    let periodStartIso: string;
    let maturityIso: string;
    try {
      purchasedAtIso = dateInputToIso(purchasedAt);
      periodStartIso = dateInputToIso(periodStart);
      maturityIso = dateInputToIso(maturityDate);
    } catch {
      setFormError("Invalid date");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      await createBondPosition(accountId, {
        seriesCode: seriesCode.trim(),
        quantity: qty,
        unitPurchasePrice: purchase,
        purchasedAt: purchasedAtIso,
        rateKind,
        currentAnnualRatePct: rate,
        couponFrequency,
        periodStart: periodStartIso,
        maturityDate: maturityIso,
        earlyExitFeePerUnit: fee,
        notes: notes.trim() ? notes.trim() : null,
      });
      setSeriesCode("");
      setNotes("");
      reload();
      onChanged();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create bond position",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this bond position?")) return;
    setBusy(true);
    setFormError(null);
    try {
      await deleteBondPosition(accountId, id);
      reload();
      onChanged();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to delete bond position",
      );
    } finally {
      setBusy(false);
    }
  }

  const positions = data?.positions ?? [];
  const totals = data?.totals;

  return (
    <section className="panel">
      <h2 className="section-title">Treasury bonds</h2>
      <p className="muted">
        Net worth and account equity use <strong>gross</strong> value (nominal +
        accrued). Liquidation net subtracts early-exit fee and an estimated Belka
        tax (19%). Coupon cash goes through{" "}
        <Link to="/cashflow">Cashflow</Link> when recorded.
      </p>

      <StatusBlock loading={loading} error={error} />

      {!loading && !error ? (
        <>
          {totals ? (
            <p className="muted">
              Totals · nominal {formatMoney(totals.nominalValue, currency)} ·
              gross {formatMoney(totals.grossValue, currency)} · liquidation net{" "}
              {formatMoney(totals.liquidationNet, currency)}
            </p>
          ) : null}
          {positions.length === 0 ? (
            <p className="muted">No bond positions yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Series</th>
                    <th className="num">Qty</th>
                    <th className="num">Rate %</th>
                    <th>Maturity</th>
                    <th className="num">Nominal</th>
                    <th className="num">Gross</th>
                    <th className="num">Fee</th>
                    <th className="num">Belka</th>
                    <th className="num">Liq. net</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id}>
                      <td className="col-text">
                        {p.seriesCode}
                        <span className="muted"> · {p.rateKind}</span>
                      </td>
                      <td className="num">{p.quantity}</td>
                      <td className="num">{p.currentAnnualRatePct}</td>
                      <td>{formatOccurredAt(p.maturityDate)}</td>
                      <td className="num">
                        {formatMoney(p.valuation.nominalValue, currency)}
                      </td>
                      <td className="num">
                        {formatMoney(p.valuation.grossValue, currency)}
                      </td>
                      <td className="num">
                        {formatMoney(p.valuation.earlyExitFee, currency)}
                      </td>
                      <td className="num">
                        {formatMoney(p.valuation.belkaEstimate, currency)}
                      </td>
                      <td className="num">
                        {formatMoney(p.valuation.liquidationNet, currency)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          disabled={busy}
                          onClick={() => void handleDelete(p.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {formError ? <p className="error-banner">{formError}</p> : null}

      <h3 className="section-title">Add position</h3>
      <form className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Series code
          <input
            className="field-control"
            value={seriesCode}
            onChange={(e) => setSeriesCode(e.target.value)}
            placeholder="COI0328"
            required
          />
        </label>
        <label>
          Quantity
          <input
            className="field-control"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
        <label>
          Purchase price / unit
          <input
            className="field-control"
            type="number"
            min="0"
            step="0.01"
            value={unitPurchasePrice}
            onChange={(e) => setUnitPurchasePrice(e.target.value)}
            required
          />
        </label>
        <label>
          Purchased
          <input
            className="field-control"
            type="date"
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            required
          />
        </label>
        <label>
          Rate kind
          <select
            className="field-control"
            value={rateKind}
            onChange={(e) => setRateKind(e.target.value as BondRateKind)}
          >
            <option value="FIXED">FIXED</option>
            <option value="FLOATING">FLOATING</option>
            <option value="INFLATION_LINKED">INFLATION_LINKED</option>
          </select>
        </label>
        <label>
          Current annual rate %
          <input
            className="field-control"
            type="number"
            min="0"
            step="0.01"
            value={currentAnnualRatePct}
            onChange={(e) => setCurrentAnnualRatePct(e.target.value)}
            required
          />
        </label>
        <label>
          Coupon frequency
          <select
            className="field-control"
            value={couponFrequency}
            onChange={(e) =>
              setCouponFrequency(e.target.value as BondCouponFrequency)
            }
          >
            <option value="ANNUAL">ANNUAL</option>
            <option value="SEMI_ANNUAL">SEMI_ANNUAL</option>
            <option value="QUARTERLY">QUARTERLY</option>
            <option value="AT_MATURITY">AT_MATURITY</option>
          </select>
        </label>
        <label>
          Period start
          <input
            className="field-control"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
        </label>
        <label>
          Maturity
          <input
            className="field-control"
            type="date"
            value={maturityDate}
            onChange={(e) => setMaturityDate(e.target.value)}
            required
          />
        </label>
        <label>
          Early-exit fee / unit
          <input
            className="field-control"
            type="number"
            min="0"
            step="0.01"
            value={earlyExitFeePerUnit}
            onChange={(e) => setEarlyExitFeePerUnit(e.target.value)}
          />
        </label>
        <label>
          Notes
          <input
            className="field-control"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={busy}>
            Add position
          </button>
        </div>
      </form>
    </section>
  );
}
