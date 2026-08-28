import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Printer,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  ChevronRight,
  Home,
  RefreshCw,
  X,
  Check,
  ArrowRight,
  FileText,
  Boxes,
  Lock,
  Eye,
  Tag,
  AlertTriangle,
  FolderOpen,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SampleLocation,
  AffiliateSample,
  SampleLocationType,
} from '../types';
import {
  subscribeSampleLocations,
  createSampleLocation,
  updateSampleLocation,
  deleteSampleLocation,
  assignSampleLocation,
  importSampleLocationsCSV,
  ImportResult,
} from '../services/sampleLocationService';
import { subscribeSamples } from '../services/sampleService';
import { formatTanggal, formatTanggalWaktu } from '../utils/formatters';

interface PenataanLokasiPageProps {
  onBackToPortal?: () => void;
  initialTab?: 'MASTER' | 'IMPORT' | 'SAMPEL_LOKASI' | 'CETAK_LABEL';
}

const DEFAULT_CATEGORIES = [
  'Fashion Celana',
  'Fashion Batik',
  'Fashion Kaos',
  'Fashion Setelan',
  'Fashion Gamis & Dress',
  'Fashion Hijab',
  'Fashion Kemeja',
  'Fashion Jaket & Outer',
  'Aksesoris & Tas',
  'Sepatu & Sandal',
  'Umum',
];

const LOCATION_TYPES: { type: SampleLocationType; label: string }[] = [
  { type: 'RAK', label: 'Rak' },
  { type: 'HANGER', label: 'Hanger' },
  { type: 'KOTAK', label: 'Kotak / Box' },
  { type: 'LEMARI', label: 'Lemari' },
  { type: 'LAINNYA', label: 'Lainnya' },
];

