import { useRef } from "react";

export function AccountLedgerHeader(props: {
  exportBusy: boolean;
  importBusy: boolean;
  onExport: () => void;
  onImportFile: (file: File) => Promise<void>;
}) {
  const importFileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="form-actions-row">
      <input
        ref={importFileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void props.onImportFile(file).finally(() => {
            if (importFileRef.current) {
              importFileRef.current.value = "";
            }
          });
        }}
      />
      <button
        type="button"
        className="btn-secondary"
        onClick={() => importFileRef.current?.click()}
        disabled={props.importBusy || props.exportBusy}
      >
        {props.importBusy ? "Uploading…" : "Upload CSV"}
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={props.onExport}
        disabled={props.exportBusy || props.importBusy}
      >
        {props.exportBusy ? "Downloading…" : "Download CSV"}
      </button>
    </div>
  );
}
