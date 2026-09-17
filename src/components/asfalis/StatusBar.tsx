import { Lock, ShieldCheck, WifiOff } from "lucide-react";

export function StatusBar() {
  return (
    <div className="sticky top-0 z-50 flex min-h-12 items-center gap-3 border-b border-border bg-status px-4 py-2 backdrop-blur-xl lg:px-7">
      <span className="flex size-6 items-center justify-center rounded-sm border border-border bg-secondary/50 text-muted-foreground">
        <Lock className="size-3.5" />
      </span>
      <p className="text-xs font-semibold text-foreground sm:text-[13px]">
        100% Local Mode <span className="mx-2 text-muted-foreground">—</span><span className="font-normal text-muted-foreground">Internet disconnected. All processing happens on this machine.</span>
      </p>
      <div className="ml-auto hidden items-center gap-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground md:flex">
        <span className="flex items-center gap-1.5">
          <WifiOff className="size-3.5" /> Air-gapped
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-primary" /> AES-256 Vault
        </span>
      </div>
    </div>
  );
}
