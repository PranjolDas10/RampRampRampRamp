// Platform team library: workflows engineers saved from their own routines, shared inside
// the org. Each person fills the same template with their own values (template stripping).

export type PersonId = "you" | "maya" | "leo" | "ana";

export type Values = {
  repo: string; // relative to $HOME
  folders: string[]; // extra folders, relative to $HOME
  devCommand: string[];
  port: number;
  tabs: string[];
  playlist: string; // empty = no music step
  startTime: [number, number]; // usual start, used by the simple launchd trigger
};

export type Person = { id: PersonId; name: string; initials: string; values: Values };

export const PEOPLE: Person[] = [
  {
    id: "you",
    name: "You",
    initials: "YOU",
    values: {
      repo: "Documents/GitHub/cl1ck",
      folders: ["Documents/GitHub/cl1ck/docs"],
      devCommand: ["npm", "run", "dev"],
      port: 3000,
      tabs: ["https://github.com/pulls", "https://www.notion.so"],
      playlist: "Deep Focus",
      startTime: [8, 40],
    },
  },
  {
    id: "maya",
    name: "Maya K.",
    initials: "MK",
    values: {
      repo: "code/ledgerline-api",
      folders: ["code/ledgerline-api/docs", "code/infra-notes"],
      devCommand: ["pnpm", "dev"],
      port: 4000,
      tabs: ["https://github.com/pulls", "https://linear.app"],
      playlist: "Lo-fi Beats",
      startTime: [8, 15],
    },
  },
  {
    id: "leo",
    name: "Leo R.",
    initials: "LR",
    values: {
      repo: "src/ledgerline-web",
      folders: ["src/design-tokens"],
      devCommand: ["npm", "run", "dev"],
      port: 5173,
      tabs: ["https://github.com/pulls", "https://www.figma.com"],
      playlist: "",
      startTime: [9, 0],
    },
  },
  {
    id: "ana",
    name: "Ana L.",
    initials: "AL",
    values: {
      repo: "work/payments-svc",
      folders: [],
      devCommand: ["pnpm", "dev"],
      port: 8080,
      tabs: ["https://github.com/pulls", "https://linear.app", "https://www.notion.so"],
      playlist: "Deep Focus",
      startTime: [8, 30],
    },
  },
];

export const personById = (id: PersonId) => PEOPLE.find((p) => p.id === id)!;

export type SimKind = "trigger" | "code" | "terminal" | "browser" | "music" | "note";

export type Workflow = {
  id: string;
  name: string;
  file: string;
  winFile: string;
  author: PersonId;
  version: string;
  updated: string;
  baseInstalls: number; // installs before the demo, besides the people in the switcher
  trigger: string;
  savesSeconds: number;
  steps: { text: string; wait?: boolean }[];
  placeholders: { key: string; label: string; value: (v: Values) => string }[];
  script: (p: Person, author: Person) => string;
  winScript: (p: Person, author: Person) => string;
  sim: (p: Person) => { kind: SimKind; label: string; detail: string; at: number }[];
};

const q = (s: string) => `"${s.replace(/(["\\$`])/g, "\\$1")}"`;
const home = (rel: string) => `"$HOME/${rel.replace(/(["\\$`])/g, "\\$1")}"`;
const clock = ([h, m]: [number, number]) => `${h}:${String(m).padStart(2, "0")}`;

