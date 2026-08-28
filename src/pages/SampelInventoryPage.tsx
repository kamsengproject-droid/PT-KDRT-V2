import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Home,
  ChevronRight,
  User,
  ShoppingBag,
  DollarSign,
  Tag,
} from 'lucide-react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { SampleInventoryItem, Employee } from '../types';
import { subscribeEmployees } from '../services/employeeService';
import { formatRupiah, formatTanggal, tanggalHariIni } from '../utils/formatters';

interface SampelInventoryPageProps {
  onBackToPortal?: () => void;
}

export const SampelInventoryPage: React.FC<SampelInventoryPageProps> = ({
  onBackToPortal,
}) => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();
  const [items, setItems] = useState<SampleInventoryItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<SampleInventoryItem | null>(null);

  const [formData, setFormData] = useState<{
    itemName: string;
    category: string;
    brand: string;
    quantity: number;
    pricePerUnit: number;
    status: 'TERSEDIA' | 'DIPAKAI_LIVE' | 'HABIS' | 'REVIEW';
    receivedDate: string;
    assignedTalentId: string;
    notes: string;
  }>({
    itemName: '',
    category: 'Skincare',
    brand: '',
    quantity: 1,
    pricePerUnit: 50000,
    status: 'TERSEDIA',
    receivedDate: tanggalHariIni(),
    assignedTalentId: '',
    notes: '',
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    const q = query(collection(db, 'samples_inventory'), orderBy('receivedDate', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as SampleInventoryItem[];
        setItems(list);
      },
      (err) => {
        console.warn('Firestore samples_inventory subscription:', err);
      }
    );

    const unsubEmp = subscribeEmployees(undefined, (empList) => {
      setEmployees(empList);
    });

    return () => {
      unsub();
      unsubEmp();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      itemName: '',
      category: 'Skincare',
      brand: '',
      quantity: 1,
      pricePerUnit: 50000,
      status: 'TERSEDIA',
      receivedDate: tanggalHariIni(),
      assignedTalentId: '',
      notes: '',
    });
    setSaveError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item: SampleInventoryItem) => {
    setEditingItem(item);
    setFormData({
      itemName: item.itemName,
      category: item.category || 'Skincare',
      brand: item.brand || '',
      quantity: item.quantity || 1,
      pricePerUnit: item.pricePerUnit || 0,
      status: item.status || 'TERSEDIA',
      receivedDate: item.receivedDate || tanggalHariIni(),
      assignedTalentId: item.assignedTalentId || '',
      notes: item.notes || '',
    });
    setSaveError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      if (!formData.itemName.trim()) {
        throw new Error('Nama produk sampel wajib diisi.');
      }

      const assignedEmp = employees.find((emp) => emp.id === formData.assignedTalentId);
      const totalCost = Number(formData.quantity) * Number(formData.pricePerUnit);

      const payload = {
        ...formData,
        quantity: Number(formData.quantity) || 1,
        pricePerUnit: Number(formData.pricePerUnit) || 0,
        totalCost,
        assignedTalentName: assignedEmp ? assignedEmp.name : '',
        updatedAt: serverTimestamp(),
      };

      if (editingItem?.id) {
        await updateDoc(doc(db, 'samples_inventory', editingItem.id), payload);
      } else {
        await addDoc(collection(db, 'samples_inventory'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: userProfile?.uid || 'user',
        });
      }

      setShowModal(false);
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan sampel.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id || !window.confirm('Hapus data sampel ini?')) return;
    try {
      await deleteDoc(doc(db, 'samples_inventory', id));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.assignedTalentName && item.assignedTalentName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalBiayaSampel = items.reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
  const totalItemSampel = items.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <nav className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
          <button
            onClick={onBackToPortal}
            className="flex items-center gap-1 hover:text-orange-600 font-bold transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>KANTOR PT.KDRT</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-bold text-slate-900">SAMPEL & INVENTORY</span>
        </nav>

        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Kembali ke Portal</span>
          </button>
        )}
      </div>

      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" />
            SAMPEL & INVENTORY
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Catatan pembelian sampel produk affiliate, inventaris kantor, dan alokasi ke talent.
          </p>
        </div>

        {(role === 'OWNER' || role === 'MANAGER') && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah Sampel Baru
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Item Sampel
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalItemSampel} Unit
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {items.length} jenis produk tercatat
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Biaya Pengadaan
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {formatRupiah(totalBiayaSampel)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Investasi sampel produk
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Dipakai Live / Review
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {items.filter((i) => i.status === 'DIPAKAI_LIVE' || i.status === 'REVIEW').length} Item
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">
            Sedang aktif dipakai talent
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['ALL', 'TERSEDIA', 'DIPAKAI_LIVE', 'REVIEW', 'HABIS'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL'
                ? 'Semua Status'
                : st === 'DIPAKAI_LIVE'
                ? 'Dipakai Live'
                : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari produk, brand, talent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-indigo-500"
          />
        </div>
      </div>

      {/* Items Table / Cards */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Package className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="font-bold text-sm text-slate-700">Belum ada data sampel</p>
            <p className="text-xs mt-1">Tambahkan data sampel produk baru untuk mulai pelacakan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Produk & Brand</th>
                  <th className="p-3.5">Kategori</th>
                  <th className="p-3.5">Jumlah</th>
                  <th className="p-3.5">Harga / Total</th>
                  <th className="p-3.5">Talent Pengguna</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5">
                      <div className="font-extrabold text-slate-900">{item.itemName}</div>
                      <div className="text-[11px] text-slate-400">{item.brand || 'No Brand'}</div>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">
                      {item.quantity} Unit
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">
                        {formatRupiah(item.totalCost || item.pricePerUnit * item.quantity)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        @{formatRupiah(item.pricePerUnit)}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {item.assignedTalentName ? (
                        <div className="inline-flex items-center gap-1 text-slate-800 font-semibold">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{item.assignedTalentName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">- Belum dialokasikan -</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          item.status === 'TERSEDIA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'DIPAKAI_LIVE'
                            ? 'bg-blue-100 text-blue-800'
                            : item.status === 'REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      {(role === 'OWNER' || role === 'MANAGER') && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          {role === 'OWNER' && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50"
                            >
                              Hapus
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-4">
              {editingItem ? 'Edit Data Sampel' : 'Tambah Sampel Baru'}
            </h3>

            {saveError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-semibold">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Produk Sampel</label>
                <input
                  type="text"
                  required
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  placeholder="contoh: Serum Glowing 30ml"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Brand / Merek</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="contoh: Glad2Glow"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Skincare / Fashion / Snack"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jumlah Unit</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Harga Beli / Unit (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.pricePerUnit}
                    onChange={(e) => setFormData({ ...formData, pricePerUnit: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Sampel</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-indigo-500"
                  >
                    <option value="TERSEDIA">TERSEDIA</option>
                    <option value="DIPAKAI_LIVE">DIPAKAI LIVE</option>
                    <option value="REVIEW">REVIEW</option>
                    <option value="HABIS">HABIS</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alokasi ke Talent</label>
                  <select
                    value={formData.assignedTalentId}
                    onChange={(e) => setFormData({ ...formData, assignedTalentId: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-indigo-500"
                  >
                    <option value="">- Belum Ditugaskan -</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal Diterima</label>
                <input
                  type="date"
                  value={formData.receivedDate}
                  onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Sampel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
