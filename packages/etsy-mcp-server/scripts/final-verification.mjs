export function finalVerificationRows(preflight) {
  return preflight.filter((candidate) => candidate.state === "READY" || candidate.state === "VERIFIED");
}
