import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type ToolSet } from "ai";
import { getRepo, unauthorized } from "@/lib/data";
import { createMockModel } from "@/lib/ai/mock-model";
import { DEFAULT_MODEL_ID, MODELS } from "@/lib/ai/models";
import { explainAIError, resolveAI } from "@/lib/ai/provider";
import { buildInstructions } from "@/lib/ai/system-prompt";
import { createTools, type DrawerUIMessage } from "@/lib/ai/tools";
import { record } from "@/lib/intake/budget";
import { limitsFromEnv } from "@/lib/intake/limits";
import { chatDailyLimit, isDeveloper, limitsAreOff } from "@/lib/usage";
import { canChat } from "@/lib/usage-rules";

export const maxDuration = 60;

export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();

  const body = (await req.json()) as { id: string; messages: DrawerUIMessage[]; model?: string; timeZone?: string };
  const { id, messages } = body;
  const ai = resolveAI(repo.userId);
  const live = body.model === "demo" || ai.source === "none" ? null : ai;
  // Only the owner's key is priced and limited: a ChatGPT plan is the person's own, and its model ids come from their account.
  const onKey = live?.source === "key";
  const fallback = MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
  const asked = MODELS.find((m) => m.id === body.model) ?? fallback;
  const keyModel = asked.developerOnly && !isDeveloper(repo) ? fallback : asked;
  let modelId = keyModel.id;
  if (live?.source === "plan") {
    try {
      modelId = await live.pickModel(body.model);
    } catch (e) {
      return new Response(explainAIError(e), { status: 502 });
    }
  }

  // Tool answers continue the same turn, so only a person's own message counts as one.
  const isNewMessage = messages[messages.length - 1]?.role === "user";
  if (isNewMessage && onKey && !(await limitsAreOff(repo))) {
    let used: number, spent: number;
    try {
      [used, spent] = await Promise.all([repo.chatMessagesToday(), repo.aiSpendToday()]);
    } catch (e) {
      // Can't read the limits, so don't spend: an outage mustn't become an open-ended bill.
      console.error("[chat] couldn't read limits", e);
      return Response.json({ error: "The stylist can't check your allowance right now. Please try again shortly.", code: "chat_unavailable" }, { status: 503 });
    }
    if (!canChat({ used, limit: chatDailyLimit(), limitsOff: false })) {
      return Response.json({ error: "You've used today's messages.", code: "chat_limit" }, { status: 429 });
    }
    if (spent >= limitsFromEnv().dailyBudget) {
      return Response.json({ error: "The stylist is resting until tomorrow. Please try again then.", code: "chat_budget" }, { status: 429 });
    }
  }
  if (isNewMessage) await repo.track("chat_sent", { demo: !onKey }); // "demo" rows don't count toward the limit
  const [profile, items] = await Promise.all([repo.getProfile(), repo.listItems({})]);
  const tools = createTools(repo, profile);
  const allTools: ToolSet = !live
    ? tools
    : {
        ...tools,
        web_search: live.provider.tools.webSearch({
          searchContextSize: "medium",
          userLocation: { type: "approximate", city: profile.home_city ?? undefined, country: undefined },
        }),
      };

  const result = streamText({
    model: live ? live.provider(modelId) : createMockModel(),
    instructions: buildInstructions({ profile, itemCount: items.length, now: new Date(), timeZone: body.timeZone }),
    messages: await convertToModelMessages(messages),
    tools: allTools,
    stopWhen: isStepCount(8),
    onEnd: async ({ totalUsage }) => {
      if (!onKey || !keyModel.usdPerM) return;
      // Web search calls ($0.01 each) aren't included: the usage totals don't report them.
      const usd = ((totalUsage.inputTokens ?? 0) * keyModel.usdPerM.input + (totalUsage.outputTokens ?? 0) * keyModel.usdPerM.output) / 1e6;
      await record(repo, "chat", usd);
    },
    maxRetries: live?.maxRetries,
    providerOptions: live ? { openai: { ...live.options, reasoningEffort: "low", reasoningSummary: "auto" } satisfies OpenAILanguageModelResponsesOptions } : undefined,
  });

  const firstUserText =
    messages.find((m) => m.role === "user")?.parts.find((p) => p.type === "text")?.text?.slice(0, 60) ?? "New chat";

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: allTools,
      originalMessages: messages,
      sendReasoning: true,
      sendSources: true,
      onError: explainAIError,
      onEnd: async ({ messages: all }) => {
        await repo.saveChat(id, all, messages.length <= 1 ? firstUserText : undefined).catch(console.error);
      },
    }),
  });
}
