import OpenAI from "openai";
import * as fs from "fs";

export interface TranscriptSegment {
  text: string;
  start_ts: number;
  end_ts: number;
}

export async function transcribeAudio(
  audioPath: string
): Promise<TranscriptSegment[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const fileStream = fs.createReadStream(audioPath);

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: fileStream,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  if (!response.segments || response.segments.length === 0) {
    return [];
  }

  return response.segments.map((seg) => ({
    text: seg.text.trim(),
    start_ts: seg.start,
    end_ts: seg.end,
  }));
}
