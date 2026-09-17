export interface ShopifyOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  fulfilledAt: string | null;
  deliveredAt: string | null;
  orderValue: number;
  currency: string;
  refundStatus: "None" | "Partial" | "Full";
  refundAmount: number;
  payoutStatus: "Paid" | "Pending" | "In Escrow";
  payoutDate?: string;
  gateway: "Shopify Payments" | "Stripe" | "PayPal";
  transactionId: string;
  gatewayFee: number;
  netPayout: number;
  itemsCount: number;
}

export interface AdSpendRecord {
  id: string;
  platform: "Facebook Ads" | "TikTok Ads" | "Google Ads";
  accountName: string;
  accountId: string;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  cpc: number;
  status: "Active" | "Paused" | "Under Review";
  date: string;
}

export interface ProductCostRecord {
  id: string;
  source: "Printify" | "PG Print 1" | "Sheet: LPro";
  externalOrderId: string;
  shopifyOrderRef: string;
  productName: string;
  variant: string;
  quantity: number;
  baseCost: number;
  shippingCost: number;
  totalCost: number;
  productionStatus: "In Production" | "Shipped" | "Completed" | "Pending";
  productionTimeDays: number;
  syncDate: string;
}

export interface AppCostRecord {
  id: string;
  appName: string;
  category:
    | "Ads Tools"
    | "Fulfillment & Print"
    | "Store Operations"
    | "Analytics";
  description: string;
  billingCycle: "Monthly" | "Usage-based" | "Yearly";
  cost: number;
  billingDate: string;
  status: "Active" | "Trial" | "Canceled";
}

export const mockShopifyOrders: ShopifyOrder[] = [];

export const mockAdSpendRecords: AdSpendRecord[] = [];

export const mockProductCostRecords: ProductCostRecord[] = [];

export const mockAppCostRecords: AppCostRecord[] = [];
