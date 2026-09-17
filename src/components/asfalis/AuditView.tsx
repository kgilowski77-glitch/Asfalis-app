import { ShieldCheck } from "lucide-react";
import { formatTimestamp, type AuditEvent } from "@/lib/asfalis-store";

export function AuditView({ events }: { events: AuditEvent[] }) {
  return (
    <div className="panel overflow-hidden rounded-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6 lg:p-7">
        <div>
          <h2 className="font-display text-base font-semibold">
            Audit &amp; Security Logs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable local record of every operation performed in this session.
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-sm border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary">
          <ShieldCheck className="size-3.5" /> 0 outbound requests
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <th className="px-5 py-3 font-normal">Timestamp</th>
              <th className="px-5 py-3 font-normal">Event Action</th>
              <th className="px-5 py-3 font-normal">Data Location</th>
              <th className="px-5 py-3 font-normal">Network Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/30"
              >
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted-foreground">
                  {formatTimestamp(e.timestamp)}
                </td>
                <td className="px-5 py-3">{e.action}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                  {e.location}
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
                    {e.network}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
