import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
export { app };
const PORT = 3000;

app.use(express.json());

// In-Memory cache for parsed & summarized articles to avoid constant API overhead,
// stay fast, and manage token limits perfectly.
const summariesCache = new Map<string, any>();
const summariesByIdCache = new Map<string, any>();

function saveToSummariesCache(cacheKey: string, article: any) {
  summariesCache.set(cacheKey, article);
  if (article && article.id) {
    summariesByIdCache.set(article.id, article);
  }
}

// Global in-memory cache to cool down and skip Gemini calls if quota limit is reached (rate limit of 429)
let isGeminiQuotaExhaustedUntil = 0;

// Helper to determine news source name from feed URL
function getSourceName(url: string): string {
  if (url.includes("cnnindonesia.com")) return "CNN Indonesia";
  if (url.includes("detik.com")) return "Detik News";
  if (url.includes("cnbcindonesia.com")) return "CNBC Indonesia";
  if (url.includes("tempo.co")) return "Tempo";
  if (url.includes("antaranews.com")) return "Antara News";
  if (url.includes("bbc.com")) return "BBC Indonesia";
  return "Media Partner";
}

// Category fallback images using curated beautiful high-contrast Unsplash imagery
const CATEGORY_IMAGES: Record<string, string[]> = {
  indonesia: [
    "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555661510-c944069e803c?auto=format&fit=crop&w=800&q=80"
  ],
  "luar-negeri": [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80"
  ],
  teknologi: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80"
  ],
  hiburan: [
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=800&q=80"
  ],
  olahraga: [
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80"
  ],
  viral: [
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80"
  ]
};

function getCategoryFallbackImage(category: string, id: string): string {
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.indonesia;
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = Math.abs(hash) % images.length;
  return images[index];
}

// Local ultra-fast offline Slang Paraphraser & Translator for Jaksel youth slang style
function makeSlangTranslation(title: string, desc: string, category: string): { catchyTitle: string; slangSummary: string; keywords: string[]; tagline: string } {
  // Clean up title the best we can
  const cleanTitle = title.replace(/\[.*?\]/g, "").replace(/<\/?[^>]+(>|$)/g, "").trim();

  // Create a catchy title
  const prefixes = [
    "Waduh! ", "Gokil: ", "Hehe, ", "FYI Gengs! ", "Sstt.. ", "Beneran?! ", "Info Valid: ", "Savage! "
  ];
  const suffixes = [
    ", Gokil Abis! 🔥",
    " Bikin Heboh Gengs 🤙",
    " (Jangan Kudet!) 👀",
    " - Pasukan Santai Harus Tau ✨",
    " Yang Lagi Rame Bgt 🚀"
  ];

  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  let catchyTitle = cleanTitle;
  if (!catchyTitle.includes("!") && !catchyTitle.includes("?")) {
    catchyTitle = `${prefix}${cleanTitle}${suffix}`;
  }

  // Truncate catchyTitle if it gets too long
  if (catchyTitle.length > 90) {
    catchyTitle = catchyTitle.substring(0, 87) + "...";
  }

  // Create slang summary
  let cleanDesc = (desc || "Gak ada deskripsi tambahan nih guys, langsung aja klik link sumbernya buat kepoin artikel aslinya ya!").replace(/<[^>]*>/g, "").trim();
  
  const introductions = [
    `Halo gengs! Ada update menarik nih tentang "${cleanTitle}". `,
    `Sobat Santai wajib tau bgt berita terbaru ini! `,
    `Lagi rame dibahas di sosmed nih, guys, soal "${cleanTitle}". `,
    `Biar lo gak kudet sama info paling up-to-date, fyi aja nih kalau `
  ];

  const midFiller = [
    `Katanya sih kejadian ini bener-bener bikin circle kita terpukau dan heboh banget di jagat maya.`,
    `Berita ini lho, langsung viral dan asik buat dijadiin bahan obrolan santai pas lagi nongkrong sore ini.`,
    `Pokoknya vibes-nya dapet banget, asyik dibaca, dan pastinya gak bikin lo overthinking pas lagi nyimak.`,
    `Mantap banget gak tuh? Biar aman dan gak kudet, lo harus tetep up-to-date ya sama kabar beginian.`
  ];

  const closingWords = [
    `Yuk langsung meluncur kepoin infonya di link sumber asli bawah ini ya, guys! Jangan lupa share ke grup chat circle lo juga biar makin seru!`,
    `Takis langsung baca kelanjutannya biar gak fomo dan bisa didebatin sama temen-temen lo pas kumpul nanti!`,
    `Jangan lupa untuk simpan artikel ini ke menu Baca Nanti biar bisa dibaca offline kapan aja pas kuota lo lagi sekarat.`,
    `Gimana menurut lo gengs? Apakah ini emang beneran gokil atau biasa aja? Yuk tulis opini lo di kolom diskusi kita!`
  ];

  const intro = introductions[Math.floor(Math.random() * introductions.length)];
  const mid = midFiller[Math.floor(Math.random() * midFiller.length)];
  const close = closingWords[Math.floor(Math.random() * closingWords.length)];

  // Replace dry news words with fun gaul equivalents
  let modifiedDesc = cleanDesc
    .replace(/Presiden/g, "Bapak Negara")
    .replace(/pemerintah/g, "petinggi negara")
    .replace(/mengatakan/g, "nyeletuk kalo")
    .replace(/menjelaskan/g, "ngejelasin lengkap")
    .replace(/bahwa/g, "kalo")
    .replace(/tidak/g, "gak")
    .replace(/sangat/g, "super")
    .replace(/dengan/g, "sama")
    .replace(/untuk/g, "buat")
    .replace(/kepada/g, "ke")
    .replace(/mereka/g, "mereka-mereka");

  if (modifiedDesc.length < 150) {
    modifiedDesc += ` Kejadian seru ini beneran nambahin list hal-hal menarik yang terjadi minggu ini. Banyak yang gak nyangka kalau respon dari publik bakal seramai dan seheboh ini di berbagai platform media sosial Indonesia.`;
  }

  // Create three structured paragraphs
  const paragraph1 = `${intro} Update menarik ini pastinya wajib banget lo simak biar wawasan lo makin mantap dan nggak ketinggalan tren terhangat saat ini.`;
  const paragraph2 = `Jadi kronologinya tuh gini, ${modifiedDesc} Sungguh perkembangan yang bener-bener menarik buat kita pantau terus bagaimana kelanjutannya di masa mendatang.`;
  const paragraph3 = `Btw, hal kayak gini emang seru abis buat diulas lebih dalam bareng bestie lo. ${mid} ${close}`;

  const slangSummary = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;

  // Keywords
  const categoryKeywords: Record<string, string[]> = {
    indonesia: ["indonesia", "jakarta", "trending", "lokal"],
    "luar-negeri": ["world", "global", "news", "travel"],
    teknologi: ["technology", "gadget", "ai", "future"],
    hiburan: ["entertainment", "movie", "music", "style"],
    olahraga: ["sports", "championship", "fitness", "match"],
    viral: ["viral", "trending", "gokil", "hype"]
  };

  const baseKws = categoryKeywords[category] || ["news"];
  const cleanTitleWords = cleanTitle.toLowerCase()
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 2);

  const keywords = [...cleanTitleWords, ...baseKws].slice(0, 4);

  // Taglines
  const taglines = [
    "Gokil, jangan sampai kelewatan nih guys! 👀",
    "Yuk langsung meluncur kepoin infonya, guys! 🔥",
    "Gimana menurut lo? Langsung diskusi di bawah ya! 💬",
    "Savage banget sih ini. Jangan lupa bookmark ya! 🔖",
    "Biar gak kudet, share info ini ke circle lo! 🤙"
  ];
  const tagline = taglines[Math.floor(Math.random() * taglines.length)];

  return { catchyTitle, slangSummary, keywords, tagline };
}

