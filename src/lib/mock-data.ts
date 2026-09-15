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

export const mockShopifyOrders: ShopifyOrder[] = [
  {
    id: "ord-1001",
    orderNumber: "#MX-8891",
    customerName: "Alex Morgan",
    createdAt: "2026-09-14 09:15",
    fulfilledAt: "2026-09-14 16:30",
    deliveredAt: "2026-09-15 10:00",
    orderValue: 89.5,
    currency: "USD",
    refundStatus: "None",
    refundAmount: 0,
    payoutStatus: "Paid",
    payoutDate: "2026-09-15",
    gateway: "Shopify Payments",
    transactionId: "ch_3N8e192xLa",
    gatewayFee: 2.85,
    netPayout: 86.65,
    itemsCount: 2,
  },
  {
    id: "ord-1002",
    orderNumber: "#MX-8892",
    customerName: "Sarah Jenkins",
    createdAt: "2026-09-14 11:20",
    fulfilledAt: "2026-09-14 18:00",
    deliveredAt: null,
    orderValue: 124.0,
    currency: "USD",
    refundStatus: "None",
    refundAmount: 0,
    payoutStatus: "Pending",
    gateway: "Stripe",
    transactionId: "txn_992144xK",
    gatewayFee: 3.9,
    netPayout: 120.1,
    itemsCount: 3,
  },
  {
    id: "ord-1003",
    orderNumber: "#MX-8893",
    customerName: "David Lee",
    createdAt: "2026-09-13 14:02",
    fulfilledAt: "2026-09-14 08:45",
    deliveredAt: null,
    orderValue: 49.0,
    currency: "USD",
    refundStatus: "Full",
    refundAmount: 49.0,
    payoutStatus: "In Escrow",
    gateway: "PayPal",
    transactionId: "pp_491028340",
    gatewayFee: 1.75,
    netPayout: 0,
    itemsCount: 1,
  },
  {
    id: "ord-1004",
    orderNumber: "#MX-8894",
    customerName: "Elena Rostova",
    createdAt: "2026-09-13 19:40",
    fulfilledAt: "2026-09-14 10:10",
    deliveredAt: "2026-09-15 08:30",
    orderValue: 165.2,
    currency: "USD",
    refundStatus: "None",
    refundAmount: 0,
    payoutStatus: "Paid",
    payoutDate: "2026-09-14",
    gateway: "Shopify Payments",
    transactionId: "ch_98317aB91",
    gatewayFee: 5.1,
    netPayout: 160.1,
    itemsCount: 4,
  },
  {
    id: "ord-1005",
    orderNumber: "#MX-8895",
    customerName: "Marcus Vance",
    createdAt: "2026-09-12 21:05",
    fulfilledAt: "2026-09-13 11:20",
    deliveredAt: "2026-09-14 15:45",
    orderValue: 74.0,
    currency: "USD",
    refundStatus: "Partial",
    refundAmount: 20.0,
    payoutStatus: "Paid",
    payoutDate: "2026-09-13",
    gateway: "Stripe",
    transactionId: "txn_7719208z",
    gatewayFee: 2.45,
    netPayout: 51.55,
    itemsCount: 2,
  },
];

export const mockAdSpendRecords: AdSpendRecord[] = [
  {
    id: "ad-01",
    platform: "Facebook Ads",
    accountName: "BM01 - Scale Tier 1 (US/EU)",
    accountId: "act_4910294819",
    spend: 1850.4,
    currency: "USD",
    impressions: 124500,
    clicks: 2980,
    cpc: 0.62,
    status: "Active",
    date: "2026-09-14",
  },
  {
    id: "ad-02",
    platform: "TikTok Ads",
    accountName: "TT_Spark_Agency_03",
    accountId: "tt_9918237190",
    spend: 940.0,
    currency: "USD",
    impressions: 89000,
    clicks: 2150,
    cpc: 0.44,
    status: "Active",
    date: "2026-09-14",
  },
  {
    id: "ad-03",
    platform: "Google Ads",
    accountName: "PMax - MatureX Shopping Brand",
    accountId: "g-771-928-1120",
    spend: 420.75,
    currency: "USD",
    impressions: 34200,
    clicks: 810,
    cpc: 0.52,
    status: "Active",
    date: "2026-09-14",
  },
  {
    id: "ad-04",
    platform: "Facebook Ads",
    accountName: "BM02 - Retargeting & Lookalike",
    accountId: "act_3389102411",
    spend: 310.2,
    currency: "USD",
    impressions: 19800,
    clicks: 640,
    cpc: 0.48,
    status: "Paused",
    date: "2026-09-14",
  },
];