export const PenataanLokasiPage: React.FC<PenataanLokasiPageProps> = ({
  onBackToPortal,
  initialTab = 'MASTER',
}) => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const canManage = isOwner || isManager;

  // Tabs state: 'MASTER' | 'IMPORT' | 'SAMPEL_LOKASI' | 'CETAK_LABEL'
  const [activeTab, setActiveTab] = useState<'MASTER' | 'IMPORT' | 'SAMPEL_LOKASI' | 'CETAK_LABEL'>(
    initialTab
  );

  // Data states
  const [locations, setLocations] = useState<SampleLocation[]>([]);
  const [samples, setSamples] = useState<AffiliateSample[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Toast & feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Master Location Filters & Search
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('SEMUA');
  const [filterType, setFilterType] = useState<string>('SEMUA');
  const [filterActiveStatus, setFilterActiveStatus] = useState<'SEMUA' | 'AKTIF' | 'NONAKTIF'>('SEMUA');

  // Modal Master Location Form State (Add / Edit)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<SampleLocation | null>(null);
  const [locationFormData, setLocationFormData] = useState<{
    kodeLokasi: string;
    namaLokasi: string;
    kategori: string;
    tipeLokasi: SampleLocationType | string;
    aktif: boolean;
    notes: string;
  }>({
    kodeLokasi: '',
    namaLokasi: '',
    kategori: 'Fashion Celana',
    tipeLokasi: 'RAK',
    aktif: true,
    notes: '',
  });
  const [submittingLocation, setSubmittingLocation] = useState<boolean>(false);

  // Import CSV Tab State
  const [csvInput, setCsvInput] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Daftar Sampel per Lokasi Filter & State
  const [searchSample, setSearchSample] = useState<string>('');
  const [selectedLocationForSampleList, setSelectedLocationForSampleList] = useState<string>('SEMUA');
  const [filterSampleArrangedStatus, setFilterSampleArrangedStatus] = useState<'SEMUA' | 'BELUM_DITATA' | 'SUDAH_DITATA'>('SEMUA');

  // Quick Assign Modal State
  const [assigningSample, setAssigningSample] = useState<AffiliateSample | null>(null);
  const [selectedTargetLocationId, setSelectedTargetLocationId] = useState<string>('');
  const [submittingAssign, setSubmittingAssign] = useState<boolean>(false);

  // Batch Assign State
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [batchTargetLocationId, setBatchTargetLocationId] = useState<string>('');
  const [isBatchAssignModalOpen, setIsBatchAssignModalOpen] = useState<boolean>(false);
  const [batchSubmitting, setBatchSubmitting] = useState<boolean>(false);

  // Cetak Label State
  const [selectedLocationIdsForPrint, setSelectedLocationIdsForPrint] = useState<string[]>([]);
  const [printFilterCategory, setPrintFilterCategory] = useState<string>('SEMUA');
  const [printFilterType, setPrintFilterType] = useState<string>('SEMUA');

  // Modal DAFTAR ISI RAK / HANGER
  const [viewingLocationContent, setViewingLocationContent] = useState<SampleLocation | null>(null);
  const [searchLocationSample, setSearchLocationSample] = useState<string>('');

  // Auto clear toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Subscriptions
  useEffect(() => {
    if (authLoading || !currentUser) return;
    setLoading(true);

    const unsubLocations = subscribeSampleLocations((locs) => {
      setLocations(locs);
      setLoading(false);
    });

    const unsubSamples = subscribeSamples(undefined, (sampleList) => {
      setSamples(sampleList);
    });

    return () => {
      unsubLocations();
      unsubSamples();
    };
  }, [authLoading, currentUser?.uid]);

  // Count samples per location ID or Code
  const sampleCountByLocationId = useMemo(() => {
    const map = new Map<string, number>();
    samples.forEach((s) => {
      if (s.locationId) {
        map.set(s.locationId, (map.get(s.locationId) || 0) + 1);
      } else if (s.locationCode) {
        // match by code fallback
        const loc = locations.find((l) => l.kodeLokasi === s.locationCode);
        if (loc && loc.id) {
          map.set(loc.id, (map.get(loc.id) || 0) + 1);
        }
      }
    });
    return map;
  }, [samples, locations]);

  // Samples without location (Belum Ditata)
  const unarrangedSamples = useMemo(() => {
    return samples.filter((s) => !s.locationId && !s.locationCode);
  }, [samples]);

  // Samples in currently selected Viewing Location (for DAFTAR ISI RAK/HANGER)
  const samplesInViewingLoc = useMemo(() => {
    if (!viewingLocationContent) return [];
    return samples.filter((s) => {
      const matchLoc =
        (s.locationId && (s.locationId === viewingLocationContent.id || s.locationId === viewingLocationContent.kodeLokasi)) ||
        (s.locationCode && (s.locationCode === viewingLocationContent.kodeLokasi || s.locationCode === viewingLocationContent.id));
      if (!matchLoc) return false;

      if (searchLocationSample.trim()) {
        const q = searchLocationSample.toLowerCase();
        const matchProduct = (s.productName || '').toLowerCase().includes(q);
        const matchBrand = (s.brandName || '').toLowerCase().includes(q);
        const matchSeller = (s.sellerName || '').toLowerCase().includes(q);
        const matchCategory = (s.category || '').toLowerCase().includes(q);
        if (!matchProduct && !matchBrand && !matchSeller && !matchCategory) return false;
      }
      return true;
    });
  }, [samples, viewingLocationContent, searchLocationSample]);

  // Filtered Locations for Master View
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      if (filterCategory !== 'SEMUA' && loc.kategori !== filterCategory) return false;
      if (filterType !== 'SEMUA' && loc.tipeLokasi !== filterType) return false;
      if (filterActiveStatus === 'AKTIF' && !loc.aktif) return false;
      if (filterActiveStatus === 'NONAKTIF' && loc.aktif) return false;

      if (searchLocation.trim()) {
        const q = searchLocation.toLowerCase();
        const matchKode = loc.kodeLokasi?.toLowerCase().includes(q);
        const matchNama = loc.namaLokasi?.toLowerCase().includes(q);
        const matchKat = loc.kategori?.toLowerCase().includes(q);
        if (!matchKode && !matchNama && !matchKat) return false;
      }
      return true;
    });
  }, [locations, filterCategory, filterType, filterActiveStatus, searchLocation]);

  // Grouped Locations by Category for Visual Display
  const groupedLocationsByCategory = useMemo<Record<string, SampleLocation[]>>(() => {
    const groups: Record<string, SampleLocation[]> = {};
    filteredLocations.forEach((loc) => {
      const cat = loc.kategori || 'Lainnya';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(loc);
    });
    return groups;
  }, [filteredLocations]);

  // Filtered Samples for Tab C (Daftar Sampel per Lokasi)
  const filteredSamplesForLocationView = useMemo(() => {
    return samples.filter((s) => {
      // Filter Arranged Status
      const isArranged = Boolean(s.locationId || s.locationCode);
      if (filterSampleArrangedStatus === 'BELUM_DITATA' && isArranged) return false;
      if (filterSampleArrangedStatus === 'SUDAH_DITATA' && !isArranged) return false;

      // Filter by Selected Location
      if (selectedLocationForSampleList !== 'SEMUA') {
        if (selectedLocationForSampleList === '__BELUM_DITATA__') {
          if (isArranged) return false;
        } else {
          if (s.locationId !== selectedLocationForSampleList && s.locationCode !== selectedLocationForSampleList) {
            return false;
          }
        }
      }

      // Search Query
      if (searchSample.trim()) {
        const q = searchSample.toLowerCase();
        const matchName = s.productName?.toLowerCase().includes(q);
        const matchBrand = s.brandName?.toLowerCase().includes(q);
        const matchSeller = s.sellerName?.toLowerCase().includes(q);
        const matchLoc = (s.locationCode || '').toLowerCase().includes(q) || (s.locationName || '').toLowerCase().includes(q);
        const matchPic = (s.employeeName || '').toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchSeller && !matchLoc && !matchPic) return false;
      }

      return true;
    });
  }, [samples, filterSampleArrangedStatus, selectedLocationForSampleList, searchSample]);

  // Printable locations list
  const printableLocations = useMemo(() => {
    return locations.filter((loc) => {
      if (printFilterCategory !== 'SEMUA' && loc.kategori !== printFilterCategory) return false;
      if (printFilterType !== 'SEMUA' && loc.tipeLokasi !== printFilterType) return false;
      return true;
    });
  }, [locations, printFilterCategory, printFilterType]);

  // Handlers for Location Form
  const handleOpenAddLocation = (presetCategory?: string) => {
    setEditingLocation(null);
    setLocationFormData({
      kodeLokasi: '',
      namaLokasi: '',
      kategori: presetCategory || 'Fashion Celana',
      tipeLokasi: 'RAK',
      aktif: true,
      notes: '',
    });
    setErrorMessage(null);
    setIsLocationModalOpen(true);
  };

  const handleOpenEditLocation = (loc: SampleLocation) => {
    setEditingLocation(loc);
    setLocationFormData({
      kodeLokasi: loc.kodeLokasi,
      namaLokasi: loc.namaLokasi,
      kategori: loc.kategori,
      tipeLokasi: loc.tipeLokasi,
      aktif: loc.aktif,
      notes: loc.notes || '',
    });
    setErrorMessage(null);
    setIsLocationModalOpen(true);
  };

  const handleSubmitLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationFormData.kodeLokasi.trim() || !locationFormData.namaLokasi.trim()) {
      setErrorMessage('Kode Lokasi dan Nama Lokasi wajib diisi.');
      return;
    }

    setSubmittingLocation(true);
    setErrorMessage(null);
    const uid = userProfile?.uid || currentUser?.uid || 'system';
    const name = userProfile?.name || currentUser?.displayName || 'User';

    try {
      if (editingLocation?.id) {
        await updateSampleLocation(
          editingLocation.id,
          editingLocation,
          locationFormData,
          uid,
          name
        );
        setToastMessage(`Lokasi "${locationFormData.kodeLokasi}" berhasil diperbarui.`);
      } else {
        await createSampleLocation(
          locationFormData,
          uid,
          name
        );
        setToastMessage(`Lokasi "${locationFormData.kodeLokasi}" berhasil ditambahkan.`);
      }
      setIsLocationModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan data lokasi');
    } finally {
      setSubmittingLocation(false);
    }
  };

  const handleDeleteLocation = async (loc: SampleLocation) => {
    if (!loc.id) return;
    const count = sampleCountByLocationId.get(loc.id) || 0;
    if (count > 0) {
      alert(`Lokasi "${loc.kodeLokasi}" tidak dapat dihapus karena saat ini berisi ${count} sampel produk. Pindahkan sampel terlebih dahulu.`);
      return;
    }

    if (window.confirm(`Hapus master lokasi "${loc.kodeLokasi} — ${loc.namaLokasi}"?`)) {
      const uid = userProfile?.uid || currentUser?.uid || 'system';
      const name = userProfile?.name || currentUser?.displayName || 'User';
      try {
        await deleteSampleLocation(loc.id, loc.namaLokasi, uid, name);
        setToastMessage(`Lokasi "${loc.kodeLokasi}" telah dihapus.`);
      } catch (err: any) {
        alert('Gagal menghapus lokasi: ' + err.message);
      }
    }
  };

  // CSV Import Handlers
  const handleLoadSampleCSVTemplate = () => {
    const template = `kodeLokasi,namaLokasi,kategori,tipeLokasi
CELANA-A,Rak Celana A,Fashion Celana,RAK
CELANA-B,Rak Celana B,Fashion Celana,RAK
CELANA-C,Rak Celana C,Fashion Celana,RAK
BATIK-A,Hanger Batik A,Fashion Batik,HANGER
BATIK-B,Hanger Batik B,Fashion Batik,HANGER
BATIK-C,Hanger Batik C,Fashion Batik,HANGER
KAOS-A,Rak Kaos A,Fashion Kaos,RAK
KAOS-B,Rak Kaos B,Fashion Kaos,RAK
SETELAN-A,Rak Setelan A,Fashion Setelan,RAK
SETELAN-B,Rak Setelan B,Fashion Setelan,RAK`;
    setCsvInput(template);
    setImportResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvInput(text);
      setImportResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleProcessImport = async () => {
    if (!csvInput.trim()) {
      alert('Masukkan atau upload data CSV terlebih dahulu.');
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    const uid = userProfile?.uid || currentUser?.uid || 'system';
    const name = userProfile?.name || currentUser?.displayName || 'User';

    try {
      const res = await importSampleLocationsCSV(csvInput, uid, name);
      setImportResult(res);
      if (res.successCount > 0) {
        setToastMessage(`Import selesai: ${res.successCount} lokasi berhasil diproses.`);
      }
    } catch (err: any) {
      alert('Gagal import CSV: ' + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  // Quick Assign Single Sample Handler
  const handleOpenAssignSample = (sample: AffiliateSample) => {
    setAssigningSample(sample);
    setSelectedTargetLocationId(sample.locationId || '');
  };

  const handleSaveAssignSample = async () => {
    if (!assigningSample?.id) return;
    setSubmittingAssign(true);
    const uid = userProfile?.uid || currentUser?.uid || 'system';
    const name = userProfile?.name || currentUser?.displayName || 'User';

    try {
      let targetLoc: { locationId: string; locationCode: string; locationName: string } | null = null;
      if (selectedTargetLocationId && selectedTargetLocationId !== '__UNASSIGN__') {
        const found = locations.find((l) => l.id === selectedTargetLocationId);
        if (found && found.id) {
          targetLoc = {
            locationId: found.id,
            locationCode: found.kodeLokasi,
            locationName: found.namaLokasi,
          };
        }
      }

      await assignSampleLocation(
        assigningSample.id,
        assigningSample.productName,
        targetLoc,
        uid,
        name
      );

      setToastMessage(
        targetLoc
          ? `Sampel "${assigningSample.productName}" diletakkan di ${targetLoc.locationCode} (${targetLoc.locationName}).`
          : `Lokasi sampel "${assigningSample.productName}" diubah menjadi BELUM DITATA.`
      );
      setAssigningSample(null);
    } catch (err: any) {
      alert('Gagal mengatur lokasi sampel: ' + err.message);
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Batch Assign Handlers
  const handleToggleSelectSample = (sampleId: string) => {
    setSelectedSampleIds((prev) =>
      prev.includes(sampleId) ? prev.filter((id) => id !== sampleId) : [...prev, sampleId]
    );
  };

  const handleSelectAllVisibleSamples = () => {
    const visibleIds = filteredSamplesForLocationView.map((s) => s.id!).filter(Boolean);
    if (selectedSampleIds.length === visibleIds.length) {
      setSelectedSampleIds([]);
    } else {
      setSelectedSampleIds(visibleIds);
    }
  };

  const handleProcessBatchAssign = async () => {
    if (selectedSampleIds.length === 0) return;
    setBatchSubmitting(true);
    const uid = userProfile?.uid || currentUser?.uid || 'system';
    const name = userProfile?.name || currentUser?.displayName || 'User';

    try {
      let targetLoc: { locationId: string; locationCode: string; locationName: string } | null = null;
      if (batchTargetLocationId && batchTargetLocationId !== '__UNASSIGN__') {
        const found = locations.find((l) => l.id === batchTargetLocationId);
        if (found && found.id) {
          targetLoc = {
            locationId: found.id,
            locationCode: found.kodeLokasi,
            locationName: found.namaLokasi,
          };
        }
      }

      for (const sampleId of selectedSampleIds) {
        const s = samples.find((item) => item.id === sampleId);
        if (s) {
          await assignSampleLocation(
            sampleId,
            s.productName,
            targetLoc,
            uid,
            name
          );
        }
      }

      setToastMessage(
        targetLoc
          ? `${selectedSampleIds.length} sampel berhasil dipindahkan ke ${targetLoc.locationCode}.`
          : `${selectedSampleIds.length} sampel diubah menjadi BELUM DITATA.`
      );
      setSelectedSampleIds([]);
      setIsBatchAssignModalOpen(false);
    } catch (err: any) {
      alert('Gagal batch assign lokasi: ' + err.message);
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Print Label Handlers
  const handleToggleSelectPrintLocation = (locId: string) => {
    setSelectedLocationIdsForPrint((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  const handleSelectAllPrintLocations = () => {
    const allIds = printableLocations.map((l) => l.id!).filter(Boolean);
    if (selectedLocationIdsForPrint.length === allIds.length) {
      setSelectedLocationIdsForPrint([]);
    } else {
      setSelectedLocationIdsForPrint(allIds);
    }
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  // Locations to print based on selection
  const selectedLocationsToPrint = useMemo(() => {
    if (selectedLocationIdsForPrint.length === 0) return printableLocations;
    return printableLocations.filter((loc) => selectedLocationIdsForPrint.includes(loc.id!));
  }, [printableLocations, selectedLocationIdsForPrint]);

  // Helper to split kodeLokasi into Prefix & SubCode for big display (e.g. "CELANA-A" -> Category: "CELANA", Code: "A")
  const parseLocationCodeDisplay = (loc: SampleLocation) => {
    const raw = (loc.kodeLokasi || '').trim().toUpperCase();
    const parts = raw.split('-');
    if (parts.length >= 2) {
      return {
        prefix: parts[0],
        suffix: parts.slice(1).join('-'),
        full: raw,
      };
    }
    return {
      prefix: loc.kategori?.toUpperCase().replace('FASHION', '').trim() || raw,
      suffix: raw,
      full: raw,
    };
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xl animate-bounce print:hidden">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Navigation (Hidden in Print) */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3 print:hidden">
        <nav className="flex items-center space-x-1.5 text-xs text-zinc-500 font-medium">
          <button
            onClick={onBackToPortal}
            className="flex items-center gap-1 hover:text-emerald-600 font-bold transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>KANTOR PT.KDRT</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-bold text-zinc-900">PENATAAN LOKASI SAMPEL</span>
        </nav>

        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Kembali ke Portal</span>
          </button>
        )}
      </div>

      {/* Header Banner (Hidden in Print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 border border-indigo-800 px-2.5 py-0.5 rounded-lg">
              Sistem Manajemen Fisik & Rak Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
            <MapPin className="h-8 w-8 text-indigo-400" />
            PENATAAN LOKASI SAMPEL
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Atur dan susun seluruh sampel fashion & produk fisik berdasarkan Kategori Rak atau Hanger (misal: CELANA-A, BATIK-B, KAOS-A), cari posisi sampel fisik dengan cepat, serta cetak label siap laminasi.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenAddLocation()}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-xs font-black shadow-lg transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ TAMBAH LOKASI</span>
            </button>
            <button
              onClick={() => setActiveTab('IMPORT')}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Upload className="h-4 w-4 text-emerald-400" />
              <span>IMPORT CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards (Hidden in Print) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-bold">Total Lokasi</span>
            <MapPin className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-zinc-900">{locations.length}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {locations.filter((l) => l.aktif).length} Aktif
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-bold">Total Rak / Hanger</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-zinc-900">
            {locations.filter((l) => l.tipeLokasi === 'RAK').length} <span className="text-xs font-semibold text-zinc-500">Rak</span> /{' '}
            {locations.filter((l) => l.tipeLokasi === 'HANGER').length} <span className="text-xs font-semibold text-zinc-500">Hanger</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {Object.keys(groupedLocationsByCategory).length} Kategori
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-bold">Sampel Tertata</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {samples.length - unarrangedSamples.length} <span className="text-xs font-medium text-zinc-500">/ {samples.length}</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            {samples.length > 0 ? Math.round(((samples.length - unarrangedSamples.length) / samples.length) * 100) : 0}% terkelola
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedLocationForSampleList('SEMUA');
            setFilterSampleArrangedStatus('BELUM_DITATA');
            setActiveTab('SAMPEL_LOKASI');
          }}
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-2xs cursor-pointer hover:bg-amber-100/80 transition-colors group"
          title="Klik untuk melihat semua sampel yang belum ditata"
        >
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <span>Belum Ditata</span>
              <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-black">LIHAT</span>
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-900">{unarrangedSamples.length}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">
            Klik untuk lihat & atur ke rak
          </div>
        </div>
      </div>

      {/* Main Tab Navigation (Hidden in Print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 print:hidden">
        <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('MASTER')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'MASTER'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>A. MASTER LOKASI ({locations.length})</span>
          </button>

          {canManage && (
            <button
              onClick={() => setActiveTab('IMPORT')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'IMPORT'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Upload className="h-4 w-4" />
              <span>B. IMPORT LOKASI</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('SAMPEL_LOKASI')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'SAMPEL_LOKASI'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>C. DAFTAR SAMPEL PER LOKASI</span>
            {unarrangedSamples.length > 0 && (
              <span className="rounded-full bg-amber-500 text-white px-2 py-0.2 text-[10px] font-black">
                {unarrangedSamples.length} Belum Ditata
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('CETAK_LABEL')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'CETAK_LABEL'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Printer className="h-4 w-4" />
            <span>D. CETAK LABEL LOKASI</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB A: MASTER LOKASI */}
      {/* ========================================================================= */}
      {activeTab === 'MASTER' && (
        <div className="space-y-6 print:hidden">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Cari kode, nama, atau kategori..."
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:bg-white focus:outline-indigo-500"
                />
              </div>

              {/* Filter Kategori */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 focus:bg-white focus:outline-indigo-500"
              >
                <option value="SEMUA">Semua Kategori</option>
                {Array.from(new Set(locations.map((l) => l.kategori))).filter(Boolean).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Filter Tipe */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 focus:bg-white focus:outline-indigo-500"
              >
                <option value="SEMUA">Semua Tipe (Rak / Hanger)</option>
                {LOCATION_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>

              {/* Filter Status Aktif */}
              <select
                value={filterActiveStatus}
                onChange={(e) => setFilterActiveStatus(e.target.value as any)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 focus:bg-white focus:outline-indigo-500"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="AKTIF">Hanya Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {canManage && (
                <button
                  onClick={() => handleOpenAddLocation()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 text-xs font-black shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Lokasi</span>
                </button>
              )}
            </div>
          </div>

          {/* Grouped Category Cards & Location Chips */}
          {Object.keys(groupedLocationsByCategory).length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center text-zinc-400">
              <MapPin className="h-10 w-10 mx-auto text-zinc-300 mb-2" />
              <h3 className="font-bold text-sm text-zinc-700">Belum Ada Lokasi Ditemukan</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                {searchLocation || filterCategory !== 'SEMUA'
                  ? 'Tidak ada lokasi yang cocok dengan filter pencarian.'
                  : 'Mulai dengan menambahkan master lokasi rak/hanger baru atau gunakan fitur Import CSV.'}
              </p>
              {canManage && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => handleOpenAddLocation()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white px-4 py-2 text-xs font-bold hover:bg-indigo-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Buat Lokasi Baru</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('IMPORT')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Import dari CSV</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {(Object.entries(groupedLocationsByCategory) as [string, SampleLocation[]][]).map(([kategori, locList]) => (
                <div
                  key={kategori}
                  className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs border border-indigo-200">
                        {kategori.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="font-black text-sm text-zinc-900">{kategori}</h2>
                        <p className="text-[11px] text-zinc-400">{locList.length} Titik Lokasi Fisik</p>
                      </div>
                    </div>

                    {canManage && (
                      <button
                        onClick={() => handleOpenAddLocation(kategori)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        <span>+ Tambah di Kategori Ini</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {locList.map((loc) => {
                      const count = loc.id ? sampleCountByLocationId.get(loc.id) || 0 : 0;
                      return (
                        <div
                          key={loc.id}
                          className={`rounded-2xl border p-4 transition-all space-y-3 cursor-pointer group ${
                            loc.aktif
                              ? 'border-zinc-200 bg-zinc-50/60 hover:border-indigo-400 hover:bg-white hover:shadow-md'
                              : 'border-zinc-200 bg-zinc-100/60 opacity-60'
                          }`}
                          onClick={() => {
                            setViewingLocationContent(loc);
                            setSearchLocationSample('');
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="inline-block font-black text-base text-zinc-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                                📍 {loc.kodeLokasi}
                              </span>
                              <h3 className="font-semibold text-xs text-zinc-700 truncate mt-0.5">
                                {loc.namaLokasi}
                              </h3>
                            </div>

                            <span
                              className={`rounded-lg px-2 py-0.5 text-[9px] font-black tracking-wide ${
                                loc.tipeLokasi === 'HANGER'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : loc.tipeLokasi === 'RAK'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}
                            >
                              {loc.tipeLokasi}
                            </span>
                          </div>

                          <div
                            className="flex items-center justify-between text-xs pt-2 border-t border-zinc-200/60"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setViewingLocationContent(loc);
                                setSearchLocationSample('');
                              }}
                              className="inline-flex items-center gap-1.5 text-zinc-700 hover:text-indigo-600 font-bold"
                            >
                              <Package className="h-3.5 w-3.5 text-zinc-400" />
                              <span>{count} Sampel</span>
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setViewingLocationContent(loc);
                                  setSearchLocationSample('');
                                }}
                                title="Lihat Daftar Isi Rak / Hanger"
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Daftar Isi</span>
                              </button>

                              {canManage && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditLocation(loc)}
                                    title="Edit master lokasi"
                                    className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLocation(loc)}
                                    title="Hapus master lokasi"
                                    className="rounded-lg p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB B: IMPORT LOKASI (CSV) */}
      {/* ========================================================================= */}
      {activeTab === 'IMPORT' && canManage && (
        <div className="space-y-6 print:hidden">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-5 max-w-4xl mx-auto">
            <div className="border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-emerald-600" />
                <h2 className="font-black text-base text-zinc-900">Import Master Lokasi via CSV</h2>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Gunakan format CSV sederhana untuk menambah atau memperbarui banyak lokasi fisik sekaligus secara instan dan aman (tanpa menghapus data lama).
              </p>
            </div>

            {/* Instruction & Example */}
            <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950">Format Kolom CSV:</span>
                <button
                  type="button"
                  onClick={handleLoadSampleCSVTemplate}
                  className="rounded-lg bg-indigo-600 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-indigo-500 transition-colors"
                >
                  Gunakan Contoh Template
                </button>
              </div>
              <code className="block bg-white p-2.5 rounded-xl border border-indigo-200 text-indigo-800 font-mono text-[11px]">
                kodeLokasi,namaLokasi,kategori,tipeLokasi
              </code>
              <p className="text-[11px] text-indigo-700">
                Kolom <strong>tipeLokasi</strong> dapat diisi: <code>RAK</code>, <code>HANGER</code>, <code>KOTAK</code>, <code>LEMARI</code>, atau <code>LAINNYA</code>.
              </p>
            </div>

            {/* Textarea & File Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-xs text-zinc-700">
                  Data CSV (Tempel / Paste teks CSV di sini):
                </label>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Upload Berkas .CSV</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={10}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="Contoh:&#10;CELANA-A,Rak Celana A,Fashion Celana,RAK&#10;BATIK-A,Hanger Batik A,Fashion Batik,HANGER&#10;KAOS-A,Rak Kaos A,Fashion Kaos,RAK"
                className="w-full rounded-2xl border border-zinc-300 p-3 font-mono text-xs text-zinc-800 placeholder-zinc-400 focus:outline-indigo-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setCsvInput('');
                  setImportResult(null);
                }}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Reset
              </button>

              <button
                type="button"
                disabled={importLoading || !csvInput.trim()}
                onClick={handleProcessImport}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
              >
                {importLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>MEMPROSES IMPORT...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>PROSES & SIMPAN IMPORT LOKASI</span>
                  </>
                )}
              </button>
            </div>

            {/* Import Result Feedback */}
            {importResult && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                <h4 className="font-bold text-xs text-zinc-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Hasil Ringkasan Import:</span>
                </h4>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg">
                    Berhasil: {importResult.successCount}
                  </span>
                  <span className={`px-3 py-1 rounded-lg ${importResult.failedCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-zinc-200 text-zinc-600'}`}>
                    Gagal / Lewat: {importResult.failedCount}
                  </span>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="font-bold text-[11px] text-rose-800">Daftar Baris yang Gagal:</span>
                    <div className="max-h-40 overflow-y-auto rounded-xl bg-white border border-rose-200 p-2 space-y-1 text-[11px]">
                      {importResult.errors.map((err, idx) => (
                        <div key={idx} className="text-rose-700 flex items-start gap-2">
                          <span className="font-mono font-bold">Baris {err.row} ({err.kode}):</span>
                          <span>{err.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB C: DAFTAR SAMPEL PER LOKASI */}
      {/* ========================================================================= */}
      {activeTab === 'SAMPEL_LOKASI' && (
        <div className="space-y-6 print:hidden">
          {/* Top Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Cari nama sampel, brand, PIC, lokasi..."
                  value={searchSample}
                  onChange={(e) => setSearchSample(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:bg-white focus:outline-indigo-500"
                />
              </div>

              {/* Filter Lokasi Tertentu */}
              <select
                value={selectedLocationForSampleList}
                onChange={(e) => setSelectedLocationForSampleList(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-800 focus:bg-white focus:outline-indigo-500"
              >
                <option value="SEMUA">Semua Lokasi Fisik</option>
                <option value="__BELUM_DITATA__">📍 BELUM DITATA ({unarrangedSamples.length})</option>
                <optgroup label="Daftar Rak / Hanger">
                  {locations.map((loc) => {
                    const c = loc.id ? sampleCountByLocationId.get(loc.id) || 0 : 0;
                    return (
                      <option key={loc.id} value={loc.id}>
                        {loc.kodeLokasi} — {loc.namaLokasi} ({c} sampel)
                      </option>
                    );
                  })}
                </optgroup>
              </select>

              {/* Status Penataan */}
              <select
                value={filterSampleArrangedStatus}
                onChange={(e) => setFilterSampleArrangedStatus(e.target.value as any)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 focus:bg-white focus:outline-indigo-500"
              >
                <option value="SEMUA">Semua Status Penataan</option>
                <option value="BELUM_DITATA">Hanya Belum Ditata ({unarrangedSamples.length})</option>
                <option value="SUDAH_DITATA">Hanya yang Sudah Ditata</option>
              </select>
            </div>

            {/* Batch Assign Bar */}
            {canManage && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllVisibleSamples}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
                >
                  {selectedSampleIds.length === filteredSamplesForLocationView.length && selectedSampleIds.length > 0
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua'}
                </button>

                {selectedSampleIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchTargetLocationId('');
                      setIsBatchAssignModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 text-xs font-black shadow-sm transition-colors cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Pindahkan ({selectedSampleIds.length}) Sampel</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sample Cards Grid */}
          {filteredSamplesForLocationView.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center text-zinc-400">
              <Package className="h-10 w-10 mx-auto text-zinc-300 mb-2" />
              <h3 className="font-bold text-sm text-zinc-700">Tidak Ada Sampel Ditemukan</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Silakan sesuaikan filter lokasi atau pencarian nama produk sampel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSamplesForLocationView.map((sample) => {
                const isSelected = sample.id ? selectedSampleIds.includes(sample.id) : false;
                const hasLocation = Boolean(sample.locationCode || sample.locationId);

                return (
                  <div
                    key={sample.id}
                    className={`rounded-3xl border p-4 shadow-2xs transition-all space-y-3 relative ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500'
                        : hasLocation
                        ? 'border-zinc-200 bg-white hover:border-indigo-300'
                        : 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
                    }`}
                  >
                    {/* Checkbox for batch select */}
                    {canManage && (
                      <div className="absolute top-3 right-3 z-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => sample.id && handleToggleSelectSample(sample.id)}
                          className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                    )}

                    {/* Top Row: Photo & Title */}
                    <div className="flex items-start gap-3 pr-6">
                      {sample.sampleImage || sample.productImage ? (
                        <img
                          src={sample.sampleImage || sample.productImage}
                          alt={sample.productName}
                          className="h-14 w-14 rounded-2xl object-cover border border-zinc-200 shrink-0"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 shrink-0 font-bold text-xs">
                          <Package className="h-6 w-6" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-zinc-900 truncate">
                          {sample.productName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5">
                          {sample.brandName && (
                            <span className="font-medium text-zinc-700">Brand: {sample.brandName}</span>
                          )}
                          <span>•</span>
                          <span>PIC: {sample.employeeName || '-'}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Tgl: {formatTanggal(sample.purchaseDate)}
                        </div>
                      </div>
                    </div>

                    {/* Badge Lokasi Fisik */}
                    <div className="rounded-2xl bg-zinc-50 p-3 border border-zinc-200/70 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                          Posisi Rak / Hanger:
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                            sample.status === 'DIPESAN'
                              ? 'bg-blue-100 text-blue-800'
                              : sample.status === 'DIKIRIM'
                              ? 'bg-amber-100 text-amber-800'
                              : sample.status === 'DITERIMA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sample.status === 'DIGUNAKAN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          {sample.status}
                        </span>
                      </div>

                      {hasLocation ? (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="rounded-lg bg-indigo-100 border border-indigo-200 px-2 py-0.5 font-black text-xs text-indigo-900">
                            📍 {sample.locationCode}
                          </span>
                          <span className="text-xs font-semibold text-zinc-700 truncate">
                            {sample.locationName || ''}
                          </span>
                        </div>
                      ) : (
                        <div className="pt-0.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 border border-amber-200 px-2 py-0.5 font-black text-xs text-amber-900 animate-pulse">
                            📍 BELUM DITATA
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Row */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[11px] font-bold text-zinc-500">
                        Target: {sample.completedContent || 0}/{sample.targetContent || 3} VT
                      </span>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleOpenAssignSample(sample)}
                          className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition-colors"
                        >
                          <MapPin className="h-3 w-3" />
                          <span>{hasLocation ? 'Pindah Lokasi' : 'Tentukan Lokasi'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB D: CETAK LABEL LOKASI (Print Layout) */}
      {/* ========================================================================= */}
      {activeTab === 'CETAK_LABEL' && (
        <div className="space-y-6">
          {/* Controls Bar (Hidden in Print) */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4 print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <h2 className="font-black text-base text-zinc-900 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-indigo-600" />
                  <span>Cetak Label Rak & Hanger Lokasi</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Label format besar, tajam dan kontras tinggi. Siap dicetak di kertas A4 untuk dipotong dan dilaminasi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>CETAK SEKARANG (PRINT / PDF)</span>
                </button>
              </div>
            </div>

            {/* Filter & Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={printFilterCategory}
                  onChange={(e) => setPrintFilterCategory(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-bold text-zinc-800"
                >
                  <option value="SEMUA">Semua Kategori</option>
                  {Array.from(new Set(locations.map((l) => l.kategori))).filter(Boolean).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  value={printFilterType}
                  onChange={(e) => setPrintFilterType(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-bold text-zinc-800"
                >
                  <option value="SEMUA">Semua Tipe</option>
                  {LOCATION_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleSelectAllPrintLocations}
                  className="rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 font-bold text-zinc-700"
                >
                  {selectedLocationIdsForPrint.length === printableLocations.length && selectedLocationIdsForPrint.length > 0
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua'}
                </button>
              </div>

              <span className="font-semibold text-zinc-500">
                Menampilkan: <strong>{selectedLocationsToPrint.length} Label</strong> siap cetak
              </span>
            </div>

            {/* Selection Chips */}
            <div className="flex flex-wrap gap-1.5 pt-2 max-h-32 overflow-y-auto">
              {printableLocations.map((loc) => {
                const isChecked = selectedLocationIdsForPrint.includes(loc.id!);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleToggleSelectPrintLocation(loc.id!)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isChecked
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                    <span>{loc.kodeLokasi}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Printable Label Cards Container */}
          {/* Printable CSS Grid: 2 columns per A4 page, with clean border dashed lines */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider print:hidden">
              Pratinjau Hasil Cetak Label (Ukuran Besar & Jelas):
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:p-0">
              {selectedLocationsToPrint.map((loc) => {
                const parsed = parseLocationCodeDisplay(loc);

                return (
                  <div
                    key={loc.id}
                    className="rounded-3xl border-4 border-dashed border-zinc-900 bg-white p-8 sm:p-10 flex flex-col items-center justify-between text-center min-h-[280px] shadow-sm print:shadow-none print:rounded-2xl print:border-3 print:border-black print:min-h-[260px] print:break-inside-avoid"
                  >
                    {/* Header: Category / Prefix */}
                    <div className="w-full border-b-2 border-zinc-300 pb-3 print:border-black">
                      <span className="text-sm sm:text-base font-black tracking-widest text-zinc-600 uppercase print:text-black">
                        {parsed.prefix}
                      </span>
                    </div>

                    {/* Center Huge Index / Code */}
                    <div className="my-auto py-4">
                      <div className="text-5xl sm:text-6xl font-black text-zinc-950 tracking-tight font-mono print:text-black">
                        {parsed.suffix}
                      </div>
                      <div className="text-xs font-extrabold tracking-wider text-zinc-400 uppercase mt-1 print:text-black">
                        {loc.kodeLokasi}
                      </div>
                    </div>

                    {/* Footer: Full Location Name */}
                    <div className="w-full border-t-2 border-zinc-300 pt-3 print:border-black">
                      <div className="text-base sm:text-lg font-black text-zinc-900 uppercase tracking-wide print:text-black">
                        {loc.namaLokasi}
                      </div>
                      <div className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mt-0.5 print:text-black">
                        PT. KDRT AFFILIATE STUDIO • {loc.tipeLokasi}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT MASTER LOKASI */}
      {/* ========================================================================= */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:hidden">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-600" />
                <span>{editingLocation ? 'Edit Master Lokasi' : 'Tambah Master Lokasi Baru'}</span>
              </h3>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmitLocation} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">
                  Kode Lokasi * (Harus Unik)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: CELANA-A, BATIK-B, KAOS-A"
                  value={locationFormData.kodeLokasi}
                  onChange={(e) =>
                    setLocationFormData({
                      ...locationFormData,
                      kodeLokasi: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-mono font-black text-sm uppercase focus:outline-indigo-500"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  Gunakan format singkatan jelas agar mudah dicari oleh talent (misal: <code>CELANA-A</code>).
                </p>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">
                  Nama Lokasi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rak Celana A, Hanger Batik B"
                  value={locationFormData.namaLokasi}
                  onChange={(e) =>
                    setLocationFormData({
                      ...locationFormData,
                      namaLokasi: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-sm focus:outline-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Kategori *
                  </label>
                  <select
                    value={locationFormData.kategori}
                    onChange={(e) =>
                      setLocationFormData({
                        ...locationFormData,
                        kategori: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold focus:outline-indigo-500"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Tipe Lokasi *
                  </label>
                  <select
                    value={locationFormData.tipeLokasi}
                    onChange={(e) =>
                      setLocationFormData({
                        ...locationFormData,
                        tipeLokasi: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold focus:outline-indigo-500"
                  >
                    {LOCATION_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">
                  Catatan / Lokasi Ruangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Studio Live 1, Rak paling atas dekat pintu"
                  value={locationFormData.notes}
                  onChange={(e) =>
                    setLocationFormData({
                      ...locationFormData,
                      notes: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-zinc-300 p-2.5 focus:outline-indigo-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-800">
                  <input
                    type="checkbox"
                    checked={locationFormData.aktif}
                    onChange={(e) =>
                      setLocationFormData({
                        ...locationFormData,
                        aktif: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Lokasi Aktif & Siap Digunakan</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingLocation}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submittingLocation ? 'MENYIMPAN...' : 'SIMPAN LOKASI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUICK ASSIGN SINGLE SAMPLE */}
      {/* ========================================================================= */}
      {assigningSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:hidden">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-600" />
                <span>Atur Lokasi Fisik Sampel</span>
              </h3>
              <button
                onClick={() => setAssigningSample(null)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 flex items-center gap-3">
              {assigningSample.sampleImage || assigningSample.productImage ? (
                <img
                  src={assigningSample.sampleImage || assigningSample.productImage}
                  alt={assigningSample.productName}
                  className="h-12 w-12 rounded-xl object-cover border border-zinc-200"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500 font-bold text-xs">
                  <Package className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-zinc-900 truncate">
                  {assigningSample.productName}
                </h4>
                <p className="text-[11px] text-zinc-500">
                  PIC: {assigningSample.employeeName || '-'}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Lokasi saat ini:{' '}
                  <strong className="text-indigo-700 font-bold">
                    {assigningSample.locationCode
                      ? `${assigningSample.locationCode} (${assigningSample.locationName || ''})`
                      : 'BELUM DITATA'}
                  </strong>
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-zinc-700">
                Pilih Rak / Hanger dari Master Lokasi:
              </label>

              <select
                value={selectedTargetLocationId}
                onChange={(e) => setSelectedTargetLocationId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-3 font-bold text-sm text-zinc-900 focus:outline-indigo-500"
              >
                <option value="__UNASSIGN__">-- KEMBALIKAN KE (BELUM DITATA) --</option>
                {(Object.entries(groupedLocationsByCategory) as [string, SampleLocation[]][]).map(([cat, locs]) => (
                  <optgroup key={cat} label={cat}>
                    {locs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.kodeLokasi} — {l.namaLokasi} ({l.tipeLokasi})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setAssigningSample(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 font-bold text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submittingAssign}
                onClick={handleSaveAssignSample}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
              >
                {submittingAssign ? 'MENYIMPAN...' : 'SIMPAN LOKASI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATCH ASSIGN MULTIPLE SAMPLES */}
      {/* ========================================================================= */}
      {isBatchAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:hidden">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-600" />
                <span>Pindahkan {selectedSampleIds.length} Sampel Sekaligus</span>
              </h3>
              <button
                onClick={() => setIsBatchAssignModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Seluruh <strong>{selectedSampleIds.length} sampel</strong> yang dipilih akan ditempatkan ke lokasi rak/hanger yang Anda pilih berikut.
            </p>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-zinc-700">
                Pilih Lokasi Tujuan:
              </label>

              <select
                value={batchTargetLocationId}
                onChange={(e) => setBatchTargetLocationId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-3 font-bold text-sm text-zinc-900 focus:outline-indigo-500"
              >
                <option value="">-- Pilih Lokasi Tujuan --</option>
                <option value="__UNASSIGN__">-- UBAH JADI (BELUM DITATA) --</option>
                {(Object.entries(groupedLocationsByCategory) as [string, SampleLocation[]][]).map(([cat, locs]) => (
                  <optgroup key={cat} label={cat}>
                    {locs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.kodeLokasi} — {l.namaLokasi} ({l.tipeLokasi})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsBatchAssignModalOpen(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 font-bold text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={batchSubmitting || !batchTargetLocationId}
                onClick={handleProcessBatchAssign}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
              >
                {batchSubmitting ? 'MEMINDAHKAN...' : 'PINDAHKAN SEMUA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL & PRINT VIEW: DAFTAR ISI RAK / HANGER */}
      {/* ========================================================================= */}
      {viewingLocationContent && (
        <>
          {/* Modal Overlay (Hidden during print) */}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:hidden">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white text-zinc-900 shadow-2xl border border-zinc-200 overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-zinc-900 via-slate-900 to-zinc-900 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-md">
                      DAFTAR ISI RAK / HANGER
                    </span>
                    <span className="text-[10px] font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded-md">
                      {viewingLocationContent.kategori}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded-md">
                      {viewingLocationContent.tipeLokasi}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                    <MapPin className="h-6 w-6 text-indigo-400" />
                    <span>{viewingLocationContent.namaLokasi}</span>
                    <span className="font-mono text-indigo-300 text-base">({viewingLocationContent.kodeLokasi})</span>
                  </h2>
                  {viewingLocationContent.notes && (
                    <p className="text-xs text-zinc-400 mt-0.5">{viewingLocationContent.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-xs font-black shadow-md cursor-pointer transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                    <span>🖨️ CETAK DAFTAR ISI (A4)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingLocationContent(null)}
                    className="rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2.5 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Cari dalam lokasi ini (Nama Produk, Brand, Seller)..."
                    value={searchLocationSample}
                    onChange={(e) => setSearchLocationSample(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2 text-xs font-medium text-zinc-800 focus:outline-indigo-500 shadow-2xs"
                  />
                  {searchLocationSample && (
                    <button
                      onClick={() => setSearchLocationSample('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs font-bold text-zinc-600 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-indigo-600" />
                  <span>
                    Total: <strong>{samplesInViewingLoc.length} Sampel</strong>
                  </span>
                </div>
              </div>

              {/* Sample Content List */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
                {samplesInViewingLoc.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 space-y-2">
                    <Package className="h-10 w-10 mx-auto text-zinc-300" />
                    <p className="font-bold text-sm text-zinc-600">
                      {searchLocationSample
                        ? 'Tidak ada sampel yang cocok dengan pencarian di lokasi ini.'
                        : 'Belum ada sampel yang diletakkan di rak/hanger ini.'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Gunakan menu <strong>Daftar Sampel per Lokasi</strong> untuk menambahkan sampel ke rak ini.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {samplesInViewingLoc.map((sample, idx) => (
                      <div
                        key={sample.id || idx}
                        className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-2xs flex items-start gap-3 hover:border-indigo-300 transition-colors"
                      >
                        {sample.sampleImage || sample.productImage ? (
                          <img
                            src={sample.sampleImage || sample.productImage}
                            alt={sample.productName}
                            className="h-16 w-16 rounded-xl object-cover border border-zinc-200 shrink-0"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 shrink-0">
                            <Package className="h-6 w-6" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="font-black text-xs text-zinc-900 line-clamp-2">
                            {sample.productName}
                          </h4>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-zinc-600">
                            <div>
                              <span className="text-zinc-400">Brand: </span>
                              <strong className="text-zinc-800">{sample.brandName || '-'}</strong>
                            </div>
                            <div>
                              <span className="text-zinc-400">Seller: </span>
                              <strong className="text-zinc-800">{sample.sellerName || '-'}</strong>
                            </div>
                            <div>
                              <span className="text-zinc-400">Kategori: </span>
                              <span>{sample.category || '-'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400">Status: </span>
                              <span className="font-bold text-indigo-700">{sample.status || 'DITERIMA'}</span>
                            </div>
                          </div>

                          <div className="pt-1 flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-100 mt-1">
                            <span>
                              Progres VT: <strong>{sample.completedContent || 0}/{sample.targetContent || 1}</strong>
                            </span>
                            <span className="font-mono font-bold text-indigo-600">
                              {sample.locationCode || viewingLocationContent.kodeLokasi}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  Lokasi hanya menunjukkan titik fisik penyimpanan sampel.
                </span>
                <button
                  type="button"
                  onClick={() => setViewingLocationContent(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>

          {/* Dedicated A4 Printable Document Container (Only visible during print) */}
          <div className="hidden print:block print:p-6 print:bg-white print:text-black">
            <div className="border-b-2 border-black pb-4 mb-4 text-center">
              <h1 className="text-xl font-black uppercase tracking-wider">PT. KARYA DIGITAL RAKYAT TERPADU (PT. KDRT)</h1>
              <h2 className="text-base font-bold text-zinc-700">DAFTAR ISI RAK / HANGER LOKASI FISIK SAMPEL</h2>
            </div>

            <div className="border-2 border-black rounded-xl p-4 mb-4 flex items-center justify-between bg-zinc-50">
              <div>
                <div className="text-2xl font-black tracking-tight">{viewingLocationContent.namaLokasi}</div>
                <div className="text-sm font-mono font-bold text-zinc-600 mt-0.5">
                  Kode Lokasi: {viewingLocationContent.kodeLokasi}
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  Kategori: <strong>{viewingLocationContent.kategori}</strong> | Tipe:{' '}
                  <strong>{viewingLocationContent.tipeLokasi}</strong>
                  {viewingLocationContent.notes && ` | Catatan: ${viewingLocationContent.notes}`}
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-black">{samplesInViewingLoc.length} SAMPEL</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Dicetak: {formatTanggalWaktu(new Date())}
                </div>
              </div>
            </div>

            {/* Print Table */}
            <table className="w-full text-left text-xs border-collapse border border-black">
              <thead>
                <tr className="bg-zinc-200 border-b border-black">
                  <th className="border border-black p-2 text-center w-10">No</th>
                  <th className="border border-black p-2">Nama Produk</th>
                  <th className="border border-black p-2 w-32">Brand</th>
                  <th className="border border-black p-2 w-32">Seller</th>
                  <th className="border border-black p-2 w-28">Kategori</th>
                  <th className="border border-black p-2 text-center w-24">Progres VT</th>
                </tr>
              </thead>
              <tbody>
                {samplesInViewingLoc.map((sample, idx) => (
                  <tr key={sample.id || idx} className="border-b border-zinc-400 break-inside-avoid">
                    <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                    <td className="border border-black p-2 font-bold">{sample.productName}</td>
                    <td className="border border-black p-2">{sample.brandName || '-'}</td>
                    <td className="border border-black p-2">{sample.sellerName || '-'}</td>
                    <td className="border border-black p-2">{sample.category || '-'}</td>
                    <td className="border border-black p-2 text-center font-mono font-bold">
                      {sample.completedContent || 0}/{sample.targetContent || 1} VT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-300 pt-2">
              <span>Sistem Manajemen Lokasi Fisik Sampel PT. KDRT</span>
              <span>Halaman 1</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
