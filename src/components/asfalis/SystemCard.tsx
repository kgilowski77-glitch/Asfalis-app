import { Cpu, Gauge, MemoryStick } from "lucide-react";

const stats = [
  { icon: Cpu, label: "Model Active", value: "Llama 3 (8B)" },
  { icon: MemoryStick, label: "VRAM Allocation", value: "4.2 GB" },
  { icon: Gauge, label: "Hardware Acceleration", value: "GPU Enabled" },
];

export function SystemCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="panel rounded-sm p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          System Status
        </p>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Online
        </span>
      </div>
      <ul className="space-y-2.5">
        {stats.map(({ icon: Icon, label, value }) => (
          <li key={label} className="flex items-center gap-2.5">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">
                {label}
              </p>
              <p className="truncate font-mono text-xs text-foreground">
                {value}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {!compact && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>VRAM LOAD</span>
            <span>52%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-[52%] rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
