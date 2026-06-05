import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReceiptDocument, type ReceiptData } from "./receipt-template";

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ReceiptDocument, { data }) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

/** Convert number to Indonesian words for receipt amounts. */
export function amountToWords(amount: number): string {
  const ones = [
    "", "satu", "dua", "tiga", "empat", "lima",
    "enam", "tujuh", "delapan", "sembilan",
  ];
  const teens = [
    "sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas",
    "lima belas", "enam belas", "tujuh belas", "delapan belas", "sembilan belas",
  ];

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      return ones[Math.floor(n / 10)] + " puluh" + (n % 10 ? " " + ones[n % 10] : "");
    }
    if (n < 200) {
      return "seratus" + (n % 100 ? " " + convert(n % 100) : "");
    }
    if (n < 1000) {
      return ones[Math.floor(n / 100)] + " ratus" + (n % 100 ? " " + convert(n % 100) : "");
    }
    if (n < 2000) {
      return "seribu" + (n % 1000 ? " " + convert(n % 1000) : "");
    }
    if (n < 1_000_000) {
      return convert(Math.floor(n / 1000)) + " ribu" + (n % 1000 ? " " + convert(n % 1000) : "");
    }
    if (n < 1_000_000_000) {
      return convert(Math.floor(n / 1_000_000)) + " juta" + (n % 1_000_000 ? " " + convert(n % 1_000_000) : "");
    }
    return convert(Math.floor(n / 1_000_000_000)) + " miliar" + (n % 1_000_000_000 ? " " + convert(n % 1_000_000_000) : "");
  }

  if (amount === 0) return "nol rupiah";
  return convert(Math.floor(amount)) + " rupiah";
}
