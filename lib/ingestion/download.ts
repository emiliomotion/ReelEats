export interface DownloadResult {
  videoPath: string;
  audioPath: string;
  thumbnailPath: string;
  caption: string;
  creatorHandle: string;
  sourceUrl: string;
}

export class DownloadError extends Error {
  constructor(
    public code: "PRIVATE" | "DELETED" | "RATE_LIMITED" | "UNSUPPORTED" | "UNKNOWN",
    message: string
  ) {
    super(message);
    this.name = "DownloadError";
  }
}

/**
 * Calls the Fly.io download microservice to fetch the reel.
 * The microservice runs yt-dlp + ffmpeg in a Docker container
 * since Vercel serverless cannot execute native binaries.
 */
export async function downloadReel(url: string): Promise<DownloadResult> {
  const serviceUrl = process.env.DOWNLOAD_SERVICE_URL;
  const secret = process.env.DOWNLOAD_SERVICE_SECRET;

  if (!serviceUrl) {
    throw new Error("DOWNLOAD_SERVICE_URL is not configured");
  }

  const response = await fetch(`${serviceUrl}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const code = body.code ?? "UNKNOWN";
    throw new DownloadError(code, body.message ?? `Download service returned ${response.status}`);
  }

  return response.json();
}
