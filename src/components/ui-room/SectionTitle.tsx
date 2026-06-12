import { cn } from "@/lib/utils";

export function SectionTitle({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between px-1", className)}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {children}
      </h2>
      {right}
    </div>
  );
}
