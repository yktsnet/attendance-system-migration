#!/usr/bin/env bash
# NixOS 初回セットアップ
# 実行場所: サーバー上で直接実行
set -euo pipefail

APP_DIR="${DEPLOY_PATH:-/home/${USER}/github-public/attendance-system-migration}"

echo "==> [1/2] Docker 確認"
if ! command -v docker &>/dev/null; then
  cat <<EOF

Docker が未インストール。/etc/nixos/configuration.nix に以下を追加:

  virtualisation.docker.enable = true;
  users.users.${USER}.extraGroups = [ "docker" ];

適用:
  sudo nixos-rebuild switch

再ログイン後、このスクリプトを再実行。

EOF
  exit 1
fi

echo "==> [2/2] ディレクトリ作成"
mkdir -p "$APP_DIR"

echo "==> done"
echo ""
echo "次: Mac 側で ./infrastructure/deploy.sh を実行"
