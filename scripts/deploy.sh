#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"
: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${DEPLOY_SSH_KEY:?Missing DEPLOY_SSH_KEY}"
: "${DEPLOY_KNOWN_HOSTS:?Missing DEPLOY_KNOWN_HOSTS}"
: "${GITHUB_SHA:?Missing commit ID}"
DEPLOY_PORT=${DEPLOY_PORT:-22}
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$DEPLOY_PORT" =~ ^[0-9]{1,5}$ ]]
(( DEPLOY_PORT > 0 && DEPLOY_PORT < 65536 ))
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
test -s dist/index.html

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
umask 077
printf '%s\n' "$DEPLOY_SSH_KEY" > "$work/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$work/known_hosts"
printf '{"commit":"%s"}\n' "$GITHUB_SHA" > dist/version.json
tar -czf "$work/site.tar.gz" -C dist .
options=(-i "$work/key" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$work/known_hosts" -o ConnectTimeout=15)
destination="$DEPLOY_USER@$DEPLOY_HOST"
ssh "${options[@]}" -p "$DEPLOY_PORT" "$destination" 'test -d /srv/sebas-fulbo && test -w /srv/sebas-fulbo && mkdir -p /srv/sebas-fulbo/incoming'
scp "${options[@]}" -P "$DEPLOY_PORT" "$work/site.tar.gz" "$destination:/srv/sebas-fulbo/incoming/$GITHUB_SHA.tar.gz"
ssh "${options[@]}" -p "$DEPLOY_PORT" "$destination" "bash -s -- $GITHUB_SHA" < scripts/activate-release.sh
