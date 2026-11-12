#!/usr/bin/env bash
# Merge gate for this repo (AGENTS.md, "Pull Requests and Merging"): squash-merge a
# pull request through the REST API, but only if every CI check run on its exact head
# commit succeeded (or was skipped) and the required `test` job ran. Never use
# `gh pr merge`; it bypasses this check.
#
#   scripts/merge.sh <pr-number> [--dry-run]
set -euo pipefail

pr="${1:?usage: scripts/merge.sh <pr-number> [--dry-run]}"
dry_run="${2:-}"
repo="${ETSY_CLIENT_REPO:-profplum700/etsy-v3-api-client}"
default_branch="master"

read -r state draft base sha < <(gh api "repos/$repo/pulls/$pr" \
  --jq '"\(.state) \(.draft) \(.base.ref) \(.head.sha)"')

refuse() { echo "REFUSED: PR #$pr $1" >&2; exit 1; }

[ "$state" = "open" ] || refuse "is $state, not open."
[ "$draft" = "false" ] || refuse "is a draft; mark it ready for review first."
[ "$base" = "$default_branch" ] || refuse "targets $base, not $default_branch."

runs="$(gh api "repos/$repo/commits/$sha/check-runs?per_page=100" \
  --jq '.check_runs[] | "\(.name)\t\(.status)/\(.conclusion)"')"
printf '%s\n' "$runs" | grep -q '^test	' || refuse "has no CI job named 'test' on ${sha:0:7} yet."
while IFS=$'\t' read -r name result; do
  [ -n "$name" ] || continue
  case "$result" in
    completed/success|completed/skipped|completed/neutral) ;;
    *) refuse "check '$name' on ${sha:0:7} is $result, not success." ;;
  esac
done <<< "$runs"

echo "PR #$pr at ${sha:0:7}: every CI check passed."
if [ "$dry_run" = "--dry-run" ]; then
  echo "Dry run: would squash-merge #$pr pinned to $sha."
  exit 0
fi

gh api --method PUT "repos/$repo/pulls/$pr/merge" -f merge_method=squash -f sha="$sha" \
  --jq '"Merged #'"$pr"' as \(.sha)"'
