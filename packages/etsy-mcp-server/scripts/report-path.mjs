import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

function comparable(path) {
  const absolute = resolve(path);
  const canonical = existsSync(absolute) ? realpathSync(absolute) : absolute;
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical;
}

export function resolveExecutionReportPath(proposalPath, requestedReportPath) {
  const proposal = resolve(proposalPath);
  let report;
  if (requestedReportPath) {
    report = resolve(requestedReportPath);
  } else if (/\.csv$/i.test(proposal)) {
    report = proposal.replace(/\.csv$/i, '.execution.csv');
  } else {
    report = `${proposal}.execution.csv`;
  }

  if (comparable(proposal) === comparable(report)) {
    throw new Error('The execution report path must be different from the proposal path.');
  }
  return report;
}
