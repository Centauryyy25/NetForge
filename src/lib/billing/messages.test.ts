import { describe, expect, it } from "vitest";
import {
  buildBillingMessage,
  buildOverdueMessage,
  buildPaymentConfirmationMessage,
} from "./messages";

const base = {
  customerName: "Budi",
  invoiceNumber: "INV-2606-00001",
  amount: 150000,
  periodMonth: "2026-06",
};

describe("billing messages", () => {
  it("uses company name from settings when provided", () => {
    const msg = buildBillingMessage({ ...base, companyName: "Acme Net" });
    expect(msg).toContain("Acme Net");
    expect(msg).not.toContain("YBY NET");
  });

  it("falls back to YBY NET when company name empty", () => {
    expect(buildBillingMessage({ ...base, companyName: "  " })).toContain(
      "YBY NET"
    );
    expect(buildBillingMessage(base)).toContain("YBY NET");
  });

  it("formats amount as Indonesian Rupiah", () => {
    expect(buildBillingMessage(base)).toContain("Rp 150.000");
  });

  it("billing reminder mentions invoice and period", () => {
    const msg = buildBillingMessage(base);
    expect(msg).toContain("INV-2606-00001");
    expect(msg).toContain("2026-06");
    expect(msg).toContain("pengingat tagihan");
  });

  it("overdue message mentions jatuh tempo", () => {
    expect(buildOverdueMessage(base)).toContain("melewati jatuh tempo");
  });

  it("confirmation message thanks the customer and shows method label", () => {
    const msg = buildPaymentConfirmationMessage({
      ...base,
      paymentMethod: "transfer",
    });
    expect(msg).toContain("telah kami terima");
    expect(msg).toContain("Metode: Transfer");
  });

  it("confirmation omits method line when not provided", () => {
    expect(buildPaymentConfirmationMessage(base)).not.toContain("Metode:");
  });
});
