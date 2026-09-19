import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info,
  Thermometer,
  Droplets,
  AlertCircle,
  X,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import type { Medicine, CategoryCount } from '../types';
import { fetchMedicines, fetchCategories, fetchMedicineById } from '../services/api';

export const MedicinesPage: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  // Load categories on initial mount
  useEffect(() => {
    fetchCategories()
      .then((cats) => setCategories(cats))
      .catch((err) => console.warn('Could not load categories:', err));
  }, []);

  // Fetch medicines based on current filters
  const loadMedicines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMedicines({
        page: currentPage,
        pageSize,
        search: search.trim() || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      });
      setMedicines(response.items);
      setTotalCount(response.total);
      setTotalPages(response.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading medicines.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMedicines();
    }, 250); // slight debounce
    return () => clearTimeout(timer);
  }, [loadMedicines]);

  // Reset to page 1 on filter changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
    setCurrentPage(1);
  };

  const handleOpenDetail = async (med: Medicine) => {
    setSelectedMedicine(med);
    try {
      const fullMed = await fetchMedicineById(med.medicine_id);
      setSelectedMedicine(fullMed);
    } catch (err) {
      console.warn('Failed to refresh detail:', err);
    }
  };

  const isColdChain = (med: Medicine) => med.storage_max_temperature <= 8;

  return (
    <div className="space-y-6">
      {/* Header & Provenance Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>FDA DailyMed & USP Sourced ground truth</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Medicine Storage Catalog & Specifications
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Curated pharmaceutical storage standards. Storage tolerances are verified manufacturer monograph specifications and never invented by AI.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-300">
          Total Monitored SKU: <span className="font-semibold text-cyan-400 font-mono">{totalCount} Classes</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search medicine name, generic API, brand or SKU (e.g. Paracetamol, Insulin, MED-001)..."
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setCurrentPage(1);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="w-full sm:w-auto rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 px-3 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
          >
            <option value="ALL">All Categories ({totalCount})</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} ({c.count})
              </option>
            ))}
          </select>

          <button
            onClick={() => loadMedicines()}
            disabled={loading}
            title="Reload dataset"
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl">
        {error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-400" />
            <h3 className="text-sm font-semibold text-white">Error Loading Medicine Data</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={() => loadMedicines()}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-xs text-slate-400">Loading verified pharmaceutical catalog...</p>
          </div>
        ) : medicines.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Info className="mx-auto h-8 w-8 text-slate-500" />
            <h3 className="text-sm font-semibold text-white">No Medicines Found</h3>
            <p className="text-xs text-slate-400">
              No records match your current search query "{search}" or category filter.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('ALL');
                setCurrentPage(1);
              }}
              className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-mono">
                <tr>
                  <th className="px-5 py-3.5">SKU / Class</th>
                  <th className="px-5 py-3.5">Medicine Name</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Storage Limits</th>
                  <th className="px-5 py-3.5">Expiry Threshold</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {medicines.map((med) => (
                  <tr
                    key={med.medicine_id}
                    onClick={() => handleOpenDetail(med)}
                    className="hover:bg-slate-800/40 transition cursor-pointer group"
                  >
                    <td className="px-5 py-4 font-mono">
                      <span className="font-semibold text-cyan-400">{med.medicine_id}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">{med.image_class}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white group-hover:text-cyan-300 transition">
                        {med.medicine_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {med.generic_name} • {med.strength} ({med.dosage_form})
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{med.category}</td>
                    <td className="px-5 py-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Thermometer className={`h-3.5 w-3.5 ${isColdChain(med) ? 'text-blue-400' : 'text-amber-400'}`} />
                        <span className="font-semibold text-slate-200">
                          {med.storage_min_temperature}°C – {med.storage_max_temperature}°C
                        </span>
                        {isColdChain(med) && (
                          <span className="rounded bg-blue-500/20 px-1 py-0.2 text-[9px] font-bold text-blue-300 border border-blue-500/30">
                            COLD CHAIN
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {med.storage_max_humidity
                          ? `${med.storage_min_humidity || 0}% - ${med.storage_max_humidity}% RH`
                          : 'Protect from moisture'}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-400">
                      {med.expiry_warning_days} days notice
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(med);
                        }}
                        className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 transition"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/60 px-5 py-3.5 text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-white">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-white">{totalCount}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <span className="px-2 font-mono text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Medicine Monograph Modal */}
      {selectedMedicine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setSelectedMedicine(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-mono font-bold text-cyan-300 border border-cyan-500/30">
                    {selectedMedicine.medicine_id}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    CV Class: <code className="font-mono text-slate-300">{selectedMedicine.image_class}</code>
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {selectedMedicine.medicine_name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedMedicine.generic_name} • {selectedMedicine.strength}
                </p>
              </div>

              <button
                onClick={() => setSelectedMedicine(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Storage Criteria Card */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Official Storage Specification
                </span>
                {isColdChain(selectedMedicine) && (
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                    Strict Refrigeration (2°C - 8°C)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
                    <Thermometer className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Temperature Tolerance</div>
                    <div className="text-base font-bold font-mono text-white">
                      {selectedMedicine.storage_min_temperature}°C – {selectedMedicine.storage_max_temperature}°C
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-400">
                    <Droplets className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Relative Humidity (% RH)</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {selectedMedicine.storage_max_humidity
                        ? `${selectedMedicine.storage_min_humidity || 0}% – ${selectedMedicine.storage_max_humidity}%`
                        : 'Protect from moisture (USP)'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* General Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-slate-400 mb-0.5">Therapeutic Category</div>
                <div className="font-semibold text-white">{selectedMedicine.category}</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-slate-400 mb-0.5">Brand / Trade Name</div>
                <div className="font-semibold text-white">{selectedMedicine.brand_name || 'Generic Formulation'}</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-slate-400 mb-0.5">Dosage Form</div>
                <div className="font-semibold text-white">{selectedMedicine.dosage_form}</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-slate-400 mb-0.5">Manufacturer</div>
                <div className="font-semibold text-white">{selectedMedicine.manufacturer || 'Standard Pharmaceutical'}</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-slate-400 mb-0.5">Expiry Notice Window</div>
                <div className="font-semibold text-cyan-400 font-mono">{selectedMedicine.expiry_warning_days} days</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-slate-400 mb-0.5">Database ID</div>
                <div className="font-mono text-slate-300"># {selectedMedicine.id}</div>
              </div>
            </div>

            {/* Official Provenance Citation */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <FileText className="h-4 w-4 text-cyan-400" />
                <span>Regulatory Ground Truth Source</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                {selectedMedicine.source}
              </p>
              <div className="pt-1">
                <a
                  href={selectedMedicine.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 hover:underline font-mono text-[11px]"
                >
                  <span>View Official FDA DailyMed Package Insert</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Mandatory Academic / Ethical Provenance Disclaimer */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-300 leading-relaxed">
              <strong>Data Provenance Notice:</strong> These storage parameters are established by regulatory pharmacopeias (USP/FDA) and manufacturer package inserts. AI/ML models in this system operate on this ground truth to predict environmental risk, and <em>never generate or hallucinate</em> storage boundaries.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
