export type Role = "OWNER" | "ADMIN" | "CASHIER";
export const PAYMENT_MODES = ["CASH", "UPI", "CARD", "CREDIT", "BANK_TRANSFER", "CHEQUE", "WALLET"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  CREDIT: "Credit",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  WALLET: "Wallet",
};

export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export type InvoiceStatus = "PAID" | "PARTIAL" | "UNPAID";
export type StockMovementType =
  | "PURCHASE_IN"
  | "SALE_OUT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "RETURN_IN"
  | "OPENING_STOCK"
  | "DAMAGE_OUT"
  | "SAMPLE_OUT";

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  PURCHASE_IN: "Purchase Entry",
  SALE_OUT: "Invoice Sales",
  ADJUSTMENT_IN: "Stock In",
  ADJUSTMENT_OUT: "Stock Out",
  RETURN_IN: "Return In",
  OPENING_STOCK: "Opening Stock",
  DAMAGE_OUT: "Damage Stock",
  SAMPLE_OUT: "Sample Issue",
};

export type DispatchStatus = "PENDING" | "DISPATCHED" | "DELIVERED";

export const TAB_KEYS = ["home", "dashboard", "billing", "invoices", "customers", "items", "reports", "admin"] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const DEFAULT_TABS_BY_ROLE: Record<Role, TabKey[]> = {
  OWNER: ["home", "dashboard", "billing", "invoices", "customers", "items", "reports", "admin"],
  ADMIN: ["home", "dashboard", "billing", "invoices", "customers", "items", "reports"],
  CASHIER: ["home", "billing", "invoices", "customers"],
};

export interface RoleDTO {
  id: string;
  name: string;
  tabs: TabKey[];
}

export interface CreateRoleInput {
  name: string;
  tabs: TabKey[];
}

export interface UserDTO {
  id: string;
  name: string;
  phone: string;
  role: Role;
  customRoleId?: string | null;
  customRole?: RoleDTO | null;
  active: boolean;
  tabs: TabKey[];
  languageCode: string;
  themeId: string;
  fontScale: number;
  customBackground?: string | null;
  customTextColor?: string | null;
}

