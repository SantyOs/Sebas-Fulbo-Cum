#!/usr/bin/env bash
# Runs on the Linux server as the unprivileged deployment user.
set -euo pipefail
commit=${1:?Missing commit ID}
[[ "$commit" =~ ^[a-f0-9]{40}$ ]]
root=${DEPLOY_ROOT:?Missing server deployment directory}
[[ "$root" == /* && "$root" != / ]]
archive="$root/incoming/$commit.tar.gz"
test -s "$archive"
mkdir -p "$root/releases"
# A unique directory also makes re-running the same commit safe.
release=$(mktemp -d "$root/releases/$commit.XXXXXX")
tar -xzf "$archive" -C "$release" --no-same-owner
test -s "$release/index.html"
test -s "$release/assets/players/footballer.glb"
test -s "$release/assets/players/locomotion.glb"
test -s "$release/version.json"
chmod -R u=rwX,go=rX "$release"
previous=$(readlink "$root/current" || true)
if [[ -n "$previous" ]]; then
  ln -sfn "$previous" "$root/previous.next"
  mv -Tf "$root/previous.next" "$root/previous"
fi
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
if [[ -n "${HEALTHCHECK_URL:-}" ]]; then
  healthy=false
  for attempt in 1 2 3 4 5; do
    if curl --fail --silent --max-time 5 "$HEALTHCHECK_URL" | grep -Fq "\"commit\":\"$commit\""; then
      healthy=true
      break
    fi
    sleep 2
  done
  if [[ "$healthy" != true ]]; then
    if [[ -n "$previous" ]]; then
      ln -sfn "$previous" "$root/current.rollback"
      mv -Tf "$root/current.rollback" "$root/current"
    fi
    echo 'Release HTTP verification failed; restored previous version when available.' >&2
    exit 1
  fi
fi
rm -- "$archive"
printf 'Activated %s\n' "$commit"
