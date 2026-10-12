import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Camera,
  Compass,
  FileText,
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
import { useCatalogCount, useApiHealth, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

const workspaceNav = [
  {
    to: "/app",
    label: "Overview",
    icon: Boxes,
    tag: "Control",
  },
  {
    to: "/scan",
    label: "Scanner",
    icon: ScanLine,
    tag: "Multimodal",
  },
  {
    to: "/medicines",
    label: "Library",
    icon: BookOpen,
    tag: "27.3k Records",
  },
  {
    to: "/assessment",
    label: "Assessment",
    icon: Thermometer,
    tag: "Kinetic Rules",
  },
  {
    to: "/alerts",
    label: "Excursions",
    icon: AlertTriangle,
    tag: "Audit",
  },
  {
    to: "/models",
    label: "Model Insights",
    icon: BarChart3,
    tag: "Verification",
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const catalogCount = useCatalogCount();
  const health = useApiHealth();
  const models = useModelsOverview();
  const assessments = useAssessmentHistory();

  const openAlerts = assessments.filter(isFlagged).length;

  // Keyboard accessibility: dismiss mobile navigation with Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Current section context title
  const currentNav = workspaceNav.find(
    (item) => item.to === pathname || (item.to === "/app" && pathname === "/"),
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-mint/20 selection:text-forest">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-xs focus:text-primary-foreground focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* Top Scientific Workspace Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand & Context */}
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              aria-label="Toggle workspace navigation"
              aria-expanded={mobileOpen}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>

            <Link to="/app" className="flex items-center gap-2.5 group">
              <div className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground font-head font-bold text-xs tracking-wider shadow-xs transition-transform group-hover:scale-105">
                MS
              </div>
              <div className="flex flex-col">
                <span className="font-head text-sm font-bold tracking-tight text-foreground leading-none">
                  MediShelf AI
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  Intelligence System
                </span>
              </div>
            </Link>

            {/* Separator */}
            <div className="hidden h-5 w-px bg-border/80 lg:block" />

            {/* Desktop Horizontal Navigation Ribbon */}
            <nav
              className="hidden lg:flex items-center gap-1"
              aria-label="Workspace primary navigation"
            >
              {workspaceNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || (item.to === "/app" && pathname === "/");
                const badge = item.to === "/alerts" && openAlerts > 0 ? String(openAlerts) : null;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{item.label}</span>
                    {badge && (
                      <span className="ml-1 rounded-full bg-destructive/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-destructive">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Search */}
            <Link
              to="/medicines"
              className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              title="Search 27,326 clinical concepts"
            >
              <Search className="size-3 text-muted-foreground" />
              <span className="truncate max-w-[120px] xl:max-w-[180px]">Search 27k medicines</span>
              <kbd className="hidden xl:inline-block rounded border border-border bg-card px-1 text-[9px] font-mono text-muted-foreground">
                /
              </kbd>
            </Link>

            {/* Quick Scan Action */}
            <Link
              to="/scan"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
            >
              <Camera className="size-3.5" />
              <span className="hidden sm:inline">Scan Label</span>
              <span className="sm:hidden">Scan</span>
            </Link>

            {/* Public Site Link */}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Return to Public Homepage"
            >
              <Compass className="size-3.5" />
              <span className="hidden md:inline">Public Site</span>
            </Link>

            {/* Status & Provenance */}
            <div
              className="hidden md:flex items-center gap-2 pl-3 border-l border-border/80 text-[11px] text-muted-foreground"
              title="Authoritative FDA DailyMed & NLM RxNorm Connected"
            >
              <span className="size-1.5 rounded-full bg-mint" />
              <span className="text-foreground font-mono text-[10px]">
                {catalogCount.isSuccess
                  ? `${Number(catalogCount.data).toLocaleString()} RxNorm`
                  : "Catalogue"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer Overlay */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-72 bg-card p-4 shadow-xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground font-head font-bold text-xs">
                    MS
                  </div>
                  <div>
                    <h2 className="font-head text-sm font-bold text-foreground">MediShelf AI</h2>
                    <p className="font-mono text-[9px] text-muted-foreground">Workspace Menu</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <nav className="mt-4 space-y-1">
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
                        "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-secondary",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="size-4" />
                        <span>{item.label}</span>
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

            <div className="pt-4 border-t border-border">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Compass className="size-4" />
                <span>Return to Public Website</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Spacious Content Canvas */}
      <main id="main-content" className="flex-1 w-full" tabIndex={-1}>
        {children}
      </main>

      {/* Scientific Responsible Use & Provenance Footer */}
      <footer className="border-t border-border bg-card/60 py-6 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="font-head font-bold text-foreground">MediShelf AI</span>
            <span>—</span>
            <span>Healthcare Intelligence & Storage Compliance Research System</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span>FDA DailyMed & NLM RxNorm Lineage</span>
            <span>•</span>
            <Link to="/models" className="text-primary hover:underline">
              Model Artifacts
            </Link>
            <span>•</span>
            <span className="text-muted-foreground/80">Academic Research Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
