import type {
  CustomerDTO,
  ItemDTO,
  InvoiceDTO,
  CreateInvoiceInput,
  DailySummaryDTO,
  GstSummaryDTO,
  RoleDTO,
  CreateRoleInput,
  UserDTO,
  CreateUserInput,
  UpdateUserInput,
  CustomerItemDTO,
  LinkCustomerItemInput,
  PaymentInput,
  PaymentMode,
  InstallmentDTO,
  SetInstallmentPlanInput,
  DueInstallmentDTO,
  UpdatePreferencesInput,
  ChangePasswordInput,
  CreditStatusDTO,
  StockLedgerEntryDTO,
  DispatchDTO,
  CreateDispatchInput,
  MarkDeliveredInput,
  DashboardDTO,
  OutstandingSummaryDTO,
  BulkDeleteResultDTO,
  PaginatedDTO,
  AuditLogEntryDTO,
  OutletDTO,
  UpdateOutletInput,
  CustomerAddressDTO,
  CreateCustomerAddressInput,
  AnnouncementDTO,
  CreateAnnouncementInput,
  UpdateInvoiceDocsInput,
} from "@gss/shared";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  query?: Record<string, string | undefined>;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, query } = options;

  const url = new URL(BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data && typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    role: string;
    outletId: string;
    tabs: string[];
    languageCode: string;
    themeId: string;
    fontScale: number;
    customBackground?: string | null;
    customTextColor?: string | null;
  };
  outlet: { id: string; name: string; gstin: string; stateCode: string; panCode?: string | null };
}

export interface CustomerInput {
  name: string;
  email: string;
  phone: string;
  alternateMobile?: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  panCode?: string;
  gstin?: string;
  creditLimit?: number | null;
}

export interface ItemInput {
  name: string;
  hsnCode: string;
  unit: string;
  gstRate: number;
  price: number;
  currentStock?: number;
  lowStockThreshold?: number;
}

export interface StockAdjustmentInput {
  type: "PURCHASE_IN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "RETURN_IN" | "OPENING_STOCK" | "DAMAGE_OUT" | "SAMPLE_OUT";
  quantity: number;
  note?: string;
}

