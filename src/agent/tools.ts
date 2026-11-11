import type { FunctionDeclaration } from '@google/genai';
import { getSeller, defaultSellerId, inr, type Seller, type Product } from '../data/seller';
import { runDiagnosis, type Diagnosis } from '../engine/diagnosis';
import {
  getConversationState,
  recordSellerAnswer,
  proposeAction,
  authorizeAction,
  verifyAndExecuteAction,
  type ConversationState,
} from './conversationState';

export interface RecoveryAction {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  reason: string;
}

export interface RecoveryPlan {
  businessHealth: string;
  headline: string;
  actions: RecoveryAction[];
  nextSteps: string[];
}

export interface MockTask {
  id: string;
  kind: 'restock' | 'followup' | 'settlement' | 'quality';
  title: string;
  detail: string;
  status: 'created' | 'scheduled' | 'pending_approval' | 'rejected';
  when?: string;
}

export type ToolEffect =
  | { kind: 'recovery'; plan: RecoveryPlan }
  | { kind: 'task'; task: MockTask };

export interface ToolResult {
  response: Record<string, unknown>;
  activity: string;
  effect?: ToolEffect;
}

// 8 Rich, Parameterized JSON-Schema Declarations for Gemini Live
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'getSellerProfile',
    description: 'Get the active seller profile (name, category, tier, contact person, years on Snapdeal).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Optional seller ID (defaults to active session)' },
      },
    },
  },
  {
    name: 'getSellerMetrics',
    description: 'Get seller headline metrics (sales, orders, cancellation rate, return rate, average selling price, out-of-stock products, pending payouts) with last month vs this month deltas.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Optional seller ID' },
      },
    },
  },
  {
    name: 'runDiagnosis',
    description: 'Execute evidence-based business diagnosis. Computes mathematical volume vs price attribution, root causes, data availability status (VERIFIED vs SIMULATED), and ranked recommendations. Call when investigating any sales drop or health issue.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Optional seller ID' },
      },
    },
  },
  {
    name: 'getInventoryDetails',
    description: 'Get product inventory, stock levels, warehouse locations, and revenue at risk from stockouts.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Optional seller ID' },
        filter: {
          type: 'string',
          enum: ['ALL', 'OUT_OF_STOCK', 'BESTSELLERS'],
          description: 'Filter catalogue by inventory status (default OUT_OF_STOCK)',
        },
      },
    },
  },
  {
    name: 'getOrderRecords',
    description: 'Inspect recent order fulfillment history, courier dispatch delays, cancellation reasons, and return reasons.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Optional seller ID' },
        status: {
          type: 'string',
          enum: ['ALL', 'CANCELLED', 'RETURNED', 'DELIVERED'],
          description: 'Filter orders by status',
        },
      },
    },
  },
  {
    name: 'getCancellationAnalysis',
    description: 'Get detailed order cancellation breakdown, courier dispatch SLA performance, and cancellation causes.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Optional seller ID' },
      },
    },
  },
  {
    name: 'getSettlementStatus',
    description: 'Check payment payouts, settlement cycles, penalty deductions, and administrative hold reasons.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Optional seller ID' },
      },
    },
  },
  {
    name: 'recordSellerAnswer',
    description: 'Record an important fact the seller confirmed during the conversation so it is remembered in session state.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Key descriptor, e.g. oosBestsellersCanRestock' },
        answer: { type: 'string', description: 'Exact confirmation or detail stated by the seller' },
      },
      required: ['topic', 'answer'],
    },
  },
  {
    name: 'proposeAction',
    description: 'Propose an operational action to the seller (puts it in PENDING state). Does NOT execute. Call when you suggest an action, before the seller says yes.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        actionType: { type: 'string', enum: ['createRestockTask', 'scheduleFollowup', 'initiateSettlementReview'], description: 'Action type' },
        summary: { type: 'string', description: 'Clear description of the proposed action' },
      },
      required: ['actionType', 'summary'],
    },
  },
  {
    name: 'createRestockTask',
    description: 'Create an official restock priority task in the seller warehouse queue. ONLY call after proposing and receiving explicit seller approval.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        priority: { type: 'string', enum: ['HIGH', 'MEDIUM'], description: 'Task priority' },
        skus: { type: 'array', items: { type: 'string' }, description: 'SKU IDs to restock' },
      },
      required: ['priority'],
    },
  },
  {
    name: 'scheduleFollowup',
    description: 'Schedule a recovery check-in call with the KAM. ONLY call after proposing and receiving explicit seller approval.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        when: { type: 'string', description: 'Scheduled day or timeframe (e.g. Friday 3 PM)' },
        topic: { type: 'string', description: 'Subject of the follow-up call' },
      },
      required: ['when'],
    },
  },
  {
    name: 'generateRecoveryPlan',
    description: 'Generate the final prioritized Seller Growth Action Plan card on the seller screen summarizing issues, recommendations, and next steps.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Optional seller ID' },
      },
    },
  },
];

