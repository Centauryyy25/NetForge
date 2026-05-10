import { Badge } from "@/components/ui/badge";
import {
  CUSTOMER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  type CustomerStatus,
  type PaymentStatus,
  type RequestStatus,
} from "@/lib/constants";

type StatusType = "customer" | "payment" | "request";

const CUSTOMER_VARIANT: Record<CustomerStatus, string> = {
  active: "bg-success/85 text-success-foreground",
  inactive: "bg-muted/70 text-muted-foreground",
  suspended: "bg-warning/85 text-warning-foreground",
  terminated: "bg-destructive/85 text-destructive-foreground",
  provisioning_failed: "bg-destructive/85 text-destructive-foreground",
};

const PAYMENT_VARIANT: Record<PaymentStatus, string> = {
  paid: "bg-success/85 text-success-foreground",
  pending: "bg-warning/85 text-warning-foreground",
  overdue: "bg-destructive/85 text-destructive-foreground",
  cancelled: "bg-muted/70 text-muted-foreground",
};

const REQUEST_VARIANT: Record<RequestStatus, string> = {
  open: "bg-primary/85 text-primary-foreground",
  in_progress: "bg-warning/85 text-warning-foreground",
  approved: "bg-success/85 text-success-foreground",
  rejected: "bg-destructive/85 text-destructive-foreground",
  resolved: "bg-success/85 text-success-foreground",
  closed: "bg-muted/70 text-muted-foreground",
};

interface StatusBadgeProps {
  status: string;
  type: StatusType;
}

export function StatusBadge({ status, type }: StatusBadgeProps) {
  let label: string;
  let className: string;

  switch (type) {
    case "customer":
      label = CUSTOMER_STATUS_LABELS[status as CustomerStatus] ?? status;
      className = CUSTOMER_VARIANT[status as CustomerStatus] ?? "";
      break;
    case "payment":
      label = PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status;
      className = PAYMENT_VARIANT[status as PaymentStatus] ?? "";
      break;
    case "request":
      label = REQUEST_STATUS_LABELS[status as RequestStatus] ?? status;
      className = REQUEST_VARIANT[status as RequestStatus] ?? "";
      break;
  }

  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}
