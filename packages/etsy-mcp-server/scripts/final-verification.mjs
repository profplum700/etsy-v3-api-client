export function finalVerificationRows(preflight) {
  return preflight.filter((candidate) => candidate.state === "READY" || candidate.state === "VERIFIED");
}

export async function verifyFinalListingSnapshots(rows, readSnapshot, verifyRow) {
  const groups = new Map();
  for (const candidate of rows) {
    const listingId = candidate.row.listing_id;
    const key = String(listingId);
    const group = groups.get(key) ?? { listingId, rows: [] };
    group.rows.push(candidate);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const snapshot = await readSnapshot(group.listingId, group.rows);
    for (const candidate of group.rows) await verifyRow(candidate, snapshot);
  }
}