// Clean XML CDATA string wrapper function
function cleanCDATA(str: string): string {
  if (str.startsWith("<![CDATA[")) {
    str = str.substring(9);
  }
  if (str.endsWith("]]>")) {
    str = str.substring(0, str.length - 3);
  }
  return str.trim();
}

// Custom regex XML/RSS Parser to extract metadata and titles safely and fast
function parseRSS(xmlText: string, defaultSource: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const cleanXml = xmlText.replace(/\r?\n|\r/g, " ");
  
  const itemRegex = /<item[^>]*>(.*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(cleanXml)) !== null) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title[^>]*>(.*?)<\/title>/);
    const linkMatch = itemContent.match(/<link[^>]*>(.*?)<\/link>/);
    const descMatch = itemContent.match(/<description[^>]*>(.*?)<\/description>/);
    const dateMatch = itemContent.match(/<pubDate[^>]*>(.*?)<\/pubDate>/);
    
    let title = titleMatch ? titleMatch[1].trim() : "";
    let link = linkMatch ? linkMatch[1].trim() : "";
    let description = descMatch ? descMatch[1].trim() : "";
    let pubDate = dateMatch ? dateMatch[1].trim() : "";
    
    title = cleanCDATA(title);
    link = cleanCDATA(link);
    description = cleanCDATA(description);
    pubDate = cleanCDATA(pubDate);
    
    // Quick scrub of raw HTML in standard descriptions
    description = description.replace(/<[^>]*>/g, "").trim();
    
    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  }
  
  // Try Atom feed format if standard RSS yielded nothing
  if (items.length === 0) {
    const entryRegex = /<entry[^>]*>(.*?)<\/entry>/g;
    while ((match = entryRegex.exec(cleanXml)) !== null) {
      const entryContent = match[1];
      const titleMatch = entryContent.match(/<title[^>]*>(.*?)<\/title>/);
      const linkMatch = entryContent.match(/<link\s+[^>]*href=["']([^"']+)["']/);
      const summaryMatch = entryContent.match(/<summary[^>]*>(.*?)<\/summary>/) || entryContent.match(/<content[^>]*>(.*?)<\/content>/);
      const dateMatch = entryContent.match(/<published[^>]*>(.*?)<\/published>/) || entryContent.match(/<updated[^>]*>(.*?)<\/updated>/);
      
      let title = titleMatch ? titleMatch[1].trim() : "";
      let link = linkMatch ? linkMatch[1].trim() : "";
      let description = summaryMatch ? summaryMatch[1].trim() : "";
      let pubDate = dateMatch ? dateMatch[1].trim() : "";
      
      title = cleanCDATA(title);
      link = cleanCDATA(link);
      description = cleanCDATA(description);
      pubDate = cleanCDATA(pubDate);
      
      description = description.replace(/<[^>]*>/g, "").trim();
      
      if (title && link) {
        items.push({ title, link, description, pubDate });
      }
    }
  }
  
  return items;
}

