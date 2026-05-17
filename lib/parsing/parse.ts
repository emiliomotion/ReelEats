import Anthropic from "@anthropic-ai/sdk";
import { ParsedRecipeSchema, type ParsedRecipe } from "./schema";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";

export interface ParseInput {
  caption: string;
  transcript: Array<{ text: string; start_ts: number; end_ts: number }>;
  ocrFrames: Array<{ text: string; timestamp: number }>;
  creatorHandle: string;
}

const RECIPE_TOOL: Anthropic.Tool = {
  name: "output_recipe",
  description: "Output the structured recipe extracted from the reel",
  input_schema: {
    type: "object" as const,
    properties: {
      is_recipe: { type: "boolean" },
      low_audio_signal: { type: "boolean" },
      title: { type: "string" },
      summary: { type: ["string", "null"] },
      creator_handle: { type: ["string", "null"] },
      cuisine: { type: ["string", "null"] },
      dietary_tags: { type: "array", items: { type: "string" } },
      difficulty: {
        type: ["string", "null"],
        enum: ["easy", "medium", "hard", null],
      },
      total_time_min: { type: ["integer", "null"] },
      active_time_min: { type: ["integer", "null"] },
      servings: { type: ["integer", "null"] },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          required: ["item", "quantity", "unit", "descriptor", "was_vague", "notes", "confidence"],
          properties: {
            item: { type: "string" },
            quantity: { type: ["number", "null"] },
            unit: {
              type: ["string", "null"],
              enum: ["tbsp", "tsp", "cup", "g", "oz", "ml", "lb", "pinch", "clove", "piece", "slice", null],
            },
            descriptor: { type: ["string", "null"] },
            was_vague: { type: "boolean" },
            notes: { type: "array", items: { type: "string" } },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          required: ["position", "instruction", "duration_sec", "approximate", "temperature", "confidence"],
          properties: {
            position: { type: "integer" },
            instruction: { type: "string" },
            duration_sec: { type: ["integer", "null"] },
            approximate: { type: "boolean" },
            temperature: { type: ["string", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      equipment: { type: "array", items: { type: "string" } },
      multi_recipe: { type: "boolean" },
      additional_recipes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
          },
        },
      },
    },
    required: [
      "is_recipe",
      "low_audio_signal",
      "title",
      "summary",
      "creator_handle",
      "cuisine",
      "dietary_tags",
      "difficulty",
      "total_time_min",
      "active_time_min",
      "servings",
      "ingredients",
      "steps",
      "equipment",
      "multi_recipe",
    ],
  },
};

export async function parseRecipe(input: ParseInput): Promise<ParsedRecipe> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userMessage = buildUserMessage(input);

  let rawOutput: unknown = null;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [RECIPE_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("LLM did not call the output_recipe tool");
    }

    rawOutput = toolUse.input;
    const result = ParsedRecipeSchema.safeParse(rawOutput);

    if (result.success) {
      return result.data;
    }

    // First validation failed — retry with corrective message
    console.warn("[parse] First validation failed, retrying:", result.error.flatten());

    const retryResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [RECIPE_TOOL],
      tool_choice: { type: "any" },
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: `Your output failed schema validation. Errors:\n${JSON.stringify(result.error.flatten(), null, 2)}\n\nPlease fix and call output_recipe again with valid output.`,
        },
      ],
    });

    const retryToolUse = retryResponse.content.find((b) => b.type === "tool_use");
    if (!retryToolUse || retryToolUse.type !== "tool_use") {
      throw new Error("LLM did not call output_recipe on retry");
    }

    rawOutput = retryToolUse.input;
    const retryResult = ParsedRecipeSchema.safeParse(rawOutput);

    if (!retryResult.success) {
      console.error("[parse] Retry also failed validation:", retryResult.error.flatten());
      console.error("[parse] Raw LLM output:", JSON.stringify(rawOutput, null, 2));
      throw new Error(
        `Recipe parsing failed after retry: ${JSON.stringify(retryResult.error.flatten())}`
      );
    }

    return retryResult.data;
  } catch (err) {
    if (rawOutput !== null) {
      console.error("[parse] Raw LLM output at failure:", JSON.stringify(rawOutput, null, 2));
    }
    throw err;
  }
}
