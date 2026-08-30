import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RotateCcw,
  Layers,
  ArrowRight,
  Database,
  Search,
  Filter,
  Check,
  ChevronDown,
  Info,
  DollarSign,
  User,
  ShoppingBag,
  ExternalLink,
  Sparkles,
  History,
  FileCheck,
} from 'lucide-react';
import {
  AffiliateSample,
  SpreadsheetSampleRow,
  ImportRowValidationStatus,
  DuplicateAction,
  SampleImportLog,
  ScopeType,
  SampleStatus,
  Account,
  Employee,
} from '../../types';
import {
  parseSpreadsheetBuffer,
  generateSampleImportTemplate,
  executeSpreadsheetImport,
  subscribeSampleImportLogs,
  ParsedWorksheetResult,
} from '../../services/sampleImportService';
import { formatRupiah, formatTanggal, tanggalHariIni } from '../../utils/formatters';

interface ImportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSamples: AffiliateSample[];
  accounts: Account[];
  employees: Employee[];
  currentUserId: string;
  currentUserName: string;
  defaultScope: ScopeType;
  canChooseScope: boolean;
  onImportSuccess?: (result: { batchId: string; successCount: number }) => void;
}

type ModalStep = 'UPLOAD' | 'PREVIEW' | 'IMPORTING' | 'REPORT';

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  existingSamples,
  accounts,
  employees,
  currentUserId,
  currentUserName,
  defaultScope,
  canChooseScope,
  onImportSuccess,
}) => {
  // Navigation & Step
  const [step, setStep] = useState<ModalStep>('UPLOAD');
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'HISTORY'>('IMPORT');

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [parseResult, setParseResult] = useState<ParsedWorksheetResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Configuration defaults
  const [targetScope, setTargetScope] = useState<ScopeType>(canChooseScope ? defaultScope : 'SHARING');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [sampleStatus, setSampleStatus] = useState<SampleStatus>('DITERIMA');
  const [autoCreateExpense, setAutoCreateExpense] = useState<boolean>(true);
  const [autoCreateTask, setAutoCreateTask] = useState<boolean>(true);

  // Filter in preview
  const [previewFilter, setPreviewFilter] = useState<'ALL' | ImportRowValidationStatus>('ALL');
  const [previewSearch, setPreviewSearch] = useState<string>('');

  // Execution & Progress state
  const [importProgress, setImportProgress] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  const [executionReport, setExecutionReport] = useState<{
    batchId: string;
    total: number;
    successCount: number;
    duplicateSkippedCount: number;
    duplicateUpdatedCount: number;
    errorCount: number;
    errors: Array<{ rowNumber: number; orderNumber: string; productName: string; message: string }>;
  } | null>(null);

  // Import Logs History
  const [importLogs, setImportLogs] = useState<SampleImportLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to import history
  useEffect(() => {
    if (isOpen) {
      setLoadingLogs(true);
      const unsub = subscribeSampleImportLogs((logs) => {
        setImportLogs(logs);
        setLoadingLogs(false);
      });
      return () => unsub();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);
    try {
      const buffer = await file.arrayBuffer();
      setFileBuffer(buffer);
      const result = await parseSpreadsheetBuffer(buffer, existingSamples);
      setParseResult(result);
      setSelectedSheet(result.sheetName);
      setStep('PREVIEW');
    } catch (err: any) {
      console.error('Error parsing spreadsheet:', err);
      setParseError(err.message || 'Gagal membaca file spreadsheet. Pastikan format .xlsx valid.');
    } finally {
      setIsParsing(false);
    }
  };

  // Change worksheet if multi-sheet
  const handleSheetChange = async (sheetName: string) => {
    if (!fileBuffer) return;
    setIsParsing(true);
    try {
      const result = await parseSpreadsheetBuffer(fileBuffer, existingSamples, sheetName);
      setParseResult(result);
      setSelectedSheet(sheetName);
    } catch (err: any) {
      setParseError(err.message || 'Gagal membaca worksheet.');
    } finally {
      setIsParsing(false);
    }
  };

  // Load Test Data Example (data_sampel_zovee_no1.xlsx simulator)
  const handleLoadSampleTestData = () => {
    const blob = generateSampleImportTemplate();
    const testFile = new File([blob], 'data_sampel_zovee_no1.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    processFile(testFile);
  };

  // Download Official Template
  const handleDownloadTemplate = () => {
    const blob = generateSampleImportTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Import_Sampel_PT_KDRT_V2.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Update duplicate action for a specific row
  const handleSetRowDuplicateAction = (rowIdx: number, action: DuplicateAction) => {
    if (!parseResult) return;
    const updatedRows = [...parseResult.rows];
    updatedRows[rowIdx] = {
      ...updatedRows[rowIdx],
      duplicateAction: action,
    };
    setParseResult({
      ...parseResult,
      rows: updatedRows,
    });
  };

  // Bulk set duplicate action
  const handleBulkSetDuplicateAction = (action: DuplicateAction) => {
    if (!parseResult) return;
    const updatedRows = parseResult.rows.map((row) => {
      if (row.status === 'DUPLICATE') {
        return { ...row, duplicateAction: action };
      }
      return row;
    });
    setParseResult({
      ...parseResult,
      rows: updatedRows,
    });
  };

  // Filtered rows for preview
  const filteredRows = (parseResult?.rows || []).filter((row) => {
    if (previewFilter !== 'ALL' && row.status !== previewFilter) return false;
    if (previewSearch) {
      const q = previewSearch.toLowerCase();
      return (
        row.productName.toLowerCase().includes(q) ||
        row.sellerName.toLowerCase().includes(q) ||
        row.orderNumber.toLowerCase().includes(q) ||
        row.color.toLowerCase().includes(q) ||
        row.size.toLowerCase().includes(q) ||
        row.paymentMethod.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate executable count
  const executableRows = (parseResult?.rows || []).filter((row) => {
    if (row.status === 'ERROR') return false;
    if (row.status === 'DUPLICATE' && row.duplicateAction === 'SKIP') return false;
    return true;
  });

  // Execute Import
  const handleExecuteImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) return;

    setStep('IMPORTING');
    setImportProgress(0);
    setProgressText('Menyiapkan data import...');

    const selAcc = accounts.find((a) => a.id === selectedAccountId);
    const selEmp = employees.find((e) => e.employeeId === selectedEmployeeId || e.id === selectedEmployeeId);

    try {
      const report = await executeSpreadsheetImport({
        rows: parseResult.rows,
        fileName: selectedFile?.name || 'spreadsheet_import.xlsx',
        scope: targetScope,
        accountId: selectedAccountId,
        accountName: selAcc?.accountName || '',
        employeeId: selectedEmployeeId,
        employeeName: selEmp?.name || '',
        statusSampel: sampleStatus,
        autoCreateExpense,
        autoCreateTask,
        currentUserId,
        currentUserName,
        onProgress: (pct, msg) => {
          setImportProgress(pct);
          setProgressText(msg);
        },
      });

      setExecutionReport(report);
      setStep('REPORT');
      if (onImportSuccess) {
        onImportSuccess({ batchId: report.batchId, successCount: report.successCount });
      }
    } catch (err: any) {
      console.error('Fatal import error:', err);
      alert('Terjadi kesalahan saat memproses import: ' + err.message);
      setStep('PREVIEW');
    }
  };

  // Reset to Upload Step
  const handleReset = () => {
    setSelectedFile(null);
    setFileBuffer(null);
    setParseResult(null);
    setParseError(null);
    setExecutionReport(null);
    setImportProgress(0);
    setStep('UPLOAD');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ================= MODAL HEADER ================= */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-zinc-900 via-slate-900 to-zinc-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-md">
                  V2 Database Sampel
                </span>
                {step === 'PREVIEW' && (
                  <span className="text-[10px] font-bold text-zinc-400">
                    File: <b className="text-zinc-200">{selectedFile?.name}</b>
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                IMPORT DATA SPREADSHEET (EXCEL)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch between Import & History */}
            <div className="hidden sm:flex items-center bg-zinc-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('IMPORT')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === 'IMPORT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import File</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === 'HISTORY' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>Riwayat Batch</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ================= MODAL BODY ================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-zinc-50/50">
          {activeTab === 'HISTORY' ? (
            /* ================= RIWAYAT IMPORT LOGS ================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                    Riwayat Log Batch Import Spreadsheet
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Daftar seluruh file spreadsheet sampel yang pernah diimport ke sistem.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('IMPORT')}
                  className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-500"
                >
                  + Import File Baru
                </button>
              </div>

              {loadingLogs ? (
                <div className="flex items-center justify-center p-12 text-zinc-400 text-xs">
                  Memuat riwayat import...
                </div>
              ) : importLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-xs text-zinc-400">
                  Belum ada riwayat import spreadsheet.
                </div>
              ) : (
                <div className="space-y-3">
                  {importLogs.map((log) => (
                    <div
                      key={log.id || log.batchId}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-2 hover:border-zinc-300 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-zinc-900 bg-zinc-100 px-2 py-1 rounded-md">
                            {log.batchId}
                          </span>
                          <span className="text-xs font-bold text-zinc-700">{log.fileName}</span>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                            log.status === 'SELESAI'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.status === 'SEBAGIAN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-zinc-50 p-2 rounded-xl">
                          <span className="text-[10px] text-zinc-400 block font-bold">TOTAL BARIS</span>
                          <span className="font-black text-zinc-900">{log.totalRows} Baris</span>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-xl">
                          <span className="text-[10px] text-emerald-600 block font-bold">BERHASIL</span>
                          <span className="font-black text-emerald-800">{log.successCount} Sampel</span>
                        </div>
                        <div className="bg-amber-50 p-2 rounded-xl">
                          <span className="text-[10px] text-amber-600 block font-bold">DUPLIKAT</span>
                          <span className="font-black text-amber-800">{log.duplicateCount} Baris</span>
                        </div>
                        <div className="bg-rose-50 p-2 rounded-xl">
                          <span className="text-[10px] text-rose-600 block font-bold">GAGAL / ERROR</span>
                          <span className="font-black text-rose-800">{log.errorCount} Baris</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                        <span>Diimpor oleh: <b className="text-zinc-600">{log.importedByName || 'User'}</b></span>
                        <span>{formatTanggal(log.importedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : step === 'UPLOAD' ? (
            /* ================= STEP 1: UPLOAD ZONE ================= */
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Info Card */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-950">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Sistem Cerdas Pembaca Spreadsheet Sampel PT KDRT V2</span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  Sistem membaca header secara otomatis (Seller, Nama Produk, Warna, Ukuran, Harga Produk, Ongkir, Diskon, Total Bayar, No Pesanan, Metode Pembayaran) dan memvalidasi kalkulasi secara instan.
                </p>
              </div>

              {/* Drag & Drop Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group cursor-pointer rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center transition-all bg-white hover:bg-emerald-50/30 ${
                  isParsing ? 'border-emerald-400 bg-emerald-50/40' : 'border-zinc-300 hover:border-emerald-500'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8" />
                </div>

                <div className="mt-4 space-y-1">
                  <p className="text-base font-black text-zinc-900">
                    {isParsing ? 'Membaca data spreadsheet...' : 'Pilih atau Tarik File Excel (.xlsx / .csv)'}
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Mendukung file spreadsheet pembelian sampel TikTok / Shopee / Tokopedia (.xlsx / .xls).
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <span className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    📁 Jelajahi File
                  </span>
                </div>
              </div>

              {/* Template & Quick Test Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-all"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span>Download Format Template Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleTestData}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:opacity-95 shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Uji Coba dengan Data Contoh (data_sampel_zovee_no1.xlsx)</span>
                </button>
              </div>

              {parseError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Gagal Membaca File:</span>
                    <span>{parseError}</span>
                  </div>
                </div>
              )}
            </div>
          ) : step === 'PREVIEW' ? (
            /* ================= STEP 2: PREVIEW & VALIDATION TABLE ================= */
            <div className="space-y-5">
              {/* Configuration Defaults Bar */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <span className="text-xs font-black uppercase text-zinc-800 tracking-tight flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-emerald-600" />
                    Pengaturan Default Target Simpan
                  </span>
                  {parseResult && parseResult.allSheetNames.length > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500 font-semibold">Pilih Sheet:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 font-bold text-zinc-800 text-xs"
                      >
                        {parseResult.allSheetNames.map((name) => (
                          <option key={name} value={name}>
                            📄 {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {/* Scope */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Kategori Scope
                    </label>
                    <select
                      value={targetScope}
                      disabled={!canChooseScope}
                      onChange={(e) => setTargetScope(e.target.value as ScopeType)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-800 focus:outline-emerald-500 disabled:opacity-60"
                    >
                      <option value="SHARING">SHARING (Investor & Kantor)</option>
                      <option value="PRIBADI">PRIBADI (Internal PT KDRT)</option>
                    </select>
                  </div>

                  {/* Akun TikTok */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Akun TikTok (Opsional)
                    </label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-800 focus:outline-emerald-500"
                    >
                      <option value="">-- Tanpa Akun Spesifik --</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          📱 {acc.accountName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* PIC Karyawan */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      PIC Talent / Karyawan (Opsional)
                    </label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-800 focus:outline-emerald-500"
                    >
                      <option value="">-- Tanpa PIC Spesifik --</option>
                      {employees.map((emp) => (
                        <option key={emp.id || emp.employeeId} value={emp.employeeId || emp.id}>
                          👤 {emp.name} ({emp.position})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Awal */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Status Awal Sampel
                    </label>
                    <select
                      value={sampleStatus}
                      onChange={(e) => setSampleStatus(e.target.value as SampleStatus)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-800 focus:outline-emerald-500"
                    >
                      <option value="DITERIMA">DITERIMA (Sudah Sampai di Kantor)</option>
                      <option value="DIPESAN">DIPESAN (Baru Dipesan)</option>
                      <option value="DIKIRIM">DIKIRIM (Dalam Pengiriman)</option>
                    </select>
                  </div>
                </div>

                {/* Auto Sync Checkboxes */}
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-700">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoCreateExpense}
                      onChange={(e) => setAutoCreateExpense(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-medium">Otomatis catat transaksi pengeluaran kas PT KDRT</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoCreateTask}
                      onChange={(e) => setAutoCreateTask(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-medium">Otomatis buat tugas kerjaan harian (VT)</span>
                  </label>
                </div>
              </div>

              {/* Status Summary KPI Pills */}
              {parseResult && (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('ALL')}
                    className={`rounded-2xl p-3 text-left transition-all border ${
                      previewFilter === 'ALL'
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase opacity-75 block">TOTAL BARIS</span>
                    <span className="text-xl font-black">{parseResult.totalRows}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('VALID')}
                    className={`rounded-2xl p-3 text-left transition-all border ${
                      previewFilter === 'VALID'
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-md'
                        : 'border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:border-emerald-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase opacity-75 block">VALID</span>
                    <span className="text-xl font-black">{parseResult.validCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('WARNING')}
                    className={`rounded-2xl p-3 text-left transition-all border ${
                      previewFilter === 'WARNING'
                        ? 'border-amber-500 bg-amber-500 text-white shadow-md'
                        : 'border-amber-200 bg-amber-50/60 text-amber-800 hover:border-amber-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase opacity-75 block">PERINGATAN</span>
                    <span className="text-xl font-black">{parseResult.warningCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('NEEDS_REVIEW')}
                    className={`rounded-2xl p-3 text-left transition-all border ${
                      previewFilter === 'NEEDS_REVIEW'
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                        : 'border-indigo-200 bg-indigo-50/60 text-indigo-800 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase opacity-75 block">BUTUH REVIEW</span>
                    <span className="text-xl font-black">{parseResult.needsReviewCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('DUPLICATE')}
                    className={`rounded-2xl p-3 text-left transition-all border ${
                      previewFilter === 'DUPLICATE'
                        ? 'border-purple-600 bg-purple-600 text-white shadow-md'
                        : 'border-purple-200 bg-purple-50/60 text-purple-800 hover:border-purple-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase opacity-75 block">DUPLIKAT</span>
                    <span className="text-xl font-black">{parseResult.duplicateCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('ERROR')}
                    className={`rounded-2xl p-3 text-left transition-all border ${
                      previewFilter === 'ERROR'
                        ? 'border-rose-600 bg-rose-600 text-white shadow-md'
                        : 'border-rose-200 bg-rose-50/60 text-rose-800 hover:border-rose-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase opacity-75 block">ERROR</span>
                    <span className="text-xl font-black">{parseResult.errorCount}</span>
                  </button>
                </div>
              )}

              {/* Preview Controls & Bulk Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Cari seller, produk, no pesanan, varian..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-emerald-500"
                  />
                </div>

                {parseResult && parseResult.duplicateCount > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-zinc-600">Aksi Masal Duplikat:</span>
                    <button
                      type="button"
                      onClick={() => handleBulkSetDuplicateAction('SKIP')}
                      className="rounded-lg bg-zinc-100 px-2.5 py-1 font-bold text-zinc-700 hover:bg-zinc-200"
                    >
                      Lewati Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetDuplicateAction('UPDATE')}
                      className="rounded-lg bg-purple-100 px-2.5 py-1 font-bold text-purple-700 hover:bg-purple-200"
                    >
                      Timpa / Update
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetDuplicateAction('IMPORT_ANYWAY')}
                      className="rounded-lg bg-amber-100 px-2.5 py-1 font-bold text-amber-800 hover:bg-amber-200"
                    >
                      Simpan Baru
                    </button>
                  </div>
                )}
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-100/80 font-black text-zinc-600 uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <th className="px-3 py-3 text-center">No</th>
                      <th className="px-3 py-3">Seller / Toko</th>
                      <th className="px-3 py-3">Nama Produk</th>
                      <th className="px-2 py-3 text-center">Warna</th>
                      <th className="px-2 py-3 text-center">Ukuran</th>
                      <th className="px-3 py-3 text-right">Harga Produk</th>
                      <th className="px-3 py-3 text-right">Ongkir</th>
                      <th className="px-3 py-3 text-right">Diskon</th>
                      <th className="px-3 py-3 text-right">Total Bayar</th>
                      <th className="px-3 py-3">No. Pesanan</th>
                      <th className="px-3 py-3 text-center">Pembayaran</th>
                      <th className="px-3 py-3">Status / Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-800">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-8 text-center text-zinc-400">
                          Tidak ada baris data yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => {
                        const originalIdx = (parseResult?.rows || []).indexOf(row);
                        return (
                          <tr
                            key={row.rowNumber}
                            className={`hover:bg-zinc-50/80 transition-colors ${
                              row.status === 'ERROR'
                                ? 'bg-rose-50/40'
                                : row.status === 'DUPLICATE'
                                ? 'bg-purple-50/40'
                                : row.status === 'NEEDS_REVIEW'
                                ? 'bg-indigo-50/30'
                                : ''
                            }`}
                          >
                            {/* No */}
                            <td className="px-3 py-2.5 text-center font-bold text-zinc-400">
                              {row.sequenceNumber || row.rowNumber}
                            </td>

                            {/* Seller */}
                            <td className="px-3 py-2.5 font-bold text-zinc-900 whitespace-nowrap">
                              {row.sellerName || <span className="text-rose-500 italic">Kosong</span>}
                            </td>

                            {/* Nama Produk */}
                            <td className="px-3 py-2.5 max-w-xs truncate font-medium text-zinc-800" title={row.productName}>
                              {row.productName || <span className="text-rose-500 italic">Kosong</span>}
                            </td>

                            {/* Warna */}
                            <td className="px-2 py-2.5 text-center whitespace-nowrap">
                              {row.color ? (
                                <span className="bg-zinc-100 px-2 py-0.5 rounded-md font-semibold text-zinc-700">
                                  {row.color}
                                </span>
                              ) : (
                                <span className="text-zinc-300">-</span>
                              )}
                            </td>

                            {/* Ukuran */}
                            <td className="px-2 py-2.5 text-center whitespace-nowrap">
                              {row.size ? (
                                <span className="bg-zinc-100 px-2 py-0.5 rounded-md font-black text-zinc-700">
                                  {row.size}
                                </span>
                              ) : (
                                <span className="text-zinc-300">-</span>
                              )}
                            </td>

                            {/* Harga Produk */}
                            <td className="px-3 py-2.5 text-right font-medium text-zinc-600 whitespace-nowrap">
                              {formatRupiah(row.productPrice)}
                            </td>

                            {/* Ongkir */}
                            <td className="px-3 py-2.5 text-right font-medium text-zinc-600 whitespace-nowrap">
                              {row.shippingCost > 0 ? formatRupiah(row.shippingCost) : <span className="text-zinc-400">Rp 0</span>}
                            </td>

                            {/* Diskon */}
                            <td className="px-3 py-2.5 text-right font-medium text-zinc-600 whitespace-nowrap">
                              {row.discount > 0 ? (
                                <span className="text-emerald-600 font-bold">-{formatRupiah(row.discount)}</span>
                              ) : (
                                <span className="text-zinc-400">Rp 0</span>
                              )}
                            </td>

                            {/* Total Bayar */}
                            <td className="px-3 py-2.5 text-right font-black text-zinc-900 whitespace-nowrap">
                              {formatRupiah(row.totalPaid)}
                            </td>

                            {/* No Pesanan */}
                            <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-zinc-700 whitespace-nowrap">
                              {row.orderNumber || <span className="text-rose-500 italic">Kosong</span>}
                            </td>

                            {/* Metode Pembayaran */}
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                                  row.paymentMethod === 'DANA'
                                    ? 'bg-blue-100 text-blue-800'
                                    : row.paymentMethod === 'COD'
                                    ? 'bg-amber-100 text-amber-800'
                                    : row.paymentMethod === 'TRANSFER'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : row.paymentMethod === 'PAYLATER'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-zinc-100 text-zinc-700'
                                }`}
                              >
                                {row.paymentMethod}
                              </span>
                            </td>

                            {/* Status & Aksi */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  {row.status === 'VALID' && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-black text-[10px] text-emerald-800">
                                      <CheckCircle2 className="h-3 w-3" /> VALID
                                    </span>
                                  )}
                                  {row.status === 'WARNING' && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-black text-[10px] text-amber-800">
                                      <AlertTriangle className="h-3 w-3" /> PERINGATAN
                                    </span>
                                  )}
                                  {row.status === 'NEEDS_REVIEW' && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 font-black text-[10px] text-indigo-800">
                                      <Info className="h-3 w-3" /> REVIEW
                                    </span>
                                  )}
                                  {row.status === 'DUPLICATE' && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 font-black text-[10px] text-purple-800">
                                      <RotateCcw className="h-3 w-3" /> DUPLIKAT
                                    </span>
                                  )}
                                  {row.status === 'ERROR' && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 font-black text-[10px] text-rose-800">
                                      <AlertCircle className="h-3 w-3" /> ERROR
                                    </span>
                                  )}
                                </div>

                                {row.status === 'DUPLICATE' && (
                                  <select
                                    value={row.duplicateAction}
                                    onChange={(e) =>
                                      handleSetRowDuplicateAction(
                                        originalIdx,
                                        e.target.value as DuplicateAction
                                      )
                                    }
                                    className="rounded-md border border-purple-300 bg-white px-2 py-0.5 text-[11px] font-bold text-purple-900 focus:outline-purple-500"
                                  >
                                    <option value="SKIP">Lewati (Skip)</option>
                                    <option value="UPDATE">Update Existing</option>
                                    <option value="IMPORT_ANYWAY">Import Baru</option>
                                  </select>
                                )}

                                {row.validationIssues.length > 0 && row.status !== 'DUPLICATE' && (
                                  <p
                                    className="text-[10px] text-zinc-500 max-w-xs truncate"
                                    title={row.validationIssues.join('; ')}
                                  >
                                    {row.validationIssues[0]}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : step === 'IMPORTING' ? (
            /* ================= STEP 3: IMPORTING PROGRESS ================= */
            <div className="py-16 text-center max-w-md mx-auto space-y-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 animate-pulse shadow-lg shadow-emerald-500/20">
                <FileSpreadsheet className="h-10 w-10 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-zinc-900">
                  Memproses Import ke Database Sampel...
                </h3>
                <p className="text-xs text-zinc-500">{progressText}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-200 rounded-full h-3.5 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>

              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {importProgress}% Selesai
              </span>
            </div>
          ) : (
            /* ================= STEP 4: FINAL REPORT ================= */
            executionReport && (
              <div className="space-y-6 max-w-2xl mx-auto py-4">
                <div className="text-center space-y-2">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900">IMPORT SPREADSHEET SELESAI</h3>
                  <p className="text-xs text-zinc-500 font-mono">
                    Batch ID: <b className="text-zinc-800">{executionReport.batchId}</b>
                  </p>
                </div>

                {/* KPI Metrics Results */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-black uppercase text-zinc-400 block">TOTAL DATA</span>
                    <span className="text-2xl font-black text-zinc-900">{executionReport.total}</span>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-2xs">
                    <span className="text-[10px] font-black uppercase text-emerald-600 block">BERHASIL DISIMPAN</span>
                    <span className="text-2xl font-black text-emerald-800">{executionReport.successCount}</span>
                  </div>

                  <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4 shadow-2xs">
                    <span className="text-[10px] font-black uppercase text-purple-600 block">DUPLIKAT DILEWATI</span>
                    <span className="text-2xl font-black text-purple-800">{executionReport.duplicateSkippedCount}</span>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-2xs">
                    <span className="text-[10px] font-black uppercase text-rose-600 block">GAGAL / ERROR</span>
                    <span className="text-2xl font-black text-rose-800">{executionReport.errorCount}</span>
                  </div>
                </div>

                {/* Error details if any */}
                {executionReport.errors.length > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-rose-900">
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                      <span>Rincian Baris Gagal ({executionReport.errors.length}):</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-rose-100">
                      {executionReport.errors.map((err, i) => (
                        <div key={i} className="py-1.5 flex justify-between gap-2">
                          <span className="font-semibold text-rose-800">
                            Baris #{err.rowNumber} ({err.productName}):
                          </span>
                          <span className="text-rose-600">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          {activeTab === 'HISTORY' ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('IMPORT')}
                className="rounded-xl border border-zinc-200 px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
              >
                Kembali ke Form Import
              </button>
            </div>
          ) : step === 'UPLOAD' ? (
            <div className="w-full flex justify-between items-center">
              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900"
              >
                <History className="h-4 w-4" />
                <span>Lihat Riwayat Import Sebelumnya ({importLogs.length})</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-200 px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
              >
                Batal
              </button>
            </div>
          ) : step === 'PREVIEW' ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  Ganti File
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  Tutup
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 font-medium hidden sm:inline">
                  Siap diimpor:{' '}
                  <b className="text-zinc-900">{executableRows.length} Sampel</b>
                </span>

                <button
                  type="button"
                  disabled={executableRows.length === 0}
                  onClick={handleExecuteImport}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-xs font-black text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  <span>IMPORT {executableRows.length} DATA KE DATABASE</span>
                </button>
              </div>
            </>
          ) : step === 'IMPORTING' ? (
            <div className="w-full text-center text-xs text-zinc-400 font-medium">
              Mohon tunggu, jangan menutup browser selama proses import berlangsung...
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-zinc-200 px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
              >
                Import File Lain
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
              >
                Selesai & Lihat Database Sampel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
