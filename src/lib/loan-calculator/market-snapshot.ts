import snapshot from "@/data/months-of-supply-current.json";

export type MonthsOfSupplyCity = {
  state: string;
  regionId: number;
  city: string;
  periodEnd: string;
  monthsOfSupply: number;
};

export const MONTHS_OF_SUPPLY_SNAPSHOT = snapshot as {
  schemaVersion: number;
  lastUpdated: string;
  dataThrough: string;
  supportedStates: string[];
  entries: MonthsOfSupplyCity[];
};

export function citiesForState(state: string): MonthsOfSupplyCity[] {
  const normalized = state.trim().toUpperCase();
  return MONTHS_OF_SUPPLY_SNAPSHOT.entries.filter(
    (entry) => entry.state === normalized,
  );
}
