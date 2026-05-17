import { downloadReel } from "./download";
import { transcribeAudio } from "./transcribe";
import { extractOcrFromFrames } from "./ocr";
import { parseRecipe } from "../parsing/parse";
import { createServiceClient } from "../supabase/server";
import * as fs from "fs";
import * as path from "path";

export type PipelineStatus =
  | "downloading"
  | "extracting"
  | "parsing"
  | "saving"
  | "done"
  | "error";

export interface PipelineResult {
  recipeId: string;
  isRecipe: boolean;
  multiRecipe: boolean;
}

export async function runIngestionPipeline(
  url: string,
  userId: string
): Promise<PipelineResult> {
  let tempDir: string | null = null;

  try {
    // Step 1: Download
    const download = await downloadReel(url);
    tempDir = path.dirname(download.videoPath);

    // Step 2: Parallel extraction (audio + visual)
    const frameDir = path.join(tempDir, "frames");
    const [transcript, ocrFrames] = await Promise.all([
      transcribeAudio(download.audioPath),
      fs.existsSync(frameDir) ? extractOcrFromFrames(frameDir) : Promise.resolve([]),
    ]);

    // Step 3: Parse
    const parsed = await parseRecipe({
      caption: download.caption,
      transcript,
      ocrFrames,
      creatorHandle: download.creatorHandle,
    });

    // Step 4: Persist
    const supabase = createServiceClient();

    // Upload thumbnail
    let thumbnailUrl: string | null = null;
    if (download.thumbnailPath && fs.existsSync(download.thumbnailPath)) {
      const thumbBuffer = fs.readFileSync(download.thumbnailPath);
      const thumbKey = `${userId}/${Date.now()}_thumb.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(thumbKey, thumbBuffer, { contentType: "image/jpeg", upsert: false });
      if (!uploadError) {
        const { data } = supabase.storage.from("thumbnails").getPublicUrl(thumbKey);
        thumbnailUrl = data.publicUrl;
      }
    }

    // Insert recipe
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        user_id: userId,
        title: parsed.title,
        summary: parsed.summary,
        creator_handle: parsed.creator_handle ?? download.creatorHandle,
        source_url: download.sourceUrl,
        thumbnail_url: thumbnailUrl,
        cuisine: parsed.cuisine,
        dietary_tags: parsed.dietary_tags,
        difficulty: parsed.difficulty,
        total_time_min: parsed.total_time_min,
        active_time_min: parsed.active_time_min,
        servings: parsed.servings,
        is_recipe: parsed.is_recipe,
        low_audio_signal: parsed.low_audio_signal,
      })
      .select()
      .single();

    if (recipeError || !recipe) {
      throw new Error(`Failed to insert recipe: ${recipeError?.message}`);
    }

    const recipeId = recipe.id;

    // Insert ingredients, steps, equipment in parallel
    await Promise.all([
      parsed.ingredients.length > 0
        ? supabase.from("ingredients").insert(
            parsed.ingredients.map((ing, i) => ({
              recipe_id: recipeId,
              position: i,
              item: ing.item,
              quantity: ing.quantity,
              unit: ing.unit,
              descriptor: ing.descriptor,
              was_vague: ing.was_vague,
              notes: ing.notes,
              confidence: ing.confidence,
            }))
          )
        : Promise.resolve(),

      parsed.steps.length > 0
        ? supabase.from("steps").insert(
            parsed.steps.map((step) => ({
              recipe_id: recipeId,
              position: step.position,
              instruction: step.instruction,
              duration_sec: step.duration_sec,
              approximate: step.approximate,
              temperature: step.temperature,
              confidence: step.confidence,
            }))
          )
        : Promise.resolve(),

      parsed.equipment.length > 0
        ? supabase.from("equipment").insert(
            parsed.equipment.map((item) => ({
              recipe_id: recipeId,
              item,
            }))
          )
        : Promise.resolve(),

      supabase.from("raw_inputs").insert({
        recipe_id: recipeId,
        caption: download.caption,
        transcript: transcript,
        ocr_frames: ocrFrames,
      }),
    ]);

    return {
      recipeId,
      isRecipe: parsed.is_recipe,
      multiRecipe: parsed.multi_recipe,
    };
  } finally {
    // Always clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Manual fallback: user provides caption and a frame directory path
 * (from a screen recording they uploaded). Skips yt-dlp entirely.
 */
export async function runManualPipeline(
  caption: string,
  creatorHandle: string,
  sourceUrl: string,
  frameDir: string | null,
  audioPath: string | null,
  userId: string
): Promise<PipelineResult> {
  const [transcript, ocrFrames] = await Promise.all([
    audioPath ? transcribeAudio(audioPath) : Promise.resolve([]),
    frameDir && fs.existsSync(frameDir)
      ? extractOcrFromFrames(frameDir)
      : Promise.resolve([]),
  ]);

  const parsed = await parseRecipe({
    caption,
    transcript,
    ocrFrames,
    creatorHandle,
  });

  const supabase = createServiceClient();

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      title: parsed.title,
      summary: parsed.summary,
      creator_handle: parsed.creator_handle ?? creatorHandle,
      source_url: sourceUrl,
      cuisine: parsed.cuisine,
      dietary_tags: parsed.dietary_tags,
      difficulty: parsed.difficulty,
      total_time_min: parsed.total_time_min,
      active_time_min: parsed.active_time_min,
      servings: parsed.servings,
      is_recipe: parsed.is_recipe,
      low_audio_signal: parsed.low_audio_signal,
    })
    .select()
    .single();

  if (error || !recipe) {
    throw new Error(`Failed to insert recipe: ${error?.message}`);
  }

  const recipeId = recipe.id;

  await Promise.all([
    parsed.ingredients.length > 0
      ? supabase.from("ingredients").insert(
          parsed.ingredients.map((ing, i) => ({
            recipe_id: recipeId,
            position: i,
            item: ing.item,
            quantity: ing.quantity,
            unit: ing.unit,
            descriptor: ing.descriptor,
            was_vague: ing.was_vague,
            notes: ing.notes,
            confidence: ing.confidence,
          }))
        )
      : Promise.resolve(),

    parsed.steps.length > 0
      ? supabase.from("steps").insert(
          parsed.steps.map((step) => ({
            recipe_id: recipeId,
            position: step.position,
            instruction: step.instruction,
            duration_sec: step.duration_sec,
            approximate: step.approximate,
            temperature: step.temperature,
            confidence: step.confidence,
          }))
        )
      : Promise.resolve(),

    parsed.equipment.length > 0
      ? supabase.from("equipment").insert(
          parsed.equipment.map((item) => ({ recipe_id: recipeId, item }))
        )
      : Promise.resolve(),

    supabase.from("raw_inputs").insert({
      recipe_id: recipeId,
      caption,
      transcript,
      ocr_frames: ocrFrames,
    }),
  ]);

  // Clean up manual upload temp files
  if (frameDir && fs.existsSync(frameDir)) {
    fs.rmSync(frameDir, { recursive: true, force: true });
  }
  if (audioPath && fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath);
  }

  return {
    recipeId,
    isRecipe: parsed.is_recipe,
    multiRecipe: parsed.multi_recipe,
  };
}
