export interface DashboardSummary {
  hasSnapshot: boolean;
  period: string;
  isProvisional: boolean;
  availableMonths: string[];
  lastSyncedAt: Date | null;
  activeRunId: string | null;
  ordersMetric: {
    count: number;
    refundIncidenceRate: number;
    refundCount: number;
    diffPercent: number | null;
  };
  netRevenueMetric: {
    netRevenue: number;
    grossSales: number;
    originalTax: number;
    aov: number;
    diffPercent: number | null;
  };
  adSpendMetric: {
    spend: number;
    mer: number | null;
    diffPercent: number | null;
  };
  grossProfitMetric: {
    profit: number;
    cogsTotal: number;
    grossMargin: number;
    diffPercent: number | null;
  };
  trendSeries: Array<{
    month: string;
    label: string;
    netRevenue: number;
    cogs: number;
    adSpend: number;
    isProvisional?: boolean;
  }>;
  costMix: {
    month: string;
    cogs: number;
    cogsPercent: number;
    adSpend: number;
    adSpendPercent: number;
    payoutFee: number;
    payoutFeePercent: number;
    totalCost: number;
    hasData: boolean;
  };
}

export interface SheetRowQueryParams {
  sheet: "orders" | "cogs" | "ads" | "payouts";
  month?: string;
  page?: number;
  limit?: number;
  sort?: string;
  dir?: "asc" | "desc";
  search?: string;
  supplier?: string;
  type?: string;
  account?: string;
}

export interface SheetRowPaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  availableMonths: string[];
  month: string;
  filterOptions?: {
    suppliers?: string[];
    types?: string[];
    accounts?: string[];
  };
}