// cmd.exe: % must be doubled; " inside a quoted string becomes "".
const wQ = (s: string) => `"${s.replace(/%/g, "%%").replace(/"/g, '""')}"`;
const wHome = (rel: string) => `%USERPROFILE%\\${rel.replace(/\//g, "\\")}`;
const wEsc = (s: string) => s.replace(/%/g, "%%").replace(/([&^|<>"])/g, "^$1");
function header(w: { name: string; version: string; file: string }, p: Person, author: Person, what: string[]) {
  const filledFor = p.id === "you" ? "you" : p.name;
  const by = author.id === "you" ? "you" : author.name;
  return [
    "#!/bin/zsh",
    "# ─────────────────────────────────────────────────────────────────────",
    `# ${w.name} · v${w.version} · Platform team library, Juniper Coffee Roasters`,
    `# Author: ${by} · Filled in for: ${filledFor}`,
    "# Made by cl1ck from the author's own routine, then shared with the team.",
    "#",
    "# What it does, in order:",
    ...what.map((line, i) => `#   ${i + 1}. ${line}`),
    "#",
    "# Safe by design: no sudo, no deletes, no installs. It only opens apps,",
    "# folders and URLs, and starts your dev server.",
    "#",
    `# Run it:  zsh ~/Downloads/${w.file}`,
    "# ─────────────────────────────────────────────────────────────────────",
    "set -u",
    "",
  ];
}

const NOTE = `note() { osascript -e "display notification \\"$1\\" with title \\"cl1ck\\""; }`;

const startWorkdayScript = (w: Pick<Workflow, "name" | "version" | "file">) => (p: Person, author: Person) => {
  const v = p.values;
  const url = `http://localhost:${v.port}`;
  return [
    ...header(w, p, author, [
      "Opens your repo and extra folders in VS Code",
      "Starts your dev server and waits until it answers",
      "Opens your browser tabs (only after the server is up)",
      v.playlist ? "Starts your focus music in Spotify" : "Skips music (none set)",
    ]),
    "# ── Your values (cl1ck filled these in; edit freely) ──",
    `REPO=${home(v.repo)}                       # {{repo_path}}`,
    `EXTRA_FOLDERS=(${v.folders.map(home).join(" ")})   # {{extra_folders}}`,
    `DEV_COMMAND=(${v.devCommand.map(q).join(" ")})     # {{dev_command}}`,
    `DEV_URL=${q(url)}                 # {{dev_port}}`,
    `TABS=(${[url, ...v.tabs].map(q).join(" ")})   # {{browser_tabs}}`,
    `PLAYLIST=${q(v.playlist)}                    # {{focus_playlist}}`,
    "",
    NOTE,
    "",
    'if [[ ! -d "$REPO" ]]; then',
    '  note "Repo not found: $REPO. Edit REPO at the top of this file."',
    "  exit 1",
    "fi",
    "",
    "# 1. Editor: your repo, plus any extra folders that exist",
    'open -a "Visual Studio Code" "$REPO"',
    'for folder in "${EXTRA_FOLDERS[@]}"; do',
    '  [[ -d "$folder" ]] && open -a "Visual Studio Code" "$folder"',
    "done",
    "",
    "# 2. Dev server in the background, then wait up to 60s until it answers",
    '( cd "$REPO" && "${DEV_COMMAND[@]}" > /tmp/cl1ck-dev.log 2>&1 & )',
    "for i in {1..60}; do",
    '  curl -sf "$DEV_URL" > /dev/null 2>&1 && break',
    "  sleep 1",
    "done",
    "",
    "# 3. Browser tabs, only once the server is up",
    'open "${TABS[@]}"',
    "",
    "# 4. Focus music (skipped if no playlist is set)",
    'if [[ -n "$PLAYLIST" ]]; then',
    '  open "spotify:search:${PLAYLIST// /%20}" 2>/dev/null || true',
    "fi",
    "",
    'note "Workspace ready in ${SECONDS}s"',
    "",
  ].join("\n");
};

const prReviewScript = (w: Pick<Workflow, "name" | "version" | "file">) => (p: Person, author: Person) => {
  const v = p.values;
  return [
    ...header(w, p, author, [
      "Opens your GitHub review queue",
      "Opens your repo in VS Code",
      "Starts the test watcher in Terminal so results are ready when you are",
      "Opens your ticket tracker next to the PR",
    ]),
    "# ── Your values ──",
    `REPO=${home(v.repo)}   # {{repo_path}}`,
    `TRACKER=${q(v.tabs.find((t) => /linear|notion|figma/.test(t)) ?? "https://linear.app")}   # {{tracker_url}}`,
    "",
    NOTE,
    "",
    'open "https://github.com/pulls/review-requested"',
    'open -a "Visual Studio Code" "$REPO"',
    `osascript -e "tell application \\"Terminal\\" to do script \\"cd '$REPO' && ${v.devCommand[0]} test --watch\\""`,
    'open "$TRACKER"',
    'note "Review setup ready"',
    "",
  ].join("\n");
};

const debugStagingScript = (w: Pick<Workflow, "name" | "version" | "file">) => (p: Person, author: Person) => {
  const v = p.values;
  return [
    ...header(w, p, author, [
      "Opens the staging dashboard and logs",
      "Opens your repo in VS Code",
      "Starts your dev server pointed at staging",
    ]),
    "# ── Your values ──",
    `REPO=${home(v.repo)}   # {{repo_path}}`,
    `DEV_COMMAND=(${v.devCommand.map(q).join(" ")})   # {{dev_command}}`,
    "",
    NOTE,
    "",
    'open "https://staging.juniper.example/status" "https://staging.juniper.example/logs"',
    'open -a "Visual Studio Code" "$REPO"',
    '( cd "$REPO" && APP_ENV=staging "${DEV_COMMAND[@]}" > /tmp/cl1ck-staging.log 2>&1 & )',
    'note "Staging debug setup ready"',
    "",
  ].join("\n");
};

function winHeader(w: { name: string; version: string; winFile: string }, p: Person, author: Person, what: string[]) {
  const filledFor = p.id === "you" ? "you" : p.name;
  const by = author.id === "you" ? "you" : author.name;
  return [
    "@echo off",
    "setlocal EnableExtensions",
    "REM ─────────────────────────────────────────────────────────────────────",
    `REM ${w.name} · v${w.version} · Platform team library, Juniper Coffee Roasters`,
    `REM Author: ${by} · Filled in for: ${filledFor}`,
    "REM Made by cl1ck from the author's own routine, then shared with the team.",
    "REM",
    "REM What it does, in order:",
    ...what.map((line, i) => `REM   ${i + 1}. ${line}`),
    "REM",
    "REM Safe by design: no admin, no deletes, no installs. It only opens apps,",
    "REM folders and URLs, and starts your dev server.",
    "REM",
    `REM Run it: double-click ${w.winFile}, or:  ${w.winFile}`,
    "REM ─────────────────────────────────────────────────────────────────────",
    "",
  ];
}

const startWorkdayWin = (w: Pick<Workflow, "name" | "version" | "winFile">) => (p: Person, author: Person) => {
  const v = p.values;
  const url = `http://localhost:${v.port}`;
  const folders = v.folders.map((f) => wHome(f));
  return [
    ...winHeader(w, p, author, [
      "Opens your repo and extra folders in VS Code",
      "Starts your dev server and waits until it answers",
      "Opens your browser tabs (only after the server is up)",
      v.playlist ? "Starts your focus music in Spotify" : "Skips music (none set)",
    ]),
    "REM ── Your values (cl1ck filled these in; edit freely) ──",
    `set "REPO=${wHome(v.repo)}"`,
    `set "DEV_URL=${url}"`,
    `set "PLAYLIST=${wEsc(v.playlist)}"`,
    `set "DEV_CMD=${wEsc(v.devCommand.join(" "))}"`,
    "",
    'if not exist "%REPO%" (',
    '  echo Repo not found: %REPO%. Edit REPO at the top of this file.',
    "  pause",
    "  exit /b 1",
    ")",
    "",
    "REM 1. Editor",
    'start "" code "%REPO%"',
    ...folders.flatMap((f) => [`if exist "${f}" start "" code "${f}"`]),
    "",
    "REM 2. Dev server in a minimized window",
    'start "cl1ck-dev" /min cmd /c "cd /d "%REPO%" && %DEV_CMD% > %TEMP%\\cl1ck-dev.log 2>&1"',
    "",
    "REM 3. Wait up to 60s for localhost",
    "set /a tries=0",
    ":waitloop",
    "set /a tries+=1",
    'curl -s -o nul --max-time 1 "%DEV_URL%" >nul 2>&1 && goto :ready',
    "if %tries% geq 60 goto :ready",
    "timeout /t 1 /nobreak >nul",
    "goto :waitloop",
    ":ready",
    "",
    "REM 4. Browser tabs",
    `start "" ${wQ(url)}`,
    ...v.tabs.map((t) => `start "" ${wQ(t)}`),
    "",
    "REM 5. Focus music",
    v.playlist
      ? `start "" "spotify:search:${encodeURIComponent(v.playlist).replace(/%/g, "%%")}"`
      : "REM (no playlist set)",
    "",
    "echo Workspace ready.",
    "",
  ].join("\r\n");
};

const prReviewWin = (w: Pick<Workflow, "name" | "version" | "winFile">) => (p: Person, author: Person) => {
  const v = p.values;
  const tracker = v.tabs.find((t) => /linear|notion|figma/.test(t)) ?? "https://linear.app";
  return [
    ...winHeader(w, p, author, [
      "Opens your GitHub review queue",
      "Opens your repo in VS Code",
      "Starts the test watcher in a new window",
      "Opens your ticket tracker next to the PR",
    ]),
    `set "REPO=${wHome(v.repo)}"`,
    `set "TRACKER=${wEsc(tracker)}"`,
    `set "PKG=${wEsc(v.devCommand[0])}"`,
    "",
    'start "" "https://github.com/pulls/review-requested"',
    'start "" code "%REPO%"',
    'start "cl1ck-tests" cmd /k "cd /d "%REPO%" && %PKG% test --watch"',
    'start "" "%TRACKER%"',
    "echo Review setup ready.",
    "",
  ].join("\r\n");
};

const debugStagingWin = (w: Pick<Workflow, "name" | "version" | "winFile">) => (p: Person, author: Person) => {
  const v = p.values;
  return [
    ...winHeader(w, p, author, [
      "Opens the staging dashboard and logs",
      "Opens your repo in VS Code",
      "Starts your dev server pointed at staging",
    ]),
    `set "REPO=${wHome(v.repo)}"`,
    `set "DEV_CMD=${wEsc(v.devCommand.join(" "))}"`,
    "",
    'start "" "https://staging.juniper.example/status"',
    'start "" "https://staging.juniper.example/logs"',
    'start "" code "%REPO%"',
    'start "cl1ck-staging" /min cmd /c "cd /d "%REPO%" && set APP_ENV=staging&& %DEV_CMD% > %TEMP%\\cl1ck-staging.log 2>&1"',
    "echo Staging debug setup ready.",
    "",
  ].join("\r\n");
};

const W1 = { name: "Start my workday", version: "1.2", file: "start-workday.command", winFile: "start-workday.cmd" };
const W2 = { name: "PR review kickoff", version: "2.0", file: "pr-review-kickoff.command", winFile: "pr-review-kickoff.cmd" };
const W3 = { name: "Debug staging", version: "1.0", file: "debug-staging.command", winFile: "debug-staging.cmd" };

export const LIBRARY: Workflow[] = [
  {
    id: "start-workday",
    ...W1,
    author: "you",
    updated: "today",
    baseInstalls: 0,
    trigger: "Docked to a display and focus music starts, weekdays 7–11am",
    savesSeconds: 160,
    steps: [
      { text: "Open the repo and extra folders in VS Code" },
      { text: "Start the dev server" },
      { text: "Wait until localhost answers", wait: true },
      { text: "Open browser tabs" },
      { text: "Start the focus playlist" },
    ],
    placeholders: [
      { key: "{{repo_path}}", label: "Repo", value: (v) => `~/${v.repo}` },
      { key: "{{extra_folders}}", label: "Extra folders", value: (v) => (v.folders.length ? v.folders.map((f) => `~/${f}`).join(", ") : "(none)") },
      { key: "{{dev_command}}", label: "Dev command", value: (v) => v.devCommand.join(" ") },
      { key: "{{dev_port}}", label: "Dev URL", value: (v) => `localhost:${v.port}` },
      { key: "{{browser_tabs}}", label: "Tabs", value: (v) => v.tabs.map((t) => t.replace("https://", "").replace("www.", "")).join(", ") },
      { key: "{{focus_playlist}}", label: "Playlist", value: (v) => v.playlist || "(none)" },
    ],
    script: startWorkdayScript(W1),
    winScript: startWorkdayWin(W1),
    sim: (p) => {
      const v = p.values;
      return [
        { kind: "trigger", label: "Docked + focus music", detail: v.playlist ? `2 screens · ${v.playlist}` : `2 screens · ${clock(v.startTime)}`, at: 0 },
        { kind: "code", label: "VS Code", detail: `~/${v.repo}`, at: 1.4 },
        { kind: "terminal", label: v.devCommand.join(" "), detail: "starting…", at: 2.2 },
        { kind: "terminal", label: `localhost:${v.port}`, detail: "ready ✓", at: 6.8 },
        { kind: "browser", label: "Browser tabs", detail: `${v.tabs.length + 1} tabs`, at: 8.0 },
        ...(v.playlist ? [{ kind: "music" as const, label: "Spotify", detail: v.playlist, at: 8.9 }] : []),
        { kind: "note", label: "Workspace ready", detail: "9s · saved 2m 40s", at: 9.6 },
      ];
    },
  },
  {
    id: "pr-review",
    ...W2,
    author: "maya",
    updated: "3 days ago",
    baseInstalls: 2,
    trigger: "A review is requested from you on GitHub",
    savesSeconds: 95,
    steps: [
      { text: "Open your review queue" },
      { text: "Open the repo in VS Code" },
      { text: "Start the test watcher" },
      { text: "Open the ticket tracker" },
    ],
    placeholders: [
      { key: "{{repo_path}}", label: "Repo", value: (v) => `~/${v.repo}` },
      { key: "{{tracker_url}}", label: "Tracker", value: (v) => (v.tabs.find((t) => /linear|notion|figma/.test(t)) ?? "linear.app").replace("https://", "") },
    ],
    script: prReviewScript(W2),
    winScript: prReviewWin(W2),
    sim: (p) => [
      { kind: "trigger", label: "Review requested", detail: "PR #412 · ledgerline-api", at: 0 },
      { kind: "browser", label: "GitHub", detail: "review queue", at: 1.2 },
      { kind: "code", label: "VS Code", detail: `~/${p.values.repo}`, at: 2.4 },
      { kind: "terminal", label: `${p.values.devCommand[0]} test --watch`, detail: "48 passing", at: 5.5 },
      { kind: "note", label: "Review setup ready", detail: "6s · saved 1m 35s", at: 6.2 },
    ],
  },
  {
    id: "debug-staging",
    ...W3,
    author: "leo",
    updated: "last week",
    baseInstalls: 1,
    trigger: "Someone mentions your service in #incidents",
    savesSeconds: 120,
    steps: [
      { text: "Open the staging dashboard and logs" },
      { text: "Open the repo in VS Code" },
      { text: "Start the dev server against staging" },
    ],
    placeholders: [
      { key: "{{repo_path}}", label: "Repo", value: (v) => `~/${v.repo}` },
      { key: "{{dev_command}}", label: "Dev command", value: (v) => v.devCommand.join(" ") },
    ],
    script: debugStagingScript(W3),
    winScript: debugStagingWin(W3),
    sim: (p) => [
      { kind: "trigger", label: "#incidents mention", detail: "payments latency", at: 0 },
      { kind: "browser", label: "Staging status + logs", detail: "2 tabs", at: 1.1 },
      { kind: "code", label: "VS Code", detail: `~/${p.values.repo}`, at: 2.3 },
      { kind: "terminal", label: `APP_ENV=staging ${p.values.devCommand.join(" ")}`, detail: "running", at: 4.6 },
      { kind: "note", label: "Debug setup ready", detail: "5s · saved 2m", at: 5.2 },
    ],
  },
];

export const workflowById = (id: string) => LIBRARY.find((w) => w.id === id)!;

// Simple, real trigger: launchd runs the script on weekdays at the person's usual start.
// The cl1ck agent adds the dock + playlist conditions on top.
export function launchdPlist(w: Workflow, p: Person) {
  const [h, m] = p.values.startTime;
  const days = [1, 2, 3, 4, 5]
    .map((d) => `    <dict><key>Weekday</key><integer>${d}</integer><key>Hour</key><integer>${h}</integer><key>Minute</key><integer>${m}</integer></dict>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- ${w.name}: runs ~/.cl1ck/${w.file} on weekdays at ${clock(p.values.startTime)}.
     Install: cp this file to ~/Library/LaunchAgents/ then
              launchctl load ~/Library/LaunchAgents/com.cl1ck.${w.id}.plist -->
<plist version="1.0">
<dict>
  <key>Label</key><string>com.cl1ck.${w.id}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>"$HOME/.cl1ck/${w.file}"</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
${days}
  </array>
</dict>
</plist>
`;
}

export function downloadText(filename: string, body: string, type = "text/plain") {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Persisted state keys (lib/store.ts prefixes them and syncs across tabs)
export const PKEYS = { installs: "personal-installs", runs: "personal-runs", shares: "personal-shares" } as const;
export const NO_INSTALLS: Record<string, PersonId[]> = { "pr-review": ["you"] };
export const NO_PRUNS: Record<string, number> = {};
export const NO_PSHARES: Record<string, string[]> = {};
