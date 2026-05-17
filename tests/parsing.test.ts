import { describe, it, expect } from "vitest";
import { parseRecipe } from "../lib/parsing/parse";
import type { ParsedRecipe, ParsedIngredient } from "../lib/parsing/schema";
import * as fs from "fs";
import * as path from "path";

const fixturesDir = path.join(__dirname, "fixtures");

function loadFixture(name: string) {
  const input = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, name, "input.json"), "utf8")
  );
  const expected = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, name, "expected.json"), "utf8")
  );
  return { input, expected };
}

function findIngredient(
  ingredients: ParsedIngredient[],
  itemSubstring: string
): ParsedIngredient | undefined {
  return ingredients.find((i) =>
    i.item.toLowerCase().includes(itemSubstring.toLowerCase())
  );
}

describe("Parsing module — fixture-based tests", () => {
  it("01 well-captioned reel: extracts correct ingredients and steps", async () => {
    const { input, expected } = loadFixture("01_well_captioned");
    const result = await parseRecipe(input);

    expect(result.is_recipe).toBe(true);
    expect(result.low_audio_signal).toBe(false);
    expect(result.title.toLowerCase()).toContain("salmon");

    // At least the minimum number of ingredients
    expect(result.ingredients.length).toBeGreaterThanOrEqual(
      expected.ingredient_count_min
    );

    // Key ingredients with correct quantities (OCR-confirmed values win)
    for (const keyIng of expected.key_ingredients) {
      const found = findIngredient(result.ingredients, keyIng.item);
      expect(found, `Missing ingredient: ${keyIng.item}`).toBeDefined();
      if (found && keyIng.quantity !== undefined) {
        expect(found.quantity).toBeCloseTo(keyIng.quantity, 1);
      }
      if (found && keyIng.unit) {
        expect(found.unit).toBe(keyIng.unit);
      }
    }

    // Step count
    expect(result.steps.length).toBeGreaterThanOrEqual(expected.step_count_min);

    // Timer durations exist in steps
    const allDurations = result.steps.map((s) => s.duration_sec).filter(Boolean);
    for (const dur of expected.step_durations_present) {
      const close = allDurations.some(
        (d) => d !== null && Math.abs(d - dur) <= 30
      );
      expect(close, `Expected a step with ~${dur}s duration`).toBe(true);
    }

    // Equipment
    const equipmentLower = result.equipment.map((e) => e.toLowerCase());
    for (const eq of expected.equipment_includes) {
      const found = equipmentLower.some((e) => e.includes(eq.toLowerCase()));
      expect(found, `Missing equipment: ${eq}`).toBe(true);
    }

    // No filler in steps
    const stepText = result.steps.map((s) => s.instruction).join(" ").toLowerCase();
    const fillerPhrases = ["you guys", "trust me", "save this", "follow for more", "link in bio"];
    for (const filler of fillerPhrases) {
      expect(stepText).not.toContain(filler);
    }
  }, 60_000);

  it("02 audio-only reel: transcribes and structures correctly", async () => {
    const { input, expected } = loadFixture("02_audio_only");
    const result = await parseRecipe(input);

    expect(result.is_recipe).toBe(true);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(
      expected.ingredient_count_min
    );

    for (const keyIng of expected.key_ingredients) {
      const found = findIngredient(result.ingredients, keyIng.item);
      expect(found, `Missing: ${keyIng.item}`).toBeDefined();
      if (found && keyIng.quantity !== undefined) {
        expect(found.quantity).toBeCloseTo(keyIng.quantity, 1);
      }
    }

    // Steps have durations
    const allDurations = result.steps.map((s) => s.duration_sec).filter(Boolean);
    for (const dur of expected.step_durations_present) {
      const close = allDurations.some(
        (d) => d !== null && Math.abs(d - dur) <= 60
      );
      expect(close, `Expected a step with ~${dur}s duration`).toBe(true);
    }

    // Vague ingredients are correctly marked
    for (const vagueItem of expected.vague_ingredients) {
      const found = findIngredient(result.ingredients, vagueItem);
      if (found) {
        expect(found.was_vague).toBe(true);
      }
    }
  }, 60_000);

  it("03 OCR-heavy (silent) reel: uses OCR data correctly", async () => {
    const { input, expected } = loadFixture("03_ocr_heavy");
    const result = await parseRecipe(input);

    expect(result.is_recipe).toBe(true);
    expect(result.low_audio_signal).toBe(true);
    expect(result.title.toLowerCase()).toContain("banana");

    expect(result.ingredients.length).toBeGreaterThanOrEqual(
      expected.ingredient_count_min
    );

    for (const keyIng of expected.key_ingredients) {
      const found = findIngredient(result.ingredients, keyIng.item);
      expect(found, `Missing: ${keyIng.item}`).toBeDefined();
      if (found && keyIng.quantity !== undefined) {
        expect(found.quantity).toBeCloseTo(keyIng.quantity, 1);
      }
    }

    // Bake temperature present somewhere in steps
    const temps = result.steps.map((s) => s.temperature).filter(Boolean);
    expect(temps.length).toBeGreaterThan(0);
    const hasTemp = temps.some((t) => t?.includes("350") || t?.includes("375"));
    expect(hasTemp).toBe(true);

    // Bake duration ~60min (3600s ±5min)
    const allDurations = result.steps.map((s) => s.duration_sec).filter(Boolean);
    const hasBakeDuration = allDurations.some(
      (d) => d !== null && d >= 3600 && d <= 4200
    );
    expect(hasBakeDuration, "Expected ~60min bake duration").toBe(true);

    // Technique note about not overmixing
    const stepText = result.steps.map((s) => s.instruction).join(" ").toLowerCase();
    expect(stepText).toContain("overmix");
  }, 60_000);

  it("04 multi-recipe reel: flags multi_recipe and returns primary", async () => {
    const { input, expected } = loadFixture("04_multi_recipe");
    const result = await parseRecipe(input);

    expect(result.is_recipe).toBe(true);
    expect(result.multi_recipe).toBe(true);

    // Title is for the primary (first) recipe
    expect(result.title.toLowerCase()).toMatch(/fritter|zucchini/);

    // additional_recipes present for the other two
    expect(result.additional_recipes).toBeDefined();
    expect(result.additional_recipes!.length).toBeGreaterThanOrEqual(
      expected.additional_recipes_count
    );

    // Additional recipe titles include pasta and soup
    const addlTitles = result
      .additional_recipes!.map((r) => r.title.toLowerCase())
      .join(" ");
    for (const title of expected.additional_recipe_titles_include) {
      expect(addlTitles).toContain(title.toLowerCase().split(" ")[0]);
    }
  }, 60_000);

  it("05 non-recipe reel: returns is_recipe: false", async () => {
    const { input } = loadFixture("05_not_recipe");
    const result = await parseRecipe(input);

    expect(result.is_recipe).toBe(false);
  }, 60_000);
});
