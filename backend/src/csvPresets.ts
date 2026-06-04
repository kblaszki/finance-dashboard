import type { CsvColumnMapping } from "./csvImport";

export type CsvPresetId = "mbank" | "ing" | "generic_pl";

export type CsvPreset = {
  id: CsvPresetId;
  label: string;
  mapping: CsvColumnMapping;
};

export const CSV_PRESETS: CsvPreset[] = [
  {
    id: "mbank",
    label: "mBank",
    mapping: {
      dateColumn: "Data operacji",
      amountColumn: "Kwota",
      descriptionColumn: "Opis operacji",
      typeColumn: "Typ operacji",
    },
  },
  {
    id: "ing",
    label: "ING",
    mapping: {
      dateColumn: "Data transakcji",
      amountColumn: "Kwota",
      descriptionColumn: "Opis transakcji",
    },
  },
  {
    id: "generic_pl",
    label: "Inne (PL)",
    mapping: {
      dateColumn: "Data",
      amountColumn: "Kwota",
      descriptionColumn: "Opis",
    },
  },
];

export function getCsvPreset(id: string): CsvPreset | undefined {
  return CSV_PRESETS.find((p) => p.id === id);
}

export function listCsvPresets(): CsvPreset[] {
  return CSV_PRESETS;
}
