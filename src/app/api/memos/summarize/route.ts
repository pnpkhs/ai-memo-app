import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API 키가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 추가하세요.' },
      { status: 500 }
    )
  }

  let title: string
  let content: string

  try {
    const body = await req.json()
    title = (body.title ?? '').trim()
    content = (body.content ?? '').trim()
  } catch {
    return NextResponse.json({ error: '요청 본문을 파싱할 수 없습니다.' }, { status: 400 })
  }

  if (!title || !content) {
    return NextResponse.json(
      { error: '제목과 내용을 모두 제공해야 합니다.' },
      { status: 400 }
    )
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    const prompt = `다음 메모를 한국어로 간결하게 요약해 주세요.
핵심 내용을 3~5개의 bullet point(• 기호 사용)로 정리하되, 각 항목은 한 줄 이내로 작성하세요.
불필요한 서두나 후기 문구(예: "이 메모는~", "요약하면~") 없이 bullet point만 출력하세요.

제목: ${title}

내용:
${content}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction:
          '당신은 메모 내용을 간결하게 요약하는 도우미입니다. 핵심만 추출하여 bullet point 형식으로 출력합니다.',
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    })

    const summary = response.text?.trim() ?? ''
    if (!summary) {
      return NextResponse.json(
        { error: 'Gemini가 요약을 생성하지 못했습니다. 다시 시도해 주세요.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('[summarize] Gemini API 오류:', error)
    return NextResponse.json(
      { error: 'AI 요약 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 502 }
    )
  }
}
