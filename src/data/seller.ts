// Production-grade Multi-Seller Data Registry for Snapdeal Virtual KAM.
// Supports multi-category sellers, relational order records, return logs, inventory, and settlements.

export interface MetricPair {
  lastMonth: number;
  thisMonth: number;
}

export interface SellerMetrics {
  sales: MetricPair;
  orders: MetricPair;
  cancellationRate: MetricPair; // in %
  returnRate: MetricPair;       // in %
  averageSellingPrice: MetricPair; // in INR
  outOfStockProducts: MetricPair;
  pendingPayouts: number;       // in INR
}

export interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  warehouseLocation: string;
  impressions: number;
  conversionRate: number; // in %
  revenueSharePct: number; // in %
  isBestseller: boolean;
  rating: number; // out of 5
}

export interface OrderRecord {
  orderId: string;
  sku: string;
  orderDate: string;
  amount: number;
  status: 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'IN_TRANSIT';
  dispatchDelayDays?: number;
  cancellationReason?: string;
  returnReason?: string;
}

export interface SettlementRecord {
  settlementId: string;
  period: string;
  grossSales: number;
  commission: number;
  logisticsFee: number;
  penaltyDeductions: number;
  netPayout: number;
  status: 'SETTLED' | 'PENDING' | 'ON_HOLD';
  holdReason?: string;
}

export interface CancellationReason {
  reason: string;
  sharePct: number;
  source: 'CALCULATED_FROM_ORDERS' | 'SIMULATED_INDUSTRY_BENCHMARK';
}

export interface Seller {
  id: string;
  name: string;
  contactPerson: string;
  category: string;
  tier: 'Gold' | 'Silver' | 'Bronze';
  experienceYears: number;
  metrics: SellerMetrics;
  products: Product[];
  orders: OrderRecord[];
  settlements: SettlementRecord[];
  cancellationReasons: CancellationReason[];
}

