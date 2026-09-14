import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoanCalculatorClient } from "./loan-calculator-client";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LoanCalculatorClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              snapshot: { lastUpdated: "2026-09-03", dataThrough: "2026-08-31" },
              cities: [
                {
                  state: "FL",
                  regionId: 18142,
                  city: "Tampa, FL",
                  periodEnd: "2026-08-31",
                  monthsOfSupply: 4.9,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
  });

  it("loads a state market, calculates the workbook example, and renders eligibility", async () => {
    const user = userEvent.setup();
    render(<LoanCalculatorClient />);
    const form = screen.getByTestId("loan-calculator-form");

    await user.selectOptions(within(form).getByLabelText("Property state *"), "FL");
    await waitFor(() => {
      expect(screen.getByText(/Market data through Aug 31, 2026/)).toBeInTheDocument();
    });
    await user.type(within(form).getByLabelText("City *"), "Tampa, FL");
    await user.selectOptions(within(form).getByLabelText("Borrower tier *"), "2");
    await user.type(within(form).getByLabelText("Guarantor FICO *"), "736");
    await user.type(within(form).getByLabelText("Flips completed with T1F *"), "0");
    await user.type(within(form).getByLabelText("Purchase price *"), "250000");
    await user.type(within(form).getByLabelText("After-repair value *"), "1000000");
    await user.type(within(form).getByLabelText("Rehab budget *"), "50000");
    await user.type(within(form).getByLabelText("Financed rehab holdback *"), "50000");
    await user.type(within(form).getByLabelText("Requested borrower points"), "1");
    await user.click(within(form).getByTestId("loan-calculator-submit"));

    const results = await screen.findByTestId("loan-calculator-results");
    expect(within(results).getAllByText("$275,000").length).toBeGreaterThan(0);
    expect(within(results).getAllByText("$225,000").length).toBeGreaterThan(0);
    expect(within(results).getAllByText("9.625%")).toHaveLength(2);
    expect(within(results).getAllByText("Not eligible")).toHaveLength(2);
  });

  it("requires an exact eligible city selection", async () => {
    const user = userEvent.setup();
    render(<LoanCalculatorClient />);
    const form = screen.getByTestId("loan-calculator-form");
    await user.selectOptions(within(form).getByLabelText("Property state *"), "FL");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await user.type(within(form).getByLabelText("City *"), "Not a city");
    await user.click(within(form).getByTestId("loan-calculator-submit"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Select an eligible city from the market data list.",
    );
  });
});
