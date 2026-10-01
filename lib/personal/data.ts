// Personal demo: the "dock-in" morning routine cl1ck found on this MacBook Pro.
// Hardcoded from the shape of real signals (display, Wi-Fi, Spotify, shell hook, browser).

export const MACHINE = {
  model: "MacBook Pro",
  chip: "M5 Pro · 24 GB",
  os: "macOS 26.5",
  apps: ["Spotify", "Visual Studio Code", "Arc", "Rectangle", "MonitorControl", "Teleport Connect", "Slack", "Zoom"],
};

export const REPO = "~/Documents/GitHub/RampRampRampRamp";

export type SignalKind = "display" | "wifi" | "spotify" | "window" | "shell" | "auth" | "app" | "browser" | "slack" | "noise";

export type Signal = { at: number; kind: SignalKind; text: string; source: string; routine?: boolean };

export type Day = {
  label: string;
  date: string;
  start: string; // clock time the routine started
  ran: boolean;
  handSeconds: number;
  signals: Signal[];
  note?: string;
};

// Window shown on the timeline: 8:30–9:15am, so `at` is minutes after 8:30.
export const WINDOW_MINUTES = 45;

export const SIGNAL_LABEL: Record<SignalKind, string> = {
  display: "Display",
  wifi: "Wi-Fi",
  spotify: "Spotify",
  window: "Rectangle",
  shell: "Shell",
  auth: "Teleport",
  app: "VS Code",
  browser: "Arc",
  slack: "Slack",
  noise: "Other",
};

// The routine as done by hand, in order, with typical seconds of hands-on time.
export const ROUTINE: { kind: SignalKind; text: string; source: string; seconds: number; lockfileOnly?: boolean }[] = [
  { kind: "display", text: "External display attached (2 screens)", source: "display events", seconds: 0 },
  { kind: "wifi", text: "Wi-Fi: Home office", source: "network state", seconds: 0 },
  { kind: "spotify", text: "Spotify: Deep Focus playlist started", source: "Spotify Web API", seconds: 0 },
  { kind: "shell", text: `git -C ${REPO} pull --ff-only`, source: "shell hook", seconds: 9 },
  { kind: "auth", text: "tsh login --proxy=teleport.juniper.example", source: "shell hook", seconds: 35 },
  { kind: "shell", text: "tsh proxy db --tunnel staging-pg --port 5433", source: "shell hook", seconds: 14 },
  { kind: "shell", text: "pnpm install", source: "shell hook", seconds: 28, lockfileOnly: true },
  { kind: "shell", text: "pnpm dev", source: "shell hook", seconds: 12 },
  { kind: "app", text: `VS Code opened ${REPO}`, source: "app focus", seconds: 15 },
  { kind: "window", text: "Rectangle: VS Code left half, Arc right half", source: "app focus", seconds: 12 },
  { kind: "browser", text: "Arc: localhost:3000 · GitHub PRs · Notion standup", source: "browser extension", seconds: 18 },
  { kind: "slack", text: "Slack status: Heads down 🎧", source: "Slack app", seconds: 10 },
];

const HAND_BASE = ROUTINE.filter((r) => !r.lockfileOnly).reduce((s, r) => s + r.seconds, 0) + 18; // + context switching

type DaySpec = { label: string; date: string; startMin: number; lockfile: boolean; noise: [number, string][] };

const SPECS: DaySpec[] = [
  { label: "Fri", date: "Sep 18", startMin: 11, lockfile: false, noise: [[31, "Zoom: Platform standup"]] },
  { label: "Mon", date: "Sep 21", startMin: 6, lockfile: true, noise: [[2, "Mail opened"], [31, "Zoom: Platform standup"]] },
  { label: "Tue", date: "Sep 22", startMin: 14, lockfile: false, noise: [[31, "Zoom: Platform standup"]] },
  { label: "Wed", date: "Sep 23", startMin: -1, lockfile: false, noise: [[9, "Notion opened"], [31, "Zoom: Platform standup"]] },
  { label: "Thu", date: "Sep 24", startMin: 9, lockfile: true, noise: [[31, "Zoom: Platform standup"]] },
  { label: "Fri", date: "Sep 25", startMin: 17, lockfile: false, noise: [[4, "Mail opened"], [31, "Zoom: Platform standup"]] },
  { label: "Mon", date: "Sep 28", startMin: 7, lockfile: true, noise: [[31, "Zoom: Platform standup"]] },
  { label: "Tue", date: "Sep 29", startMin: 12, lockfile: false, noise: [[31, "Zoom: Platform standup"]] },
  { label: "Wed", date: "Sep 30", startMin: 10, lockfile: true, noise: [[1, "Mail opened"], [31, "Zoom: Platform standup"]] },
  { label: "Thu", date: "Oct 1", startMin: 11, lockfile: false, noise: [[31, "Zoom: Platform standup"]] },
];

