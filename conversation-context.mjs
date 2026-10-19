// Keep recent conversation turns coherent without exhausting small local model windows.
// Conversation history is private to one account and one chat in server.mjs.
const HARD_BUDGET = 15000;
const MAX_MESSAGES = 20;
const MAX_SINGLE = 2800;
export function compactConversation(messages, currentPrompt = "") {
  const ordered = (Array.isArray(messages) ? messages : []).filter(m =>
    (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  ).slice(-MAX_MESSAGES);
  const chosen = [];
  let remaining = HARD_BUDGET - Math.min(String(currentPrompt).length, 3000);
  // Always retain the immediately preceding exchange if it exists.
  for (let i = ordered.length - 1; i >= 0; i--) {
    const m = ordered[i];
    const limit = i >= ordered.length - 2 ? 5200 : MAX_SINGLE;
    const content = m.content.length > limit
      ? m.content.slice(0, Math.max(0,limit-95)) + "\n[Older message truncated to preserve recent conversation context]"
      : m.content;
    const cost = content.length;
    if (cost > remaining && chosen.length >= 2) break;
    if (cost > remaining) continue;
    chosen.push({role:m.role, content});
    remaining -= cost;
  }
  return chosen.reverse();
}
export function continuityInstruction(messages) {
  if (!messages?.length) return "";
  return "\nCONVERSATION CONTINUITY: This is a follow-up in an existing conversation. Resolve short references such as 'isso', 'eles', 'o código', 'por que' or 'it' using the most recent messages below. If the user points out a flaw, acknowledge and address that specific flaw instead of regenerating an unrelated answer. Do not change the subject or repeat already supplied code unless asked. Previous assistant replies may contain mistakes; correct them rather than treating them as verified facts.";
}