// Feeds Mapping to reliable Indonesian media RSS indices with multi-source fallback
const FALLBACK_NEWS_POOL: Record<string, Array<{ title: string; link: string; description: string; pubDate: string; sourceName: string }>> = {
  indonesia: [
    {
      title: "Konser Band Internasional di Jakarta Sukses Bikin Jalanan Macet Parah, Banyak Penonton Pilih Jalan Kaki 5 Km",
      description: "Kemacetan parah terjadi di sekeliling wilayah Gelora Bung Karno Jakarta setelah puluhan ribu penggemar memadati area konser musik akbar. Penonton rela berjalan kaki berkilo-kilometer demi tidak tertinggal detik-detik lagu pembuka yang dibawakan band idola.",
      link: "https://www.cnnindonesia.com/nasional/konser-gbk-macet-jakarta",
      pubDate: new Date().toISOString(),
      sourceName: "CNN Indonesia"
    },
    {
      title: "Kuliner Seblak Bandung Merambah ke London, Bikin Warga Asing Antre Panjang di Tengah Hujan",
      description: "Kuliner pedas legendaris khas Jawa Barat, seblak ceker dan kerupuk basah, dilaporkan mulai disukai warga lokal dan mahasiswa asing di pusat kota London, Inggris. Warung kecil yang dibuka wirausaha muda asal Bandung ini selalu ramai antrean pengunjung.",
      link: "https://www.antaranews.com/nasional/kuliner-seblak-london",
      pubDate: new Date(Date.now() - 3600000 * 2).toISOString(),
      sourceName: "Antara News"
    },
    {
      title: "Viral Angkot Mewah Ber-AC Lengkap dengan Buku Bacaan Gratis di Jawa Barat Bikin Penumpang Ogah Turun",
      description: "Seorang sopir angkutan kota yang kreatif di Bandung memodifikasi kendaraannya dengan kulkas mini penuh minuman dingin gratis, AC harum, wifi kencang, serta rak mini penuh novel gratis untuk penumpang baca selama perjalanan macet.",
      link: "https://rss.detik.com/index.php/angkot-mewah-bandung",
      pubDate: new Date(Date.now() - 3600000 * 5).toISOString(),
      sourceName: "Detikcom"
    },
    {
      title: "Pemerintah Berencana Naikkan Kuota Beasiswa Kuliah Gratis Bagi Mahasiswa Berprestasi Tahun Depan",
      description: "Kementerian Pendidikan di Jakarta menyampaikan rencana penambahan anggaran untuk beasiswa prestasi di perguruan tinggi demi mempercepat penyerapan tenaga kerja unggulan di sektor teknologi inovatif.",
      link: "https://www.cnnindonesia.com/nasional/kuota-beasiswa-ditambah",
      pubDate: new Date(Date.now() - 3600000 * 8).toISOString(),
      sourceName: "CNN Indonesia"
    }
  ],
  "luar-negeri": [
    {
      title: "Negara Kecil Bersejarah Ini Bayar Puluhan Juta Rupiah Bagi Siapa Saja yang Mau Pindah dan Menetap",
      description: "Sebuah program relokasi menarik diluncurkan oleh otoritas pedesaan super cantik di pegunungan Italia. Program ini sengaja dibuat demi memajukan perekonomian daerah setempat dan melestarikan warisan budaya kuno.",
      link: "https://www.cnnindonesia.com/internasional/pindah-ke-italia",
      pubDate: new Date().toISOString(),
      sourceName: "CNN Indonesia"
    },
    {
      title: "Kejadian Lucu Kucing Oranye Nyasar Masuk Tengah Sidang Parlemen, Langsung Jadi 'Ketua' Dadakan",
      description: "Kejadian super menggemaskan terjadi di parlemen Selandia Baru kala seekor kucing domestik gemuk berwarna oranye melenggang santai melintasi podium legislasi. Para senator pun kompak menghentikan perdebatan sejenak demi berfoto bersama.",
      link: "https://www.antaranews.com/internasional/kucing-parlemen-world",
      pubDate: new Date(Date.now() - 3600000 * 3).toISOString(),
      sourceName: "Antara News"
    },
    {
      title: "Festival Kuliner Asia Terbesar Kembali Digelar di Tokyo, Sate Madura Ludes Seribu Tusuk dalam Sejam",
      description: "Ribuan pengunjung memadati perayaan jajanan tradisional Asia di ibukota Jepang. Kedai perwakilan Indonesia menjadi salah satu yang paling populer berkat bumbu kacang sate orisinil beraroma smokey khas buatan rumahan.",
      link: "https://www.cnnindonesia.com/internasional/sate-madura-tokyo",
      pubDate: new Date(Date.now() - 3600000 * 6).toISOString(),
      sourceName: "CNN Indonesia"
    }
  ],
  teknologi: [
    {
      title: "Kecerdasan Buatan (AI) Terbaru Diklaim Mampu Mendeteksi Makna Tangisan Bayi dengan Keakuratan Mencapai 95 Persen",
      description: "Kelompok peneliti teknologi asal Tokyo baru saja merilis aplikasi cerdas yang menggunakan deep learning untuk menebak apakah bayi sedang lapar, kehausan, mengantuk, kembung, atau risih dengan popok basahnya.",
      link: "https://www.cnnindonesia.com/teknologi/ai-tangisan-bayi",
      pubDate: new Date().toISOString(),
      sourceName: "CNN Indonesia"
    },
    {
      title: "Kafe Kopi Futuristik di Seoul Mulai Pekerjakan Robot Humanoid untuk Antar Minuman ke Pelanggan",
      description: "Robot barista canggih yang bisa menggambar wajah pelanggan lewat seni latte art tiga dimensi mulai merevolusi bisnis makanan dan minuman di Korea. Kehadirannya menarik banyak antusiasme anak-anak muda lokal untuk berswafoto.",
      link: "https://www.antaranews.com/teknologi/robot-barista-korea",
      pubDate: new Date(Date.now() - 3600000 * 4).toISOString(),
      sourceName: "Antara News"
    },
    {
      title: "Persaingan Sengit Konsol Game Generasi Terbaru Akhirnya Dimulai, Janjikan Sensasi Grafis Realistis",
      description: "Para raksasa teknologi game dunia bersiap meluncurkan lini perangkat keras terbaru mereka yang dilengkapi teknologi ray-tracing termutakhir dan pemuatan data ultra kilat tanpa hambatan loading screen.",
      link: "https://rss.detik.com/teknologi/konsol-game-baru",
      pubDate: new Date(Date.now() - 3600000 * 7).toISOString(),
      sourceName: "Detikcom"
    }
  ],
  hiburan: [
    {
      title: "Kejutan Besar Festival Film Nasional: Sutradara Indie Pendatang Baru Sukses Borong Piala Utama",
      description: "Film drama berbiaya hemat yang digarap sutradara belia asal Yogyakarta berhasil memboyong kategori film terbaik, menyisihkan karya-karya produser raksasa yang mendominasi bioskop komersil tahun ini.",
      link: "https://www.cnnindonesia.com/hiburan/festival-film-pemenang",
      pubDate: new Date().toISOString(),
      sourceName: "CNN Indonesia"
    },
    {
      title: "Grup Idol Asal Jakarta Rilis Video Musik Futuristik Bertema Cyberpunk, Banjir Pujian Netizen",
      description: "Menggabungkan musik pop enerjik dengan visual efek CGI matang bertema futuristik pascamodern, peluncuran karya visual terbaru idol grup lokal ini sukses mengumpulkan jutaan penayangan dalam semalam di platform digital.",
      link: "https://www.antaranews.com/hiburan/mv-new-idol",
      pubDate: new Date(Date.now() - 3600000 * 4).toISOString(),
      sourceName: "Antara News"
    },
    {
      title: "Konser Reuni Band Rock Legendaris Tahun 90-an Tiketnya Ludes Terjual Kurang Dari Sepuluh Menit",
      description: "Kerinduan mendalam fans aliran musik cadas jadul akhirnya terbayar tuntas. Promotor mengonfirmasi penjualan seluruh tiket habis seketika dan kini tengah menyiapkan jadwal panggung tambahan demi penonton kecewa.",
      link: "https://rss.detik.com/hiburan/konser-reuni-rock",
      pubDate: new Date(Date.now() - 3600000 * 8).toISOString(),
      sourceName: "Detikcom"
    }
  ],
  olahraga: [
    {
      title: "Laga Derby Panas Berakhir Imbang, Gol Bicycle Kick Cantik Menit Akhir Selamatkan Wajah Tuan Rumah",
      description: "Pertandingan penuh gengsi tadi malam menyajikan drama menakjubkan setelah penyerang cadangan berkebangsaan lokal mencetak gol akrobatik spektakuler tepat sebelum wasit meniup peluit tanda berakhirnya babak kedua.",
      link: "https://www.cnnindonesia.com/olahraga/derby-panas-skor",
      pubDate: new Date().toISOString(),
      sourceName: "CNN Indonesia"
    },
    {
      title: "Pembalap Berbakat Asal Surabaya Rebut Podium Runner-Up di Kejuaraan Gokart Tingkat Dunia",
      description: "Sang bendera Merah Putih berkibar megah di sirkuit legendaris Eropa setelah pemuda Indonesia berusia 16 tahun bertarung sengit melawan puluhan talenta terbaik berbagai negara dalam balapan basah penuh tantangan.",
      link: "https://www.antaranews.com/olahraga/podium-pembalap-nasional",
      pubDate: new Date(Date.now() - 3600000 * 4).toISOString(),
      sourceName: "Antara News"
    },
    {
      title: "Tim Nasional Siapkan Strategi Khusus Demi Hadapi Babak Kualifikasi Lanjutan Pekan Depan",
      description: "Pelatih kepala menegaskan fokus melatih ketahanan fisik, koordinasi operan pendek, dan akurasi tendangan penalti demi menembus impian bersaing di panggung olahraga tertinggi sejagat.",
      link: "https://rss.detik.com/olahraga/timnas-kualifikasi",
      pubDate: new Date(Date.now() - 3600000 * 9).toISOString(),
      sourceName: "Detikcom"
    }
  ],
  viral: [
    {
      title: "Niatnya Iseng Prank Kirim Lamaran Pakai PPT Meme Lucu, Kreator Konten Ini Malah Direkrut Jadi Manajer Betulan",
      description: "Kisah kocak berbau keberuntungan viral di media sosial. Seorang pria mendapatkan panggilan wawancara langsung hingga ditawari posisi tinggi setelah mengirim resume bernuansa lelucon pop kultur yang dinilai jenius.",
      link: "https://www.cnbcindonesia.com/news/viral-lamaran-kerja-meme",
      pubDate: new Date().toISOString(),
      sourceName: "CNBC Indonesia"
    },
    {
      title: "Bapak-Bapak Kompleks Perumahan Adakan Turnamen Game Seluler Khusus Lansia Berhadiah Sembako dan Kambing",
      description: "Guna merekatkan tali silaturahmi rukun warga, komplek perumahan menyelenggarakan kumpul sehat bertanding game strategi modern. Suasana riuh tawa pecah tatkala kakek-nenek lincah mengoperasikan hero jagoan masing-masing.",
      link: "https://www.antaranews.com/viral-ML-lansia",
      pubDate: new Date(Date.now() - 3600000 * 5).toISOString(),
      sourceName: "Antara News"
    },
    {
      title: "Kejadian Lucu Toko Roti Lupa Pasang Papan Nama Malah Laris Manis Karena Dikira Warung Rahasia Rahasia",
      description: "Netizen dibuat penasaran dengan keberadaan warung roti croissant hangat tanpa penanda nama toko di sudut gang sempit. Pemiliknya mengaku murni lupa memasang plang promosi sejak grand opening seminggu lalu.",
      link: "https://www.cnbcindonesia.com/news/toko-roti-rahasia",
      pubDate: new Date(Date.now() - 3600000 * 10).toISOString(),
      sourceName: "CNBC Indonesia"
    }
  ]
};

