import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Camera,
  Compass,
  ExternalLink,
  Layers,
  Menu,
  ScanLine,
  Search,
  ShieldCheck,
  Thermometer,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAssessmentHistory, isFlagged } from "@/lib/activity";
import { formatPercent } from "@/lib/api";
import { useCatalogCount, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

const workspaceNav = [
  { to: "/app", label: "Overview", icon: Boxes, description: "Operational summary & quick tools" },
  {
    to: "/scan",
    label: "Scan Medicine",
    icon: ScanLine,
    description: "Packaging CV & label extraction",
  },
  {
    to: "/medicines",
    label: "Medicine Library",
    icon: BookOpen,
    description: "27,326 authentic monographs",
  },
  {
    to: "/assessment",
    label: "Storage Assessment",
    icon: Thermometer,
    description: "Excursion risk & compliance",
  },
  {
    to: "/alerts",
    label: "Storage Alerts",
    icon: AlertTriangle,
    description: "Flagged stability excursions",
  },
  {
    to: "/models",
    label: "Model Insights",
    icon: BarChart3,
    description: "Evaluation artifacts & metrics",
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  const catalogCount = useCatalogCount();
  const models = useModelsOverview();
  const assessments = useAssessmentHistory();

  const openAlerts = assessments.filter(isFlagged).length;
  const riskAccuracy = models.data?.storage_risk.test_metrics.accuracy ?? null;
  const visionTop1 = models.data?.vision.test_metrics.top1_accuracy ?? null;

  // Keyboard accessibility: dismiss mobile navigation with Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-xs focus:text-primary-foreground focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* Product Top Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md md:px-6">
        <div className="flex items-center gap-3 md:gap-6">
          <button
            aria-label="Toggle workspace navigation"
            aria-expanded={mobileOpen}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>

          <Link to="/app" className="flex items-center gap-2.5 group">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-head font-bold text-xs shadow-sm transition-transform group-hover:scale-105">
              MS
            </div>
            <div className="flex flex-col">
              <span className="font-head text-base font-bold tracking-tight text-foreground leading-none">
                MediShelf AI
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                Workspace
              </span>
            </div>
          </Link>
        </div>

        {/* Global Workspace Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/medicines"
            className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Search className="size-3.5 text-muted-foreground" />
            <span className="truncate max-w-[140px] lg:max-w-[200px]">Search 27k medicines...</span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Return to Public Homepage"
          >
            <Compass className="size-3.5" />
            <span className="hidden md:inline">Public Website</span>
          </Link>

          <Link
            to="/scan"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
          >
            <Camera className="size-3.5" />
            <span>Scan Package</span>
          </Link>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 flex min-h-[calc(100vh-3.5rem)]">
        {/* Mobile Navigation Drawer Overlay */}
        {mobileOpen && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-xs md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Desktop Sidebar & Mobile Drawer */}
        <aside
          className={cn(
            "fixed bottom-0 left-0 top-14 z-50 flex w-64 flex-col justify-between border-r border-border bg-card transition-transform duration-200 md:static md:w-60 md:translate-x-0 md:z-10",
            mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:shadow-none",
          )}
        >
          <div className="p-3">
            <div className="mb-2 px-3 py-1">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
                Workspace Navigation
              </p>
            </div>

            <nav className="space-y-1" aria-label="Workspace primary navigation">
              {workspaceNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || (item.to === "/app" && pathname === "/");
                const badge = item.to === "/alerts" && openAlerts > 0 ? String(openAlerts) : null;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors group",
                      active
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-transform group-hover:scale-105",
                          active ? "text-primary-foreground" : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {badge && (
                      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Status & Model Information Card */}
          <div className="p-3 border-t border-border">
            <div className="rounded-lg bg-background p-3 border border-border/80">
              <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                  Catalogue Scope
                </span>
                <span className="font-mono text-[11px] font-semibold text-primary">
                  {catalogCount.isSuccess ? Number(catalogCount.data).toLocaleString() : "27,326"}
                </span>
              </div>

              <div className="mt-2 space-y-1 text-[10px] text-muted-foreground font-mono">
                <div className="flex justify-between">
                  <span>Vision (Top-1)</span>
                  <span className="text-foreground">
                    {visionTop1 ? `${(visionTop1 * 100).toFixed(1)}%` : "63.3%"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ML Risk Test</span>
                  <span className="text-foreground">
                    {riskAccuracy ? `${(riskAccuracy * 100).toFixed(1)}%` : "99.6%"}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between">
                <Link
                  to="/models"
                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-accent transition-colors font-medium"
                >
                  Model Details <ExternalLink className="size-2.5" />
                </Link>
                <span className="text-[9px] font-mono text-muted-foreground">v2.0 Checkpoint</span>
              </div>
            </div>

            <div className="mt-2.5 flex items-start gap-1.5 px-1 text-[10px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-muted-foreground/60" />
              <span>Educational & research tool. Not for autonomous clinical triage.</span>
            </div>
          </div>
        </aside>

        {/* Workspace Main Content Viewport */}
        <main id="main-content" className="flex-1 min-w-0 bg-background pb-16 md:pb-8">
          <div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Quick Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed bottom-0 inset-x-0 z-30 flex h-14 items-center justify-around border-t border-border bg-background/95 backdrop-blur-md px-2 md:hidden"
      >
        <Link
          to="/app"
          className={cn(
            "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors",
            pathname === "/app" || pathname === "/"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Boxes className="size-4" />
          <span>Overview</span>
        </Link>

        <Link
          to="/medicines"
          className={cn(
            "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors",
            pathname === "/medicines"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <BookOpen className="size-4" />
          <span>Library</span>
        </Link>

        <Link
          to="/scan"
          className="relative -top-3 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 transition-transform"
          aria-label="Scan medicine package"
        >
          <Camera className="size-5" />
        </Link>

        <Link
          to="/assessment"
          search={{ medicine: undefined }}
          className={cn(
            "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors",
            pathname === "/assessment"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Thermometer className="size-4" />
          <span>Assess</span>
        </Link>

        <Link
          to="/alerts"
          className={cn(
            "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors",
            pathname === "/alerts"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <div className="relative">
            <AlertTriangle className="size-4" />
            {openAlerts > 0 && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-destructive" />
            )}
          </div>
          <span>Alerts</span>
        </Link>
      </nav>
    </div>
  );
}
