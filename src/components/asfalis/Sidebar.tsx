import { FileSearch, MessagesSquare, ScrollText, Settings2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemCard } from "./SystemCard";

export type ViewKey = "analyzer" | "chat" | "logs" | "settings";

const items: { key: ViewKey; label: string; icon: typeof FileSearch }[] = [
  { key: "analyzer", label: "Document Analyzer", icon: FileSearch },
  { key: "chat", label: "Private Workspace Chat", icon: MessagesSquare },
  { key: "logs", label: "Audit & Security Logs", icon: ScrollText },
  { key: "settings", label: "Settings", icon: Settings2 },
];

export function Sidebar({
  active,
  onSelect,
}: {
  active: ViewKey;
  onSelect: (key: ViewKey) => void;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-sidebar-border bg-sidebar p-5 md:sticky md:top-12 md:h-[calc(100vh-48px)] md:w-72 md:border-b-0 md:border-r lg:p-7">
      <div className="mb-10 flex items-center gap-3 border-b border-sidebar-border pb-7">
        <div className="flex size-10 items-center justify-center border border-primary/50 bg-primary/10 text-primary shadow-[inset_0_0_16px_color-mix(in_oklab,var(--primary)_14%,transparent)]">
          <Shield className="size-5" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold leading-none">
            Asfalis
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Secure Workspace
          </p>
        </div>
      </div>

      <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
      <nav className="flex flex-col gap-1">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <Button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={isActive ? "page" : undefined}
              variant="ghost"
              className={`group h-11 justify-start rounded-sm border px-3 text-left text-sm font-normal transition-all duration-150 ${
                isActive
                  ? "border-primary/35 bg-primary/12 text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--primary)]"
                  : "border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent/60 hover:text-foreground"
              }`}
            >
              <Icon
                className={`size-4 transition-colors ${isActive ? "text-primary" : ""}`}
              />
              <span className="truncate">{label}</span>
            </Button>
          );
        })}
      </nav>

      <div className="mt-6 md:mt-auto">
        <SystemCard compact />
      </div>
    </aside>
  );
}