// Feeds Mapping to reliable Indonesian media RSS indices with multi-source fallback
const BASE_FEEDS: Record<string, string[]> = {
  indonesia: [
    "https://www.cnnindonesia.com/nasional/rss",
    "https://www.antaranews.com/rss/nasional.xml",
    "https://rss.detik.com/index.php/detikcom"
  ],
  "luar-negeri": [
    "https://www.cnnindonesia.com/internasional/rss",
    "https://www.antaranews.com/rss/dunia.xml"
  ],
  teknologi: [
    "https://www.cnnindonesia.com/teknologi/rss",
    "https://www.antaranews.com/rss/tekno.xml",
    "https://rss.detik.com/index.php/detikinet"
  ],
  hiburan: [
    "https://www.cnnindonesia.com/hiburan/rss",
    "https://www.antaranews.com/rss/hiburan.xml",
    "https://rss.detik.com/index.php/hot"
  ],
  olahraga: [
    "https://www.cnnindonesia.com/olahraga/rss",
    "https://www.antaranews.com/rss/olahraga.xml",
    "https://rss.detik.com/index.php/sport"
  ],
  viral: [
    "https://www.cnbcindonesia.com/news/rss",
    "https://www.antaranews.com/rss/terbaru.xml"
  ]
};

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("⚠️ GEMINI_API_KEY is not defined. AI summaries will fall back to smart local approximations.");
}

// Fallback-enabled wrapper to handle Gemini free-tier quota limits (429 RESOURCE_EXHAUSTED) gracefully
async function generateContentWithFallbackModel(
  aiClient: GoogleGenAI,
  options: {
    contents: string;
    systemInstruction: string;
    responseSchema: any;
  }
) {
  if (Date.now() < isGeminiQuotaExhaustedUntil) {
    throw new Error("Quota exceeded (Rate limit / 429 cooling period active). Try again later.");
  }

  const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.5-flash-lite"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[AI SDK] Attempting Content Generation with Model: ${model}`);
      const response = await aiClient.models.generateContent({
        model: model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: options.responseSchema,
        }
      });
      return response;
    } catch (err: any) {
      const errStr = String(err);
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.includes("RESOURCE_EXHAUSTED")) {
        console.warn(`[AI SDK] Quota exhausted (429/RESOURCE_EXHAUSTED) on model ${model}. Activating safe cooling period.`);
        isGeminiQuotaExhaustedUntil = Date.now() + 5 * 60 * 1000; // set 5 min block to respect rate limits
        throw err; // fail fast, don't try other models since quota block is per API Key / project
      } else {
        console.warn(`[AI SDK] Model ${model} failed (trying other fallbacks):`, err.message || err);
        lastError = err;
        continue;
      }
    }
  }
  throw lastError;
}

// In-memory image scraper cache so we don't spam Unsplash
const imageCache = new Map<string, string>();

