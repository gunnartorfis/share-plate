import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const TEST_TAGS = [
  { key: 'beef', label: 'Beef', category: 'protein' },
  { key: 'chicken', label: 'Chicken', category: 'protein' },
  { key: 'fish', label: 'Fish', category: 'protein' },
  { key: 'pork', label: 'Pork', category: 'protein' },
  { key: 'vegetarian', label: 'Vegetarian', category: 'protein' },
  { key: 'vegan', label: 'Vegan', category: 'protein' },
  { key: 'lamb', label: 'Lamb', category: 'protein' },
  { key: 'turkey', label: 'Turkey', category: 'protein' },
  { key: 'shrimp', label: 'Shrimp', category: 'protein' },
  { key: 'tofu', label: 'Tofu', category: 'protein' },
  { key: 'baked', label: 'Baked', category: 'method' },
  { key: 'grilled', label: 'Grilled', category: 'method' },
  { key: 'fried', label: 'Fried', category: 'method' },
  { key: 'boiled', label: 'Boiled', category: 'method' },
  { key: 'steamed', label: 'Steamed', category: 'method' },
  { key: 'slowCooked', label: 'Slow cooked', category: 'method' },
  { key: 'quick', label: 'Quick', category: 'method' },
  { key: 'onePan', label: 'One pan', category: 'method' },
  { key: 'healthy', label: 'Healthy', category: 'dietary' },
  { key: 'light', label: 'Light', category: 'dietary' },
  { key: 'comfort', label: 'Comfort food', category: 'dietary' },
  { key: 'glutenFree', label: 'Gluten free', category: 'dietary' },
  { key: 'lowCarb', label: 'Low carb', category: 'dietary' },
  { key: 'highProtein', label: 'High protein', category: 'dietary' },
  { key: 'italian', label: 'Italian', category: 'cuisine' },
  { key: 'mexican', label: 'Mexican', category: 'cuisine' },
  { key: 'asian', label: 'Asian', category: 'cuisine' },
  { key: 'indian', label: 'Indian', category: 'cuisine' },
  { key: 'mediterranean', label: 'Mediterranean', category: 'cuisine' },
  { key: 'nordic', label: 'Nordic', category: 'cuisine' },
  { key: 'american', label: 'American', category: 'cuisine' },
] as const

interface TagSelectorProps {
  selectedTags: Array<string>
  onChange: (tags: Array<string>) => void
}

export function TagSelector({ selectedTags, onChange }: TagSelectorProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [popupRect, setPopupRect] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const filteredTags = useMemo(() => {
    if (!search) return [...TEST_TAGS]
    const searchLower = search.toLowerCase()
    return TEST_TAGS.filter(
      ({ key, label }) =>
        key.toLowerCase().includes(searchLower) ||
        label.toLowerCase().includes(searchLower),
    )
  }, [search])

  const getTagLabel = (key: string) => {
    const found = TEST_TAGS.find((tag) => tag.key === key)
    return found?.label || key
  }

  const handleSelect = (key: string) => {
    if (!selectedTags.includes(key)) {
      onChange([...selectedTags, key])
    }
    setSearch('')
    setOpen(false)
  }

  const removeTag = (key: string) => {
    onChange(selectedTags.filter((tag) => tag !== key))
  }

  useEffect(() => {
    if (!open) return

    const updatePopupPosition = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      setPopupRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }

    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)

    return () => {
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
    }
  }, [open])

  return (
    <div className="space-y-1.5">
      <Label htmlFor="tags">{t('recipes.tags.label')}</Label>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedTags.map((key) => (
            <Button
              key={key}
              variant="secondary"
              size="sm"
              className="h-6 text-xs gap-1 pr-1"
              onClick={() => removeTag(key)}
            >
              {getTagLabel(key)}
              <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
            </Button>
          ))}
        </div>
      )}

      <div ref={anchorRef} className="relative">
        <input
          type="text"
          className="flex w-full rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={t('recipes.tags.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open &&
        filteredTags.length > 0 &&
        popupRect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[220] max-h-60 overflow-auto rounded-md border border-border bg-popup shadow-lg"
            style={{
              top: popupRect.top,
              left: popupRect.left,
              width: popupRect.width,
            }}
          >
            {filteredTags.map(({ key, label }) => (
              <div
                key={key}
                className={`px-3 py-2 cursor-pointer hover:bg-accent text-sm ${
                  selectedTags.includes(key)
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => !selectedTags.includes(key) && handleSelect(key)}
              >
                {label}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
