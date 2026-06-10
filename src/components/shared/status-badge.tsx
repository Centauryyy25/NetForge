import { Badge } from "@/components/ui/badge";
import {
  CUSTOMER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  type CustomerStatus,
  type PaymentStatus,
  type RequestStatus,
  type TicketPriority,
} from "@/lib/constants";

type StatusType = "customer" | "payment" | "request" | "priority";

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

const PRIORITY_VARIANT: Record<TicketPriority, string> = {
  low: "bg-muted/70 text-muted-foreground",
  medium: "bg-primary/85 text-primary-foreground",
  high: "bg-warning/85 text-warning-foreground",
  critical: "bg-destructive/85 text-destructive-foreground",
};

const REQUEST_VARIANT: Record<RequestStatus, string> = {
  open: "bg-primary/85 text-primary-foreground",
  in_progress: "bg-warning/85 text-warning-foreground",
  pending: "bg-orange-500/85 text-white",
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
    case "priority":
      label = TICKET_PRIORITY_LABELS[status as TicketPriority] ?? status;
      className = PRIORITY_VARIANT[status as TicketPriority] ?? "";
      break;
  }

  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}
