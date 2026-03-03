import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EmojiPicker from 'emoji-picker-react'
import { AppLayout } from '@/components/layout/app-layout'
import {
  deleteConstraint,
  getDayTemplates,
  getMyConstraints,
  saveConstraint,
  saveDayTemplate,
} from '@/lib/server/constraints'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/constraints')({
  component: ConstraintsPage,
})

const DAY_KEYS = [
  'days.monday',
  'days.tuesday',
  'days.wednesday',
  'days.thursday',
  'days.friday',
  'days.saturday',
  'days.sunday',
]

const PRESET_COLORS = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#3498db',
  '#9b59b6',
  '#e91e63',
  '#607d8b',
  '#795548',
]

const DEFAULT_CONSTRAINTS: Array<{
  id: string
  nameKey: string
  emoji: string
  color: string
  frequency?: string
}> = [
  {
    id: 'preset-fish',
    nameKey: 'constraints.defaults.fish',
    emoji: '🐟',
    color: '#3498db',
    frequency: '2',
  },
  {
    id: 'preset-simple',
    nameKey: 'constraints.defaults.simple',
    emoji: '✨',
    color: '#9b59b6',
  },
  {
    id: 'preset-vegetarian',
    nameKey: 'constraints.defaults.vegetarian',
    emoji: '🥗',
    color: '#2ecc71',
    frequency: '2',
  },
  {
    id: 'preset-vegan',
    nameKey: 'constraints.defaults.vegan',
    emoji: '🌱',
    color: '#27ae60',
    frequency: '1',
  },
  {
    id: 'preset-healthy',
    nameKey: 'constraints.defaults.healthy',
    emoji: '🥦',
    color: '#1abc9c',
  },
  {
    id: 'preset-comfort',
    nameKey: 'constraints.defaults.comfort',
    emoji: '🍲',
    color: '#e67e22',
  },
  {
    id: 'preset-kid-friendly',
    nameKey: 'constraints.defaults.kidFriendly',
    emoji: '👶',
    color: '#e91e63',
  },
  {
    id: 'preset-quick',
    nameKey: 'constraints.defaults.quick',
    emoji: '🥪',
    color: '#607d8b',
    frequency: '1',
  },
  {
    id: 'preset-new',
    nameKey: 'constraints.defaults.new',
    emoji: '🆕',
    color: '#8e44ad',
  },
]

type Constraint = {
  id: string
  name: string
  color: string
  emoji: string | null
  frequency: string | null
  isPreset?: boolean
}

