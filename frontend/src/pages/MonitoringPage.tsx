import React, { useState, useEffect, useMemo } from 'react';
import {
  Thermometer,
  ShieldCheck,
  Search,
  ExternalLink,
  Pill,
  Info,
} from 'lucide-react';
import {
  Badge,
  Card,
  PageHeader,
  SectionHeader,
  Select,
} from '../components/common';
import { StorageRiskAssessment } from '../components/storage/StorageRiskAssessment';
import { fetchMedicines } from '../services/api';
import type { Medicine } from '../types';

export const MonitoringPage: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMedId, setSelectedMedId] = useState<string>('MED-001');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fallback initial list if API is starting up
  const fallbackMedicines = useMemo(
    () => [
      {
        id: 1,
        medicine_id: 'MED-001',
        medicine_name: 'Paracetamol 500 mg Tablet',
        generic_name: 'Acetaminophen',
        strength: '500 mg',
        dosage_form: 'Tablet',
        category: 'Analgesic',
        storage_min_temperature: 20.0,
        storage_max_temperature: 25.0,
        storage_min_humidity: null,
        storage_max_humidity: null,
        expiry_warning_days: 90,
        image_class: 'paracetamol',
        source: 'DailyMed / USP Monograph',
        source_url: 'https://dailymed.nlm.nih.gov/dailymed/',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 14,
        medicine_id: 'MED-014',
        medicine_name: 'Human Insulin Regular 100 units/mL',
        generic_name: 'Insulin Human',
        strength: '100 units/mL',
        dosage_form: 'Injection',
        category: 'Antidiabetic',
        storage_min_temperature: 2.0,
        storage_max_temperature: 8.0,
        storage_min_humidity: null,
        storage_max_humidity: null,
        expiry_warning_days: 28,
        image_class: 'insulin_regular',
        source: 'DailyMed / FDA Package Insert',
        source_url: 'https://dailymed.nlm.nih.gov/dailymed/',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    []
  );

  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      setLoading(true);
      try {
        const res = await fetchMedicines({ pageSize: 100 });
        if (isMounted && res.items && res.items.length > 0) {
          setMedicines(res.items);
          if (!res.items.some((m) => m.medicine_id === selectedMedId)) {
            setSelectedMedId(res.items[0].medicine_id);
          }
        } else if (isMounted) {
          setMedicines(fallbackMedicines);
        }
      } catch {
        if (isMounted) {
          setMedicines(fallbackMedicines);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [fallbackMedicines, selectedMedId]);

  const activeMedicineList = medicines.length > 0 ? medicines : fallbackMedicines;

  const filteredMedicines = useMemo(() => {
    if (!searchQuery.trim()) return activeMedicineList;
    const q = searchQuery.toLowerCase();
    return activeMedicineList.filter(
      (m) =>
        m.medicine_name.toLowerCase().includes(q) ||
        m.generic_name.toLowerCase().includes(q) ||
        m.medicine_id.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [activeMedicineList, searchQuery]);

  const selectedMedicine = useMemo(() => {
    return (
      activeMedicineList.find((m) => m.medicine_id === selectedMedId) ||
      activeMedicineList[0]
    );
  }, [activeMedicineList, selectedMedId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge={
          <Badge variant="success" size="sm" dot>
            Verified Monograph Database
          </Badge>
        }
        title="Storage Assessment"
        description="Assess medicine storage conditions against documented requirements and obtain an AI-assisted storage-risk estimate."
        actions={
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs text-slate-300 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Database Records:</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {activeMedicineList.length} Verified
            </span>
          </div>
        }
      />

      {/* Honest Operational Notice */}
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-cyan-200 font-medium">
          <Info className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>Manual Storage Evaluation (Software-Only Decision Support)</span>
        </div>
        <p className="text-[11px] text-slate-400">
          No live sensors connected. Enter observed environmental conditions manually to assess compliance and risk.
        </p>
      </div>

      {/* Medicine Selection & Monograph Reference Card */}
      <Card className="p-6 space-y-5 border-slate-800 bg-slate-900/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <SectionHeader
            icon={<Pill className="h-5 w-5 text-cyan-400" />}
            title="Step 1: Select Medicine from Verified Catalog"
            description="Choose any medicine monograph from the official database to retrieve documented storage boundaries."
          />

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Dropdown Select */}
            <div className="w-full sm:w-80">
              <Select
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                className="text-xs"
                disabled={loading}
              >
                {filteredMedicines.map((m) => (
                  <option key={m.medicine_id} value={m.medicine_id} className="bg-slate-900 text-slate-200">
                    {m.medicine_name} ({m.strength})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Monograph Facts Grid for Selected Medicine */}
        {selectedMedicine && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">Medicine & Active Ingredient</span>
              <p className="text-xs font-semibold text-white truncate">{selectedMedicine.medicine_name}</p>
              <p className="text-[11px] text-slate-400 font-mono">{selectedMedicine.generic_name}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">Documented Storage Range</span>
              <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold text-xs">
                <Thermometer className="h-3.5 w-3.5" />
                <span>
                  {selectedMedicine.storage_min_temperature}°C – {selectedMedicine.storage_max_temperature}°C
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                {selectedMedicine.storage_max_temperature <= 8.0 ? 'Cold chain requirement' : 'Controlled room temperature'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">Dosage Form & Category</span>
              <p className="text-xs font-medium text-slate-200">
                {selectedMedicine.dosage_form} ({selectedMedicine.strength})
              </p>
              <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                {selectedMedicine.category}
              </Badge>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">Authoritative Provenance</span>
              <p className="text-xs text-cyan-300 font-medium truncate">{selectedMedicine.source}</p>
              {selectedMedicine.source_url && (
                <a
                  href={selectedMedicine.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition"
                >
                  <span>Monograph Link</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Step 2: Input Actual Conditions & Run Assessment */}
      <div className="space-y-3">
        <div className="px-1 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Step 2: Enter Observed Environmental Conditions</span>
          </h3>
          <span className="text-xs text-slate-400">
            Real ML Inference + Deterministic Compliance
          </span>
        </div>

        {selectedMedicine && (
          <StorageRiskAssessment
            key={selectedMedicine.medicine_id}
            medicineId={selectedMedicine.medicine_id}
            medicineName={selectedMedicine.medicine_name}
            initialTemp={selectedMedicine.storage_max_temperature <= 8 ? 5.0 : 22.0}
            initialHumidity={50.0}
          />
        )}
      </div>
    </div>
  );
};

export const StorageAssessmentPage = MonitoringPage;
