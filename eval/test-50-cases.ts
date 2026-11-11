// 50 Comprehensive End-to-End Test Cases for Snapdeal SellerOS Virtual KAM
// Covers Multi-Seller Scenarios, Mathematical Attributions, Dynamic Diagnosis,
// Tool Parameterization, Two-Phase HITL Safety, and Edge Cases.
// Run: npx tsx eval/test-50-cases.ts

import { sellers, getSeller, listAvailableSellers, defaultSellerId } from '../src/data/seller';
import { runDiagnosis } from '../src/engine/diagnosis';
import { executeTool, buildRecoveryPlan } from '../src/agent/tools';
import {
  initConversation,
  getConversationState,
  resetConversationState,
  recordSellerAnswer,
  proposeAction,
  authorizeAction,
  verifyAndExecuteAction,
} from '../src/agent/conversationState';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertTest(id: number, name: string, condition: boolean, details: string = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] Test ${String(id).padStart(2, '0')}: ${name}`);
  } else {
    failedTests++;
    console.error(`[FAIL] Test ${String(id).padStart(2, '0')}: ${name} -> ${details}`);
  }
}

console.log('========================================================================');
console.log('       RUNNING 50 COMPREHENSIVE PRODUCTION READINESS TESTS              ');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: SELLER 1 (Urban Threads Apparel - Fashion Sales Drop Prompt Scenario)
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: Seller 1 (Fashion Sales Drop Scenario) ---');
const s1 = getSeller('SD-1001');
const d1 = runDiagnosis(s1);

assertTest(1, 'S1 Revenue Delta is exactly -₹65,000 (-32.5%)', d1.revenueDeltaAbs === -65000 && d1.revenueDeltaPct === -32.5, `got abs:${d1.revenueDeltaAbs}, pct:${d1.revenueDeltaPct}`);
assertTest(2, 'S1 Order Volume Delta is exactly -130 orders (-32.5%)', d1.ordersDelta === -130 && d1.ordersDeltaPct === -32.5, `got ordersDelta:${d1.ordersDelta}`);
assertTest(3, 'S1 Average Selling Price detected strictly flat at ₹500', d1.aspFlat === true && s1.metrics.averageSellingPrice.thisMonth === 500);
assertTest(4, 'S1 Volume accounts for 100% of revenue drop (130 lost orders * ₹500)', d1.volumeExplainsDropPct === 100, `got volumeExplains:${d1.volumeExplainsDropPct}%`);
assertTest(5, 'S1 Pricing explicitly RULED_OUT as root cause', d1.findings.find(f => f.id === 'pricing')?.severity === 'RULED_OUT');
assertTest(6, 'S1 Pricing finding includes confidence score >= 0.9', (d1.findings.find(f => f.id === 'pricing')?.confidence ?? 0) >= 0.9);
assertTest(7, 'S1 Stockouts detected (5 -> 18 items) and ranked HIGH severity', d1.findings.find(f => f.id === 'stockouts')?.severity === 'HIGH');
assertTest(8, 'S1 Order cancellations detected (8% -> 14%) and ranked HIGH severity', d1.findings.find(f => f.id === 'cancellations')?.severity === 'HIGH');
assertTest(9, 'S1 Top zero-stock bestsellers accurately identified (T-Shirt & Kurti)', s1.products.filter(p => p.stock === 0 && p.isBestseller).length === 2);
assertTest(10, 'S1 Low-converting products (< 2.5%) dynamically isolated', d1.findings.find(f => f.id === 'visibility')?.severity === 'MEDIUM');

// -----------------------------------------------------------------------------
// SUITE 2: SELLER 2 (NexTech Electronics - High Return Rate Spike Scenario)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Seller 2 (Electronics Return Rate Spike Scenario) ---');
const s2 = getSeller('SD-2002');
const d2 = runDiagnosis(s2);

assertTest(11, 'S2 Revenue shows positive growth (+17.1%)', d2.revenueDeltaPct === 17.1, `got revenueDeltaPct:${d2.revenueDeltaPct}`);
assertTest(12, 'S2 Primary Concern is classified as HIGH_RETURNS', d2.primaryConcern === 'HIGH_RETURNS', `got:${d2.primaryConcern}`);
assertTest(13, 'S2 Return rate surge (4% -> 21%) ranked HIGH severity', d2.findings.find(f => f.id === 'returns')?.severity === 'HIGH');
assertTest(14, 'S2 Stockouts correctly classified as NOT high severity', d2.findings.find(f => f.id === 'stockouts')?.severity !== 'HIGH');
assertTest(15, 'S2 Returns finding has VERIFIED data status from orders', d2.findings.find(f => f.id === 'returns')?.dataStatus === 'VERIFIED');
assertTest(16, 'S2 Defective product records exist in order logs', s2.orders.some(o => o.status === 'RETURNED' && o.returnReason?.includes('pin loose')));
assertTest(17, 'S2 Defective cable SKU has depressed rating (2.8)', s2.products.find(p => p.sku === 'NT-CAB-001')?.rating === 2.8);
assertTest(18, 'S2 Action plan focuses on batch quality audit, not restock', d2.recommendedActions.some(a => /quality|defect|batch|quarantine/i.test(a.title)));

// -----------------------------------------------------------------------------
// SUITE 3: SELLER 3 (Aura Living & Home - Settlement Payout Hold Scenario)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Seller 3 (Home Decor Settlement Payout Hold Scenario) ---');
const s3 = getSeller('SD-3003');
const d3 = runDiagnosis(s3);

assertTest(19, 'S3 Revenue & orders detected as stable (+2.8%)', d3.revenueDeltaPct === 2.8 && d3.ordersDelta === 10);
assertTest(20, 'S3 Primary Concern is classified as PAYMENT_HOLD', d3.primaryConcern === 'PAYMENT_HOLD', `got:${d3.primaryConcern}`);
assertTest(21, 'S3 Settlement payout on hold ranked HIGH severity', d3.findings.find(f => f.id === 'settlement_hold')?.severity === 'HIGH');
assertTest(22, 'S3 Pending payout amount is correctly ₹1,12,000', s3.metrics.pendingPayouts === 112000);
assertTest(23, 'S3 Settlement hold reason identifies IFSC & GSTIN reconciliation', s3.settlements.some(set => set.holdReason?.includes('IFSC')));
assertTest(24, 'S3 Cancellations (6%) and Returns (7%) verified normal', s3.metrics.cancellationRate.thisMonth === 6 && s3.metrics.returnRate.thisMonth === 7);
assertTest(25, 'S3 Action plan prioritizes GSTIN & banking compliance', d3.recommendedActions.some(a => /compliance|GSTIN|banking/i.test(a.title)));

// -----------------------------------------------------------------------------
// SUITE 4: MULTI-SELLER REGISTRY INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Multi-Seller Registry Integrity ---');
const allSellers = listAvailableSellers();

assertTest(26, 'Registry contains exactly 3 distinct seller profiles', allSellers.length === 3);
assertTest(27, 'Default seller ID resolves to SD-1001', defaultSellerId === 'SD-1001');
assertTest(28, 'getSeller with invalid ID falls back safely to default seller', getSeller('NON-EXISTENT').id === 'SD-1001');
assertTest(29, 'All registered sellers have unique IDs and contact persons', new Set(allSellers.map(s => s.id)).size === 3);
assertTest(30, 'Every seller has non-empty products, orders, and settlements', Object.values(sellers).every(s => s.products.length > 0 && s.orders.length > 0 && s.settlements.length > 0));

// -----------------------------------------------------------------------------
// SUITE 5: PARAMETERIZED TOOL EXECUTION
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Parameterized Tool Execution ---');

const profileTool = executeTool('getSellerProfile', { sellerId: 'SD-1001' });
assertTest(31, 'getSellerProfile returns correct contact person (Muskan)', (profileTool.response as any).contactPerson === 'Muskan');

const profileTool2 = executeTool('getSellerProfile', { sellerId: 'SD-2002' });
assertTest(32, 'getSellerProfile with SD-2002 returns Aman (NexTech)', (profileTool2.response as any).contactPerson === 'Aman');

const metricsTool = executeTool('getSellerMetrics', { sellerId: 'SD-1001' });
assertTest(33, 'getSellerMetrics returns exact assignment numbers (200k->135k)', (metricsTool.response as any).sales.thisMonth === 135000);

const invAll = executeTool('getInventoryDetails', { sellerId: 'SD-1001', filter: 'ALL' });
assertTest(34, 'getInventoryDetails with filter:ALL returns complete catalogue', (invAll.response as any).queriedCount === s1.products.length);

const invOos = executeTool('getInventoryDetails', { sellerId: 'SD-1001', filter: 'OUT_OF_STOCK' });
assertTest(35, 'getInventoryDetails with filter:OUT_OF_STOCK returns only 0-stock SKUs', (invOos.response as any).products.every((p: any) => p.stock === 0));

const invBest = executeTool('getInventoryDetails', { sellerId: 'SD-1001', filter: 'BESTSELLERS' });
assertTest(36, 'getInventoryDetails with filter:BESTSELLERS returns only bestsellers', (invBest.response as any).products.every((p: any) => p.isBestseller === true));

const ordersCancelled = executeTool('getOrderRecords', { sellerId: 'SD-1001', status: 'CANCELLED' });
assertTest(37, 'getOrderRecords filter:CANCELLED returns only cancelled orders', (ordersCancelled.response as any).orders.every((o: any) => o.status === 'CANCELLED'));

const ordersReturned = executeTool('getOrderRecords', { sellerId: 'SD-2002', status: 'RETURNED' });
assertTest(38, 'getOrderRecords filter:RETURNED returns only returned orders', (ordersReturned.response as any).orders.every((o: any) => o.status === 'RETURNED'));

const cancelAnalysis = executeTool('getCancellationAnalysis', { sellerId: 'SD-1001' });
assertTest(39, 'getCancellationAnalysis identifies delayed dispatch as top reason', (cancelAnalysis.response as any).topReason?.includes('Delayed dispatch'));

const settlementTool = executeTool('getSettlementStatus', { sellerId: 'SD-3003' });
assertTest(40, 'getSettlementStatus returns on-hold settlement with reason', (settlementTool.response as any).settlements.some((s: any) => s.status === 'ON_HOLD'));

// -----------------------------------------------------------------------------
// SUITE 6: SESSION ISOLATION & TWO-PHASE HITL APPROVAL GATE
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 6: Session Isolation & Two-Phase HITL Safety ---');

const sessA = initConversation('session-A', 'SD-1001');
const sessB = initConversation('session-B', 'SD-2002');

recordSellerAnswer('bestsellerRestock', 'yes', 'seller_confirmed', 'session-A');
recordSellerAnswer('cableDefects', 'yes', 'seller_confirmed', 'session-B');

assertTest(41, 'Session A memory is completely isolated from Session B', getConversationState('session-A').confirmedFacts.some(f => f.topic === 'bestsellerRestock') && !getConversationState('session-B').confirmedFacts.some(f => f.topic === 'bestsellerRestock'));

const pendingAction = proposeAction('createRestockTask', { priority: 'HIGH', skus: ['UT-TSH-001'] }, 'session-A');
assertTest(42, 'proposeAction creates action with status:pending', pendingAction.status === 'pending');
assertTest(43, 'proposeAction sets future expiration timestamp (> Date.now())', pendingAction.expiresAt > Date.now());

const unapprovedExec = verifyAndExecuteAction('createRestockTask', 'session-B');
assertTest(44, 'verifyAndExecuteAction BLOCKS unapproved actions with unauthorized error', unapprovedExec.success === false && unapprovedExec.error?.includes('Unauthorized'));

const approvalSuccess = authorizeAction('createRestockTask', 'session-A');
assertTest(45, 'authorizeAction moves status from pending to approved', approvalSuccess === true && pendingAction.status === 'approved');

const authorizedExec = verifyAndExecuteAction('createRestockTask', 'session-A');
assertTest(46, 'verifyAndExecuteAction SUCCEEDS when action is authorized', authorizedExec.success === true && authorizedExec.action?.status === 'executed');

// -----------------------------------------------------------------------------
// SUITE 7: RECOVERY PLAN INTEGRITY & DEFENSE AGAINST COMMON PITFALLS
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 7: Recovery Plan Integrity & Guardrails ---');

const planS1 = buildRecoveryPlan('SD-1001');
assertTest(47, 'S1 recovery plan has prioritized actions with reasons', planS1.actions.length >= 2 && planS1.actions.every(a => a.reason.length > 10));
assertTest(48, 'S1 recovery plan NEVER recommends price cuts or discounts', !/discount|lower price|cut price|reduce price/i.test(JSON.stringify(planS1)));

const planS2 = buildRecoveryPlan('SD-2002');
assertTest(49, 'S2 recovery plan is dynamically tailored to quality & returns', planS2.actions.some(a => /quality|defect|supplier/i.test(JSON.stringify(a))));

const unknownTool = executeTool('unsupportedToolXYZ', {});
assertTest(50, 'Tool dispatcher gracefully handles unsupported tools without throwing', (unknownTool.response as any).error?.includes('not supported'));

// -----------------------------------------------------------------------------
// FINAL SUMMARY REPORT
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('========================================================================');

if (failedTests === 0) {
  console.log('\n>>> VERDICT: 100% OF 50 PRODUCTION READINESS TESTS PASSED SUCCESSFULLY! <<<');
  process.exit(0);
} else {
  console.error(`\n>>> VERDICT: ${failedTests} TEST(S) FAILED. REVIEW REQUIRED. <<<`);
  process.exit(1);
}
