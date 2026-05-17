import { z } from "zod";

const IngredientSchema = z.object({
  item: z.string().describe("Normalized ingredient name, lowercase singular"),
  quantity: z.number().nullable().describe("Numeric quantity, null when unknowable"),
  unit: z
    .enum(["tbsp", "tsp", "cup", "g", "oz", "ml", "lb", "pinch", "clove", "piece", "slice"])
    .nullable()
    .describe("Normalized unit"),
  descriptor: z
    .string()
    .nullable()
    .describe("Vague descriptor like 'a glug', 'to taste' when quantity is null"),
  was_vague: z.boolean().describe("True when quantity was not precisely stated"),
  notes: z
    .array(z.string())
    .describe("Substitutions, prep notes (e.g. 'or greek yogurt', 'finely diced')"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("0-1 confidence: 1.0=caption list, 0.9=OCR confirmed, 0.8=clear transcript, 0.6=inferred, 0.4=vague"),
});

const StepSchema = z.object({
  position: z.number().int().describe("1-based step number"),
  instruction: z
    .string()
    .describe("Clear, actionable instruction. No filler, no personal asides."),
  duration_sec: z
    .number()
    .int()
    .nullable()
    .describe("Step duration in seconds if stated, null otherwise"),
  approximate: z
    .boolean()
    .describe("True when duration was stated as 'about', 'like', 'around' etc."),
  temperature: z
    .string()
    .nullable()
    .describe("e.g. 'medium-high', '375F/190C'. Null if not applicable."),
  confidence: z.number().min(0).max(1),
});

export const ParsedRecipeSchema = z.object({
  is_recipe: z
    .boolean()
    .describe("False for non-recipe content like restaurant tours or eating reels"),
  low_audio_signal: z
    .boolean()
    .describe("True when audio was absent or music-only; recipe relied on OCR/caption"),

  title: z.string().describe("Concise recipe title, title-cased"),
  summary: z
    .string()
    .nullable()
    .describe("1-2 sentence description of the dish, from the creator's voice"),
  creator_handle: z.string().nullable(),
  cuisine: z
    .string()
    .nullable()
    .describe("e.g. 'Italian', 'Mexican', 'Japanese'. Null if unclear."),
  dietary_tags: z
    .array(z.string())
    .describe("e.g. ['vegan', 'gluten-free', 'dairy-free', 'keto', 'vegetarian']"),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .nullable()
    .describe("Based on technique complexity and step count"),

  total_time_min: z
    .number()
    .int()
    .nullable()
    .describe("Total time including resting/marinating in minutes"),
  active_time_min: z
    .number()
    .int()
    .nullable()
    .describe("Hands-on cooking time in minutes"),
  servings: z.number().int().nullable(),

  ingredients: z.array(IngredientSchema),
  steps: z.array(StepSchema),
  equipment: z
    .array(z.string())
    .describe(
      "Only material equipment: cast iron, blender, food processor. Not 'a bowl'."
    ),

  multi_recipe: z
    .boolean()
    .describe("True when the reel contains multiple distinct recipes"),
  additional_recipes: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .optional()
    .describe("Brief descriptors for secondary recipes in a multi-recipe reel"),
});

export type ParsedRecipe = z.infer<typeof ParsedRecipeSchema>;
export type ParsedIngredient = z.infer<typeof IngredientSchema>;
export type ParsedStep = z.infer<typeof StepSchema>;
