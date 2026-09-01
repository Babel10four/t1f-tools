# Months-of-supply snapshot updates

The Loan Calculator uses the normalized snapshot at
`src/data/months-of-supply-current.json`. It does not query Google Sheets at
runtime.

## Monthly update

1. Export the updated city market-data tab as CSV.
2. Run:

   ```bash
   npm run data:months-of-supply -- /absolute/path/to/city-market-data.csv
   ```

3. Review the printed city count and the `lastUpdated` / `dataThrough` values in
   the generated JSON.
4. Run the Loan Calculator tests before publishing the update.

The importer keeps the latest reporting period for each supported city, sums
duplicate rows for the same city and period to match the workbook, rejects
non-numeric months-of-supply values, and sorts the snapshot deterministically.
