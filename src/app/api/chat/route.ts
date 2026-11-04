import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type ToolSet } from "ai";
import { getRepo, unauthorized } from "@/lib/data";
import { createMockModel } from "@/lib/ai/mock-model";
import { DEFAULT_MODEL_ID, MODELS } from "@/lib/ai/models";
import { buildInstructions } from "@/lib/ai/system-prompt";
import { createTools, type DrawerUIMessage } from "@/lib/ai/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();

  const body = (await req.json()) as { id: string; messages: DrawerUIMessage[]; model?: string; timeZone?: string };
  const { id, messages } = body;
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  const choice = MODELS.find((m) => m.id === body.model) ?? MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
  const useDemo = choice.provider === "demo" || !hasKey;

  await repo.track("chat_sent", { demo: useDemo });
  const [profile, items] = await Promise.all([repo.getProfile(), repo.listItems({})]);
  const tools = createTools(repo, profile);
  const allTools: ToolSet = useDemo
    ? tools
    : {
        ...tools,
        web_search: openai.tools.webSearch({
          searchContextSize: "medium",
          userLocation: { type: "approximate", city: profile.home_city ?? undefined, country: undefined },
        }),
      };

  const result = streamText({
    model: useDemo ? createMockModel() : openai(choice.id),
    instructions: buildInstructions({ profile, itemCount: items.length, now: new Date(), timeZone: body.timeZone }),
    messages: await convertToModelMessages(messages),
    tools: allTools,
    stopWhen: isStepCount(8),
    providerOptions: useDemo
      ? undefined
      : { openai: { reasoningEffort: "low", reasoningSummary: "auto" } satisfies OpenAILanguageModelResponsesOptions },
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
      onError: (e) => (e instanceof Error ? e.message : "Something went wrong"),
      onEnd: async ({ messages: all }) => {
        await repo.saveChat(id, all, messages.length <= 1 ? firstUserText : undefined).catch(console.error);
      },
    }),
  });
}
