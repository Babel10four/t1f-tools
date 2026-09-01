import {
  citiesForState,
  MONTHS_OF_SUPPLY_SNAPSHOT,
} from "@/lib/loan-calculator/market-snapshot";
import { SUPPORTED_STATES } from "@/lib/loan-calculator/rules";

export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state")?.toUpperCase() ?? "";
  if (!SUPPORTED_STATES.includes(state as (typeof SUPPORTED_STATES)[number])) {
    return Response.json(
      { error: "Choose a supported state." },
      { status: 400 },
    );
  }

  return Response.json(
    {
      snapshot: {
        lastUpdated: MONTHS_OF_SUPPLY_SNAPSHOT.lastUpdated,
        dataThrough: MONTHS_OF_SUPPLY_SNAPSHOT.dataThrough,
      },
      cities: citiesForState(state),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
