import { linkSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("rejects an explicit report path that is a hard link to the proposal", () => {
    const directory = mkdtempSync(join(tmpdir(), "etsy-mcp-report-path-"));
    const proposal = join(directory, "proposal.csv");
    const report = join(directory, "report.csv");
    try {
      writeFileSync(proposal, "approved proposal");
      linkSync(proposal, report);

      expect(() => resolveExecutionReportPath(proposal, report))
        .toThrow("The execution report path must be different from the proposal path.");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a pre-existing default report that is a hard link to the proposal", () => {
    const directory = mkdtempSync(join(tmpdir(), "etsy-mcp-report-path-"));
    const proposal = join(directory, "proposal.csv");
    const report = join(directory, "proposal.execution.csv");
    try {
      writeFileSync(proposal, "approved proposal");
      linkSync(proposal, report);

      expect(() => resolveExecutionReportPath(proposal))
        .toThrow("The execution report path must be different from the proposal path.");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("allows a separate existing report file", () => {
    const directory = mkdtempSync(join(tmpdir(), "etsy-mcp-report-path-"));
    const proposal = join(directory, "proposal.csv");
    const report = join(directory, "proposal.execution.csv");
    try {
      writeFileSync(proposal, "approved proposal");
      writeFileSync(report, "previous report");

      expect(resolveExecutionReportPath(proposal)).toBe(report);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
