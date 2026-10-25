import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronRight,
  Menu,
  ScanLine,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Thermometer,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAssessmentHistory, isFlagged } from "@/lib/activity";
import { API_BASE_URL } from "@/lib/api";
import { useCatalogCount, useApiHealth, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: typeof Boxes;
  badge?: string | number | null;
  badgeColor?: string;
}

const PRIMARY_NAV = [
  {
    to: "/",
    label: "Overview",
    description: "Intelligence workspace & telemetry",
    icon: Boxes,
  },
  {
    to: "/scan",
    label: "Scanner",
    description: "Multimodal label & vision classification",
    icon: ScanLine,
  },
  {
    to: "/medicines",
    label: "Medicine Library",
    description: "27,326 pharmacopeial monographs",
    icon: BookOpen,
  },
  {
    to: "/assessment",
    label: "Storage Assessment",
    description: "Kinetic rules & excursion limits",
    icon: Thermometer,
  },
  {
    to: "/alerts",
    label: "Excursions & Audit",
    description: "Session boundary violations",
    icon: AlertTriangle,
  },
  {
    to: "/models",
    label: "Model Insights",
    description: "Empirical verification benchmarks",
    icon: BarChart3,
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const catalogCount = useCatalogCount();
  const health = useApiHealth();
  const models = useModelsOverview();
  const assessments = useAssessmentHistory();

  const flaggedAlertsCount = assessments.filter(isFlagged).length;

  // Keyboard accessibility: dismiss mobile navigation with Escape, or focus search with '/'
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Handle header search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerSearch.trim()) {
      navigate({
        to: "/medicines",
        search: { search: headerSearch.trim() } as any,
      });
      setHeaderSearch("");
      searchInputRef.current?.blur();
    }
  };

  const isHealthLoading = health.isLoading || health.isFetching;
  const isHealthy =
    health.isSuccess &&
    (health.data?.status === "healthy" || health.data?.status === "ok") &&
    health.data?.database !== "error";
  const isDegraded =
    health.isSuccess &&
    (health.data?.status === "degraded" || health.data?.database === "error");
  const isOffline = !isHealthLoading && !isHealthy && !isDegraded;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-mint/20 selection:text-forest">
      {/* Skip to Main Content Accessibility Landmark */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-mint"
      >
        Skip to main content
      </a>

      {/* =========================================================================
          1. PERSISTENT DESKTOP SIDEBAR (Visible lg and above, 260px fixed)
         ========================================================================= */}
      <aside
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 bg-[#102D26] text-[#F7F6F0] border-r border-[#1A453B]"
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center px-5 border-b border-[#1A453B]">
          <Link
            to="/"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint rounded-md p-1 -m-1"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-mint text-[#0B211C] shadow-sm font-head font-bold text-base transition-transform group-hover:scale-105">
              <Shield className="size-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="font-head text-base font-bold tracking-tight text-[#F7F6F0] leading-tight">
                MediShelf AI
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#A3B8B0]">
                Healthcare Intelligence
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Group */}
        <div className="flex-1 flex flex-col overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <div className="px-3 pb-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7E968D]">
              Clinical Workspace
            </div>
            <nav className="space-y-1" aria-label="Primary Workspace Navigation">
              {PRIMARY_NAV.map((item) => {
                const Icon = item.icon;
                const active =
                  item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                const badge =
                  item.to === "/alerts" && flaggedAlertsCount > 0
                    ? String(flaggedAlertsCount)
                    : item.to === "/models"
                      ? "91%"
                      : null;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint",
                      active
                        ? "bg-[#1A453B] text-white font-semibold shadow-xs"
                        : "text-[#D1DDD7] hover:bg-[#153830] hover:text-white",
                    )}
                  >
                    {/* Active Route Left Border Indicator */}
                    {active && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-sm bg-mint"
                        aria-hidden="true"
                      />
                    )}

                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active ? "text-mint" : "text-[#8CA399] group-hover:text-mint",
                        )}
                      />
                      <div className="truncate">
                        <div className="leading-snug truncate">{item.label}</div>
                      </div>
                    </div>

                    {badge && (
                      <span
                        className={cn(
                          "ml-2 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide",
                          item.to === "/alerts"
                            ? "bg-[#D9383A] text-white"
                            : "bg-mint/15 text-mint border border-mint/30",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Quick Guidance / Verified Capabilities */}
          <div className="rounded-lg bg-[#0B211C]/80 border border-[#1A453B] p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-mint font-semibold text-[11px]">
              <Sparkles className="size-3.5" />
              <span>Multi-Source Intelligence</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#A3B8B0]">
              MobileNetV3 packaging vision + EasyOCR label parsing + USP kinetic compliance engine.
            </p>
          </div>
        </div>

        {/* Bottom System & Telemetry Status Dock */}
        <div className="p-3 border-t border-[#1A453B] bg-[#0B211C] text-xs space-y-2.5">
          {/* Backend Connection Health */}
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  isHealthLoading
                    ? "bg-amber-400 animate-pulse"
                    : isHealthy
                      ? "bg-mint animate-pulse"
                      : isDegraded
                        ? "bg-amber-400"
                        : "bg-[#D9383A]",
                )}
                aria-hidden="true"
              />
              <span className="text-[#D1DDD7] font-medium truncate">
                {isHealthLoading
                  ? "Checking Service..."
                  : isHealthy
                    ? "Inference Service"
                    : isDegraded
                      ? "Service Degraded"
                      : "Service Offline"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isHealthLoading) {
                  health.refetch();
                }
              }}
              disabled={isHealthLoading}
              title={
                isHealthy
                  ? `API online (${health.data?.version ?? "v0.1.0"}, DB ${health.data?.database ?? "connected"}). Click to refresh.`
                  : isDegraded
                    ? `DB issue: ${String(health.data?.details?.["db_error"] ?? "Degraded state")}. Click to re-check.`
                    : `Cannot reach API at ${API_BASE_URL}. Click to re-check.`
              }
              className={cn(
                "font-mono text-[10px] shrink-0 rounded px-1.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mint",
                isHealthLoading
                  ? "text-[#A3B8B0] cursor-wait opacity-70"
                  : isHealthy
                    ? "text-mint/90 hover:bg-mint/10 hover:text-mint cursor-pointer"
                    : isDegraded
                      ? "text-amber-400 hover:bg-amber-400/10 cursor-pointer"
                      : "text-[#F87171] hover:bg-[#D9383A]/20 cursor-pointer underline",
              )}
            >
              {isHealthLoading
                ? "Checking..."
                : isHealthy
                  ? "Active"
                  : isDegraded
                    ? "Degraded"
                    : "Check API"}
            </button>
          </div>

          {/* Catalog & Knowledge Base */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8CA399]">RxNorm Reference DB</span>
            <span className="font-mono text-[10px] text-[#D1DDD7] font-medium">
              {catalogCount.isSuccess
                ? `${Number(catalogCount.data).toLocaleString()} Records`
                : "27,326 Records"}
            </span>
          </div>

          {/* Session Scope Notice */}
          <div className="pt-1 text-[10px] text-[#7E968D] border-t border-[#1A453B]/70 flex items-center justify-between">
            <span>Audit history scope</span>
            <span
              className="font-mono text-[9px] uppercase tracking-wider text-[#A3B8B0]"
              title="Excursions and review history are stored in browser sessionStorage (ephemeral to this tab)."
            >
              Session Only
            </span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. COMPACT TOP TOOLBAR (Desktop lg:pl-64, Mobile full-width)
         ========================================================================= */}
      <header className="sticky top-0 z-40 lg:pl-64 border-b border-border bg-card/95 backdrop-blur-md transition-all">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Mobile Drawer Trigger & Identity */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              aria-label="Toggle workspace navigation"
              aria-expanded={mobileOpen}
              className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <Link to="/" className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground font-head font-bold text-xs">
                MS
              </div>
              <span className="font-head text-base font-bold text-foreground leading-none">
                MediShelf AI
              </span>
            </Link>
          </div>

          {/* Desktop Global Medicine Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden sm:flex flex-1 max-w-md items-center relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Search 27,326 medicines, active ingredients, or RxNorm codes..."
              aria-label="Global medicine catalogue search"
              className="w-full h-9.5 rounded-lg border border-border bg-background pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
            />
            <kbd
              aria-hidden="true"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden xl:inline-flex h-5 items-center rounded border border-border bg-card px-1.5 font-mono text-[10px] text-muted-foreground"
            >
              /
            </kbd>
          </form>

          {/* Action Utilities (Right side) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Primary Action: Scan Medicine */}
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/92 active:scale-[0.98] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint transition-all"
            >
              <Camera className="size-4 shrink-0" />
              <span>Scan Medicine</span>
            </Link>

            {/* Assessment Quick Link */}
            <Link
              to="/assessment"
              search={{ medicine: undefined }}
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint transition-colors"
            >
              <Thermometer className="size-3.5 text-warning" />
              <span>Check Excursion</span>
            </Link>

            {/* Audited Model Accuracy Badge */}
            <Link
              to="/models"
              className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-mint/40 bg-mint/10 text-xs font-mono font-medium text-forest hover:bg-mint/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint transition-colors"
              title="Audited Model Accuracy: 91.0% Top-1 / 97.0% Top-3 on 50 test photographs"
            >
              <Sparkles className="size-3.5 text-mint" />
              <span className="hidden sm:inline font-semibold">91.0% Acc</span>
              <span className="sm:hidden font-semibold">91%</span>
            </Link>
          </div>
        </div>
      </header>

      {/* =========================================================================
          3. ACCESSIBLE MOBILE NAVIGATION DRAWER (Slide-over sheet)
         ========================================================================= */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Workspace Navigation Menu"
          className="fixed inset-0 z-50 lg:hidden"
        >
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-[#0B211C]/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#102D26] text-[#F7F6F0] p-5 shadow-2xl flex flex-col justify-between border-r border-[#1A453B] z-10">
            <div>
              {/* Drawer Brand & Close Button */}
              <div className="flex items-center justify-between pb-4 border-b border-[#1A453B]">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-mint text-[#0B211C] font-head font-bold text-sm">
                    <Shield className="size-4 fill-current" />
                  </div>
                  <div>
                    <h2 className="font-head text-sm font-bold text-[#F7F6F0]">MediShelf AI</h2>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[#A3B8B0]">
                      Clinical Intelligence
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation drawer"
                  className="rounded-md p-1.5 text-[#D1DDD7] hover:bg-[#153830] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Mobile Quick Search */}
              <div className="pt-4 pb-2">
                <form
                  onSubmit={(e) => {
                    handleSearchSubmit(e);
                    setMobileOpen(false);
                  }}
                  className="relative"
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8CA399]" />
                  <input
                    type="search"
                    value={headerSearch}
                    onChange={(e) => setHeaderSearch(e.target.value)}
                    placeholder="Search 27k medicines..."
                    className="w-full h-9 rounded-md bg-[#0B211C] border border-[#1A453B] pl-9 pr-3 text-xs text-[#F7F6F0] placeholder:text-[#7E968D] focus:outline-none focus:border-mint"
                  />
                </form>
              </div>

              {/* Mobile Nav Links */}
              <nav className="mt-3 space-y-1" aria-label="Mobile Navigation Links">
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  const badge =
                    item.to === "/alerts" && flaggedAlertsCount > 0
                      ? String(flaggedAlertsCount)
                      : item.to === "/models"
                        ? "91%"
                        : null;

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-[#1A453B] text-white font-semibold"
                          : "text-[#D1DDD7] hover:bg-[#153830] hover:text-white",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("size-4", active ? "text-mint" : "text-[#8CA399]")} />
                        <span>{item.label}</span>
                      </div>
                      {badge && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                            item.to === "/alerts"
                              ? "bg-[#D9383A] text-white"
                              : "bg-mint/15 text-mint",
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Footer Status */}
            <div className="pt-4 border-t border-[#1A453B] space-y-3">
              <Link
                to="/scan"
                onClick={() => setMobileOpen(false)}
                className="flex w-full items-center justify-center gap-2 h-10 rounded-lg bg-mint text-[#0B211C] font-semibold text-xs shadow-sm"
              >
                <Camera className="size-4" />
                <span>Open Optical Scanner</span>
              </Link>

              {/* Mobile Service Health Indicator */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#1A453B]/70">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      isHealthLoading
                        ? "bg-amber-400 animate-pulse"
                        : isHealthy
                          ? "bg-mint animate-pulse"
                          : isDegraded
                            ? "bg-amber-400"
                            : "bg-[#D9383A]",
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-[#D1DDD7] font-medium truncate">
                    {isHealthLoading
                      ? "Checking API..."
                      : isHealthy
                        ? "Inference Service"
                        : isDegraded
                          ? "Service Degraded"
                          : "Service Offline"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isHealthLoading) health.refetch();
                  }}
                  disabled={isHealthLoading}
                  className="font-mono text-[10px] text-mint hover:underline"
                >
                  {isHealthLoading ? "..." : isHealthy ? "Online" : "Retry"}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#A3B8B0] font-mono">
                <span>Model Checkpoint</span>
                <span className="text-white font-bold">v3.1 (91% Acc)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. MAIN VIEWPORT CANVAS (Desktop offset by lg:pl-64, mobile full width)
         ========================================================================= */}
      <main id="main-content" className="flex-1 w-full lg:pl-64" tabIndex={-1}>
        <div className="w-full">{children}</div>
      </main>

      {/* =========================================================================
          5. PROFESSIONAL HEALTHCARE PROVENANCE FOOTER (lg:pl-64)
         ========================================================================= */}
      <footer className="border-t border-border bg-card/60 py-6 text-xs text-muted-foreground lg:pl-64 transition-all">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-center sm:text-left">
            <span className="font-head font-bold text-foreground">MediShelf AI</span>
            <span>—</span>
            <span>Pharmaceutical Packaging Identification & Kinetic Storage Compliance</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono">
            <span>FDA DailyMed & RxNorm Lineage</span>
            <span>•</span>
            <Link to="/models" className="text-primary hover:underline font-semibold">
              Model Evaluation Dossier (v3.1)
            </Link>
            <span>•</span>
            <span className="text-muted-foreground/80">Clinical Research Workspace</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