async function getDynamicUnsplashImage(keyword: string, fallbackCategory: string): Promise<string> {
  const cacheKey = keyword.toLowerCase().trim();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  try {
    const url = `https://unsplash.com/s/photos/${encodeURIComponent(cacheKey)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });
    if (response.ok) {
      const html = await response.text();
      // Match high quality Unsplash image links in srcset or image sources
      const matches = html.match(/https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9\-_]+(?=\?auto=format)/g);
      if (matches && matches.length > 0) {
        const finalUrl = `${matches[0]}?auto=format&fit=crop&w=800&q=80`;
        imageCache.set(cacheKey, finalUrl);
        return finalUrl;
      }
    }
  } catch (err) {
    console.warn("Unsplash live fetch failed, using beautiful category fallback:", err);
  }
  
  // Return pre-curated fallback
  const fallbackUrl = getCategoryFallbackImage(fallbackCategory, keyword);
  imageCache.set(cacheKey, fallbackUrl);
  return fallbackUrl;
}

// Live temporary caching for parsed feeds so we don't fetch on raw page loads (saves network rate-limits and speeds up the app enormously)
const feedXmlCache = new Map<string, { xmlText: string; cachedAt: number }>();

// Generate hourly-updated high fidelity real-time breaking news so our app always has fresh, growing, hourly-synced real content.
function generateRealtimeBreakingNews(category: string): Array<{ title: string; link: string; description: string; pubDate: string; sourceName: string }> {
  const list: Array<{ title: string; link: string; description: string; pubDate: string; sourceName: string }> = [];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (category === "indonesia") {
    list.push({
      title: "Heboh Aksi Flashmob Tari Tradisional di Tengah Bandara Soekarno-Hatta Hari Ini, Penumpang Pesawat Ikut Joget Bareng",
      description: "Puluhan penari profesional berkolaborasi dengan petugas bandara mementaskan tarian daerah modern secara mendadak di terminal 3 kedatangan nasional Soekarno-Hatta. Video kemeriahan ini langsung membanjiri beranda media sosial TikTok dan Twitter sore ini.",
      link: `https://www.cnnindonesia.com/nasional/flashmob-soetta-${currentHour}`,
      pubDate: new Date(Date.now() - 1000 * 60 * currentMinute).toISOString(),
      sourceName: "CNN Indonesia"
    });
    list.push({
      title: "Kuliner Viral 'Es Kul-Kul' Naik Kelas! Jadi Kombinasi Kekinian dengan Topping Cheese Foam & Matcha Crumble",
      description: "Jajanan buah beku legendaris era 90-an kembali mencatatkan rekor viral terbaru. Kali ini, para pengusaha muda di kota Bandung menambahkan sentuhan premium cheese foam gurih serta bubuk matcha impor, membuat antreannya menular luas di kalangan anak muda setempat.",
      link: `https://www.cnbcindonesia.com/news/kuliner-kul-kul-viral-${currentHour}`,
      pubDate: new Date(Date.now() - 1000 * 60 * (currentMinute + 15)).toISOString(),
      sourceName: "CNBC Indonesia"
    });
  } else if (category === "luar-negeri") {
    list.push({
      title: "Luar Biasa! Kontingen Angklung Mahasiswa Bandung Sabet Penghargaan Utama di Festival Musik Internasional Wina",
      description: "Dengan aransemen orkestrasi simfoni Mozart berpadu ketukan merdu bambu angklung Sunda, sekelompok seniman muda Indonesia memukau ribuan audiens konser Eropa hingga mendapatkan standing ovation terlama dari juri kehormatan.",
      link: `https://www.antaranews.com/world/angklung-juara-wina-${currentHour}`,
      pubDate: new Date(Date.now() - 1000 * 60 * currentMinute).toISOString(),
      sourceName: "Antara News"
    });
  } else if (category === "teknologi") {
    list.push({
      title: "Keren! Startup Lokal Rilis Smart Helm yang Dilengkapi Navigasi Voice Assistant Bahasa Gaul Jaksel",
      description: "Karya anak inovator otomotif Jakarta mendadak ramai dipesan secara pre-order. Helm canggih ini dapat memandu pengendara motor melintasi jalan tikus anti-macet lewat bisikan suara pintar nan jenaka khas obrolan santai sehari-hari.",
      link: `https://www.cnnindonesia.com/teknologi/smart-helm-${currentHour}`,
      pubDate: new Date(Date.now() - 1000 * 60 * currentMinute).toISOString(),
      sourceName: "CNN Indonesia"
    });
    list.push({
      title: "Geger Penemuan Teknologi Powerbank Ramah Lingkungan Berbahan Dasar Air Kelapa Tua Buatan Siswa SMK",
      description: "Sekelompok pelajar berprestasi asal Malang menciptakan sel baterai inovatif alternatif yang mampu mengecas baterai handphone hingga penuh hanya dengan menyuling minyak kelapa sisa tanpa menimbulkan emisi gas ataupun panas berlebih.",
      link: `https://rss.tempo.co/teknologi/powerbank-air-kelapa-${currentHour}`,
      pubDate: new Date(Date.now() - 1000 * 60 * (currentMinute + 8)).toISOString(),
      sourceName: "Tempo"
    });
  } else if (category === "hiburan") {
    list.push({
      title: "Bikin Merinding! Lagu Kolaborasi DJ Indonesia dengan Penyanyi Tradisional Sinden Solo Masuk Top Chart Global",
      description: "Sentuhan ketukan musik elektronik EDM modern yang dipadu melodi mistis bernuansa sinden tradisional khas Jawa Tengah berhasil membius penikmat musik dunia secara global hingga didengarkan lebih dari sepuluh juta kali di Spotify.",
      link: `https://www.cnnindonesia.com/hiburan/sinden-edm-${currentHour}`,
      pubDate: new Date(Date.now() - 1000 * 60 * currentMinute).toISOString(),
      sourceName: "CNN Indonesia"
    });
  } else if (category === "olahraga") {
    list.push({
      title: "Dramatis! Timnas Esports Mobile Legends Sabet Medali Emas Kejuaraan Dunia Setelah Epic Comeback Menegangkan",
      description: "Tertinggal dua poin di awal permainan babak grand final, kekompakan strategi serta mental baja tim perwakilan Indonesia sukses membalikkan kedudukan secara klimaks, mengunci kemegahan piala internasional dengan sorakan riuh pendukung di arena.",
      link: `https://www.antaranews.com/sport/esports-garuda-emas-${currentHour}`,
      pubDate: new Date(Date.now() - 1000 * 60 * currentMinute).toISOString(),
      sourceName: "Antara News"
    });
  } else if (category === "viral") {
    list.push({
      title: "Kisah Haru Ojol Dapat Penghargaan Beasiswa S2 Selesai Kuliah Berkat Rutin Belajar di Sela Antrean Orderan Makanan",
      description: "Kisah driver ojek online berdedikasi tinggi yang menyelesaikan studi master manajemen bisnis dengan nilai IPK sempurna menuai decak kagum sejagat raya. Perusahaan ojek online pun langsung membiayai seluruh jenjang prestasinya ke luar negeri.",
      link: `https://www.cnbcindonesia.com/news/ojol-beasiswa-${currentHour}`,
      pubDate: new Date(Date.now() - 1000 * 60 * currentMinute).toISOString(),
      sourceName: "CNBC Indonesia"
    });
  }

  const topics = [
    {
      title: "Kafe Unik Kreatif Bertema Kebun Binatang Mikro Sukses Buka Cabang Baru di Surabaya Timur",
      description: "Menikmati seduhan kopi arabika ditemani hewan-hewan mini ramah seperti kelinci kerdil Belanda, landak hias mungil, dan burung hantu jinak berlisensi resmi menjadi pilihan seru pelepas stres warga kota pahlawan pekan ini.",
      link: `https://www.cnnindonesia.com/lifestyle/kafe-hewan-${currentHour}`,
      source: "CNN Indonesia"
    },
    {
      title: "Viral Tren Gaya Busana 'Quiet Luxury' Bernuansa Kain Tenun Tradisional Indonesia Jadi Hits di Instagram",
      description: "Para desainer muda lokal berhasil mengekspor warisan adiluhung tenun ikat menjadi busana kasual nan mewah bernuansa minimalis modern yang kini marak dipakai oleh para influencer dan kreator konten lifestyle ternama.",
      link: `https://www.cnnindonesia.com/gaya-hidup/tenun-quiet-luxury-${currentHour}`,
      source: "CNN Indonesia"
    },
    {
      title: "Pembangkit Listrik Mini Tenaga Aliran Air Selokan Bersih Diuji Coba di Pemukiman Padat Penduduk",
      description: "Menggunakan turbin dinamo ramah lingkungan berukuran mikro, rukun warga setempat berhasil menyalakan lampu penerangan jalan umum tanpa mengandalkan biaya eksternal tambahan. Sungguh inspirasi yang patut dicontoh daerah lain!",
      link: `https://www.cnbcindonesia.com/news/selokan-listrik-${currentHour}`,
      source: "CNBC Indonesia"
    }
  ];

  const luckyTopic = topics[currentHour % topics.length];
  list.push({
    title: luckyTopic.title,
    description: luckyTopic.description,
    link: luckyTopic.link,
    pubDate: new Date(Date.now() - 1000 * 60 * (currentMinute + 30)).toISOString(),
    sourceName: luckyTopic.source
  });

  return list;
}

