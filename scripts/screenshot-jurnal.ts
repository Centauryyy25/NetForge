import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(__dirname, "../../screenshots-jurnal");

const CREDENTIALS = {
  email: "admin@ybynet.id",
  password: "admin123",
};

// Gambar 5–10 sesuai kebutuhan jurnal
const PAGES = [
  { name: "Gambar_05_Daftar_Pelanggan", path: "/customers" },
  { name: "Gambar_06_Tambah_Pelanggan", path: "/customers/new" },
  { name: "Gambar_07_Pencatatan_Pembayaran", path: "/payments" },
  { name: "Gambar_08_Monitoring_Bandwidth", path: "/bandwidth" },
  { name: "Gambar_09_Tiket_Layanan", path: "/service-requests" },
  { name: "Gambar_10_Dashboard", path: "/" },
];

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // retina untuk kualitas cetak
  });
  const page = await context.newPage();

  // ── Login ──
  console.log("🔐 Logging in...");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");

  await page.fill('input[name="email"], input[type="email"]', CREDENTIALS.email);
  await page.fill('input[name="password"], input[type="password"]', CREDENTIALS.password);
  await page.click('button[type="submit"]');

  // Tunggu redirect ke dashboard
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
  console.log("✅ Logged in successfully\n");

  // ── Screenshot setiap halaman ──
  for (const { name, path: pagePath } of PAGES) {
    console.log(`📸 Capturing ${name} (${pagePath})...`);
    await page.goto(`${BASE_URL}${pagePath}`);
    await page.waitForLoadState("networkidle");

    // Tunggu konten muncul
    await page.waitForTimeout(2000);

    const filePath = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({
      path: filePath,
      fullPage: false, // viewport saja (1920x1080)
    });
    console.log(`  ✅ Saved: ${filePath}`);
  }

  await browser.close();
  console.log(`\n🎉 Done! ${PAGES.length} screenshots saved to: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("❌ Screenshot failed:", err);
  process.exit(1);
});