export interface UpdatePreferencesInput {
  languageCode?: string;
  themeId?: string;
  fontScale?: number;
  customBackground?: string;
  customTextColor?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserInput {
  name: string;
  phone: string;
  password: string;
  role?: Role;
  customRoleId?: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  customRoleId?: string | null;
  active?: boolean;
  password?: string;
}

export interface CustomerItemDTO {
  id: string;
  itemId: string;
  item: ItemDTO;
  customPrice?: number | null;
  isFavorite: boolean;
}

export interface LinkCustomerItemInput {
  itemId: string;
  customPrice?: number | null;
  isFavorite?: boolean;
}

export interface OutletDTO {
  id: string;
  name: string;
  gstin: string;
  stateCode: string;
  panCode?: string | null;
  cinNo?: string | null;
  addressLine: string;
  regnAddress?: string | null;
  city: string;
  pincode: string;
  phone?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfscCode?: string | null;
}

export interface UpdateOutletInput {
  name?: string;
  gstin?: string;
  panCode?: string;
  cinNo?: string;
  addressLine?: string;
  regnAddress?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfscCode?: string;
}

export interface CustomerDTO {
  id: string;
  customerCode: string;
  name: string;
  phone?: string | null;
  alternateMobile?: string | null;
  email?: string | null;
  company?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  stateCode?: string | null;
  panCode?: string | null;
  gstin?: string | null;
  creditLimit?: number | null;
  active: boolean;
}

export interface ItemDTO {
  id: string;
  name: string;
  hsnCode: string;
  unit: string;
  gstRate: number;
  price: number; // paise
  currentStock: number;
  lowStockThreshold: number;
  active: boolean;
}

export interface InvoiceLineItemInput {
  itemId: string;
  quantity: number;
}

export interface PaymentInput {
  mode: PaymentMode;
  amount: number; // paise
}

export interface CreateInvoiceInput {
  customerId: string;
  lineItems: InvoiceLineItemInput[];
  payments: PaymentInput[];
  billToAddressId?: string;
  ewayBillNo?: string;
  cinNumber?: string;
  acknowledgeNo?: string;
  transportMode?: string;
  transporterName?: string;
  vehicleRegNo?: string;
  driverContactNo?: string;
  poNo?: string;
  lrNo?: string;
  lrDate?: string;
}

export interface UpdateInvoiceDocsInput {
  ewayBillNo?: string;
  cinNumber?: string;
  acknowledgeNo?: string;
  transportMode?: string;
  transporterName?: string;
  vehicleRegNo?: string;
  driverContactNo?: string;
  poNo?: string;
  lrNo?: string;
  lrDate?: string;
}

export interface CustomerAddressDTO {
  id: string;
  customerId: string;
  label: string;
  addressLine1: string;
  addressLine2?: string | null;
  addressLine3?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  stateCode?: string | null;
  gstin?: string | null;
}

export interface CreateCustomerAddressInput {
  label: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
}

export interface InvoiceLineItemDTO {
  id: string;
  itemId: string;
  itemName: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export type InstallmentStatus = "PAID" | "OVERDUE" | "PENDING";

export interface InstallmentDTO {
  id: string;
  amount: number;
  dueDate: string;
  paidAt?: string | null;
  status: InstallmentStatus;
  interestRate?: number | null;
  documentCharges?: number | null;
}

export interface SetInstallmentPlanInput {
  count: number;
  startDate: string;
  intervalDays: number;
  interestRate?: number;
  documentCharges?: number;
}

export interface DueInstallmentDTO {
  id: string;
  amount: number;
  dueDate: string;
  status: InstallmentStatus;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string | null;
}

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  customer?: CustomerDTO | null;
  isInterState: boolean;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOff: number;
  grandTotal: number;
  status: InvoiceStatus;
  amountPaid: number;
  createdAt: string;
  billToSnapshot?: string | null;
  shipToSnapshot?: string | null;
  ewayBillNo?: string | null;
  cinNumber?: string | null;
  acknowledgeNo?: string | null;
  transportMode?: string | null;
  transporterName?: string | null;
  vehicleRegNo?: string | null;
  driverContactNo?: string | null;
  poNo?: string | null;
  lrNo?: string | null;
  lrDate?: string | null;
  lineItems: InvoiceLineItemDTO[];
  payments: { mode: PaymentMode; amount: number; isInitial: boolean; createdAt: string }[];
  installments: InstallmentDTO[];
}

export interface DailySummaryDTO {
  date: string;
  invoiceCount: number;
  totalSales: number;
  totalTax: number;
  byMode: Partial<Record<PaymentMode, number>>;
}

export interface GstSummaryDTO {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  byRate: { gstRate: number; taxableValue: number; cgst: number; sgst: number; igst: number }[];
}

export interface CreditStatusDTO {
  creditLimit: number | null;
  currentOutstanding: number;
}

export interface DispatchDTO {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  vehicleNo?: string | null;
  lrNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  status: DispatchStatus;
  dispatchedAt?: string | null;
  podReceivedAt?: string | null;
  podNote?: string | null;
  createdAt: string;
}

export interface CreateDispatchInput {
  vehicleNo?: string;
  lrNo?: string;
  driverName?: string;
  driverPhone?: string;
}

export interface MarkDeliveredInput {
  podNote?: string;
}

export interface StockLedgerEntryDTO {
  id: string;
  itemId: string;
  itemName: string;
  type: StockMovementType;
  in: number;
  out: number;
  balance: number;
  note?: string | null;
  referenceInvoiceId?: string | null;
  createdAt: string;
}

export interface DashboardDTO {
  todaySales: number;
  monthlySales: number;
  outstandingAmount: number;
  totalCustomers: number;
  totalItems: number;
  lowStockItems: number;
  totalInvoices: number;
  salesTrend: { date: string; sales: number }[];
  monthlyTrend: { month: string; sales: number }[];
  statusCounts: { status: InvoiceStatus; count: number; amount: number }[];
  topCustomers: { customerId: string; name: string; total: number }[];
  topItems: { itemId: string; name: string; total: number }[];
  recentInvoices: { id: string; invoiceNumber: string; customerName: string; grandTotal: number; status: InvoiceStatus; createdAt: string }[];
}

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

export interface OutstandingSummaryDTO {
  totalOutstanding: number;
  aging: { bucket: AgingBucket; amount: number; count: number }[];
  customers: { customerId: string; name: string; phone?: string | null; outstanding: number; oldestDueDays: number }[];
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "BULK_DELETE" | "RESTORE";
export type AuditEntityType = "Customer" | "Item" | "Invoice" | "Announcement";

export interface AuditLogEntryDTO {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface PaginatedDTO<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BulkDeleteInput {
  ids: string[];
}

export interface BulkDeleteResultDTO {
  deleted: number;
}

export const ANNOUNCEMENT_CATEGORIES = ["PRICE_CHANGE", "DISCOUNT", "MRP_CHANGE", "GENERAL"] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  PRICE_CHANGE: "Price Change",
  DISCOUNT: "Discount",
  MRP_CHANGE: "MRP Change",
  GENERAL: "General",
};

export interface AnnouncementDTO {
  id: string;
  authorId: string;
  authorName: string;
  category: AnnouncementCategory;
  title: string;
  message: string;
  createdAt: string;
  canDelete: boolean;
}

export interface CreateAnnouncementInput {
  category: AnnouncementCategory;
  title: string;
  message: string;
}
