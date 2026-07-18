#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

npm run verify:p2-six
npm run verify:vertical-slice
npm run verify:p3-m4
npm run test:ui-experience
npm run test:p3-visual
npm run test:p3-rpg
npm run test:smoke
npm run test:vertical-player
npm run test:player

REMOTE_URL="$(git remote get-url origin)"
TMP_DIR="$(mktemp -d)"
SITE_DIR="$TMP_DIR/site"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$SITE_DIR"
cp index.html manifest.webmanifest sw.js "$SITE_DIR/"
cp -R src data "$SITE_DIR/"
mkdir -p "$SITE_DIR/assets/game" "$SITE_DIR/assets/pwa"
cp assets/app-icon.svg "$SITE_DIR/assets/"
cp -R assets/game/qstyle "$SITE_DIR/assets/game/"
cp -R assets/pwa/. "$SITE_DIR/assets/pwa/"
touch "$SITE_DIR/.nojekyll"

git -C "$SITE_DIR" init
git -C "$SITE_DIR" checkout -b gh-pages
git -C "$SITE_DIR" config user.name "$(git config user.name || echo codex)"
git -C "$SITE_DIR" config user.email "$(git config user.email || echo codex@example.local)"
git -C "$SITE_DIR" remote add origin "$REMOTE_URL"
git -C "$SITE_DIR" add .
git -C "$SITE_DIR" commit -m "Deploy playable site"
git -C "$SITE_DIR" -c http.proxy="${GIT_HTTP_PROXY:-http://127.0.0.1:1082}" -c https.proxy="${GIT_HTTPS_PROXY:-http://127.0.0.1:1082}" push -f origin gh-pages
