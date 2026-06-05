import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    textAlign: "center",
    marginBottom: 20,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  companyInfo: {
    fontSize: 8,
    color: "#666",
    marginBottom: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 15,
    borderTop: "2px solid #333",
    borderBottom: "2px solid #333",
    paddingVertical: 6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: "40%",
    color: "#555",
  },
  value: {
    width: "60%",
    fontFamily: "Helvetica-Bold",
  },
  separator: {
    borderBottom: "1px dashed #ccc",
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#333",
  },
  amountBox: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    marginVertical: 10,
    textAlign: "center",
    borderRadius: 4,
  },
  amountLabel: {
    fontSize: 9,
    color: "#666",
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  amountWords: {
    fontSize: 8,
    color: "#666",
    marginTop: 2,
    fontStyle: "italic",
  },
  footer: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: {
    width: "45%",
    textAlign: "center",
  },
  signatureLine: {
    borderBottom: "1px solid #333",
    marginTop: 50,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 9,
  },
  statusPaid: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
    textAlign: "center",
    marginTop: 5,
    padding: 4,
    borderRadius: 4,
  },
  watermark: {
    position: "absolute",
    top: "40%",
    left: "25%",
    fontSize: 48,
    color: "#e5e5e5",
    transform: "rotate(-30deg)",
    fontFamily: "Helvetica-Bold",
  },
});

export interface ReceiptData {
  invoiceNumber: string;
  periodMonth: string;
  amount: number;
  amountInWords: string;
  paymentMethod: string;
  paymentDate: string;
  paidAt: string | null;
  customerName: string;
  customerId: string;
  customerAddress: string;
  customerPhone: string;
  packageName: string;
  packagePrice: number;
  operatorName: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  status: string;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer Bank",
  qris: "QRIS",
};

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  return (
    <Document>
      <Page size="A5" style={styles.page}>
        {data.status === "paid" && (
          <Text style={styles.watermark}>LUNAS</Text>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>
            {data.companyName || "YBY NET"}
          </Text>
          {data.companyAddress && (
            <Text style={styles.companyInfo}>{data.companyAddress}</Text>
          )}
          {data.companyPhone && (
            <Text style={styles.companyInfo}>Telp: {data.companyPhone}</Text>
          )}
        </View>

        <Text style={styles.title}>KWITANSI PEMBAYARAN</Text>

        {/* Invoice Info */}
        <View style={styles.row}>
          <Text style={styles.label}>No. Invoice</Text>
          <Text style={styles.value}>{data.invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Periode</Text>
          <Text style={styles.value}>{data.periodMonth}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>
            {data.status === "paid" ? "LUNAS" : "BELUM LUNAS"}
          </Text>
        </View>

        <View style={styles.separator} />

        {/* Customer Info */}
        <Text style={styles.sectionTitle}>Data Pelanggan</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nama</Text>
          <Text style={styles.value}>{data.customerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ID Pelanggan</Text>
          <Text style={styles.value}>{data.customerId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Alamat</Text>
          <Text style={styles.value}>{data.customerAddress || "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Paket</Text>
          <Text style={styles.value}>{data.packageName}</Text>
        </View>

        {/* Amount */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Jumlah Pembayaran</Text>
          <Text style={styles.amountValue}>
            Rp {data.amount.toLocaleString("id-ID")}
          </Text>
          <Text style={styles.amountWords}>
            {data.amountInWords}
          </Text>
        </View>

        {/* Payment Details */}
        <View style={styles.row}>
          <Text style={styles.label}>Metode Bayar</Text>
          <Text style={styles.value}>
            {METHOD_LABELS[data.paymentMethod] || data.paymentMethod || "-"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tanggal Bayar</Text>
          <Text style={styles.value}>{data.paymentDate || "-"}</Text>
        </View>

        {/* Footer / Signature */}
        <View style={styles.footer}>
          <View style={styles.signatureBlock}>
            <Text>Pelanggan</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{data.customerName}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text>Petugas</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{data.operatorName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
