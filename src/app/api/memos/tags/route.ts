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
  let existingTags: string[]

  try {
    const body = await req.json()
    title = (body.title ?? '').trim()
    content = (body.content ?? '').trim()
    existingTags = Array.isArray(body.existingTags) ? body.existingTags : []
  } catch {
    return NextResponse.json({ error: '요청 본문을 파싱할 수 없습니다.' }, { status: 400 })
  }

  if (!title && !content) {
    return NextResponse.json(
      { error: '제목 또는 내용을 제공해야 합니다.' },
      { status: 400 }
    )
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    const existingTagsNote =
      existingTags.length > 0
        ? `\n이미 추가된 태그: ${existingTags.join(', ')} (이 태그들은 제외하고 추천해 주세요.)`
        : ''

    const prompt = `다음 메모의 제목과 내용을 분석하여 적합한 태그를 추천해 주세요.
규칙:
- 태그는 3~6개 추천
- 각 태그는 짧고 명확한 단어 또는 구 (최대 10자)
- 한국어 또는 영어 모두 허용 (메모 내용에 맞게)
- 쉼표(,)로 구분하여 한 줄로만 출력 (예: 회의,프로젝트,일정,개발)
- 앞뒤 공백 없음, 특수문자(#, @, 등) 없음
- 다른 설명 없이 태그 목록만 출력${existingTagsNote}

제목: ${title}
내용: ${content}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction:
          '당신은 메모에 어울리는 태그를 추천하는 도우미입니다. 쉼표로 구분된 태그 목록만 출력합니다.',
        temperature: 0.4,
        maxOutputTokens: 128,
      },
    })

    const raw = response.text?.trim() ?? ''
    if (!raw) {
      return NextResponse.json(
        { error: 'Gemini가 태그를 생성하지 못했습니다. 다시 시도해 주세요.' },
        { status: 502 }
      )
    }

    const tags = raw
      .split(',')
      .map(t => t.trim().replace(/^#+/, ''))
      .filter(t => t.length > 0 && t.length <= 20)
      .filter(t => !existingTags.includes(t))
      .slice(0, 6)

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('[tags] Gemini API 오류:', error)
    return NextResponse.json(
      { error: 'AI 태그 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 502 }
    )
  }
}