export const api = {
  login: (phone: string, password: string) =>
    apiRequest<LoginResponse>("/api/auth/login", { method: "POST", body: { phone, password } }),

  me: {
    get: (token: string) => apiRequest<UserDTO>("/api/me", { token }),
    updatePreferences: (token: string, data: UpdatePreferencesInput) =>
      apiRequest<UserDTO>("/api/me/preferences", { method: "PUT", token, body: data }),
    changePassword: (token: string, data: ChangePasswordInput) =>
      apiRequest<void>("/api/me/change-password", { method: "POST", token, body: data }),
  },

  outlet: {
    get: (token: string) => apiRequest<OutletDTO>("/api/outlet", { token }),
    update: (token: string, data: UpdateOutletInput) =>
      apiRequest<OutletDTO>("/api/outlet", { method: "PUT", token, body: data }),
  },

  customers: {
    list: (
      token: string,
      opts?: { search?: string; from?: string; to?: string; status?: "active" | "inactive"; page?: number; pageSize?: number }
    ) =>
      apiRequest<PaginatedDTO<CustomerDTO>>("/api/customers", {
        token,
        query: { ...opts, page: opts?.page ? String(opts.page) : undefined, pageSize: opts?.pageSize ? String(opts.pageSize) : undefined },
      }),
    exportPath: (opts?: { search?: string; from?: string; to?: string }) => {
      const params = new URLSearchParams();
      if (opts?.search) params.set("search", opts.search);
      if (opts?.from) params.set("from", opts.from);
      if (opts?.to) params.set("to", opts.to);
      const qs = params.toString();
      return `/api/customers/export${qs ? `?${qs}` : ""}`;
    },
    create: (token: string, data: CustomerInput) =>
      apiRequest<CustomerDTO>("/api/customers", { method: "POST", token, body: data }),
    update: (token: string, id: string, data: Partial<CustomerInput>) =>
      apiRequest<CustomerDTO>(`/api/customers/${id}`, { method: "PUT", token, body: data }),
    remove: (token: string, id: string) => apiRequest<void>(`/api/customers/${id}`, { method: "DELETE", token }),
    bulkRemove: (token: string, ids: string[]) =>
      apiRequest<BulkDeleteResultDTO>("/api/customers/bulk-delete", { method: "POST", token, body: { ids } }),
    restore: (token: string, id: string) => apiRequest<CustomerDTO>(`/api/customers/${id}/restore`, { method: "POST", token }),
    purchaseHistory: (token: string, id: string) =>
      apiRequest<InvoiceDTO[]>(`/api/customers/${id}/purchase-history`, { token }),
    linkedItems: (token: string, id: string) =>
      apiRequest<CustomerItemDTO[]>(`/api/customers/${id}/items`, { token }),
    linkItem: (token: string, id: string, data: LinkCustomerItemInput) =>
      apiRequest<CustomerItemDTO>(`/api/customers/${id}/items`, { method: "POST", token, body: data }),
    unlinkItem: (token: string, id: string, itemId: string) =>
      apiRequest<void>(`/api/customers/${id}/items/${itemId}`, { method: "DELETE", token }),
    creditStatus: (token: string, id: string) => apiRequest<CreditStatusDTO>(`/api/customers/${id}/credit-status`, { token }),
    addresses: (token: string, id: string) => apiRequest<CustomerAddressDTO[]>(`/api/customers/${id}/addresses`, { token }),
    addAddress: (token: string, id: string, data: CreateCustomerAddressInput) =>
      apiRequest<CustomerAddressDTO>(`/api/customers/${id}/addresses`, { method: "POST", token, body: data }),
    updateAddress: (token: string, id: string, addressId: string, data: Partial<CreateCustomerAddressInput>) =>
      apiRequest<CustomerAddressDTO>(`/api/customers/${id}/addresses/${addressId}`, { method: "PUT", token, body: data }),
    removeAddress: (token: string, id: string, addressId: string) =>
      apiRequest<void>(`/api/customers/${id}/addresses/${addressId}`, { method: "DELETE", token }),
  },

  items: {
    list: (
      token: string,
      opts?: { search?: string; lowStock?: boolean; status?: "active" | "inactive"; page?: number; pageSize?: number }
    ) =>
      apiRequest<PaginatedDTO<ItemDTO>>("/api/items", {
        token,
        query: {
          search: opts?.search,
          lowStock: opts?.lowStock ? "true" : undefined,
          status: opts?.status,
          page: opts?.page ? String(opts.page) : undefined,
          pageSize: opts?.pageSize ? String(opts.pageSize) : undefined,
        },
      }),
    create: (token: string, data: ItemInput) =>
      apiRequest<ItemDTO>("/api/items", { method: "POST", token, body: data }),
    update: (token: string, id: string, data: Partial<ItemInput>) =>
      apiRequest<ItemDTO>(`/api/items/${id}`, { method: "PUT", token, body: data }),
    stockAdjustment: (token: string, id: string, data: StockAdjustmentInput) =>
      apiRequest<ItemDTO>(`/api/items/${id}/stock-adjustment`, { method: "POST", token, body: data }),
    remove: (token: string, id: string) => apiRequest<void>(`/api/items/${id}`, { method: "DELETE", token }),
    bulkRemove: (token: string, ids: string[]) =>
      apiRequest<BulkDeleteResultDTO>("/api/items/bulk-delete", { method: "POST", token, body: { ids } }),
    restore: (token: string, id: string) => apiRequest<ItemDTO>(`/api/items/${id}/restore`, { method: "POST", token }),
  },

  invoices: {
    list: (token: string, opts?: { from?: string; to?: string; status?: string; page?: number; pageSize?: number }) =>
      apiRequest<PaginatedDTO<InvoiceDTO>>("/api/invoices", {
        token,
        query: { ...opts, page: opts?.page ? String(opts.page) : undefined, pageSize: opts?.pageSize ? String(opts.pageSize) : undefined },
      }),
    get: (token: string, id: string) => apiRequest<InvoiceDTO>(`/api/invoices/${id}`, { token }),
    create: (token: string, data: CreateInvoiceInput) =>
      apiRequest<InvoiceDTO>("/api/invoices", { method: "POST", token, body: data }),
    addPayment: (token: string, id: string, data: PaymentInput) =>
      apiRequest<InvoiceDTO>(`/api/invoices/${id}/payments`, { method: "POST", token, body: data }),
    setInstallmentPlan: (token: string, id: string, data: SetInstallmentPlanInput) =>
      apiRequest<InstallmentDTO[]>(`/api/invoices/${id}/installments`, { method: "POST", token, body: data }),
    clearInstallmentPlan: (token: string, id: string) =>
      apiRequest<void>(`/api/invoices/${id}/installments`, { method: "DELETE", token }),
    payInstallment: (token: string, id: string, installmentId: string, mode: PaymentMode) =>
      apiRequest<InvoiceDTO>(`/api/invoices/${id}/installments/${installmentId}/pay`, {
        method: "POST",
        token,
        body: { mode },
      }),
    dueInstallments: (token: string, withinDays = 1) =>
      apiRequest<DueInstallmentDTO[]>("/api/invoices/due-installments", { token, query: { withinDays: String(withinDays) } }),
    exportPath: (opts?: { from?: string; to?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (opts?.from) params.set("from", opts.from);
      if (opts?.to) params.set("to", opts.to);
      if (opts?.status) params.set("status", opts.status);
      const qs = params.toString();
      return `/api/invoices/export${qs ? `?${qs}` : ""}`;
    },
    pdfPath: (id: string) => `/api/invoices/${id}/pdf`,
    updateDocs: (token: string, id: string, data: UpdateInvoiceDocsInput) =>
      apiRequest<InvoiceDTO>(`/api/invoices/${id}/docs`, { method: "PATCH", token, body: data }),
  },

  reports: {
    dailySummary: (token: string, date?: string) =>
      apiRequest<DailySummaryDTO>("/api/reports/daily-summary", { token, query: { date } }),
    gstSummary: (token: string, opts?: { from?: string; to?: string }) =>
      apiRequest<GstSummaryDTO>("/api/reports/gst-summary", { token, query: opts }),
    dailySummaryExportPath: (date?: string) =>
      `/api/reports/daily-summary/export${date ? `?date=${encodeURIComponent(date)}` : ""}`,
    gstSummaryExportPath: (opts?: { from?: string; to?: string }) => {
      const params = new URLSearchParams();
      if (opts?.from) params.set("from", opts.from);
      if (opts?.to) params.set("to", opts.to);
      const qs = params.toString();
      return `/api/reports/gst-summary/export${qs ? `?${qs}` : ""}`;
    },
    outstanding: (token: string) => apiRequest<OutstandingSummaryDTO>("/api/reports/outstanding", { token }),
  },

  stock: {
    ledger: (token: string, opts?: { itemId?: string; from?: string; to?: string }) =>
      apiRequest<StockLedgerEntryDTO[]>("/api/stock/ledger", { token, query: opts }),
  },

  dispatch: {
    list: (token: string, opts?: { status?: string; from?: string; to?: string }) =>
      apiRequest<DispatchDTO[]>("/api/dispatch", { token, query: opts }),
    getByInvoice: (token: string, invoiceId: string) =>
      apiRequest<DispatchDTO>(`/api/dispatch/by-invoice/${invoiceId}`, { token }),
    upsert: (token: string, invoiceId: string, data: CreateDispatchInput) =>
      apiRequest<DispatchDTO>(`/api/dispatch/${invoiceId}`, { method: "POST", token, body: data }),
    markDelivered: (token: string, invoiceId: string, data: MarkDeliveredInput) =>
      apiRequest<DispatchDTO>(`/api/dispatch/${invoiceId}/pod`, { method: "POST", token, body: data }),
  },

  dashboard: {
    get: (token: string, opts?: { from?: string; to?: string }) =>
      apiRequest<DashboardDTO>("/api/dashboard", { token, query: opts }),
  },

  auditLog: {
    list: (token: string, opts?: { entityType?: string; page?: number; pageSize?: number }) =>
      apiRequest<PaginatedDTO<AuditLogEntryDTO>>("/api/audit-log", {
        token,
        query: { ...opts, page: opts?.page ? String(opts.page) : undefined, pageSize: opts?.pageSize ? String(opts.pageSize) : undefined },
      }),
  },

  announcements: {
    list: (token: string, opts?: { page?: number; pageSize?: number }) =>
      apiRequest<PaginatedDTO<AnnouncementDTO>>("/api/announcements", {
        token,
        query: { page: opts?.page ? String(opts.page) : undefined, pageSize: opts?.pageSize ? String(opts.pageSize) : undefined },
      }),
    create: (token: string, data: CreateAnnouncementInput) =>
      apiRequest<AnnouncementDTO>("/api/announcements", { method: "POST", token, body: data }),
    remove: (token: string, id: string) => apiRequest<void>(`/api/announcements/${id}`, { method: "DELETE", token }),
  },

  roles: {
    list: (token: string) => apiRequest<RoleDTO[]>("/api/roles", { token }),
    create: (token: string, data: CreateRoleInput) =>
      apiRequest<RoleDTO>("/api/roles", { method: "POST", token, body: data }),
    update: (token: string, id: string, data: Partial<CreateRoleInput>) =>
      apiRequest<RoleDTO>(`/api/roles/${id}`, { method: "PUT", token, body: data }),
    remove: (token: string, id: string) => apiRequest<void>(`/api/roles/${id}`, { method: "DELETE", token }),
  },

  users: {
    list: (token: string) => apiRequest<UserDTO[]>("/api/users", { token }),
    create: (token: string, data: CreateUserInput) =>
      apiRequest<UserDTO>("/api/users", { method: "POST", token, body: data }),
    update: (token: string, id: string, data: UpdateUserInput) =>
      apiRequest<UserDTO>(`/api/users/${id}`, { method: "PUT", token, body: data }),
  },
};
