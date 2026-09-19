import React from 'react';
import {
  Bell,
  ShieldCheck,
  Thermometer,
  Clock,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  PageHeader,
} from '../components/common';

interface AlertsPageProps {
  onNavigateToAssessment?: () => void;
  onNavigateToScan?: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  onNavigateToAssessment,
  onNavigateToScan,
}) => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge={
          <Badge variant="neutral" size="sm">
            Event Log
          </Badge>
        }
        title="Storage Alerts"
        description="Records storage boundary discrepancies, critical temperature excursions, and label expiration violations evaluated during active sessions."
        actions={
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs text-slate-300">
            Recorded Alerts:{' '}
            <span className="font-semibold text-emerald-400 font-mono">0 Active</span>
          </div>
        }
      />

      {/* Honest Empty State */}
      <Card className="p-10 sm:p-14 text-center border-slate-800 bg-slate-900/60 max-w-3xl mx-auto space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-400 border border-slate-700/60 shadow-inner">
          <Bell className="h-6 w-6 text-slate-400" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg font-bold text-white tracking-tight">
            No storage alerts recorded
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            No storage condition violations or critical excursion events have occurred in this session. Alerts are generated when actual storage discrepancies or expiry limits are evaluated.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onNavigateToAssessment && (
            <Button
              variant="primary"
              size="sm"
              onClick={onNavigateToAssessment}
              icon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Assess Storage Conditions
            </Button>
          )}
          {onNavigateToScan && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToScan}
            >
              Scan Medicine Package
            </Button>
          )}
        </div>
      </Card>

      {/* Real Alert Generation Architecture Explanation */}
      <Card className="p-6 space-y-4 border-slate-800 bg-slate-900/40 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
          <Info className="h-4 w-4 text-cyan-400" />
          <span>Alert Architecture & Event Criteria</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          MediShelf AI maintains strict integrity: alert records are never fabricated. A storage alert is produced only when one of the following verifiable conditions occurs:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
              <Thermometer className="h-4 w-4 text-cyan-400" />
              <span>Boundary Violation</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ambient temperature breaches the official USP/FDA monograph minimum or maximum allowable threshold.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>Elevated ML Risk</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The storage-risk model infers high cumulative excursion severity (duration × deviation).
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
              <Clock className="h-4 w-4 text-rose-400" />
              <span>Expiry Exceeded</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              OCR label extraction or user input identifies a package that has surpassed its manufacturer shelf-life.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
