// Deterministic eval of the multi-seller fact layer & dynamic diagnosis engine.
// Run: npm run eval:engine

import { runDiagnosis } from '../src/engine/diagnosis';
import { executeTool, buildRecoveryPlan } from '../src/agent/tools';
import { resetConversationState, getConversationState } from '../src/agent/conversationState';
import { sellers, getSeller } from '../src/data/seller';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('\n--- EVALUATION SUITE 1: SELLER 1 (Assignment Brief: Sales Drop & Stockouts) ---');
const s1 = getSeller('SD-1001');
const d1 = runDiagnosis(s1);

check('S1 revenue decline is -32.5%', d1.revenueDeltaPct === -32.5, String(d1.revenueDeltaPct));
check('S1 orders delta is -130', d1.ordersDelta === -130, String(d1.ordersDelta));
check('S1 ASP detected flat at ₹500', d1.aspFlat === true);
check('S1 volume explains 100% of drop', d1.volumeExplainsDropPct === 100, String(d1.volumeExplainsDropPct));
check('S1 pricing ruled out as root cause', d1.findings.find((c) => c.id === 'pricing')?.severity === 'RULED_OUT');
check('S1 stockouts ranked HIGH', d1.findings.find((c) => c.id === 'stockouts')?.severity === 'HIGH');
check('S1 cancellations ranked HIGH', d1.findings.find((c) => c.id === 'cancellations')?.severity === 'HIGH');
check('S1 has VERIFIED data status for stockouts', d1.findings.find((c) => c.id === 'stockouts')?.dataStatus === 'VERIFIED');

console.log('\n--- EVALUATION SUITE 2: SELLER 2 (Electronics: Return Rate Spike) ---');
const s2 = getSeller('SD-2002');
const d2 = runDiagnosis(s2);
check('S2 primary concern is HIGH_RETURNS', d2.primaryConcern === 'HIGH_RETURNS', d2.primaryConcern);
check('S2 return rate ranked HIGH severity', d2.findings.find((c) => c.id === 'returns')?.severity === 'HIGH');
check('S2 stockouts is NOT HIGH', d2.findings.find((c) => c.id === 'stockouts')?.severity !== 'HIGH');

console.log('\n--- EVALUATION SUITE 3: SELLER 3 (Home Decor: Settlement Payout Hold) ---');
const s3 = getSeller('SD-3003');
const d3 = runDiagnosis(s3);
check('S3 primary concern is PAYMENT_HOLD', d3.primaryConcern === 'PAYMENT_HOLD', d3.primaryConcern);
check('S3 settlement hold ranked HIGH', d3.findings.find((c) => c.id === 'settlement_hold')?.severity === 'HIGH');

console.log('\n--- EVALUATION SUITE 4: DYNAMIC TOOL & RECOVERY PLAN LAYER ---');
const metrics = executeTool('getSellerMetrics', { sellerId: 'SD-1001' }).response as any;
check('tool returns ground-truth sales', metrics.sales.thisMonth === s1.metrics.sales.thisMonth);
check('tool returns ground-truth orders', metrics.orders.thisMonth === s1.metrics.orders.thisMonth);

const inv = executeTool('getInventoryDetails', { sellerId: 'SD-1001', filter: 'OUT_OF_STOCK' }).response as any;
check('bestsellers at zero stock identified', inv.bestsellersAtZero.length >= 2, String(inv.bestsellersAtZero.length));

const plan1 = buildRecoveryPlan('SD-1001');
check('S1 plan has prioritized actions', plan1.actions.length >= 2);
check('S1 plan cites evidence-based reasons', plan1.actions.every((a) => a.reason.length > 0));
check('S1 plan never recommends price cuts', !/discount|lower your price|cut prices|reduce price/i.test(JSON.stringify(plan1)));

const plan2 = buildRecoveryPlan('SD-2002');
check('S2 plan recommends quality audit', /quality|defects|batch/i.test(JSON.stringify(plan2)));

console.log('\n--- EVALUATION SUITE 5: SESSION CONVERSATION STATE & HITL APPROVAL ---');
resetConversationState('test-session');
executeTool('recordSellerAnswer', { topic: 'oosBestsellers', answer: 'yes' });
executeTool('proposeAction', { actionType: 'createRestockTask', summary: 'Restock top bestsellers' });
executeTool('createRestockTask', { priority: 'HIGH' });

const st = getConversationState();
check('state stores confirmed fact with source', st.confirmedFacts.some((f) => f.topic === 'oosBestsellers' && f.value === 'yes'));
check('state tracks action in pendingActions', st.pendingActions.some((a) => a.actionType === 'createRestockTask'));

resetConversationState('test-session');
check('reset clears state facts', getConversationState('test-session').confirmedFacts.length === 0);

console.log(failures === 0 ? '\nAll multi-seller engine evals passed successfully.' : `\n${failures} engine eval(s) failed.`);
process.exit(failures === 0 ? 0 : 1);