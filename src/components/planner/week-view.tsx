import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DAY_NAMES, MONTH_KEYS } from './types'
import type { Constraint } from '@/lib/db/schema'
import type { DayTemplate, HomeData, MealPlanDay } from './types'
import { cn } from '@/lib/utils'
import {
  ChevronRightIcon,
  EditIcon,
  ExternalLinkIcon,
} from '@/components/ui/icons'

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const colors = [
    '#4a7c59',
    '#c17d4a',
    '#7c4a6e',
    '#4a6e7c',
    '#7c7c4a',
    '#4a4a7c',
  ]
  return colors[Math.abs(hash) % colors.length]
}

type WeekViewProps = {
  weekStart: string
  mealPlanDays: Array<MealPlanDay>
  dayTemplates: Array<DayTemplate>
  constraints: Array<Constraint>
  home: HomeData
  subscriptions: Array<{ id: string; name: string }>
  aiLoading: boolean
  aiStartDate: string
  aiEndDate: string
  onDayClick: (dayOfWeek: number) => void
}

export const WeekView = memo(function WeekView({
  weekStart,
  mealPlanDays,
  dayTemplates,
  constraints,
  home,
  subscriptions,
  aiLoading,
  aiStartDate,
  aiEndDate,
  onDayClick,
}: WeekViewProps) {
  const { t } = useTranslation()

  const constraintMap = useMemo(
    () => new Map(constraints.map((c) => [c.id, c])),
    [constraints],
  )

  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart + 'T12:00:00')
        d.setDate(d.getDate() + i)
        return d
      }),
    [weekStart],
  )

  const today = new Date()
  function isToday(date: Date) {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  function isDateBeingGenerated(date: Date) {
    if (!aiLoading || !aiStartDate || !aiEndDate) return false
    const genStart = new Date(aiStartDate + 'T00:00:00')
    const genEnd = new Date(aiEndDate + 'T23:59:59')
    return date >= genStart && date <= genEnd
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {t('home.weekOf')} {weekDates[0].getDate()}.{' '}
        {t(`months.${MONTH_KEYS[weekDates[0].getMonth()]}`)}{' '}
        {weekDates[0].getFullYear()}
      </p>

      {/* Mobile: vertical day list */}
      <div className="md:hidden space-y-2 mb-6">
        {DAY_NAMES.map((dayName, i) => {
          const day = mealPlanDays.find((d) => d.dayOfWeek === i)
          const template = dayTemplates.find((t) => t.dayOfWeek === i)
          const effectiveConstraints = day?.constraintIds.length
            ? day.constraintIds
            : (template?.constraintIds ?? [])
          const date = weekDates[i]
          const isTodayExact = isToday(date)
          const isGenerating = isDateBeingGenerated(date)

          return (
            <button
              key={i}
              onClick={() => onDayClick(i)}
              className={cn(
                'w-full flex items-center gap-3 bg-card border rounded-lg px-3 py-3 text-left transition-colors active:bg-muted',
                isTodayExact
                  ? 'border-primary/60 ring-1 ring-primary/20'
                  : 'border-border',
                isGenerating && 'animate-pulse',
              )}
            >
              <div className="w-11 shrink-0 text-center">
                <p
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-widest',
                    isTodayExact ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {t(dayName)}
                </p>
                <p
                  className={cn(
                    'text-xl font-display font-semibold leading-tight',
                    isTodayExact ? 'text-primary' : '',
                  )}
                >
                  {date.getDate()}
                </p>
              </div>

              <div className="w-px h-9 bg-border shrink-0" />

              <div className="flex-1 min-w-0">
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      {t('planner.generating')}
                    </span>
                  </div>
                ) : day?.mealName ? (
                  <p className="text-sm font-medium text-foreground truncate">
                    {day.mealName}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/60 italic">
                    {t('planner.addDinner')}
                  </p>
                )}
                {effectiveConstraints.length > 0 && !isGenerating && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {effectiveConstraints.slice(0, 3).map((cid) => {
                      const c = constraintMap.get(cid)
                      if (!c) return null
                      return (
                        <span
                          key={cid}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: c.color + '22',
                            color: c.color,
                            border: `1px solid ${c.color}44`,
                          }}
                        >
                          {c.emoji && <span>{c.emoji}</span>}
                          {c.name}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {!isGenerating && (
                <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* Desktop: 7-col grid */}
      <div className="hidden md:grid grid-cols-7 gap-3 mb-8">
        {DAY_NAMES.map((dayName, i) => {
          const day = mealPlanDays.find((d) => d.dayOfWeek === i)
          const template = dayTemplates.find((t) => t.dayOfWeek === i)
          const effectiveConstraints = day?.constraintIds.length
            ? day.constraintIds
            : (template?.constraintIds ?? [])
          const date = weekDates[i]
          const isTodayExact = isToday(date)
          const isGenerating = isDateBeingGenerated(date)

          return (
            <button
              key={i}
              onClick={() => onDayClick(i)}
              className={cn(
                'group relative bg-card border rounded-lg p-4 text-left transition-all duration-150',
                'hover:-translate-y-0.5 hover:shadow-md',
                isTodayExact
                  ? 'border-primary/60 ring-1 ring-primary/20'
                  : 'border-border hover:border-border/80',
                isGenerating && 'animate-pulse',
              )}
            >
              <div className="mb-3">
                <p
                  className={cn(
                    'text-xs font-medium uppercase tracking-widest',
                    isTodayExact ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {t(dayName)}
                </p>
                <p className="text-lg font-display font-semibold leading-tight">
                  {date.getDate()}
                </p>
              </div>

              <div className="min-h-[48px]">
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : day?.mealName ? (
                  <p className="text-sm font-medium text-foreground leading-snug">
                    {day.mealName}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/60 italic">
                    {t('planner.addDinner')}
                  </p>
                )}
              </div>

              {!isGenerating && day?.recipeUrl && (
                <a
                  href={day.recipeUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLinkIcon className="w-3 h-3" />
                  <span className="truncate">{day.recipeUrl}</span>
                </a>
              )}

              {effectiveConstraints.length > 0 && !isGenerating && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {effectiveConstraints.map((cid) => {
                    const c = constraintMap.get(cid)
                    if (!c) return null
                    return (
                      <span
                        key={cid}
                        className="badge-animate inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: c.color + '22',
                          color: c.color,
                          border: `1px solid ${c.color}44`,
                        }}
                      >
                        {c.emoji && <span>{c.emoji}</span>}
                        {c.name}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <EditIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </button>
          )
        })}
      </div>

      {/* Members indicator */}
      <div className="mt-4 flex items-center gap-2 mb-6">
        <span className="text-xs text-muted-foreground">
          {t('home.membersLabel')}
        </span>
        {home.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-full"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: stringToColor(member.id) }}
            >
              {member.name[0].toUpperCase()}
            </div>
            <span className="text-xs font-medium">{member.name}</span>
          </div>
        ))}
      </div>

      {/* Subscribers */}
      {subscriptions.length > 0 && (
        <div className="border border-border rounded-lg p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-3 text-foreground">
            {t('planner.subscribers')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {subscriptions.map((s) => (
              <span
                key={s.id}
                className="px-3 py-1.5 rounded-md text-sm font-medium border bg-card text-foreground border-border"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
