import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    const oembedUrl = `https://www.instagram.com/oembed/?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ReelVault/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ thumbnail_url: null, author_name: null });
    }

    const data = await res.json();
    return NextResponse.json({
      thumbnail_url: data.thumbnail_url ?? null,
      author_name: data.author_name ?? null,
    });
  } catch {
    // oEmbed failed — not a problem, just return null
    return NextResponse.json({ thumbnail_url: null, author_name: null });
  }
}