function clock(min: number) {
  const total = 8 * 60 + 30 + Math.round(min);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export const DAYS: Day[] = SPECS.map((s, i) => {
  const noise: Signal[] = s.noise.map(([at, text]) => ({ at, kind: "noise", text, source: "app focus" }));
  if (s.startMin < 0) {
    // Café day: no external display, so the routine never started. This is how cl1ck
    // learned the display is part of the trigger, not just the time of day.
    return {
      label: s.label,
      date: s.date,
      start: "—",
      ran: false,
      handSeconds: 0,
      note: "Café Wi-Fi, no external display. Routine didn't happen, so docking is part of the trigger.",
      signals: [
        { at: 5, kind: "wifi", text: "Wi-Fi: Café", source: "network state" },
        { at: 6, kind: "spotify", text: "Spotify: Deep Focus playlist started", source: "Spotify Web API" },
        { at: 14, kind: "app", text: "VS Code opened (no tunnel, no dev server)", source: "app focus" },
        ...noise,
      ],
    };
  }
  let t = s.startMin;
  const jitter = [0, 0.4, 0.3, 1.2, 0.5, 0.6, 0.4, 0.5, 0.4, 0.3, 0.6, 0.5];
  const steps = ROUTINE.filter((r) => s.lockfile || !r.lockfileOnly).map((r, j) => {
    t += jitter[j % jitter.length] + (i % 3) * 0.1;
    return { at: t, kind: r.kind, text: r.text, source: r.source, routine: true };
  });
  return {
    label: s.label,
    date: s.date,
    start: clock(s.startMin),
    ran: true,
    handSeconds: HAND_BASE + (s.lockfile ? 28 : 0) + ((i * 7) % 11) - 5,
    signals: [...steps, ...noise].sort((a, b) => a.at - b.at),
  };
});

export const RAN_DAYS = DAYS.filter((d) => d.ran).length; // 9
export const MEDIAN_HAND_SECONDS = 161; // 2m 41s
export const WORKDAYS_PER_YEAR = 230;

export const TRIGGER = [
  { label: "External display attached", evidence: "9/9 routine days · 0/1 on the café day" },
  { label: "Wi-Fi is Home office", evidence: "9/9" },
  { label: "Deep Focus starts on Spotify", evidence: "9/9, within 3 min of docking" },
  { label: "Weekday, 7–11am", evidence: "9/9" },
];

export const STEPS = [
  { text: "Pull the repo you touched last", evidence: "9/9", wait: false },
  { text: "Teleport login (you approve SSO once)", evidence: "9/9", wait: true },
  { text: "Open the staging DB tunnel, wait for port 5433", evidence: "9/9", wait: true },
  { text: "pnpm install, only if pnpm-lock.yaml changed", evidence: "4/9 · always after a lockfile change", wait: false },
  { text: "pnpm dev, wait until localhost:3000 answers", evidence: "9/9", wait: true },
  { text: "VS Code on the left, Arc on the right", evidence: "9/9", wait: false },
  { text: "Arc tabs: localhost:3000, GitHub PRs, Notion standup", evidence: "9/9", wait: false },
  { text: "Slack status: Heads down 🎧", evidence: "8/9", wait: false },
];

export const OPEN_AT_LOGIN = [
  { aspect: "When it fires", login: "Once, at login", us: "When you dock + start Deep Focus, any time 7–11am" },
  { aspect: "Order & waiting", login: "Launches everything at once", us: "Waits for SSO, the tunnel and the dev server" },
  { aspect: "Context", login: "Same apps every time", us: "Last-touched repo, installs only on lockfile change" },
  { aspect: "Commands", login: "Apps only", us: "Shell commands, window layout, Slack status" },
];
