import type {
  CustomerStatus,
  PaymentStatus,
  RequestType,
  RequestStatus,
  PaymentMethod,
  Role,
} from "@/lib/constants";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface Package {
  id: number;
  name: string;
  speed: number;
  price: number;
  queueTarget: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface Customer {
  id: number;
  customerId: string;
  name: string;
  address: string;
  phone: string;
  email: string | null;
  nik: string | null;
  packageId: number;
  registrationDate: string;
  activeUntil: string;
  status: CustomerStatus;
  pppoeUsername: string | null;
  onuSn: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  package?: Package;
}

export interface Payment {
  id: number;
  invoiceNumber: string;
  customerId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  periodMonth: string;
  status: PaymentStatus;
  notes: string | null;
  receivedBy: number;
  createdAt: Date;
  customer?: Customer;
  receiver?: User;
}

export interface ServiceRequest {
  id: number;
  ticketNumber: string;
  type: RequestType;
  customerId: number | null;
  name: string;
  phone: string;
  description: string;
  status: RequestStatus;
  adminNotes: string | null;
  handledBy: number | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
  handler?: User;
}

export interface ActivityLog {
  id: number;
  customerId: number;
  action: string;
  duration: number | null;
  bytesIn: string | null;
  bytesOut: string | null;
  timestamp: Date;
  customer?: Customer;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  monthlyRevenue: number;
  pendingPayments: number;
  overduePayments: number;
  openTickets: number;
  activeConnections: number;
}
