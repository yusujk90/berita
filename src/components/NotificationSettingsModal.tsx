import React, { useState } from "react";
import { X, Bell, BellOff, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { NotificationPreferences } from "../types";

interface NotificationSettingsModalProps {
  preferences: NotificationPreferences;
  onSavePreferences: (prefs: NotificationPreferences) => void;
  onClose: () => void;
}

export default function NotificationSettingsModal({ 
  preferences, 
  onSavePreferences, 
  onClose 
}: NotificationSettingsModalProps) {
  const [enabled, setEnabled] = useState(preferences.enabled);
  const [selectedCats, setSelectedCats] = useState<string[]>(preferences.categories);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(preferences.keywords);
  const [frequency, setFrequency] = useState<"instan" | "harian" | "mingguan">(preferences.frequency);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableCats = [
    { id: "viral", name: "Lagi Viral" },
    { id: "indonesia", name: "Indonesia" },
    { id: "luar-negeri", name: "Luar Negeri" },
    { id: "teknologi", name: "Teknologi" },
    { id: "hiburan", name: "Hiburan" },
    { id: "olahraga", name: "Olahraga" }
  ];

  const handleToggleCat = (id: string) => {
    if (selectedCats.includes(id)) {
      setSelectedCats(selectedCats.filter(c => c !== id));
    } else {
      setSelectedCats([...selectedCats, id]);
    }
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = keywordInput.trim().toLowerCase();
    if (clean && !keywords.includes(clean)) {
      setKeywords([...keywords, clean]);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw));
  };

  const handleSave = () => {
    const updated: NotificationPreferences = {
      enabled,
      categories: selectedCats,
      keywords,
      frequency
    };
    onSavePreferences(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1500);

    // Request native permission if checked
    if (enabled && "Notification" in window) {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          console.log("Native notifications enabled!");
        }
      });
    }
  };

  return (
    <div id="notification-settings-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 relative flex flex-col justify-between overflow-hidden">
        
        {/* Sleek top orange/red indicator */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-indigo-600" />
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-500 animate-swing" />
            <h3 className="font-sans font-black text-slate-800 text-base">Atur Notifikasi Personal</h3>
          </div>
          <button 
            id="close-notifications-settings"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            {enabled ? <Bell className="text-emerald-500 w-4 h-4" /> : <BellOff className="text-slate-400 w-4 h-4" />}
            <div>
              <p className="text-xs font-bold text-slate-800">Status Push Notification</p>
              <p className="text-[10px] text-slate-400">Dapatkan alert instan atau sesuai jadwal</p>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
              enabled ? "bg-emerald-500 justify-end" : "bg-slate-350 justify-start"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-md block" />
          </button>
        </div>

        {/* Setting options container */}
        <div className={`space-y-4 ${enabled ? "opacity-100 pointer-events-auto" : "opacity-45 pointer-events-none"} transition-opacity duration-200`}>
          
          {/* Select Category Preferences */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block">
              1. Pilih Kategori Minat
            </label>
            <div className="grid grid-cols-3 gap-2">
              {availableCats.map((cat) => {
                const isActive = selectedCats.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleToggleCat(cat.id)}
                    className={`p-2 rounded-xl text-[10px] font-sans font-bold text-center border transition ${
                      isActive 
                        ? "bg-rose-50 border-rose-250 text-rose-600 shadow-sm" 
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keyword tags selection input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block">
              2. Keyword Alert Khusus (Bhs Gaul/Nama Artis/Topik)
            </label>
            
            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-slate-50 border border-slate-105 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-rose-450 focus:bg-white"
                placeholder="Misal: 'sora', 'timnas', 'apple'..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Tambah
              </button>
            </form>

            {/* Keyword chips rendering */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {keywords.length === 0 ? (
                <span className="text-[10px] text-slate-400 italic">Belum ada keyword custom. Dapatkan update semua topik.</span>
              ) : (
                keywords.map(kw => (
                  <span 
                    key={kw} 
                    className="flex items-center gap-1 text-[10px] font-sans font-bold text-slate-700 bg-slate-100 hover:bg-red-50 hover:text-red-600 transition cursor-pointer px-2 py-0.5 rounded-lg border border-slate-200-50"
                    onClick={() => handleRemoveKeyword(kw)}
                    title="Klik untuk hapus"
                  >
                    #{kw} <span className="text-[9px] font-black text-slate-400">×</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Custom Notification Frequency */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-450 uppercase tracking-widest block">
              3. Frekuensi Pengiriman Notif
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-rose-400"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
            >
              <option value="instan">⚡ Instan (Kirim langsung saat diterbitkan)</option>
              <option value="harian">⏰ Harian (Kumpul jadi satu ringkasan pagi)</option>
              <option value="mingguan">📅 Mingguan (Riset digest di akhir minggu)</option>
            </select>
          </div>

        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 pt-4 mt-5 flex flex-col items-stretch gap-2.5">
          {savedSuccess && (
            <div className="text-center text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 p-2 rounded-xl flex items-center justify-center gap-1 animate-pulse">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Pengaturan Berhasil Diupdate! Notifikasi Siap Meluncur Gengs!</span>
            </div>
          )}

          <button
            id="save-notification-prefs"
            onClick={handleSave}
            className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 text-white hover:opacity-95 font-bold rounded-xl text-xs transition shadow-lg active:scale-98"
          >
            Simpan & Aktifkan Sekarang
          </button>
        </div>

      </div>
    </div>
  );
}