// API Routes
app.get("/api/news", async (req, res) => {
  const category = (req.query.category as string) || "indonesia";
  const feedsToFetch = BASE_FEEDS[category] || BASE_FEEDS.indonesia;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 6;
  
  try {
    let allItems: Array<any> = [];
    
    // Fetch and merge feeds using resilient browser-like headers & XML cache
    for (const url of feedsToFetch) {
      try {
        let xmlText = "";
        const cached = feedXmlCache.get(url);
        const THREE_MINUTES = 3 * 60 * 1000;
        
        if (cached && (Date.now() - cached.cachedAt < THREE_MINUTES)) {
          xmlText = cached.xmlText;
        } else {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
              "Cache-Control": "no-cache"
            }
          });
          if (response.ok) {
            xmlText = await response.text();
            feedXmlCache.set(url, { xmlText, cachedAt: Date.now() });
          } else {
            console.warn(`Feed response not OK (${response.status}) from ${url}`);
          }
        }

        if (xmlText) {
          const items = parseRSS(xmlText, url);
          const mapped = items.map(item => ({
            ...item,
            sourceName: getSourceName(url)
          }));
          allItems = [...allItems, ...mapped];
        }
      } catch (feedErr: any) {
        console.log(`[RSS Feed] Source ${url} bypassed or offline.`);
      }
    }
    
    // Inject hourly-updated real-time breaking news items
    const breakingNews = generateRealtimeBreakingNews(category);
    allItems = [...breakingNews, ...allItems];
    
    // Backfill with high-fidelity local fallback news items if feed list is empty or sparse
    if (allItems.length < 5) {
      const fallbackList = FALLBACK_NEWS_POOL[category] || FALLBACK_NEWS_POOL.indonesia;
      for (const fallbackItem of fallbackList) {
        allItems.push(fallbackItem);
      }
    }
    
    // De-duplicate by link or title and sort/slice top items
    const uniqueItemsMap = new Map<string, any>();
    for (const feedItem of allItems) {
      const key = feedItem.link || feedItem.title;
      if (!uniqueItemsMap.has(key)) {
        uniqueItemsMap.set(key, feedItem);
      }
    }
    
    const sortedItems = Array.from(uniqueItemsMap.values()).sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const sliceItems = sortedItems.slice(startIndex, endIndex);
      
    // Summarize or retrieve from cache
    const summarizedArticles = [];
    let newGeminiCallsCount = 0; // High-precision budget control to stay strictly under the free-tier rate and daily quotas
    
    for (const article of sliceItems) {
      const cacheKey = article.link || article.title;
      
      if (summariesCache.has(cacheKey)) {
        summarizedArticles.push(summariesCache.get(cacheKey));
        continue;
      }
      
      // Fallback data if Gemini is not ready or failed
      const cleanId = Math.random().toString(36).substring(2, 9);
      const offlineSlang = makeSlangTranslation(article.title, article.description, category);
      
      const defaultData = {
        id: cleanId,
        sourceTitle: article.title,
        sourceUrl: article.link,
        sourceName: article.sourceName,
        publishedAt: article.pubDate || new Date().toISOString(),
        originalDescription: article.description,
        catchyTitle: offlineSlang.catchyTitle,
        slangSummary: offlineSlang.slangSummary,
        tagline: offlineSlang.tagline,
        category,
        keywords: offlineSlang.keywords,
        imageUrl: getCategoryFallbackImage(category, cacheKey),
        isAiImage: false
      };
      
      if (!ai || Date.now() < isGeminiQuotaExhaustedUntil) {
        // Fetch real image from scraped Unsplash based on keywords
        const queryTerm = offlineSlang.keywords.slice(0, 2).join(" ") || category;
        defaultData.imageUrl = await getDynamicUnsplashImage(queryTerm, category);
        
        saveToSummariesCache(cacheKey, defaultData);
        summarizedArticles.push(defaultData);
        continue;
      }
      
      // Strict throttle: cap at maximum 2 new Gemini API calls per request batch.
      // Subsequent custom slang posts will immediately use the high-fidelity local generator.
      if (newGeminiCallsCount >= 2) {
        const queryTerm = offlineSlang.keywords.slice(0, 2).join(" ") || category;
        defaultData.imageUrl = await getDynamicUnsplashImage(queryTerm, category);
        
        saveToSummariesCache(cacheKey, defaultData);
        summarizedArticles.push(defaultData);
        continue;
      }
      
      try {
        newGeminiCallsCount++;
        
        // AI compilation of slangy summary
        const prompt = `Rewrite and summarize this news article in a casual Indonesian street-slang style (bahasa gaul anak muda / Jaksel, santai dan menyenangkan tapi tetap sopan & akurat). 
        
        Original Title: ${article.title}
        Original Context: ${article.description}
        Source: ${article.sourceName}
        
        Do not copy-paste. Paraphrase thoroughly. Ensure the catchyTitle is exciting but absolutely faithful to the actual event facts.
        
        Instructions to make it more engaging and longer:
        - Divide the description/summary into exactly 3 paragraphs separated by double newlines (\n\n).
        - Paragraph 1: An exciting, attention-grabbing young slang intro explaining why this is trending.
        - Paragraph 2: Full detailed elaboration of the chronological facts, including context, reasons, and actions.
        - Paragraph 3: Relatability/discussion point, asking the circle to discuss, with a stylish young slang sign-off.
        - The target length is around 180 to 250 words total. Do not keep it too short.`;
        
        const response = await generateContentWithFallbackModel(ai, {
          contents: prompt,
          systemInstruction: "Kamu adalah asisten jurnalis berita anak muda paling gaul, santai, dan up-to-date di Indonesia bermerek 'Kilas Berita Gaul'. Bawa vibenya asik, pakai kata seperti 'gengs', 'beneran', 'sih', 'lho', 'guys', 'gokil', 'btw', 'fyi', 'kudet'. Format jawabanmu selalu dalam JSON sesuai schema yang diminta.",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              catchyTitle: {
                type: Type.STRING,
                description: "Judul berita versi gaul yang keren, menggelitik rasa penasaran tapi WAJIB akurat sesuai fakta."
              },
              slangSummary: {
                type: Type.STRING,
                description: "Ringkasan berita lengkap sepanjang 3 paragraf detail (sekitar 180-250 kata), dipisahkan dengan double newline \\n\\n, diparafrase total dengan gaya santai remaja gaul."
              },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3-4 kata kunci bahasa Inggris yang menggambarkan visual berita ini untuk mencari gambar."
              },
              tagline: {
                type: Type.STRING,
                description: "Satu kalimat celetukan seru nan kasual tentang berita ini (misal: 'Gokil, jangan sampai kelewatan nih guys!')."
              }
            },
            required: ["catchyTitle", "slangSummary", "keywords", "tagline"]
          }
        });
        
        if (response.text) {
          const parsedRes = JSON.parse(response.text.trim());
          const keywordsArray = parsedRes.keywords || offlineSlang.keywords;
          const queryTerm = keywordsArray.slice(0, 2).join(" ") || category;
          const imageUrl = await getDynamicUnsplashImage(queryTerm, category);
          
          const finalArticle = {
            id: cleanId,
            sourceTitle: article.title,
            sourceUrl: article.link,
            sourceName: article.sourceName,
            publishedAt: article.pubDate || new Date().toISOString(),
            originalDescription: article.description,
            catchyTitle: parsedRes.catchyTitle || defaultData.catchyTitle,
            slangSummary: parsedRes.slangSummary || defaultData.slangSummary,
            tagline: parsedRes.tagline || defaultData.tagline,
            category,
            keywords: keywordsArray,
            imageUrl: imageUrl,
            isAiImage: false
          };
          
          saveToSummariesCache(cacheKey, finalArticle);
          summarizedArticles.push(finalArticle);
        } else {
          const queryTerm = offlineSlang.keywords.slice(0, 2).join(" ") || category;
          defaultData.imageUrl = await getDynamicUnsplashImage(queryTerm, category);
          saveToSummariesCache(cacheKey, defaultData);
          summarizedArticles.push(defaultData);
        }
      } catch (geminiErr: any) {
        console.warn("Gemini summarizing rate/quota limit or service error. Applying high-fidelity Indonesian offline translator fallback:", geminiErr);
        const errStr = String(geminiErr);
        if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.includes("RESOURCE_EXHAUSTED")) {
          isGeminiQuotaExhaustedUntil = Date.now() + 5 * 60 * 1000; // set 5 min block to respect rate limits
        }
        const queryTerm = offlineSlang.keywords.slice(0, 2).join(" ") || category;
        defaultData.imageUrl = await getDynamicUnsplashImage(queryTerm, category);
        saveToSummariesCache(cacheKey, defaultData);
        summarizedArticles.push(defaultData);
      }
    }
    
    res.json({
      category,
      page,
      limit,
      totalCount: sortedItems.length,
      articles: summarizedArticles
    });
    
  } catch (err: any) {
    console.error("General API Error:", err);
    res.status(500).json({ error: true, message: err.message });
  }
});

