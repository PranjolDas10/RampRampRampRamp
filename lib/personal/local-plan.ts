// "Start my workday" on this Mac, run through Apple's Shortcuts app. The page only opens one
// link (shortcuts://run-shortcut), which Chrome allows per click; the shortcut, which the user
// creates once and can inspect in Shortcuts, opens the apps and starts the dev server.
export const LOCAL_WORKFLOW_ID = "start-workday";
export const SHORTCUT_NAME = "Start my workday";
export const SHORTCUT_RUN_URL = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;
export const SHORTCUT_CREATE_URL = "shortcuts://create-shortcut";
const DEEP_FOCUS = "spotify:playlist:37i9dQZF1DWZeKCadgRdKQ";

// Pasted into a "Run AppleScript" action. (Shortcuts' "Run Shell Script" runs in a context that
// can't launch or control apps, so app control happens in AppleScript; the shell is only used for
// the headless dev-server check.)
export function shortcutScript(repoPath: string) {
  return `-- ${SHORTCUT_NAME} · cl1ck (Platform team template)
set repo to "${repoPath}"

-- VS Code on this repo
tell application "Visual Studio Code"
	activate
	open (POSIX file repo)
end tell

-- Spotify: start Deep Focus
tell application "Spotify"
	activate
	delay 2
	play track "${DEEP_FOCUS}"
end tell

-- Dev server: start it only if it isn't already up
try
	do shell script "curl -s -o /dev/null --max-time 2 http://localhost:3000"
on error
	do shell script "cd " & quoted form of repo & " && export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH && nohup npm run dev > /tmp/cl1ck-dev.log 2>&1 &"
	delay 8
end try

-- Tabs and window layout
open location "http://localhost:3000/ledgerline"
try
	open location "rectangle://execute-action?name=left-half"
end try
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
