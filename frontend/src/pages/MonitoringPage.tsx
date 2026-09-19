import React, { useState } from 'react';
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Thermometer, Droplets, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Card,
  PageHeader,
  SectionHeader,
  Select,
  StatCard,
} from '../components/common';
import { StorageRiskAssessment } from '../components/storage/StorageRiskAssessment';

export const MonitoringPage: React.FC = () => {
  // Ambient tracking telemetry points
  const temperatureData = [
    { time: '08:00', temp: 21, safeMin: 15, safeMax: 25 },
    { time: '10:00', temp: 23, safeMin: 15, safeMax: 25 },
    { time: '12:00', temp: 26, safeMin: 15, safeMax: 25 },
    { time: '14:00', temp: 27, safeMin: 15, safeMax: 25 },
    { time: '16:00', temp: 25, safeMin: 15, safeMax: 25 },
    { time: '18:00', temp: 24, safeMin: 15, safeMax: 25 },
    { time: '20:00', temp: 22, safeMin: 15, safeMax: 25 },
  ];

  const humidityData = [
    { time: '08:00', humidity: 45, safeMin: 35, safeMax: 60 },
    { time: '10:00', humidity: 48, safeMin: 35, safeMax: 60 },
    { time: '12:00', humidity: 55, safeMin: 35, safeMax: 60 },
    { time: '14:00', humidity: 58, safeMin: 35, safeMax: 60 },
    { time: '16:00', humidity: 62, safeMin: 35, safeMax: 60 },
    { time: '18:00', humidity: 54, safeMin: 35, safeMax: 60 },
    { time: '20:00', humidity: 50, safeMin: 35, safeMax: 60 },
  ];

  const [selectedMedId, setSelectedMedId] = useState<string>('MED-001');

  const medicineOptions = [
    { value: 'MED-001', label: 'Paracetamol 500mg Tablets (Permissible: 20°C – 25°C)' },
    { value: 'MED-014', label: 'Human Insulin Regular 100U/mL (Cold Chain: 2°C – 8°C)' },
    { value: 'MED-005', label: 'Atorvastatin Calcium 20mg Tablets (Permissible: 20°C – 25°C)' },
    { value: 'MED-004', label: 'Metformin HCl 500mg Tablets (Permissible: 20°C – 25°C)' },
    { value: 'MED-006', label: 'Omeprazole 20mg Delayed-Release (Permissible: 15°C – 30°C)' },
    { value: 'MED-016', label: 'Albuterol Sulfate Inhalation Aerosol (Permissible: 15°C – 25°C)' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge={
          <Badge variant="info" size="sm" dot>
            Environmental Telemetry & ML Risk (Phase 5 Active)
          </Badge>
        }
        title="Environmental Storage Conditions Monitoring"
        description="Atmospheric telemetry tracking mapped to USP/FDA monograph boundaries. Features real-time deterministic compliance checking and trained AI/ML storage-risk degradation estimation."
        actions={
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs text-slate-300">
            Current Ambient:{' '}
            <span className="font-semibold text-emerald-400 font-mono">22°C / 50% RH</span>
          </div>
        }
      />

      {/* Ambient Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Ambient Temperature"
          value="22.0°C"
          subtitle="Nominal Room Temperature (15-25°C)"
          icon={<Thermometer className="h-5 w-5" />}
          theme="cyan"
        />
        <StatCard
          title="Relative Humidity"
          value="50% RH"
          subtitle="Nominal Humidity Window (35-60% RH)"
          icon={<Droplets className="h-5 w-5" />}
          theme="emerald"
        />
        <StatCard
          title="Storage Compliance"
          value="Nominal"
          subtitle="Deterministic range compliance active"
          icon={<ShieldCheck className="h-5 w-5" />}
          theme="emerald"
        />
      </div>

      {/* Temperature Trend Chart */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionHeader
            icon={<Thermometer className="h-5 w-5 text-cyan-400" />}
            title="Temperature Trajectory (°C)"
            description="Green dashed boundaries indicate standard USP Controlled Room Temperature (15°C – 25°C)"
          />
          <Badge variant="info" size="sm">
            Telemetry Stream
          </Badge>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLine data={temperatureData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis domain={[10, 35]} stroke="#64748b" fontSize={12} unit="°C" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <ReferenceLine
                y={25}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: 'USP Max (25°C)', fill: '#10b981', fontSize: 10, position: 'top' }}
              />
              <ReferenceLine
                y={15}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: 'USP Min (15°C)', fill: '#10b981', fontSize: 10, position: 'bottom' }}
              />
              <Line
                type="monotone"
                dataKey="temp"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ fill: '#38bdf8', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Humidity Trend Chart */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionHeader
            icon={<Droplets className="h-5 w-5 text-emerald-400" />}
            title="Relative Humidity Trajectory (% RH)"
            description="Green dashed boundaries indicate standard pharmaceutical packaging humidity safe window (35% – 60% RH)"
          />
          <Badge variant="success" size="sm">
            Hygrometry Stream
          </Badge>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLine data={humidityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis domain={[20, 80]} stroke="#64748b" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <ReferenceLine
                y={60}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: 'Safe Max (60% RH)', fill: '#10b981', fontSize: 10, position: 'top' }}
              />
              <ReferenceLine
                y={35}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: 'Safe Min (35% RH)', fill: '#10b981', fontSize: 10, position: 'bottom' }}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                stroke="#34d399"
                strokeWidth={2.5}
                dot={{ fill: '#34d399', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Phase 5: Storage Risk ML Assessment Section */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Live Storage Risk Evaluation by Catalog Medicine
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any medicine monograph to simulate stability degradation against current ambient or stress conditions.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <Select
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="text-xs"
            >
              {medicineOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <StorageRiskAssessment
          medicineId={selectedMedId}
          medicineName={medicineOptions.find((m) => m.value === selectedMedId)?.label.split('(')[0].trim()}
          initialTemp={22.0}
          initialHumidity={50.0}
        />
      </div>
    </div>
  );
};

