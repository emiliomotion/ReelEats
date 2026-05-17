import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runIngestionPipeline, runManualPipeline } from "@/lib/ingestion/pipeline";
import { DownloadError } from "@/lib/ingestion/download";
import { z } from "zod";

const IngestSchema = z.object({
  url: z.string().url(),
});

const ManualIngestSchema = z.object({
  caption: z.string(),
  creatorHandle: z.string().default(""),
  sourceUrl: z.string().default(""),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Manual fallback path
  if (body.caption !== undefined) {
    const parsed = ManualIngestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await runManualPipeline(
      parsed.data.caption,
      parsed.data.creatorHandle,
      parsed.data.sourceUrl,
      null,
      null,
      user.id
    );
    return NextResponse.json(result);
  }

  // Normal URL path
  const parsed = IngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runIngestionPipeline(parsed.data.url, user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DownloadError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
    console.error("[ingest] Unexpected error:", err);
    return NextResponse.json(
      { error: "Ingestion failed. Please try again." },
      { status: 500 }
    );
  }
}
