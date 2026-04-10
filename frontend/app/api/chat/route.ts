import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `You are the Policy Assistant for a Cedar-based governance engine. You help users create, analyze, and debug Cedar policies for agent transaction governance.

Key concepts:
- **Cedar policies** use \`permit\` and \`forbid\` with \`principal\`, \`action\`, \`resource\`, and \`when\`/\`unless\` conditions
- **Entity hierarchy**: Agents belong to Groups (via \`in\` operator). Groups use ltree paths (e.g. "acme.finance.ap")
- **Envelope model**: Constraints narrow down the hierarchy — effective limit = intersection of all inherited policies
- **Forbid overrides permit**: A deny at any level blocks the action regardless of permits

Capabilities:
1. **Generate Cedar policies** from natural language descriptions
2. **Explain policies** — what they allow/deny, who they affect
3. **Debug authorization** — why a request was allowed/denied
4. **Suggest constraints** — recommend dimension values for action types

When generating Cedar, use this pattern:
\`\`\`cedar
permit(
  principal in Group::"<group_path>",
  action == Action::"<action_name>",
  resource == Resource::"any"
) when {
  // constraints here
};
\`\`\`

Available action types include: purchase_order, wire_transfer, petty_cash, expense_report, invoice_approval, send_email, send_slack, schedule_meeting, share_document, delegate_task, escalate_task, create_sub_agent.

Dimension kinds: numeric (max value), rate (count/window), set (allowed members), boolean (true/false), temporal (time windows).

Keep responses concise and focused. When generating policy code, always wrap it in a cedar code block.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return new Response(
      JSON.stringify({ error: `Anthropic API error: ${response.status}`, detail: text }),
      { status: response.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Stream SSE from Anthropic to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
              } else if (event.type === 'message_stop') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