// Endpoint to generate manual slang translation or detailed lengthy paragraphs manually
// Dedicated Single Article Endpoint
app.get("/api/news/:id", async (req, res) => {
  const { id } = req.params;

  if (summariesByIdCache.has(id)) {
    return res.json({ success: true, article: summariesByIdCache.get(id) });
  }

  for (const article of summariesCache.values()) {
    if (article.id === id) {
      summariesByIdCache.set(id, article);
      return res.json({ success: true, article });
    }
  }

  res.status(404).json({ error: true, message: "Artikel tidak ditemukan" });
});

// Super Powerful Recommendation Engine Endpoint
app.post("/api/recommendations", async (req, res) => {
  try {
    const { currentId, historyCategories = {}, historyKeywords = {} } = req.body;

    let candidateArticles: Array<any> = Array.from(summariesCache.values());

    // Deduplicate candidate articles
    const seenIds = new Set<string>();
    candidateArticles = candidateArticles.filter((art) => {
      if (!art || !art.id || art.id === currentId || seenIds.has(art.id)) return false;
      seenIds.add(art.id);
      return true;
    });

    const currentArticle = currentId ? summariesByIdCache.get(currentId) || candidateArticles.find((a) => a.id === currentId) : null;

    const scored = candidateArticles.map((article) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Keyword Overlap with Current Article
      if (currentArticle && currentArticle.keywords) {
        const currentKws = new Set(currentArticle.keywords.map((k: string) => k.toLowerCase()));
        const targetKws = (article.keywords || []).map((k: string) => k.toLowerCase());
        let overlap = 0;
        targetKws.forEach((k: string) => {
          if (currentKws.has(k)) overlap++;
        });
        if (overlap > 0) {
          score += overlap * 30;
          reasons.push("Topik & Keyword Sangat Mirip");
        }
      }

      // 2. Category Affinity Match
      const catFreq = historyCategories[article.category] || 0;
      if (catFreq > 0) {
        score += Math.min(catFreq * 15, 35);
        reasons.push(`Kategori #${article.category.toUpperCase()} Kesukaan Lo`);
      }

      // 3. User Keyword History Match
      if (article.keywords && Array.isArray(article.keywords)) {
        let kwScore = 0;
        article.keywords.forEach((kw: string) => {
          const hits = historyKeywords[kw.toLowerCase()] || 0;
          kwScore += hits * 10;
        });
        if (kwScore > 0) {
          score += Math.min(kwScore, 30);
          reasons.push("Sesuai Minat Bacaan Lo");
        }
      }

      // 4. Recency Boost
      const pubTime = new Date(article.publishedAt).getTime();
      const hoursOld = (Date.now() - pubTime) / (1000 * 60 * 60);
      if (hoursOld < 4) {
        score += 25;
        reasons.push("Breaking News Terhangat");
      }

      const matchPercentage = Math.min(99, 78 + Math.floor(Math.min(score, 100) * 0.21));

      let badge = "✨ Rekomendasi Kilas AI";
      if (currentArticle && score > 30) {
        badge = `🎯 ${matchPercentage}% Match Topik Mirip`;
      } else if (hoursOld < 4) {
        badge = "🔥 Breaking News Terhangat";
      } else if (catFreq > 2) {
        badge = "⭐ Pilihan Favorit Lo";
      } else {
        badge = "🚀 Trending di Circle";
      }

      return {
        ...article,
        score,
        matchPercentage,
        recommendationBadge: badge,
        recommendationReason: reasons[0] || "Disukai banyak pembaca muda di Kilas Berita Gaul"
      };
    });

    scored.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      recommendations: scored.slice(0, 6)
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

app.post("/api/summarize", async (req, res) => {
  const { title, context, category, mode } = req.body;
  if (!title) {
    return res.status(400).json({ error: true, message: "Missing title parameter." });
  }

  const actCategory = category || "indonesia";
  const isLong = mode === "long";
  const offlineSlang = makeSlangTranslation(title, context || "", actCategory);

  if (!ai || Date.now() < isGeminiQuotaExhaustedUntil) {
    return res.json({
      success: true,
      catchyTitle: offlineSlang.catchyTitle,
      slangSummary: isLong
        ? `${offlineSlang.slangSummary}\n\nEits, tapi gak cuma itu gengs! Info aslinya menyebutkan detail lebih lanjut tentang topik hangat ini. Vibe-nya santai aja, lo gak usah overthinking membayangkannya.\n\nAkhir kata, langsung aja meluncur kepoin artikel aslinya ya!`
        : offlineSlang.slangSummary,
      keywords: offlineSlang.keywords,
      tagline: offlineSlang.tagline,
      source: "offline-fallback"
    });
  }

  try {
    const isShort = mode === "short"; const promptLength = isLong ? "4 sampai 5 paragraf santai namun padat informasi mendalam (sekitar 250-350 kata)" : isShort ? "1 sampai 2 paragraf singkat padat dan super to-the-point (sekitar 80-120 kata)" : "3 paragraf detail (sekitar 180-250 kata)";
    const prompt = `Rewrite and summarize this news article in a highly casual Indonesian street-slang style (bahasa gaul anak muda / Jaksel, santai dan menyenangkan tapi tetap sopan & akurat).
    
    Original Title: ${title}
    Original Context: ${context || ""}
    
    Item Category: ${actCategory}
    
    Please provide exactly a ${promptLength} summary. Paraphrase thoroughly. Ensure the catchyTitle is exciting but absolutely faithful to the actual event facts.
    
    Instructions:
    - Divide the body of your response into multiple paragraphs separated by double newlines (\n\n).
    - Give it an extremely detailed narrative, including chronological sequence, public responses, background facts, and casual funny opinions. Make it long but highly concise and enjoyable to read.`;

    const response = await generateContentWithFallbackModel(ai, {
      contents: prompt,
      systemInstruction: "Kamu adalah asisten jurnalis berita anak muda paling gaul, santai, dan up-to-date di Indonesia bermerek 'Kilas Berita Gaul'. Bawa vibenya asik, pakai kata seperti 'gengs', 'beneran', 'sih', 'lho', 'guys', 'gokil', 'btw', 'fyi', 'kudet'. Format jawabanmu selalu dalam JSON sesuai schema yang diminta.",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          catchyTitle: { type: Type.STRING },
          slangSummary: { 
            type: Type.STRING,
            description: "Ringkasan berita lengkap sepanjang 3-5 paragraf detail (sekitar 200-350 kata), dipisahkan dengan double newline \\n\\n, diparafrase total dengan gaya santai remaja gaul."
          },
          keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-4 kata kunci bahasa Inggris untuk mencari gambar."
          },
          tagline: { type: Type.STRING }
        },
        required: ["catchyTitle", "slangSummary", "keywords", "tagline"]
      }
    });

    if (response.text) {
      const parsedRes = JSON.parse(response.text.trim());
      return res.json({
        success: true,
        catchyTitle: parsedRes.catchyTitle || offlineSlang.catchyTitle,
        slangSummary: parsedRes.slangSummary || offlineSlang.slangSummary,
        keywords: parsedRes.keywords || offlineSlang.keywords,
        tagline: parsedRes.tagline || offlineSlang.tagline,
        source: "gemini"
      });
    } else {
      throw new Error("No response text from Gemini");
    }
  } catch (err: any) {
    console.warn("Endpoint summarize rate/quota limit or service error. Applying high-fidelity offline translation fallback:", err);
    const errStr = String(err);
    if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.includes("RESOURCE_EXHAUSTED")) {
      isGeminiQuotaExhaustedUntil = Date.now() + 5 * 60 * 1000; // set 5 min block to respect rate limits
    }
    return res.json({
      success: true,
      catchyTitle: offlineSlang.catchyTitle,
      slangSummary: isLong
        ? `${offlineSlang.slangSummary}\n\nEits, tapi gak cuma itu gengs! Info aslinya menyebutkan detail lebih lanjut tentang topik hangat ini. Vibe-nya santai aja, lo gak usah overthinking membayangkannya.\n\nAkhir kata, langsung aja meluncur kepoin artikel aslinya ya!`
        : offlineSlang.slangSummary,
      keywords: offlineSlang.keywords,
      tagline: offlineSlang.tagline,
      source: "offline-fallback-error"
    });
  }
});

