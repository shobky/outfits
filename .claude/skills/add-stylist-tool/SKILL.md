---
name: add-stylist-tool
description: Add a new tool to the Drawer stylist agent (server execute + chat UI rendering + demo model). Use when giving the stylist a new capability.
---
# Add a stylist tool

1. **Define** it in `src/lib/ai/tools.ts` inside `createTools(repo, profile)`:
   `my_tool: tool({ description, inputSchema: z.object({...}), execute: async (input) => ... })`.
   - Description says WHEN to use it. Return compact JSON (token budget!). Use `brief()` for items sent to the model, `visual()` for items the UI renders.
   - Client-side tools (need user input): omit `execute`, add `outputSchema`; answer in UI with `addToolOutput` (see `ask_user`).
2. **Data**: if it needs storage, add a method to `Repo` (`src/lib/data/repo.ts`) and implement in BOTH `demo.ts` and `supabase.ts`.
3. **Render** in chat:
   - Background/"thinking" tool → add to `TOOL_META` in `src/components/chat/agent-steps.tsx` (label, icon, summary). It then shows in the collapsible steps drawer and the header status pill.
   - Visual tool → add a `case` in `ToolBlock` (`src/components/chat/message.tsx`) and a component in `tool-views.tsx`. Show a skeleton until `state === "output-available"`.
4. **Prompt**: mention it in "How you work" in `src/lib/ai/system-prompt.ts` only if the model must know the workflow.
5. **Demo model**: if it's part of a core flow, add a branch in `src/lib/ai/mock-model.ts` so it works without an API key.
6. Verify: `npx tsc --noEmit && pnpm lint`, then run a chat with model "Demo stylist" (and a real key if available).
