import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

export interface OcrFrame {
  text: string;
  timestamp: number;
}

/**
 * Sends a batch of sampled frames to GPT-4o vision and extracts
 * any text overlays, ingredient lists, or on-screen text relevant
 * to a cooking recipe.
 */
export async function extractOcrFromFrames(
  frameDir: string
): Promise<OcrFrame[]> {
  const frameFiles = fs
    .readdirSync(frameDir)
    .filter((f) => f.endsWith(".jpg") || f.endsWith(".png"))
    .sort();

  if (frameFiles.length === 0) return [];

  // Process frames in batches of 10 to avoid token limits
  const batchSize = 10;
  const results: OcrFrame[] = [];

  for (let i = 0; i < frameFiles.length; i += batchSize) {
    const batch = frameFiles.slice(i, i + batchSize);
    const batchResults = await processBatch(frameDir, batch);
    results.push(...batchResults);
  }

  return results.filter((f) => f.text.trim().length > 0);
}

async function processBatch(
  frameDir: string,
  frameFiles: string[]
): Promise<OcrFrame[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = [];

  for (const file of frameFiles) {
    const filePath = path.join(frameDir, file);
    const base64 = fs.readFileSync(filePath).toString("base64");
    const ext = path.extname(file).slice(1);
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";

    // Frame filename encodes timestamp: frame_0042.jpg = 42 seconds
    imageContents.push({
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${base64}`,
        detail: "low",
      },
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content: `You are extracting text overlays from cooking video frames.
For each frame, extract ONLY text that is relevant to a recipe:
- Ingredient names and quantities (e.g. "2 tbsp butter")
- Cooking instructions or steps
- Temperatures (e.g. "350°F")
- Timing (e.g. "4 min")
- Technique notes (e.g. "don't overmix")

Ignore: decorative text, social media handles, watermarks, captions unrelated to the recipe.

Respond with a JSON array. Each element: { "frameIndex": number, "text": "extracted text or empty string" }
Frame indices are 0-based matching the order of images provided.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract recipe-relevant text from these ${frameFiles.length} frames:`,
          },
          ...imageContents,
        ],
      },
    ],
  });

  const content = response.choices[0].message.content ?? "[]";

  let parsed: Array<{ frameIndex: number; text: string }> = [];
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.warn("[ocr] Failed to parse GPT-4o OCR response:", content);
    return [];
  }

  return parsed
    .map((item) => {
      const filename = frameFiles[item.frameIndex];
      const timestamp = parseTimestampFromFilename(filename);
      return { text: item.text, timestamp };
    })
    .filter((f) => f.text.trim().length > 0);
}

function parseTimestampFromFilename(filename: string): number {
  // Expected format: frame_0042.jpg → 42 seconds
  const match = filename.match(/frame_(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
