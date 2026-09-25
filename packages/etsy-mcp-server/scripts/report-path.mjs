import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function comparable(path) {
  const absolute = resolve(path);
  const canonical = existsSync(absolute) ? realpathSync(absolute) : absolute;
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical;
}

function sameFileIdentity(left, right) {
  let leftStats;
  let rightStats;
  try {
    leftStats = statSync(left, { bigint: true });
    rightStats = statSync(right, { bigint: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return false;
    throw new Error('The execution report path could not be safely compared with the proposal path.');
  }
  if (leftStats.ino === 0n || rightStats.ino === 0n) {
    throw new Error('The execution report path could not be safely compared with the proposal path.');
  }
  return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
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

  if (comparable(proposal) === comparable(report) || sameFileIdentity(proposal, report)) {
    throw new Error('The execution report path must be different from the proposal path.');
  }
  return report;
}
