import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
  maxDuration: 60,
};

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }

    const { imageBase64, mimeType } = body || {};

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Gambar screenshot (imageBase64) wajib disertakan.',
      });
    }

    // Clean base64 string if data URL prefix exists
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    const validMimeType = mimeType || 'image/jpeg';

    const ai = getGeminiClient();

    const prompt = `Anda adalah asisten AI khusus membaca screenshot produk marketplace (TikTok Shop, Shopee, Tokopedia, dll).
Tugas Anda: Analisis screenshot produk ini secara teliti dan ekstrak informasinya ke dalam format JSON yang valid.

Aturan Ekstraksi:
1. "productName": Nama atau judul lengkap produk yang tertera di screenshot. Bersihkan dari karakter aneh yang tidak relevan.
2. "productPrice": Harga jual produk dalam angka murni integer (contoh: jika Rp54.450 atau 54.450 -> 54450. Jika tidak terbaca -> 0).
3. "platform": Platform marketplace yang terdeteksi ("TikTok" untuk TikTok Shop, "Shopee" untuk Shopee, atau "MANUAL" jika tidak yakin).
4. "category": Perkiraan kategori produk (pilih satu yang paling cocok dari: "Skincare & Kecantikan", "Fashion & Pakaian", "Mainan & Hobi", "Baju Anak & Bayi", "Elektronik & Gadget", "Rumah Tangga & Dapur", "Otomotif & Aksesoris", "Makanan & Minuman", "Kesehatan & Kebugaran", atau "Lainnya").
5. "aiRecommendation": Jika terdapat badge atau ranking (misal "Top selling #1", "Best Seller", "Paling Laris #1", "Mall", "Star+"), tuliskan (contoh: "TOP SELLING #1"). Jika tidak ada badge khusus, isi string kosong "".
6. "earningInfo": Jika ada informasi perkiraan penghasilan komisi di screenshot kreator (contoh: "Earn Rp5.445", "Estimasi Komisi Rp5.000"), tuliskan teks aslinya sebagai informasi pembacaan. JANGAN jadikan ini sebagai komisi real. Jika tidak ada, isi "".
7. "variantOrSize": Jika tertera varian / ukuran / warna yang dipilih di screenshot (contoh: "Hitam, Size L"), tuliskan. Jika tidak ada, isi "".
8. "notes": Ringkasan singkat fitur atau catatan penting dari produk.
9. "productImageBoundingBox": Cari koordinat area gambar/foto produk utama dalam screenshot dalam format box_2d [ymin, xmin, ymax, xmax] dengan skala 0 hingga 1000. Jika foto produk utama jelas, berikan koordinatnya agar bisa dicrop. Jika tidak jelas atau penuh, isi null.
10. "confidence": Tingkat keyakinan pembacaan ("HIGH", "MEDIUM", atau "LOW") untuk masing-masing field ("productName", "productPrice", "platform").

Format output WAJIB HANYA JSON murni strictly valid sesuai schema:
{
  "productName": "string",
  "productPrice": 0,
  "platform": "TikTok" | "Shopee" | "MANUAL",
  "category": "string",
  "aiRecommendation": "string",
  "earningInfo": "string",
  "variantOrSize": "string",
  "notes": "string",
  "productImageBoundingBox": {
    "box_2d": [0, 0, 0, 0]
  } | null,
  "confidence": {
    "productName": "HIGH" | "MEDIUM" | "LOW",
    "productPrice": "HIGH" | "MEDIUM" | "LOW",
    "platform": "HIGH" | "MEDIUM" | "LOW"
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: validMimeType,
            data: cleanBase64,
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsedData: any = {};

    try {
      parsedData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Error parsing Gemini response as JSON:', parseErr, responseText);
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedData = JSON.parse(match[0]);
      } else {
        throw new Error('Format hasil AI tidak valid.');
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        productName: parsedData.productName || '',
        productPrice: typeof parsedData.productPrice === 'number' ? parsedData.productPrice : (parseInt(String(parsedData.productPrice).replace(/\D/g, ''), 10) || 0),
        platform: parsedData.platform || 'MANUAL',
        category: parsedData.category || 'Skincare & Kecantikan',
        aiRecommendation: parsedData.aiRecommendation || '',
        earningInfo: parsedData.earningInfo || '',
        variantOrSize: parsedData.variantOrSize || '',
        notes: parsedData.notes || '',
        productImageBoundingBox: parsedData.productImageBoundingBox || null,
        confidence: parsedData.confidence || {
          productName: 'MEDIUM',
          productPrice: 'MEDIUM',
          platform: 'MEDIUM',
        },
      },
    });
  } catch (err: any) {
    console.error('Error scanning screenshot:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal memproses screenshot dengan AI.',
    });
  }
}
