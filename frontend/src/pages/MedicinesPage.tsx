import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Thermometer,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Medicine, CategoryCount } from '../types';
import { fetchMedicines, fetchCategories, fetchMedicineById } from '../services/api';
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Modal,
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/common';

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
      .catch(() => {});
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
    }, 250);
    return () => clearTimeout(timer);
  }, [loadMedicines]);

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
    } catch {
      // Retain already selected medicine if detail refresh is unavailable
    }
  };

  const isColdChain = (med: Medicine) => med.storage_max_temperature <= 8;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge={
          <Badge variant="success" size="sm" dot>
            Phase 2 Database: Verified Pharmaceutical Standards
          </Badge>
        }
        title="Medicine Storage Catalog & Specifications"
        description="Comprehensive pharmaceutical storage reference catalog. Storage tolerances are verified manufacturer monograph specifications sourced from official FDA DailyMed & USP monographs and are never fabricated by AI."
        actions={
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs text-slate-300">
            Total Monograph Classes:{' '}
            <span className="font-semibold text-cyan-400 font-mono">{totalCount} SKUs</span>
          </div>
        }
      />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Input
            placeholder="Search medicine name, active generic API, or SKU (e.g. Paracetamol, Insulin, MED-001)..."
            value={search}
            onChange={handleSearchChange}
            leftIcon={<Search className="h-4 w-4" />}
            rightAction={
              search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCurrentPage(1);
                  }}
                  className="text-slate-400 hover:text-white p-1"
                  aria-label="Clear search input"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : undefined
            }
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-56">
            <Select value={selectedCategory} onChange={handleCategoryChange}>
              <option value="ALL">All Categories ({totalCount})</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.count})
                </option>
              ))}
            </Select>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => loadMedicines()}
            disabled={loading}
            title="Reload dataset"
            icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />}
            aria-label="Reload medicine catalog"
          />
        </div>
      </div>

      {/* Main Table / Grid View */}
      <Card className="overflow-hidden">
        {error ? (
          <ErrorState
            title="Unable to Load Medicine Catalog"
            message={error}
            onRetry={() => loadMedicines()}
          />
        ) : loading ? (
          <LoadingState
            message="Loading verified pharmaceutical monographs..."
            subtext="Connecting to SQLAlchemy database"
          />
        ) : medicines.length === 0 ? (
          <EmptyState
            title="No Matching Medicines Found"
            description={`No pharmaceutical records match your current filter "${search}".`}
            actionLabel="Reset Search & Filters"
            onAction={() => {
              setSearch('');
              setSelectedCategory('ALL');
              setCurrentPage(1);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase font-mono">
                <tr>
                  <th className="px-5 py-3.5">SKU / Class</th>
                  <th className="px-5 py-3.5">Medicine Name & API</th>
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
                        <Thermometer
                          className={`h-3.5 w-3.5 ${
                            isColdChain(med) ? 'text-blue-400' : 'text-amber-400'
                          }`}
                        />
                        <span className="font-semibold text-slate-200">
                          {med.storage_min_temperature}°C – {med.storage_max_temperature}°C
                        </span>
                        {isColdChain(med) && (
                          <Badge variant="primary" size="sm">
                            COLD CHAIN
                          </Badge>
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(med);
                        }}
                      >
                        Monograph
                      </Button>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                icon={<ChevronLeft className="h-3.5 w-3.5" />}
              >
                Prev
              </Button>
              <span className="px-2 font-mono text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detailed Pharmaceutical Monograph Modal */}
      {selectedMedicine && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedMedicine(null)}
          title={
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                {selectedMedicine.medicine_id}
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {selectedMedicine.medicine_name}
              </h2>
            </div>
          }
          subtitle={`Therapeutic Category: ${selectedMedicine.category}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Core Identification Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Active Ingredient</span>
                <p className="font-semibold text-white mt-0.5">{selectedMedicine.generic_name}</p>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Strength & Form</span>
                <p className="font-semibold text-white mt-0.5">
                  {selectedMedicine.strength} • {selectedMedicine.dosage_form}
                </p>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Brand / Trade Name</span>
                <p className="font-semibold text-white mt-0.5">
                  {selectedMedicine.brand_name || 'Generic Product'}
                </p>
              </div>
            </div>

            {/* Storage Specifications Banner */}
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-cyan-200 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-cyan-400" />
                  Regulatory Storage Tolerances
                </span>
                {isColdChain(selectedMedicine) && (
                  <Badge variant="primary" size="sm">
                    Cold Chain Storage (2°C - 8°C)
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-400 text-[11px]">Temperature Range:</span>
                  <p className="font-mono font-bold text-white text-sm mt-0.5">
                    {selectedMedicine.storage_min_temperature}°C – {selectedMedicine.storage_max_temperature}°C
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Permissible Humidity:</span>
                  <p className="font-mono font-bold text-white text-sm mt-0.5">
                    {selectedMedicine.storage_max_humidity
                      ? `${selectedMedicine.storage_min_humidity || 0}% – ${selectedMedicine.storage_max_humidity}% RH`
                      : 'Not specified (Dry place)'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Expiry Advance Warning:</span>
                  <p className="font-mono font-bold text-amber-400 text-sm mt-0.5">
                    {selectedMedicine.expiry_warning_days} Days
                  </p>
                </div>
              </div>
            </div>

            {/* Technical CV Mapping */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Computer Vision Class Identifier</span>
              <p className="font-mono text-cyan-300 text-xs">{selectedMedicine.image_class}</p>
            </div>

            {/* Provenance & Monograph Link */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Source Authority: <strong className="text-slate-300">{selectedMedicine.source}</strong></span>
              </div>

              {selectedMedicine.source_url && (
                <a
                  href={selectedMedicine.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  <span>View Official FDA DailyMed Monograph</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