export const sellers: Record<string, Seller> = {
  // SELLER 1: The Primary Assignment Scenario (Fashion Seller with Volume Drop from Stockouts & Transit Cancellations)
  'SD-1001': {
    id: 'SD-1001',
    name: 'Urban Threads Apparel',
    contactPerson: 'Muskan',
    category: 'Fashion & Ethnic Wear',
    tier: 'Gold',
    experienceYears: 3,
    metrics: {
      sales: { lastMonth: 200000, thisMonth: 135000 },
      orders: { lastMonth: 400, thisMonth: 270 },
      cancellationRate: { lastMonth: 8, thisMonth: 14 },
      returnRate: { lastMonth: 5, thisMonth: 6 },
      averageSellingPrice: { lastMonth: 500, thisMonth: 500 }, // Strictly flat!
      outOfStockProducts: { lastMonth: 5, thisMonth: 18 },
      pendingPayouts: 34500,
    },
    products: [
      { sku: 'UT-TSH-001', name: 'Classic Cotton T-Shirt (Men)', category: 'T-Shirts', price: 499, stock: 0, warehouseLocation: 'Delhi-NCR', impressions: 8200, conversionRate: 4.5, revenueSharePct: 18, isBestseller: true, rating: 4.4 },
      { sku: 'UT-KUR-002', name: 'Floral Rayon Kurti (Women)', category: 'Kurtis', price: 549, stock: 0, warehouseLocation: 'Jaipur', impressions: 6100, conversionRate: 5.2, revenueSharePct: 14, isBestseller: true, rating: 4.6 },
      { sku: 'UT-JEA-003', name: 'Slim-Fit Denim Jeans', category: 'Jeans', price: 799, stock: 14, warehouseLocation: 'Delhi-NCR', impressions: 4000, conversionRate: 2.1, revenueSharePct: 9, isBestseller: false, rating: 3.9 },
      { sku: 'UT-SNK-004', name: 'Canvas Casual Sneakers', category: 'Footwear', price: 699, stock: 4, warehouseLocation: 'Delhi-NCR', impressions: 3000, conversionRate: 1.2, revenueSharePct: 6, isBestseller: false, rating: 3.7 },
      { sku: 'UT-SAR-005', name: 'Printed Daily Saree', category: 'Sarees', price: 449, stock: 0, warehouseLocation: 'Surat', impressions: 2400, conversionRate: 3.0, revenueSharePct: 5, isBestseller: false, rating: 4.1 },
      { sku: 'UT-HOO-006', name: 'Fleece Winter Hoodie', category: 'Winterwear', price: 899, stock: 0, warehouseLocation: 'Ludhiana', impressions: 1800, conversionRate: 2.8, revenueSharePct: 4, isBestseller: false, rating: 4.3 },
      { sku: 'UT-CHI-007', name: 'Cotton Chinos', category: 'Trousers', price: 599, stock: 0, warehouseLocation: 'Delhi-NCR', impressions: 1500, conversionRate: 2.0, revenueSharePct: 3, isBestseller: false, rating: 4.0 },
    ],
    orders: [
      { orderId: 'ORD-1011', sku: 'UT-TSH-001', orderDate: '2026-11-01', amount: 499, status: 'CANCELLED', dispatchDelayDays: 4, cancellationReason: 'Delayed dispatch / fulfilment' },
      { orderId: 'ORD-1012', sku: 'UT-TSH-001', orderDate: '2026-11-02', amount: 499, status: 'CANCELLED', dispatchDelayDays: 5, cancellationReason: 'Delayed dispatch / fulfilment' },
      { orderId: 'ORD-1013', sku: 'UT-KUR-002', orderDate: '2026-11-03', amount: 549, status: 'CANCELLED', dispatchDelayDays: 1, cancellationReason: 'Out of stock after order placed' },
      { orderId: 'ORD-1014', sku: 'UT-SAR-005', orderDate: '2026-11-04', amount: 449, status: 'CANCELLED', dispatchDelayDays: 3, cancellationReason: 'Delayed dispatch / fulfilment' },
      { orderId: 'ORD-1015', sku: 'UT-JEA-003', orderDate: '2026-11-05', amount: 799, status: 'DELIVERED', dispatchDelayDays: 1 },
      { orderId: 'ORD-1016', sku: 'UT-KUR-002', orderDate: '2026-11-06', amount: 549, status: 'CANCELLED', dispatchDelayDays: 0, cancellationReason: 'Customer changed mind' },
    ],
    settlements: [
      { settlementId: 'SET-991', period: 'Oct 2026', grossSales: 200000, commission: 20000, logisticsFee: 16000, penaltyDeductions: 0, netPayout: 164000, status: 'SETTLED' },
      { settlementId: 'SET-992', period: 'Nov 2026 (Cycle 1)', grossSales: 135000, commission: 13500, logisticsFee: 14000, penaltyDeductions: 4200, netPayout: 103300, status: 'SETTLED' },
    ],
    cancellationReasons: [
      { reason: 'Delayed dispatch / fulfilment', sharePct: 45, source: 'CALCULATED_FROM_ORDERS' },
      { reason: 'Out of stock after order placed', sharePct: 30, source: 'CALCULATED_FROM_ORDERS' },
      { reason: 'Customer changed mind', sharePct: 15, source: 'SIMULATED_INDUSTRY_BENCHMARK' },
      { reason: 'Address / courier unreachable', sharePct: 10, source: 'SIMULATED_INDUSTRY_BENCHMARK' },
    ],
  },

  // SELLER 2: Electronics Seller (High Returns / Defect Complaints, NOT Sales Drop)
  'SD-2002': {
    id: 'SD-2002',
    name: 'NexTech Electronics',
    contactPerson: 'Aman',
    category: 'Mobile Accessories & Audio',
    tier: 'Silver',
    experienceYears: 2,
    metrics: {
      sales: { lastMonth: 350000, thisMonth: 410000 }, // Sales are growing!
      orders: { lastMonth: 700, thisMonth: 820 },
      cancellationRate: { lastMonth: 4, thisMonth: 5 },
      returnRate: { lastMonth: 4, thisMonth: 21 }, // Massive return surge!
      averageSellingPrice: { lastMonth: 500, thisMonth: 500 },
      outOfStockProducts: { lastMonth: 1, thisMonth: 2 },
      pendingPayouts: 82000,
    },
    products: [
      { sku: 'NT-CAB-001', name: 'Braided Type-C Fast Cable 65W', category: 'Cables', price: 299, stock: 450, warehouseLocation: 'Bhiwandi', impressions: 18000, conversionRate: 6.2, revenueSharePct: 35, isBestseller: true, rating: 2.8 }, // Rating crashed due to pin break
      { sku: 'NT-TWS-002', name: 'True Wireless Earbuds Pro', category: 'Audio', price: 1299, stock: 120, warehouseLocation: 'Bhiwandi', impressions: 9500, conversionRate: 3.4, revenueSharePct: 40, isBestseller: true, rating: 4.5 },
      { sku: 'NT-ADP-003', name: '20W PD Dual Port Wall Charger', category: 'Chargers', price: 499, stock: 80, warehouseLocation: 'Bhiwandi', impressions: 7200, conversionRate: 4.1, revenueSharePct: 25, isBestseller: true, rating: 3.1 },
    ],
    orders: [
      { orderId: 'ORD-2011', sku: 'NT-CAB-001', orderDate: '2026-11-02', amount: 299, status: 'RETURNED', returnReason: 'Defective / connector pin loose' },
      { orderId: 'ORD-2012', sku: 'NT-CAB-001', orderDate: '2026-11-03', amount: 299, status: 'RETURNED', returnReason: 'Cable stopped working in 2 days' },
      { orderId: 'ORD-2013', sku: 'NT-ADP-003', orderDate: '2026-11-04', amount: 499, status: 'RETURNED', returnReason: 'Device overheating while charging' },
    ],
    settlements: [
      { settlementId: 'SET-881', period: 'Nov 2026', grossSales: 410000, commission: 41000, logisticsFee: 32000, penaltyDeductions: 18500, netPayout: 318500, status: 'SETTLED' },
    ],
    cancellationReasons: [
      { reason: 'Customer changed mind', sharePct: 60, source: 'CALCULATED_FROM_ORDERS' },
      { reason: 'Found cheaper alternative', sharePct: 40, source: 'SIMULATED_INDUSTRY_BENCHMARK' },
    ],
  },

  // SELLER 3: Home & Living (Payment Hold / SLA Penalties)
  'SD-3003': {
    id: 'SD-3003',
    name: 'Aura Living & Home',
    contactPerson: 'Sunita',
    category: 'Home Decor & Furnishings',
    tier: 'Bronze',
    experienceYears: 1,
    metrics: {
      sales: { lastMonth: 180000, thisMonth: 185000 }, // Stable sales
      orders: { lastMonth: 360, thisMonth: 370 },
      cancellationRate: { lastMonth: 5, thisMonth: 6 },
      returnRate: { lastMonth: 6, thisMonth: 7 },
      averageSellingPrice: { lastMonth: 500, thisMonth: 500 },
      outOfStockProducts: { lastMonth: 2, thisMonth: 3 },
      pendingPayouts: 112000, // Large amount on hold!
    },
    products: [
      { sku: 'AL-CUS-001', name: 'Velvet Cushion Covers (Set of 5)', category: 'Cushions', price: 499, stock: 85, warehouseLocation: 'Panipat', impressions: 5400, conversionRate: 3.8, revenueSharePct: 45, isBestseller: true, rating: 4.4 },
      { sku: 'AL-CUR-002', name: 'Blackout Eyelet Door Curtains', category: 'Curtains', price: 699, stock: 40, warehouseLocation: 'Panipat', impressions: 4200, conversionRate: 3.1, revenueSharePct: 35, isBestseller: true, rating: 4.2 },
      { sku: 'AL-BED-003', name: 'Cotton Double Bedsheet with Pillows', category: 'Bedsheets', price: 799, stock: 30, warehouseLocation: 'Panipat', impressions: 3800, conversionRate: 2.9, revenueSharePct: 20, isBestseller: false, rating: 4.0 },
    ],
    orders: [
      { orderId: 'ORD-3011', sku: 'AL-CUS-001', orderDate: '2026-11-01', amount: 499, status: 'DELIVERED', dispatchDelayDays: 1 },
      { orderId: 'ORD-3012', sku: 'AL-CUR-002', orderDate: '2026-11-03', amount: 699, status: 'DELIVERED', dispatchDelayDays: 0 },
    ],
    settlements: [
      { settlementId: 'SET-771', period: 'Nov 2026 (Cycle 1)', grossSales: 185000, commission: 18500, logisticsFee: 16000, penaltyDeductions: 0, netPayout: 150500, status: 'ON_HOLD', holdReason: 'Bank IFSC verification pending & GSTIN quarterly reconciliation' },
    ],
    cancellationReasons: [
      { reason: 'Customer changed mind', sharePct: 50, source: 'SIMULATED_INDUSTRY_BENCHMARK' },
      { reason: 'Delayed delivery', sharePct: 50, source: 'SIMULATED_INDUSTRY_BENCHMARK' },
    ],
  },
};

export const defaultSellerId = 'SD-1001';

export function getSeller(sellerId: string = defaultSellerId): Seller {
  const s = sellers[sellerId] ?? sellers[defaultSellerId];
  return s;
}

export function listAvailableSellers(): { id: string; name: string; category: string; keyIssue: string }[] {
  return [
    { id: 'SD-1001', name: 'Urban Threads Apparel', category: 'Fashion & Ethnic Wear', keyIssue: 'Sales drop 32% (Stockouts & Courier Dispatch Cancellations)' },
    { id: 'SD-2002', name: 'NexTech Electronics', category: 'Mobile Accessories', keyIssue: 'Surge in Returns (21% return rate from defective cable batch)' },
    { id: 'SD-3003', name: 'Aura Living & Home', category: 'Home Decor', keyIssue: 'Settlement Payout on Hold (GST & IFSC Verification pending)' },
  ];
}

// Backward compatibility alias for single-seller imports
export const seller: Seller = sellers[defaultSellerId];

export const inr = (n: number): string => '₹' + n.toLocaleString('en-IN');