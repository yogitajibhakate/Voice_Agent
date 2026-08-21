import { cn } from "@/lib/utils";

// Reusable AI A L Voice Builder logo. Theme-aware by default.
// Pass `mark` to render the square logo mark instead of the full wordmark.
// Pass `inverse` to force the white/cream logo on dark surfaces.
export function BrandLogo({
  className,
  inverse = false,
  mark = false,
}: {
  className?: string;
  inverse?: boolean;
  mark?: boolean;
}) {
  const markSrcDark = "/aal-mark-dark.png";
  const markSrcLight = "/aal-mark-light.png";

  if (mark) {
    return (
      <div className={cn("relative overflow-hidden shrink-0", className)} style={{ width: '28px', height: '28px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inverse ? markSrcLight : markSrcDark}
          alt="AI A L Logo"
          className={cn("h-full w-full object-contain", !inverse && "block dark:hidden")}
        />
        {!inverse && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={markSrcLight}
            alt="AI A L Logo"
            className="hidden dark:block h-full w-full object-contain"
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div className="relative overflow-hidden shrink-0" style={{ width: '28px', height: '28px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inverse ? markSrcLight : markSrcDark}
          alt="AI A L Logo"
          className={cn("h-full w-full object-contain", !inverse && "block dark:hidden")}
        />
        {!inverse && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={markSrcLight}
            alt="AI A L Logo"
            className="hidden dark:block h-full w-full object-contain"
          />
        )}
      </div>
      <div className="flex flex-col leading-none">
        <span className={cn("font-bold text-sm tracking-tight text-foreground", inverse && "text-white")}>AI A L</span>
        <span className={cn("text-[10px] text-muted-foreground font-medium tracking-wider uppercase", inverse && "text-white/60")}>Voice Builder</span>
      </div>
    </div>
  );
}
