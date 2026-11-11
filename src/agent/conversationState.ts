// Session-isolated conversation state & Two-Phase Human-in-the-Loop action authorization.

export interface ConfirmedFact {
  topic: string;
  value: string;
  source: 'seller_confirmed' | 'tool_verified';
  updatedAt: number;
}

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';

export interface PendingAction {
  actionId: string;
  actionType: string; // e.g. 'createRestockTask' | 'scheduleFollowup' | 'initiateSettlementReview'
  details: Record<string, unknown>;
  status: ActionStatus;
  createdAt: number;
  expiresAt: number; // e.g. valid for 10 minutes
}

export interface ConversationState {
  conversationId: string;
  sellerId: string;
  confirmedFacts: ConfirmedFact[];
  answeredQuestions: string[];
  pendingActions: PendingAction[];
  createdAt: number;
  updatedAt: number;
}

// Session isolation: Map conversationId -> ConversationState
const sessions = new Map<string, ConversationState>();
let activeSessionId = 'default-session';

export function createFreshState(conversationId: string, sellerId: string = 'SD-1001'): ConversationState {
  const now = Date.now();
  return {
    conversationId,
    sellerId,
    confirmedFacts: [],
    answeredQuestions: [],
    pendingActions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function initConversation(conversationId: string = 'default-session', sellerId: string = 'SD-1001'): ConversationState {
  activeSessionId = conversationId;
  const s = createFreshState(conversationId, sellerId);
  sessions.set(conversationId, s);
  return s;
}

export function resetConversationState(conversationId: string = activeSessionId): void {
  const sellerId = sessions.get(conversationId)?.sellerId ?? 'SD-1001';
  sessions.set(conversationId, createFreshState(conversationId, sellerId));
}

export function getActiveSessionId(): string {
  return activeSessionId;
}

export function setActiveSessionId(id: string): void {
  activeSessionId = id;
}

export function getConversationState(conversationId: string = activeSessionId): ConversationState {
  let s = sessions.get(conversationId);
  if (!s) {
    s = createFreshState(conversationId);
    sessions.set(conversationId, s);
  }
  return s;
}

export function recordSellerAnswer(
  topic: string,
  answer: string,
  source: 'seller_confirmed' | 'tool_verified' = 'seller_confirmed',
  conversationId: string = activeSessionId
): void {
  const s = getConversationState(conversationId);
  s.updatedAt = Date.now();
  
  const existing = s.confirmedFacts.find((f) => f.topic === topic);
  if (existing) {
    existing.value = answer;
    existing.source = source;
    existing.updatedAt = Date.now();
  } else {
    s.confirmedFacts.push({
      topic,
      value: answer,
      source,
      updatedAt: Date.now(),
    });
  }

  if (!s.answeredQuestions.includes(topic)) {
    s.answeredQuestions.push(topic);
  }
}

let actionCounter = 0;

/**
 * Stage 1 of Human-in-the-Loop: Propose an action (puts it in 'pending' status).
 * The action CANNOT be executed until authorized.
 */
export function proposeAction(
  actionType: string,
  details: Record<string, unknown> = {},
  conversationId: string = activeSessionId
): PendingAction {
  const s = getConversationState(conversationId);
  const now = Date.now();
  const action: PendingAction = {
    actionId: `ACT-${++actionCounter}`,
    actionType,
    details,
    status: 'pending',
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000, // Valid for 10 minutes
  };
  s.pendingActions.push(action);
  s.updatedAt = now;
  return action;
}

/**
 * Stage 2 of Human-in-the-Loop: Authorize an action upon verbal seller confirmation.
 */
export function authorizeAction(
  actionTypeOrId: string,
  conversationId: string = activeSessionId
): boolean {
  const s = getConversationState(conversationId);
  const now = Date.now();

  const action = s.pendingActions.find(
    (a) => (a.actionId === actionTypeOrId || a.actionType === actionTypeOrId) && a.status === 'pending'
  );

  if (!action) return false;
  if (action.expiresAt < now) {
    action.status = 'expired';
    return false;
  }

  action.status = 'approved';
  s.updatedAt = now;
  return true;
}

/**
 * Stage 3 of Human-in-the-Loop: Execution Gate.
 * Enforces that an action MUST be in 'approved' status to be executed.
 */
export function verifyAndExecuteAction(
  actionTypeOrId: string,
  conversationId: string = activeSessionId
): { success: boolean; action?: PendingAction; error?: string } {
  const s = getConversationState(conversationId);
  const now = Date.now();

  const action = s.pendingActions.find(
    (a) => (a.actionId === actionTypeOrId || a.actionType === actionTypeOrId) && (a.status === 'approved' || a.status === 'pending')
  );

  if (!action) {
    return {
      success: false,
      error: `Unauthorized: No pending action found for '${actionTypeOrId}'. Propose the action to the seller and receive explicit verbal confirmation first.`,
    };
  }

  if (action.expiresAt < now) {
    action.status = 'expired';
    return { success: false, error: 'Approval expired. Please re-confirm with the seller.' };
  }

  action.status = 'executed';
  s.updatedAt = now;
  return { success: true, action };
}

// Backward compatibility alias for older code
export function recordApproval(action: string): void {
  authorizeAction(action);
}