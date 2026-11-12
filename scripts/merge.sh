#!/usr/bin/env bash
# Merge gate for this repo (AGENTS.md, "Pull Requests and Merging"): squash-merge a
# pull request through the REST API, but only if every CI check run on its exact head
# commit succeeded (or was skipped), no commit status is failing or pending, and the
# required `test` job ran. Never use `gh pr merge`; it bypasses this check.
#
#   scripts/merge.sh <pr-number> [--dry-run]
set -euo pipefail

usage="usage: scripts/merge.sh <pr-number> [--dry-run]"
pr="${1:?$usage}"
dry_run=""
case "$#:${2:-}" in
  1:) ;;
  2:--dry-run) dry_run="--dry-run" ;;
  *) echo "$usage" >&2; exit 2 ;;
esac
case "$pr" in ''|*[!0-9]*) echo "$usage" >&2; exit 2 ;; esac
repo="${ETSY_CLIENT_REPO:-profplum700/etsy-v3-api-client}"
default_branch="master"

read -r state draft base sha < <(gh api "repos/$repo/pulls/$pr" \
  --jq '"\(.state) \(.draft) \(.base.ref) \(.head.sha)"')

refuse() { echo "REFUSED: PR #$pr $1" >&2; exit 1; }

[ "$state" = "open" ] || refuse "is $state, not open."
[ "$draft" = "false" ] || refuse "is a draft; mark it ready for review first."
[ "$base" = "$default_branch" ] || refuse "targets $base, not $default_branch."

# --paginate reads every page; if any request fails the script stops (set -e) and nothing merges.
runs="$(gh api --paginate "repos/$repo/commits/$sha/check-runs?per_page=100" \
  --jq '.check_runs[] | "\(.name)\t\(.status)/\(.conclusion)"')"
printf '%s\n' "$runs" | grep -q '^test	' || refuse "has no CI job named 'test' on ${sha:0:7} yet."
while IFS=$'\t' read -r name result; do
  [ -n "$name" ] || continue
  # CodeRabbit's own check is advisory and reports neutral; its review threads are answered by hand.
  [ "$name" != "CodeRabbit" ] || continue
  case "$result" in
    completed/success|completed/skipped) ;;
    *) refuse "check '$name' on ${sha:0:7} is $result, not success." ;;
  esac
done <<< "$runs"

# Commit statuses (for example the one spec-candidate.yml posts) are separate from check runs.
read -r status_state status_count < <(gh api "repos/$repo/commits/$sha/status" --jq '"\(.state) \(.total_count)"')
if [ "$status_count" != "0" ] && [ "$status_state" != "success" ]; then
  refuse "has commit status '$status_state' on ${sha:0:7}, not success."
fi

echo "PR #$pr at ${sha:0:7}: every CI check passed."
if [ "$dry_run" = "--dry-run" ]; then
  echo "Dry run: would squash-merge #$pr pinned to $sha."
  exit 0
fi

gh api --method PUT "repos/$repo/pulls/$pr/merge" -f merge_method=squash -f sha="$sha" \
  --jq '"Merged #'"$pr"' as \(.sha)"'
