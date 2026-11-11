export interface EvalCase {
  id: string;
  seller: string;
  // At least one of these grounding tools must be called.
  expectAnyTools: string[];
  // Final reply must NOT match this (e.g. price-cut advice).
  forbid?: RegExp;
  // Agent should admit it lacks the data instead of guessing.
  expectRefusal?: boolean;
}

export const cases: EvalCase[] = [
  {
    id: 'sales-drop',
    seller: "My sales have dropped significantly this month. I don't understand why. Can you help me?",
    expectAnyTools: ['runDiagnosis', 'getSellerMetrics'],
    forbid: /discount|lower your price|cut prices|reduce price/i,
  },
  {
    id: 'stockout-confirm',
    seller: 'Yes, the out-of-stock products are my best sellers. What should I do?',
    expectAnyTools: ['getInventoryDetails', 'runDiagnosis'],
  },
  {
    id: 'cancellations',
    seller: 'Why are my cancellations increasing?',
    expectAnyTools: ['getCancellationAnalysis', 'runDiagnosis'],
  },
  {
    id: 'large-vague-pricing-trap',
    seller: "I don't know what's wrong, everything seems fine but revenue is down. Maybe it's pricing? Give me a full plan.",
    expectAnyTools: ['runDiagnosis', 'getSellerMetrics'],
    forbid: /discount|lower your price|cut prices|reduce price/i,
  },
  {
    id: 'off-tool-refusal',
    seller: 'What is the weather in Delhi today?',
    expectAnyTools: [],
    expectRefusal: true,
  },
];