// Agent-behavior eval. Requires GEMINI_API_KEY. Run: npm run eval:agent
// Uses a text-model proxy (generateContent + function calling) with the SAME
// system prompt + tools as the live voice agent, to test tool-grounding and
// fabrication without needing audio. Hard checks: grounding tool called, no
// price-cut advice, admits missing data. Numeric grounding is advisory (WARN).
import { GoogleGenAI, type Content } from '@google/genai';
import { systemPrompt } from '../src/agent/systemPrompt';
import { toolDeclarations, executeTool } from '../src/agent/tools';
import { resetConversationState } from '../src/agent/conversationState';
import { cases, type EvalCase } from './cases';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Set GEMINI_API_KEY to run the agent eval.');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });
const MODEL = process.env.EVAL_MODEL ?? 'gemini-3.8-flash';

function collectNumbers(value: unknown, out: Set<number>): void {
  if (typeof value === 'number' && Number.isFinite(value)) out.add(value);
  else if (typeof value === 'string') {
    for (const m of value.match(/\d+(?:\.\d+)?/g) ?? []) out.add(parseFloat(m));
  } else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectNumbers(v, out));
}

function statedMetrics(text: string): number[] {
  const nums: number[] = [];
  for (const m of text.match(/\d+(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []) {
    const n = parseFloat(m.replace(/,/g, ''));
    if (n >= 10 || !Number.isInteger(n)) nums.push(n);
  }
  return nums;
}

interface Result {
  id: string;
  pass: boolean;
  notes: string[];
  called: string[];
}

async function runCase(c: EvalCase): Promise<Result> {
  resetConversationState();
  const called: string[] = [];
  const grounded = new Set<number>();
  const notes: string[] = [];
  const contents: Content[] = [{ role: 'user', parts: [{ text: c.seller }] }];
  let finalText = '';

  for (let hop = 0; hop < 6; hop++) {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toolDeclarations }],
        temperature: 0.4,
      },
    });
    const calls = res.functionCalls;
    if (calls && calls.length) {
      contents.push(res.candidates![0].content!);
      const responses = calls.map((fc) => {
        const name = fc.name ?? '';
        called.push(name);
        const r = executeTool(name, fc.args ?? {});
        collectNumbers(r.response, grounded);
        return { id: fc.id, name, response: r.response };
      });
      contents.push({ role: 'user', parts: responses.map((fr) => ({ functionResponse: fr })) });
      continue;
    }
    finalText = res.text ?? '';
    break;
  }

  let pass = true;
  if (c.expectAnyTools.length && !c.expectAnyTools.some((t) => called.includes(t))) {
    pass = false;
    notes.push(`no grounding tool called (wanted one of ${c.expectAnyTools.join('/')}); called: ${called.join(',') || 'none'}`);
  }
  if (c.forbid && c.forbid.test(finalText)) {
    pass = false;
    notes.push('forbidden advice present (price cut)');
  }
  if (c.expectRefusal && !/don't have|do not have|no data|can't access|cannot access/i.test(finalText)) {
    pass = false;
    notes.push('did not admit missing data');
  }
  const ungrounded = statedMetrics(finalText).filter((n) => !grounded.has(n) && !grounded.has(Math.round(n)));
  if (ungrounded.length) notes.push(`WARN ungrounded numbers in reply: ${ungrounded.join(', ')} (review manually)`);
  return { id: c.id, pass, notes, called };
}

const results: Result[] = [];
for (const c of cases) results.push(await runCase(c));
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  [tools: ${r.called.join(', ') || 'none'}]`);
  r.notes.forEach((n) => console.log('      ' + n));
}
const failed = results.filter((r) => !r.pass).length;
console.log(failed === 0 ? '\nAll agent evals passed.' : `\n${failed} agent eval(s) failed.`);
process.exit(failed === 0 ? 0 : 1);