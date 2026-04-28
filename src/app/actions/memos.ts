'use server'

import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '@/lib/supabase/client'
import { Memo, MemoFormData } from '@/types/memo'

type DbMemo = {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  summary: string | null
  summaryUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

function toMemo(row: DbMemo): Memo {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags: row.tags,
    summary: row.summary ?? undefined,
    summaryUpdatedAt: row.summaryUpdatedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listMemos(): Promise<Memo[]> {
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .order('createdAt', { ascending: false })

  if (error) throw new Error(`메모 목록 조회 실패: ${error.message}`)

  return (data as DbMemo[]).map(toMemo)
}

export async function createMemo(formData: MemoFormData): Promise<Memo> {
  const now = new Date().toISOString()
  const newMemo = {
    id: uuidv4(),
    title: formData.title,
    content: formData.content,
    category: formData.category,
    tags: formData.tags,
    createdAt: now,
    updatedAt: now,
  }

  const { data, error } = await supabase.from('memos').insert(newMemo).select().single()

  if (error) throw new Error(`메모 생성 실패: ${error.message}`)

  revalidatePath('/')
  return toMemo(data as DbMemo)
}

export async function updateMemo(id: string, formData: MemoFormData, existingSummary?: string, existingSummaryUpdatedAt?: string): Promise<Memo> {
  const { data: existing, error: fetchError } = await supabase
    .from('memos')
    .select('content, summary, summaryUpdatedAt')
    .eq('id', id)
    .single()

  if (fetchError) throw new Error(`메모 조회 실패: ${fetchError.message}`)

  const contentChanged = (existing as { content: string }).content !== formData.content
  const updates = {
    title: formData.title,
    content: formData.content,
    category: formData.category,
    tags: formData.tags,
    updatedAt: new Date().toISOString(),
    summary: contentChanged ? null : ((existing as DbMemo).summary ?? existingSummary ?? null),
    summaryUpdatedAt: contentChanged ? null : ((existing as DbMemo).summaryUpdatedAt ?? existingSummaryUpdatedAt ?? null),
  }

  const { data, error } = await supabase.from('memos').update(updates).eq('id', id).select().single()

  if (error) throw new Error(`메모 수정 실패: ${error.message}`)

  revalidatePath('/')
  return toMemo(data as DbMemo)
}

export async function deleteMemo(id: string): Promise<void> {
  const { error } = await supabase.from('memos').delete().eq('id', id)

  if (error) throw new Error(`메모 삭제 실패: ${error.message}`)

  revalidatePath('/')
}

export async function updateMemoSummary(id: string, summary: string): Promise<Memo> {
  const updates = {
    summary,
    summaryUpdatedAt: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('memos').update(updates).eq('id', id).select().single()

  if (error) throw new Error(`요약 저장 실패: ${error.message}`)

  revalidatePath('/')
  return toMemo(data as DbMemo)
}

export async function generateMemoSummary(id: string): Promise<Memo> {
  const { data: memoRow, error: fetchError } = await supabase
    .from('memos')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !memoRow) throw new Error('메모를 찾을 수 없습니다.')

  const memo = toMemo(memoRow as DbMemo)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다.')

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `다음 메모를 한국어로 간결하게 요약해 주세요.
핵심 내용을 3~5개의 bullet point(• 기호 사용)로 정리하되, 각 항목은 한 줄 이내로 작성하세요.
불필요한 서두나 후기 문구(예: "이 메모는~", "요약하면~") 없이 bullet point만 출력하세요.

제목: ${memo.title}

내용:
${memo.content}`

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
  if (!summary) throw new Error('Gemini가 요약을 생성하지 못했습니다.')

  return updateMemoSummary(id, summary)
}

export async function clearAllMemos(): Promise<void> {
  const { error } = await supabase.from('memos').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) throw new Error(`전체 삭제 실패: ${error.message}`)

  revalidatePath('/')
}