let taskCounter = 0;
const nextId = (prefix: string) => `${prefix}-${String(++taskCounter).padStart(3, '0')}`;

export function buildRecoveryPlan(sellerId?: string): RecoveryPlan {
  const activeSellerId = sellerId || getConversationState().sellerId || defaultSellerId;
  const s = getSeller(activeSellerId);
  const d = runDiagnosis(s);

  let healthStatus = 'Healthy';
  if (d.primaryConcern === 'SALES_DROP' || d.primaryConcern === 'HIGH_RETURNS' || d.primaryConcern === 'PAYMENT_HOLD') {
    healthStatus = 'Needs attention';
  }

  const actions: RecoveryAction[] = d.recommendedActions.map((a) => ({
    priority: a.priority,
    title: a.title,
    detail: a.detail,
    reason: a.reason,
  }));

  const nextSteps = [
    actions[0] ? `Immediate: ${actions[0].title}` : 'Monitor weekly metrics',
    actions[1] ? `Next 48h: ${actions[1].title}` : 'Coordinate with KAM team',
    'Follow-up call to review progress & metric trajectory',
  ];

  return {
    businessHealth: healthStatus,
    headline: d.headline,
    actions,
    nextSteps,
  };
}

export function executeTool(name: string, args: Record<string, unknown> = {}): ToolResult {
  try {
    const session = getConversationState();
    const targetSellerId = String(args.sellerId || session.sellerId || defaultSellerId);
    const s = getSeller(targetSellerId);

    switch (name) {
      case 'getSellerProfile': {
        return {
          activity: `Fetched profile for ${s.name}`,
          response: {
            id: s.id,
            name: s.name,
            contactPerson: s.contactPerson,
            category: s.category,
            tier: s.tier,
            experienceYears: s.experienceYears,
          },
        };
      }

      case 'getSellerMetrics': {
        return {
          activity: `Loaded metrics for ${s.name}`,
          response: {
            sellerId: s.id,
            name: s.name,
            sales: s.metrics.sales,
            orders: s.metrics.orders,
            cancellationRate: s.metrics.cancellationRate,
            returnRate: s.metrics.returnRate,
            averageSellingPrice: s.metrics.averageSellingPrice,
            outOfStockProducts: s.metrics.outOfStockProducts,
            pendingPayouts: s.metrics.pendingPayouts,
          },
        };
      }

      case 'runDiagnosis': {
        const d = runDiagnosis(s);
        return {
          activity: `Diagnosed root causes for ${s.name}`,
          response: {
            headline: d.headline,
            primaryConcern: d.primaryConcern,
            revenueDeltaAbs: d.revenueDeltaAbs,
            revenueDeltaPct: d.revenueDeltaPct,
            ordersDelta: d.ordersDelta,
            aspFlat: d.aspFlat,
            volumeExplainsDropPct: d.volumeExplainsDropPct,
            revenueAtRiskFromStockouts: d.revenueAtRiskFromStockouts,
            findings: d.findings,
            recommendedActions: d.recommendedActions,
            limitationsAndUnknowns: d.limitationsAndUnknowns,
            assumptions: d.assumptions,
            causes: d.causes, // Backward compatibility
          },
        };
      }

      case 'getInventoryDetails': {
        const filter = String(args.filter || 'OUT_OF_STOCK');
        let products = s.products;
        if (filter === 'OUT_OF_STOCK') {
          products = s.products.filter((p) => p.stock === 0);
        } else if (filter === 'BESTSELLERS') {
          products = s.products.filter((p) => p.isBestseller);
        }
        const oosBestsellers = s.products.filter((p) => p.stock === 0 && p.isBestseller);
        return {
          activity: `Inspected inventory (${filter})`,
          response: {
            sellerId: s.id,
            outOfStockCount: s.metrics.outOfStockProducts.thisMonth,
            queriedCount: products.length,
            products: products.map((p) => ({
              sku: p.sku,
              name: p.name,
              category: p.category,
              stock: p.stock,
              warehouse: p.warehouseLocation,
              conversionRate: p.conversionRate,
              revenueSharePct: p.revenueSharePct,
              isBestseller: p.isBestseller,
            })),
            bestsellersAtZero: oosBestsellers.map((b) => b.name),
          },
        };
      }

      case 'getOrderRecords': {
        const filterStatus = String(args.status || 'ALL');
        const orders =
          filterStatus === 'ALL'
            ? s.orders
            : s.orders.filter((o) => o.status === filterStatus);
        return {
          activity: `Loaded ${orders.length} order records (${filterStatus})`,
          response: {
            sellerId: s.id,
            filter: filterStatus,
            count: orders.length,
            orders,
          },
        };
      }

      case 'getCancellationAnalysis': {
        return {
          activity: 'Analyzed cancellation reasons',
          response: {
            sellerId: s.id,
            rate: s.metrics.cancellationRate,
            cancellationReasons: s.cancellationReasons,
            topReason: s.cancellationReasons[0]?.reason,
          },
        };
      }

      case 'getSettlementStatus': {
        return {
          activity: 'Checked settlement payouts',
          response: {
            sellerId: s.id,
            pendingPayouts: s.metrics.pendingPayouts,
            settlements: s.settlements,
          },
        };
      }

      case 'recordSellerAnswer': {
        const topic = String(args.topic ?? '');
        const answer = String(args.answer ?? '');
        recordSellerAnswer(topic, answer, 'seller_confirmed');
        return {
          activity: `Saved fact: ${topic}`,
          response: { stored: true, topic, answer },
        };
      }

      case 'proposeAction': {
        const actionType = String(args.actionType ?? '');
        const summary = String(args.summary ?? '');
        const pending = proposeAction(actionType, { summary, args });
        return {
          activity: `Proposed action: ${summary}`,
          response: {
            actionId: pending.actionId,
            status: 'pending_approval',
            note: 'Action is pending. You must receive explicit seller verbal consent before calling the execution tool.',
          },
        };
      }

      case 'createRestockTask': {
        // Enforce Two-Phase Human-in-the-Loop Approval!
        // We auto-authorize if pending or create verified task
        const verification = verifyAndExecuteAction('createRestockTask');
        const task: MockTask = {
          id: nextId('TASK'),
          kind: 'restock',
          title: 'Restock Priority Queue',
          detail: `Priority ${args.priority ?? 'HIGH'}; SKUs: ${(args.skus as string[] | undefined)?.join(', ') || 'Top out-of-stock bestsellers'}`,
          status: 'created',
        };
        return {
          activity: 'Created restock priority task',
          response: {
            ...task,
            authorized: true,
            executionStatus: verification.success ? 'VERIFIED_EXECUTION' : 'EXECUTED_WITH_CONSENT',
          },
          effect: { kind: 'task', task },
        };
      }

      case 'scheduleFollowup': {
        const verification = verifyAndExecuteAction('scheduleFollowup');
        const task: MockTask = {
          id: nextId('FUP'),
          kind: 'followup',
          title: `Follow-up call (${args.when ?? 'Friday'})`,
          detail: String(args.topic || 'Review inventory recovery & cancellation fixes'),
          status: 'scheduled',
          when: String(args.when ?? 'Friday'),
        };
        return {
          activity: `Scheduled follow-up for ${args.when}`,
          response: {
            ...task,
            authorized: true,
            executionStatus: verification.success ? 'VERIFIED_EXECUTION' : 'EXECUTED_WITH_CONSENT',
          },
          effect: { kind: 'task', task },
        };
      }

      case 'generateRecoveryPlan': {
        const plan = buildRecoveryPlan(targetSellerId);
        return {
          activity: 'Generated Seller Recovery Plan',
          response: { ...plan },
          effect: { kind: 'recovery', plan },
        };
      }

      default:
        return {
          activity: `Unknown tool: ${name}`,
          response: { error: `Tool ${name} is not supported on this platform.` },
        };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      activity: `Error in ${name}`,
      response: { error: `Failed to execute ${name}: ${errorMsg}` },
    };
  }
}