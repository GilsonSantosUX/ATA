import { OpenAIStream, StreamingTextResponse } from 'ai'
import { Elysia, t } from 'elysia'

import { openai } from '@/lib/openai'
import { prisma } from '@/lib/prisma'

export const generateAIDescription = new Elysia().post(
  '/ai/generate/description',
  async ({ set, query }) => {
    const { videoId } = query

    const [transcription] = await prisma.$queryRaw<
      [{ text: string }]
    >/* sql */ `
      SELECT 
        STRING_AGG("public"."TranscriptionSegment"."text", '') as "text"
      FROM "public"."TranscriptionSegment"
      JOIN "public"."Transcription" ON "public"."Transcription"."id" = "public"."TranscriptionSegment"."transcriptionId"
      WHERE "public"."Transcription"."videoId" = ${videoId}
    `

    if (!transcription.text) {
      set.status = 400

      return { message: 'Transcription not found.' }
    }

    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo-0125',
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'Se comporte como um especialista em programação que cria resumos a partir da transcrição de uma aula. Os resumos devem ter foco educacional para dar contexto sobre uma aula que será publicada numa plataforma de vídeos e deve explicar detalhes sobre o vídeo sem necessariamente replicar o passo à passo do vídeo.',
        },
        {
          role: 'system',
          content:
            'Responda em primeira pessoa como se você fosse o instrutor da aula. Utilize uma linguagem menos formal. Evite repetir as palavras muitas vezes, use sinônimos sempre que possível.',
        },
        {
          role: 'system',
          content:
            'Seja sucinto e retorne no máximo 80 palavras em markdown sem cabeçalhos.',
        },
        {
          role: 'user',
          content: `Gere um resumo da transcrição abaixo. Retorne o resumo no mesmo idioma da transcrição. \n\n ${transcription.text}`,
        },
      ],
      temperature: 0,
    })

    const stream = OpenAIStream(response)

    return new StreamingTextResponse(stream)
  },
  {
    query: t.Object({
      videoId: t.String(),
    }),
  },
)
