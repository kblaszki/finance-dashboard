import type { Account } from "../../api/accountsApi";
import { formatMoney } from "../../utils/format";
import { formatOccurredAt } from "./occurredAt";

export function AccountSubtitle(props: { account: Account }) {
  const { account } = props;
  return (
    <>
      <span className="badge">{account.accountType}</span>
      {" · Cash "}
      <strong>{formatMoney(account.cashBalance, account.currency)}</strong>
      {account.holdingsValue != null && account.holdingsValue !== 0 && (
        <>
          {" · Holdings "}
          <strong>{formatMoney(account.holdingsValue, account.currency)}</strong>
        </>
      )}
      {account.totalEquity != null &&
        account.totalEquity !== account.cashBalance && (
          <>
            {" · Equity "}
            <strong>{formatMoney(account.totalEquity, account.currency)}</strong>
          </>
        )}
      {account.openingCashAsOf && (
        <>
          {" · Opening as of "}
          {formatOccurredAt(account.openingCashAsOf)}
        </>
      )}
      {account.description ? ` · ${account.description}` : null}
      {" · Double-click a cell to edit."}
    </>
  );
}