export const mockProductCostRecords: ProductCostRecord[] = [
  {
    id: "cogs-01",
    source: "Printify",
    externalOrderId: "PF-994102",
    shopifyOrderRef: "#MX-8891",
    productName: "Vintage Heavyweight Graphic Tee",
    variant: "L / Washed Black",
    quantity: 2,
    baseCost: 24.5,
    shippingCost: 7.99,
    totalCost: 32.49,
    productionStatus: "Completed",
    productionTimeDays: 1.2,
    syncDate: "2026-09-14",
  },
  {
    id: "cogs-02",
    source: "PG Print 1",
    externalOrderId: "PG-2026-4418",
    shopifyOrderRef: "#MX-8892",
    productName: "Oversized Fleece Hoodie",
    variant: "XL / Charcoal",
    quantity: 1,
    baseCost: 28.0,
    shippingCost: 8.5,
    totalCost: 36.5,
    productionStatus: "Shipped",
    productionTimeDays: 1.5,
    syncDate: "2026-09-14",
  },
  {
    id: "cogs-03",
    source: "Sheet: LPro",
    externalOrderId: "LP-88102",
    shopifyOrderRef: "#MX-8894",
    productName: "Embroidered Snapback Cap",
    variant: "One Size / Navy",
    quantity: 4,
    baseCost: 38.0,
    shippingCost: 11.2,
    totalCost: 49.2,
    productionStatus: "Completed",
    productionTimeDays: 2.0,
    syncDate: "2026-09-13",
  },
  {
    id: "cogs-04",
    source: "Printify",
    externalOrderId: "PF-994198",
    shopifyOrderRef: "#MX-8895",
    productName: "Acid Wash Crewneck Sweatshirt",
    variant: "M / Vintage Brown",
    quantity: 1,
    baseCost: 19.8,
    shippingCost: 6.5,
    totalCost: 26.3,
    productionStatus: "Shipped",
    productionTimeDays: 1.1,
    syncDate: "2026-09-13",
  },
];

export const mockAppCostRecords: AppCostRecord[] = [
  {
    id: "app-01",
    appName: "TripleWhale Ads Attribution",
    category: "Ads Tools",
    description: "Multi-touch pixel tracking & ad analytics",
    billingCycle: "Monthly",
    cost: 199.0,
    billingDate: "2026-09-01",
    status: "Active",
  },
  {
    id: "app-02",
    appName: "Klaviyo Email & SMS Marketing",
    category: "Store Operations",
    description: "Automated cart abandonment & post-purchase flows",
    billingCycle: "Monthly",
    cost: 145.0,
    billingDate: "2026-09-05",
    status: "Active",
  },
  {
    id: "app-03",
    appName: "Loox Product Reviews & UGC",
    category: "Store Operations",
    description: "Social proof review widgets & photo reviews",
    billingCycle: "Monthly",
    cost: 39.99,
    billingDate: "2026-09-10",
    status: "Active",
  },
  {
    id: "app-04",
    appName: "AutoPrint Sync Portal",
    category: "Fulfillment & Print",
    description: "Direct API bridge to PG Print 1 & Printify routing",
    billingCycle: "Usage-based",
    cost: 49.5,
    billingDate: "2026-09-14",
    status: "Active",
  },
];
