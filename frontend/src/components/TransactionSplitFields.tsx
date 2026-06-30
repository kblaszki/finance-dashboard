import { CategoryPicker } from './CategoryPicker'

export type SplitLine = { categoryId: number | null; amount: number }

type Props = {
  splits: SplitLine[]
  totalAmount: number
  onChange: (splits: SplitLine[]) => void
}

export function TransactionSplitFields({ splits, totalAmount, onChange }: Props) {
  const splitSum = splits.reduce((s, line) => s + (line.amount > 0 ? line.amount : 0), 0)
  const remaining = Math.round((totalAmount - splitSum) * 100) / 100

  function updateLine(index: number, patch: Partial<SplitLine>) {
    onChange(splits.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function addLine() {
    onChange([...splits, { categoryId: null, amount: remaining > 0 ? remaining : 0 }])
  }

  function removeLine(index: number) {
    onChange(splits.filter((_, i) => i !== index))
  }

  return (
    <div className="split-form stack-md">
      {splits.map((line, index) => (
        <div key={index} className="inline-form">
          <CategoryPicker
            value={line.categoryId}
            onChange={(categoryId) => updateLine(index, { categoryId })}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={line.amount || ''}
            onChange={(e) => updateLine(index, { amount: Number(e.target.value) })}
            placeholder="Amount"
          />
          <button type="button" className="btn-link danger" onClick={() => removeLine(index)}>
            Remove
          </button>
        </div>
      ))}
      <div className="inline-form">
        <button type="button" className="btn-secondary" onClick={addLine}>
          + Add split line
        </button>
        <span className="muted">
          Split total: {splitSum.toFixed(2)} / {totalAmount.toFixed(2)}
          {Math.abs(remaining) > 0.005 ? ` (${remaining > 0 ? '+' : ''}${remaining.toFixed(2)} remaining)` : ''}
        </span>
      </div>
    </div>
  )
}
