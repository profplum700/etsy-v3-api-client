import { describe, expect, it } from "vitest";
import { resolveExecutionReportPath } from "../scripts/report-path.mjs";

describe("approved price execution report paths", () => {
  it("uses a separate default report for proposal paths with a CSV suffix", () => {
    expect(resolveExecutionReportPath("proposal.csv")).toMatch(/proposal\.execution\.csv$/);
  });

  it("appends an execution suffix when the proposal has no CSV extension", () => {
    expect(resolveExecutionReportPath("proposal")).toMatch(/proposal\.execution\.csv$/);
  });

  it("rejects an explicitly selected report path that is the proposal", () => {
    expect(() => resolveExecutionReportPath("proposal.csv", "proposal.csv"))
      .toThrow("The execution report path must be different from the proposal path.");
  });
});
