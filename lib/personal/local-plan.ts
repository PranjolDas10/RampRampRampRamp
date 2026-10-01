// "Start my workday" on this Mac, run through Apple's Shortcuts app. The page only opens one
// link (shortcuts://run-shortcut), which Chrome allows per click; the shortcut, which the user
// creates once and can inspect in Shortcuts, opens the apps and starts the dev server.
export const LOCAL_WORKFLOW_ID = "start-workday";
export const SHORTCUT_NAME = "Start my workday";
export const SHORTCUT_RUN_URL = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;
export const SHORTCUT_CREATE_URL = "shortcuts://create-shortcut";
const DEEP_FOCUS = "spotify:playlist:37i9dQZF1DWZeKCadgRdKQ";

// Pasted into a "Run Shell Script" action. Shortcuts runs it with a minimal PATH, so add the
// usual Homebrew and /usr/local locations for npm.
export function shortcutScript(repoPath: string) {
  return `# ${SHORTCUT_NAME} · cl1ck (Platform team template)
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
REPO="${repoPath}"

open -a "Visual Studio Code" "$REPO"
open "${DEEP_FOCUS}"
osascript -e 'tell application "Spotify" to play track "${DEEP_FOCUS}"' 2>/dev/null

# Start the dev server only if it isn't already running, then wait for it.
if ! curl -s -o /dev/null --max-time 2 http://localhost:3000; then
  cd "$REPO" && nohup npm run dev > /tmp/cl1ck-dev.log 2>&1 &
  for i in {1..30}; do curl -s -o /dev/null --max-time 1 http://localhost:3000 && break; sleep 1; done
fi

open "http://localhost:3000/ledgerline"
open -g "rectangle://execute-action?name=left-half" 2>/dev/null
`;
}

export function openLink(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
