import React from "react";
import { BookOpen, X } from "lucide-react";

interface GlosariumGaulProps {
  isOpen: boolean;
  onClose: () => void;
}

const SLANG_EXPLANATIONS = [
  { word: "Kudet", meaning: "Kurang Update. Istilah buat orang yang telat denger kabar terbaru." },
  { word: "Gokil", meaning: "Sangat luar biasa, keren parah, atau bikin geleng-geleng kepala." },
  { word: "FYI / BTW", meaning: "For Your Information / By The Way. Pembuka info penting biar makin asik." },
  { word: "Gengs / Guys", meaning: "Panggilan akrab buat temen-temen atau pembaca sekalian." },
  { word: "Nyantai", meaning: "Rileks, tanpa beban. Gaya baca berita tanpa bahasa birokrat kaku." },
  { word: "Beneran", meaning: "Kenyataan asli, fakta valid, anti-hoax!" },
  { word: "Kepo", meaning: "Rasa penasaran tinggi. Pengen tau aja seluk beluk infonya." },
  { word: "No Debat", meaning: "Fakta mutlak yang sudah tidak perlu diperdebatkan lagi karena super jelas." }
];

export default function GlosariumGaul({ isOpen, onClose }: GlosariumGaulProps) {
  if (!isOpen) return null;

  return (
    <div id="glosarium-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-700" />
        
        <div className="flex items-center justify-between mb-4 mt-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <h3 className="font-sans font-bold text-lg text-slate-800">Kamus Gaul KilasSantai</h3>
          </div>
          <button 
            id="close-glosarium"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 font-sans leading-relaxed">
          Sering denger kata-kata aneh di ringkasan berita kami? Tenang gengs, ini contekan biar lo gak kudet dan tetep nyambung:
        </p>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {SLANG_EXPLANATIONS.map((item, idx) => (
            <div key={idx} className="p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition">
              <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {item.word}
              </span>
              <p className="text-xs font-sans text-slate-600 mt-1.5 leading-relaxed">
                {item.meaning}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            id="understand-slang"
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-sans text-xs font-medium rounded-xl hover:opacity-90 active:scale-95 transition shadow-sm"
          >
            Siap, Paham Gengs!
          </button>
        </div>
      </div>
    </div>
  );
}
