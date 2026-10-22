import {
  ariaSortValue,
  type SortState,
} from "../../utils/tableSort";

export function SortableTh<K extends string>(props: {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onToggle: (key: K) => void;
  className?: string;
}) {
  const active = props.sort?.key === props.sortKey;
  const marker = active ? (props.sort?.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      className={props.className}
      aria-sort={ariaSortValue(props.sort, props.sortKey)}
    >
      <button
        type="button"
        className="th-sort"
        aria-label={`Sort by ${props.label}`}
        onClick={() => props.onToggle(props.sortKey)}
      >
        {props.label}
        {marker ? <span aria-hidden="true">{marker}</span> : null}
      </button>
    </th>
  );
}
