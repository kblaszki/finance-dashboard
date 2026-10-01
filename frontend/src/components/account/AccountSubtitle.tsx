import type { Account } from "../../api/accountsApi";
import { formatMoney } from "../../utils/format";
import { formatOccurredAt } from "./occurredAt";

export function AccountSubtitle(props: { account: Account }) {
  const { account } = props;
  return (
    <>
      <span className="badge">{account.accountType}</span>
      {" · Balance "}
      <strong>{formatMoney(account.cashBalance, account.currency)}</strong>
      {account.openingCashAsOf && (
        <>
          {" · Opening as of "}
          {formatOccurredAt(account.openingCashAsOf)}
        </>
      )}
      {account.description ? ` · ${account.description}` : null}
    </>
  );
}
