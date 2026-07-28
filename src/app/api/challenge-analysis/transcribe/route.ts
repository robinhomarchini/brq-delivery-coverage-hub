import { NextResponse } from "next/server";
import { assertCanUseChallengeAnalysis, ChallengeAccessError } from "@/server/auth/challenge-analysis-access";
import { transcribeAiAudio } from "@/server/ai/openai";

const maxAudioBytes = 10 * 1024 * 1024;
const supportedAudioTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

export async function POST(request: Request) {
  try {
    await assertCanUseChallengeAnalysis(request);
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof Blob) || audio.size === 0 || audio.size > maxAudioBytes) {
      return NextResponse.json({ error: "Áudio inválido ou maior que 10 MB." }, { status: 400 });
    }
    const audioType = audio.type.split(";")[0]?.trim().toLowerCase() ?? "";
    if (audioType && !supportedAudioTypes.has(audioType)) {
      return NextResponse.json({ error: "Formato de áudio não suportado." }, { status: 415 });
    }

    const extension = getAudioExtension(audioType);
    const transcript = await transcribeAiAudio(audio, `contexto.${extension}`);
    if (!transcript) {
      return NextResponse.json(
        { error: "Não foi possível transcrever o áudio agora. Tente novamente ou digite o contexto." },
        { status: 503 },
      );
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    if (error instanceof ChallengeAccessError) {
      return NextResponse.json(
        { error: "Acesso não autorizado para transcrição da Análise de Desafio." },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível processar o áudio agora." },
      { status: 500 },
    );
  }
}

function getAudioExtension(contentType: string) {
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  return "webm";
}
