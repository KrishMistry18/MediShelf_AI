import type { SystemHealth, Medicine, MedicineListResponse, CategoryCount, ScanResponse, OCRResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function fetchSystemHealth(): Promise<SystemHealth> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    return {
      status: 'error',
      version: '0.1.0',
      project_name: 'MediShelf AI',
      environment: 'development (offline)',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
      disclaimer: 'MediShelf AI is an academic research platform. Predictions are AI-assisted estimations and not certified medical or storage safety guarantees.',
      details: { message: error instanceof Error ? error.message : 'Unknown connection error' },
    };
  }
}

export interface MedicineQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
}

export async function fetchMedicines(params: MedicineQueryParams = {}): Promise<MedicineListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page.toString());
  if (params.pageSize) query.append('page_size', params.pageSize.toString());
  if (params.search && params.search.trim()) query.append('search', params.search.trim());
  if (params.category && params.category.trim() && params.category !== 'ALL') {
    query.append('category', params.category.trim());
  }

  const url = `${API_BASE_URL}/api/medicines?${query.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch medicines: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function fetchMedicineById(medicineId: string): Promise<Medicine> {
  const res = await fetch(`${API_BASE_URL}/api/medicines/${encodeURIComponent(medicineId)}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch medicine ${medicineId}: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function fetchCategories(): Promise<CategoryCount[]> {
  const res = await fetch(`${API_BASE_URL}/api/medicines/categories`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch categories: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function searchMedicines(q: string, limit: number = 10): Promise<Medicine[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${API_BASE_URL}/api/medicines/search?q=${encodeURIComponent(q)}&limit=${limit}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to search medicines: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function scanMedicineImage(file: File, threshold?: number): Promise<ScanResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const url = threshold !== undefined 
    ? `${API_BASE_URL}/api/scan?threshold=${threshold}` 
    : `${API_BASE_URL}/api/scan`;

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Scan request failed with HTTP ${res.status}`);
  }

  return await res.json();
}

export async function scanOCR(file: File): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/ocr`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `OCR request failed with HTTP ${res.status}`);
  }

  return await res.json();
}
