import "dotenv/config";
import { sendWhatsApp } from "../src/lib/whatsapp";

async function main() {
  const phone = process.argv[2];
  
  if (!phone) {
    console.error("Usage: npm run tsx scripts/test-fonnte.ts <nomor_wa>");
    console.error("Contoh: npm run tsx scripts/test-fonnte.ts 081234567890");
    process.exit(1);
  }

  console.log(`Mengirim pesan percobaan ke ${phone}...`);
  try {
    const result = await sendWhatsApp(
      phone, 
      "Halo! \n\nIni adalah pesan percobaan dari sistem YBY NET menggunakan integrasi Fonnte API.\nJika Anda menerima pesan ini, berarti konfigurasi Fonnte sudah berhasil."
    );
    console.log("Hasil Fonnte:", result);
  } catch (error) {
    console.error("Gagal mengirim pesan:", error);
  }
}

main().catch(console.error);
