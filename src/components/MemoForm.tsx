'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Memo,
  MemoFormData,
  MEMO_CATEGORIES,
  DEFAULT_CATEGORIES,
} from '@/types/memo'
import MarkdownPreview from '@/components/MarkdownPreview'
import { generateMemoSummary } from '@/app/actions/memos'

interface MemoFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: MemoFormData) => void
  editingMemo?: Memo | null
  onDeleteMemo?: (id: string) => void
  onUpdateSummary?: (id: string, summary: string) => void
}

export default function MemoForm({
  isOpen,
  onClose,
  onSubmit,
  editingMemo,
  onDeleteMemo,
  onUpdateSummary,
}: MemoFormProps) {
  const [formData, setFormData] = useState<MemoFormData>({
    title: '',
    content: '',
    category: 'personal',
    tags: [],
  })
  const [tagInput, setTagInput] = useState('')
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [tagsError, setTagsError] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  // 현재 편집 중인 내용이 저장된 내용과 다른지 여부
  const hasUnsavedChanges =
    editingMemo !== null &&
    editingMemo !== undefined &&
    (formData.content !== editingMemo.content || formData.title !== editingMemo.title)

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 모달 열릴 때 내용 필드로 포커스
  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => contentRef.current?.focus(), 50)
      return () => window.clearTimeout(id)
    }
  }, [isOpen])

  // 편집 모드일 때 폼 데이터 설정
  useEffect(() => {
    if (editingMemo) {
      setFormData({
        title: editingMemo.title,
        content: editingMemo.content,
        category: editingMemo.category,
        tags: editingMemo.tags,
      })
    } else {
      setFormData({
        title: '',
        content: '',
        category: 'personal',
        tags: [],
      })
    }
    setTagInput('')
    setSuggestedTags([])
    setTagsError(null)
    setSummaryError(null)
  }, [editingMemo, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.')
      return
    }
    onSubmit(formData)
    onClose()
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }))
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }))
  }

  const handleAddSuggestedTag = (tag: string) => {
    if (!formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }))
    }
    setSuggestedTags(prev => prev.filter(t => t !== tag))
  }

  const handleSuggestTags = async () => {
    if (!formData.title.trim() && !formData.content.trim()) return
    setTagsLoading(true)
    setTagsError(null)
    setSuggestedTags([])
    try {
      const res = await fetch('/api/memos/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          existingTags: formData.tags,
        }),
      })
      const data: { tags?: string[]; error?: string } = await res.json()
      if (!res.ok || !data.tags) {
        setTagsError(data.error ?? 'AI 태그 추천에 실패했습니다.')
        return
      }
      setSuggestedTags(data.tags)
    } catch {
      setTagsError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setTagsLoading(false)
    }
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleDelete = () => {
    if (!editingMemo || !onDeleteMemo) return
    if (!window.confirm('정말로 이 메모를 삭제하시겠습니까?')) return
    onDeleteMemo(editingMemo.id)
    onClose()
  }

  const handleGenerateSummary = async () => {
    if (!editingMemo || !onUpdateSummary) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const updatedMemo = await generateMemoSummary(editingMemo.id)
      onUpdateSummary(editingMemo.id, updatedMemo.summary ?? '')
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'AI 요약 생성에 실패했습니다.')
    } finally {
      setSummaryLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 헤더 */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingMemo ? '메모 편집' : '새 메모 작성'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 제목 */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                제목 *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className="placeholder-gray-400 text-gray-400 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="메모 제목을 입력하세요"
                required
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                카테고리
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                className="text-gray-400 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                {DEFAULT_CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {MEMO_CATEGORIES[category]}
                  </option>
                ))}
              </select>
            </div>

            {/* 내용 - 좌우 분할 편집기 / 미리보기 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label
                  htmlFor="content"
                  className="text-sm font-medium text-gray-700"
                >
                  내용 *
                </label>
                <span className="text-xs text-gray-400">Markdown 지원</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 편집기 */}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 mb-1">편집</span>
                  <textarea
                    ref={contentRef}
                    id="content"
                    value={formData.content}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        content: e.target.value,
                      }))
                    }
                    className="placeholder-gray-400 text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none flex-1"
                    placeholder={`메모 내용을 입력하세요\n\n**굵게**, *기울임*, # 제목\n- 목록, - [x] 체크리스트\n| 표 | 지원 |`}
                    rows={12}
                    required
                  />
                </div>

                {/* 미리보기 */}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 mb-1">미리보기</span>
                  <div className="border border-gray-200 rounded-lg px-3 py-2 min-h-[12rem] overflow-y-auto bg-gray-50 flex-1">
                    <MarkdownPreview content={formData.content} />
                  </div>
                </div>
              </div>
            </div>

            {/* 태그 */}
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="text-sm font-medium text-gray-700">태그</label>
                <button
                  type="button"
                  onClick={handleSuggestTags}
                  disabled={
                    tagsLoading ||
                    (!formData.title.trim() && !formData.content.trim())
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {tagsLoading ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      태그 추천 중...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                      AI 태그 추천
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="placeholder-gray-400 text-black flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="태그를 입력하고 Enter를 누르세요"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  추가
                </button>
              </div>

              {/* AI 추천 태그 */}
              {tagsError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2">
                  {tagsError}
                </p>
              )}
              {suggestedTags.length > 0 && (
                <div className="mb-3 p-3 border border-purple-100 rounded-lg bg-purple-50">
                  <p className="text-xs text-purple-600 mb-2 font-medium">
                    AI 추천 태그 — 클릭하면 추가됩니다
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {suggestedTags.map((tag, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleAddSuggestedTag(tag)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-purple-300 text-purple-700 text-xs rounded-full hover:bg-purple-100 transition-colors"
                      >
                        + #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 현재 태그 목록 */}
              {formData.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AI 요약 */}
            {editingMemo && onUpdateSummary && (
              <div className="border border-blue-100 rounded-lg p-4 bg-blue-50 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-medium text-blue-800">AI 요약</span>
                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={summaryLoading || hasUnsavedChanges}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {summaryLoading ? (
                      <>
                        <svg
                          className="w-3 h-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>
                        요약 생성 중...
                      </>
                    ) : editingMemo.summary ? (
                      'AI 요약 다시 생성'
                    ) : (
                      'AI 요약 생성'
                    )}
                  </button>
                </div>

                {hasUnsavedChanges && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    변경사항을 저장한 후 요약을 생성할 수 있습니다.
                  </p>
                )}

                {summaryError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                    {summaryError}
                  </p>
                )}

                {editingMemo.summary ? (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                      {editingMemo.summary}
                    </p>
                    {editingMemo.summaryUpdatedAt && (
                      <p className="text-xs text-gray-400">
                        {new Date(editingMemo.summaryUpdatedAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        기준 요약
                      </p>
                    )}
                  </div>
                ) : (
                  !summaryLoading && (
                    <p className="text-xs text-blue-500">
                      버튼을 눌러 AI가 메모 내용을 요약합니다.
                    </p>
                  )
                )}
              </div>
            )}

            {/* 버튼 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
              {editingMemo && onDeleteMemo && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full sm:w-auto px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg transition-colors sm:mr-auto"
                >
                  삭제
                </button>
              )}
              <div className="flex flex-1 gap-3 min-w-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                >
                  {editingMemo ? '수정하기' : '저장하기'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
