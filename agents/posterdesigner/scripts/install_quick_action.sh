#!/bin/bash
# 安装/卸载「出 zine 海报」访达右键快捷指令（macOS Quick Action）。
#
#   安装： bash install_quick_action.sh
#   卸载： bash install_quick_action.sh --uninstall
#
# 装好后：访达里选中图片 → 右键 → 快速操作 → 出 zine 海报。

set -euo pipefail

ACTION_NAME="出 zine 海报"
SERVICES_DIR="$HOME/Library/Services"
WF_DIR="$SERVICES_DIR/$ACTION_NAME.workflow"
AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$AGENT_DIR/scripts/poster_from_finder.sh"

if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "$WF_DIR"
  echo "已卸载：$WF_DIR"
  exit 0
fi

mkdir -p "$WF_DIR/Contents"

cat > "$WF_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSServices</key>
  <array>
    <dict>
      <key>NSMenuItem</key>
      <dict>
        <key>default</key>
        <string>出 zine 海报</string>
      </dict>
      <key>NSMessage</key>
      <string>runWorkflowAsService</string>
      <key>NSSendFileTypes</key>
      <array>
        <string>public.image</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
PLIST

# runner 路径注入 wflow（转义双引号安全）
RUNNER_ESC=$(printf '%s' "$RUNNER" | sed 's/&/\&amp;/g')

cat > "$WF_DIR/Contents/document.wflow" <<WFLOW
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>AMApplicationBuild</key><string>521</string>
  <key>AMApplicationVersion</key><string>2.10</string>
  <key>AMDocumentVersion</key><string>2</string>
  <key>actions</key>
  <array>
    <dict>
      <key>action</key>
      <dict>
        <key>AMAccepts</key>
        <dict>
          <key>Container</key><string>List</string>
          <key>Optional</key><false/>
          <key>Types</key><array><string>com.apple.applescript.object</string></array>
        </dict>
        <key>AMActionVersion</key><string>2.0.3</string>
        <key>AMProvides</key>
        <dict>
          <key>Container</key><string>List</string>
          <key>Types</key><array><string>com.apple.applescript.object</string></array>
        </dict>
        <key>ActionBundlePath</key>
        <string>/System/Library/Automator/Run Shell Script.action</string>
        <key>ActionName</key><string>Run Shell Script</string>
        <key>ActionParameters</key>
        <dict>
          <key>COMMAND_STRING</key>
          <string>f=/tmp/posterdesigner.paths
: &gt; "\$f"
for p in "\$@"; do printf '%s\n' "\$p" &gt;&gt; "\$f"; done
/usr/bin/osascript -e 'tell application "Terminal" to do script "$RUNNER_ESC --paths-file /tmp/posterdesigner.paths"' -e 'tell application "Terminal" to activate'</string>
          <key>CheckedForUserDefaultShell</key><true/>
          <key>inputMethod</key><integer>1</integer>
          <key>shell</key><string>/bin/bash</string>
          <key>source</key><string></string>
        </dict>
        <key>BundleIdentifier</key>
        <string>com.apple.RunShellScript</string>
        <key>Class Name</key><string>RunShellScriptAction</string>
        <key>InputUUID</key><string>POSTER-INPUT-UUID</string>
        <key>UUID</key><string>POSTER-ACTION-UUID</string>
        <key>CanShowSelectedItemsWhenRun</key><false/>
        <key>CanShowWhenRun</key><true/>
        <key>Keywords</key><array><string>Shell</string></array>
        <key>arguments</key><dict/>
        <key>isViewVisible</key><integer>1</integer>
      </dict>
      <key>isViewVisible</key><integer>1</integer>
    </dict>
  </array>
  <key>connectors</key><dict/>
  <key>workflowMetaData</key>
  <dict>
    <key>serviceInputTypeIdentifier</key>
    <string>com.apple.Automator.fileSystemObject.image</string>
    <key>serviceOutputTypeIdentifier</key>
    <string>com.apple.Automator.nothing</string>
    <key>serviceApplicationBundleID</key>
    <string>com.apple.finder</string>
    <key>applicationBundleIDsByPath</key><dict/>
    <key>applicationPaths</key><array/>
    <key>inputTypeIdentifier</key>
    <string>com.apple.Automator.fileSystemObject.image</string>
    <key>outputTypeIdentifier</key>
    <string>com.apple.Automator.nothing</string>
    <key>presentationMode</key><integer>15</integer>
    <key>processesInput</key><integer>0</integer>
    <key>serviceInputType</key><string>image</string>
    <key>useAutomaticInputType</key><integer>0</integer>
    <key>workflowTypeIdentifier</key>
    <string>com.apple.Automator.servicesMenu</string>
  </dict>
</dict>
</plist>
WFLOW

/usr/bin/plutil -lint "$WF_DIR/Contents/Info.plist" >/dev/null
/usr/bin/plutil -lint "$WF_DIR/Contents/document.wflow" >/dev/null

# 让「服务」菜单刷新
/System/Library/CoreServices/pbs -flush 2>/dev/null || true

echo "已安装：$WF_DIR"
echo "访达选中图片 → 右键 → 快速操作 → 「${ACTION_NAME}」"
