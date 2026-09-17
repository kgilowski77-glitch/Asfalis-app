import { useLocalState } from "@/lib/asfalis-store";
import { SystemCard } from "./SystemCard";

type Prefs = {
  autoRedact: boolean;
  strictOffline: boolean;
  verboseLogs: boolean;
  wipeOnExit: boolean;
};

const DEFAULTS: Prefs = {
  autoRedact: true,
  strictOffline: true,
  verboseLogs: false,
  wipeOnExit: false,
};

const TOGGLES: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: "autoRedact",
    label: "Auto-redact PII before summarisation",
    hint: "Names, emails, phone numbers and ID numbers are masked in memory.",
  },
  {
    key: "strictOffline",
    label: "Strict offline enforcement",
    hint: "Blocks every outbound socket at the application layer.",
  },
  {
    key: "verboseLogs",
    label: "Verbose audit logging",
    hint: "Records each inference step in the audit table.",
  },
  {
    key: "wipeOnExit",
    label: "Wipe workspace on exit",
    hint: "Clears parsed documents and chat history when the app closes.",
  },
];

export function SettingsView({ onEvent }: { onEvent: (a: string) => void }) {
  const [prefs, setPrefs] = useLocalState<Prefs>("asfalis.prefs", DEFAULTS);

  const toggle = (key: keyof Prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    onEvent(`Setting changed: ${key} → ${!prefs[key] ? "enabled" : "disabled"}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="panel rounded-sm p-6 lg:p-7">
        <h2 className="font-display text-base font-semibold">
          Privacy Controls
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These preferences are stored on this device only.
        </p>
        <ul className="mt-5 space-y-3">
          {TOGGLES.map((t) => (
            <li
              key={t.key}
              className="flex items-start justify-between gap-5 rounded-sm border border-border bg-surface-raised/70 p-5"
            >
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[t.key]}
                aria-label={t.label}
                onClick={() => toggle(t.key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  prefs[t.key] ? "bg-primary" : "bg-secondary"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-background transition-all ${
                    prefs[t.key] ? "left-[1.375rem]" : "left-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-5">
        <SystemCard />
        <div className="panel rounded-sm p-5">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
            Storage
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Documents, chat history and logs are persisted in this browser
            profile and never synced.
          </p>
          <button
            type="button"
            onClick={() => {
              ["asfalis.analysis", "asfalis.chat", "asfalis.chat.v2", "asfalis.chat.v3", "asfalis.chat.document.v2", "asfalis.logs"].forEach((k) =>
                window.localStorage.removeItem(k),
              );
              window.location.reload();
            }}
            className="mt-4 w-full rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/20"
          >
            Wipe local workspace
          </button>
        </div>
      </div>
    </div>
  );
}