function ConstraintsPage() {
  const { t } = useTranslation()
  const [customConstraints, setCustomConstraints] = useState<Array<Constraint>>(
    [],
  )
  const [templates, setTemplates] = useState<
    Array<{ dayOfWeek: number; constraintIds: Array<string> }>
  >([])

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [cName, setCName] = useState('')
  const [cColor, setCColor] = useState(PRESET_COLORS[0])
  const [cEmoji, setCEmoji] = useState('')
  const [cFrequency, setCFrequency] = useState('')
  const [cSaving, setCsaving] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  const [openDay, setOpenDay] = useState<number | null>(null)
  const [constraintToDelete, setConstraintToDelete] = useState<string | null>(
    null,
  )
  const popoverRef = useRef<HTMLDivElement>(null)

  const presets: Array<Constraint> = DEFAULT_CONSTRAINTS.map((dc) => ({
    id: dc.id,
    name: t(dc.nameKey),
    emoji: dc.emoji,
    color: dc.color,
    frequency: dc.frequency ?? null,
    isPreset: true,
  }))

  const allConstraints = [...presets, ...customConstraints]

  async function loadConstraints() {
    const [cs, ts] = await Promise.all([getMyConstraints(), getDayTemplates()])
    setCustomConstraints(cs as Array<Constraint>)
    setTemplates(
      ts.map((t) => ({
        dayOfWeek: t.dayOfWeek,
        constraintIds: JSON.parse(t.constraintIds) as Array<string>,
      })),
    )
  }

  useEffect(() => {
    loadConstraints()
  }, [])

  useEffect(() => {
    if (openDay === null) return

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setOpenDay(null)
      }
    }

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDay])

  useEffect(() => {
    if (!showEmojiPicker || !emojiPickerRef.current) return

    function handleClickOutside(event: MouseEvent) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false)
      }
    }

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  function openNewConstraint() {
    setEditingId(null)
    setCName('')
    setCColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
    setCEmoji('')
    setCFrequency('')
    setShowModal(true)
  }

  function openEditConstraint(c: Constraint) {
    if (c.isPreset) return
    setEditingId(c.id)
    setCName(c.name)
    setCColor(c.color)
    setCEmoji(c.emoji ?? '')
    setCFrequency(c.frequency ?? '')
    setShowModal(true)
    setOpenDay(null)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setCName('')
    setCEmoji('')
    setCFrequency('')
    setShowEmojiPicker(false)
  }

  async function handleSaveConstraint(e: React.FormEvent) {
    e.preventDefault()
    setCsaving(true)
    try {
      await saveConstraint({
        data: {
          id: editingId ?? undefined,
          name: cName,
          color: cColor,
          emoji: cEmoji || undefined,
          frequency: cFrequency || undefined,
        },
      })
      closeModal()
      await loadConstraints()
    } finally {
      setCsaving(false)
    }
  }

  async function confirmDeleteConstraint() {
    if (!constraintToDelete) return
    await deleteConstraint({ data: { id: constraintToDelete } })
    await loadConstraints()
    setConstraintToDelete(null)
  }

  async function toggleDayConstraint(dayOfWeek: number, constraintId: string) {
    const template = templates.find((t) => t.dayOfWeek === dayOfWeek)
    const current = template?.constraintIds ?? []
    const next = current.includes(constraintId)
      ? current.filter((id) => id !== constraintId)
      : [...current, constraintId]
    await saveDayTemplate({ data: { dayOfWeek, constraintIds: next } })
    setOpenDay(null)
    await loadConstraints()
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-display font-bold tracking-tight">
            {t('settings.constraints')}
          </h1>
          <Button onClick={openNewConstraint} size="sm">
            + {t('constraints.defaults.create')}
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-base font-display font-semibold mb-1">
              {t('settings.dayDefaults')}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t('settings.dayDefaultsDesc')}
            </p>
            <div className="space-y-3">
              {DAY_KEYS.map((dayKey, i) => {
                const template = templates.find((t) => t.dayOfWeek === i)
                const activeIds = template?.constraintIds ?? []
                return (
                  <div key={i} className="relative">
                    <div className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3">
                      <span className="text-sm font-medium w-24 shrink-0">
                        {t(dayKey)}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {allConstraints
                          .filter((c) => activeIds.includes(c.id))
                          .map((c) => (
                            <button
                              key={c.id}
                              onClick={() => toggleDayConstraint(i, c.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-all"
                              style={{
                                backgroundColor: c.color + '22',
                                color: c.color,
                                borderColor: c.color + '55',
                              }}
                            >
                              {c.emoji && <span>{c.emoji}</span>}
                              {c.name}
                              {c.frequency && (
                                <span className="opacity-70 ml-0.5">
                                  {c.frequency}×/wk
                                </span>
                              )}
                              <span className="ml-0.5">×</span>
                            </button>
                          ))}
                        <div
                          className="relative"
                          ref={openDay === i ? popoverRef : null}
                        >
                          <button
                            onClick={() => setOpenDay(openDay === i ? null : i)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-dashed text-muted-foreground hover:bg-muted/50 transition-all"
                          >
                            +
                          </button>
                          {openDay === i && (
                            <div
                              className={cn(
                                'absolute left-0 z-[60] bg-card border border-border rounded-lg shadow-lg p-2 min-w-[180px] max-h-[50vh] overflow-y-auto overscroll-contain',
                                i >= 4
                                  ? 'bottom-full mb-1'
                                  : 'top-full mt-1',
                              )}
                            >
                              <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
                                {t('settings.constraintName')}
                              </div>
                              {allConstraints.map((c) => {
                                const isActive = activeIds.includes(c.id)
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleDayConstraint(i, c.id)
                                    }}
                                    className={cn(
                                      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-all hover:bg-muted',
                                      isActive && 'opacity-50',
                                    )}
                                    style={{ color: c.color }}
                                  >
                                    <span>{c.emoji}</span>
                                    <span className="flex-1">{c.name}</span>
                                    {isActive && <span>✓</span>}
                                  </button>
                                )
                              })}
                              <div className="border-t mt-2 pt-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenDay(null)
                                    openNewConstraint()
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-muted text-muted-foreground"
                                >
                                  <span>+</span>
                                  <span>
                                    {t('constraints.defaults.create')}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {customConstraints.length > 0 && (
            <div>
              <h2 className="text-base font-display font-semibold mb-4">
                {t('settings.myConstraints')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {customConstraints.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium cursor-pointer"
                    style={{
                      backgroundColor: c.color + '18',
                      color: c.color,
                      borderColor: c.color + '55',
                    }}
                    onClick={() => openEditConstraint(c)}
                  >
                    {c.emoji && <span>{c.emoji}</span>}
                    {c.name}
                    {c.frequency && (
                      <span className="opacity-70 ml-0.5">
                        {c.frequency}×/wk
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConstraintToDelete(c.id)
                      }}
                      className="ml-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={closeModal}
            />
            <div className="relative bg-card border border-border rounded-lg p-5 w-full max-w-md mx-4 shadow-lg">
              <h3 className="text-sm font-semibold mb-4">
                {editingId
                  ? `${t('settings.editConstraint')} "${cName}"`
                  : t('settings.newConstraint')}
              </h3>
              <form onSubmit={handleSaveConstraint} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="cname">
                      {t('settings.constraintName')}
                    </Label>
                    <Input
                      id="cname"
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder={t('settings.constraintPlaceholder')}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings.constraintEmoji')}</Label>
                    <div className="relative" ref={emojiPickerRef}>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="h-9 w-20 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {cEmoji || '😀'}
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute top-full left-0 mt-2 z-50">
                          <div
                            className="fixed inset-0"
                            onClick={() => setShowEmojiPicker(false)}
                          />
                          <EmojiPicker
                            onEmojiClick={(e) => {
                              setCEmoji(e.emoji)
                              setShowEmojiPicker(false)
                            }}
                            skinTonesDisabled
                            previewConfig={{ showPreview: false }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t('settings.constraintColor')}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCColor(color)}
                        className={cn(
                          'w-7 h-7 rounded-full border-2 transition-transform',
                          cColor === color
                            ? 'border-foreground scale-110'
                            : 'border-transparent',
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t('settings.constraintFrequency')}
                  </label>
                  <select
                    value={cFrequency}
                    onChange={(e) => setCFrequency(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">
                      {t('settings.constraintFrequencyNone')}
                    </option>
                    <option value="1">1× {t('settings.perWeek')}</option>
                    <option value="2">2× {t('settings.perWeek')}</option>
                    <option value="3">3× {t('settings.perWeek')}</option>
                    <option value="4">4× {t('settings.perWeek')}</option>
                    <option value="5">5× {t('settings.perWeek')}</option>
                    <option value="6">6× {t('settings.perWeek')}</option>
                    <option value="7">7× {t('settings.perWeek')}</option>
                  </select>
                </div>

                {cName && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t('settings.preview')}
                    </label>
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium border"
                      style={{
                        backgroundColor: cColor + '22',
                        color: cColor,
                        borderColor: cColor + '55',
                      }}
                    >
                      {cEmoji && <span>{cEmoji}</span>}
                      {cName}
                      {cFrequency && (
                        <span className="opacity-70 ml-0.5">
                          {cFrequency}×/wk
                        </span>
                      )}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={cSaving}>
                    {cSaving
                      ? t('common.saving')
                      : editingId
                        ? t('common.update')
                        : t('common.add')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <AlertDialog
          open={!!constraintToDelete}
          onOpenChange={(open) => {
            if (!open) setConstraintToDelete(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.deleteConfirm')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('constraints.defaults.deleteWarning')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteConstraint}>
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
