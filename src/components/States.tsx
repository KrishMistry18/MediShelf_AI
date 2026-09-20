import { AlertTriangle, Inbox, Loader2, PlugZap, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { ApiError, API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Grey placeholder bar used while real values are in flight. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[4px] bg-secondary", className)} aria-hidden />;
}

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid place-items-center gap-2 py-10 text-center", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin text-accent" />
      <p className="text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center px-4 py-10 text-center", className)}>
      <div className="max-w-sm">
        <span className="mx-auto mb-3 grid size-9 place-items-center rounded-[6px] bg-secondary text-muted-foreground [&_svg]:size-4">
          {icon ?? <Inbox />}
        </span>
        <p className="text-[13px] font-medium">{title}</p>
        {description && (
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

/**
 * Error panel that separates "the API is not running" from "the API rejected this request".
 * The first needs a terminal command, the second needs different inputs — showing one generic
 * message for both leaves the user with nothing to act on.
 */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const offline = error instanceof ApiError && error.isNetworkError;
  const message = error instanceof Error ? error.message : "Something went wrong.";

  return (
    <div
      className={cn(
        "rounded-[6px] border border-destructive/25 bg-destructive/5 p-4 text-left",
        className,
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0 text-destructive [&_svg]:size-4">
          {offline ? <PlugZap /> : <AlertTriangle />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">
            {offline ? "Inference API not reachable" : "Request failed"}
          </p>
          <p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">
            {message}
          </p>

          {offline && (
            <div className="mt-3 space-y-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                Start the backend
              </p>
              <pre className="overflow-x-auto rounded-[4px] border border-border bg-background p-2.5 font-mono text-[10px] leading-relaxed">
                {`pip install -r backend/requirements.txt\npython tools/serve_api.py`}
              </pre>
              <p className="text-[10px] text-muted-foreground">
                Expecting the API at <code className="font-mono">{API_BASE_URL}</code>. Override it
                with <code className="font-mono">VITE_API_BASE_URL</code>.
              </p>
            </div>
          )}

          {onRetry && (
            <Button
              variant="outline"
              className="mt-3 h-8 px-3 text-[12px]"
              icon={<RotateCcw className="size-3.5" />}
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