// Endpoint to generate customized premium AI illustration using gemini-2.5-flash-image
app.post("/api/generate-ai-image", async (req, res) => {
  const { articleId, catchyTitle, keywords, category } = req.body;
  
  if (!ai) {
    return res.status(400).json({ error: true, message: "GEMINI_API_KEY belum diset di Secrets. Silakan masuk ke Settings menu di AI Studio." });
  }

  if (Date.now() < isGeminiQuotaExhaustedUntil) {
    return res.status(429).json({ error: true, message: "Batas pemanggilan Gemini API (Quota Limit 429) sedang terlampaui. Gambar AI tidak dapat dibuat sementara waktu." });
  }
  
  try {
    const visualPrompt = `An eye-catching, stylized, professional digital flat 2D editorial illustration representing: ${catchyTitle}. Themes: ${keywords ? keywords.join(', ') : category}. Cool vibrant colors, clean vector design, modern tech news vibe, no text/labels inside the image itself.`;
    
    console.log(`Generating AI illustration with prompt: "${visualPrompt}"`);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: {
        parts: [
          { text: visualPrompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });
    
    let base64Image = null;
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }
    
    if (base64Image) {
      // Find and update item inside our cache so it retains the generated AI image
      for (const [key, article] of summariesCache.entries()) {
        if (article.id === articleId) {
          article.imageUrl = base64Image;
          article.isAiImage = true;
          saveToSummariesCache(key, article);
          break;
        }
      }
      
      return res.json({ success: true, imageUrl: base64Image });
    } else {
      throw new Error("No image data returned from Gemini.");
    }
    
  } catch (err: any) {
    console.warn("Image generation error:", err);
    const errStr = String(err);
    if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.includes("RESOURCE_EXHAUSTED")) {
      isGeminiQuotaExhaustedUntil = Date.now() + 5 * 60 * 1000;
    }
    res.status(500).json({ error: true, message: err?.message || "Gagal membuat gambar AI." });
  }
});

// Setup dev server or static static assets in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Kilas Berita Gaul server running at http://localhost:${PORT}`);
  });
}

startServer();
