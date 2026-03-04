import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MONTH_KEYS } from './types'
import type { MealPlanDay, MonthMealPlans } from './types'
import { cn } from '@/lib/utils'
import { ExternalLinkIcon } from '@/components/ui/icons'

type MonthCellData = {
  dayNum: number
  isCurrentMonth: boolean
  isToday: boolean
  isGenerating: boolean
  weekStartStr: string
  dayOfWeek: number
  dayData: MealPlanDay | undefined
}

function computeMonthCells(
  month: Date,
  monthMealPlans: MonthMealPlans,
  aiStartDate: string,
  aiEndDate: string,
  aiLoading: boolean,
): Array<MonthCellData> {
  const today = new Date()
  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const firstOfMonth = new Date(year, monthIdx, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()

  const genStart =
    aiLoading && aiStartDate ? new Date(aiStartDate + 'T00:00:00') : null
  const genEnd =
    aiLoading && aiEndDate ? new Date(aiEndDate + 'T23:59:59') : null

  const cells: Array<MonthCellData> = []
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startOffset + 1
    const currentDate = new Date(year, monthIdx, dayNum)
    const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth

    const isToday =
      currentDate.getDate() === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()

    const ws = new Date(currentDate)
    ws.setDate(ws.getDate() - ((currentDate.getDay() + 6) % 7))
    const weekStartStr = ws.toISOString().slice(0, 10)
    const dayOfWeek = (currentDate.getDay() + 6) % 7

    const weekDays = monthMealPlans[weekStartStr]
    const dayData = weekDays?.find((d) => d.dayOfWeek === dayOfWeek)

    const isGenerating =
      genStart !== null &&
      genEnd !== null &&
      currentDate >= genStart &&
      currentDate <= genEnd

    cells.push({
      dayNum: isCurrentMonth ? dayNum : 0,
      isCurrentMonth,
      isToday,
      isGenerating,
      weekStartStr,
      dayOfWeek,
      dayData,
    })
  }
  return cells
}

type MonthGridProps = {
  month: Date
  monthMealPlans: MonthMealPlans
  aiLoading: boolean
  aiStartDate: string
  aiEndDate: string
  monthLoadError: string | null
  onDayClick: (weekStartStr: string, dayOfWeek: number) => void
}

export const MonthGrid = memo(function MonthGrid({
  month,
  monthMealPlans,
  aiLoading,
  aiStartDate,
  aiEndDate,
  monthLoadError,
  onDayClick,
}: MonthGridProps) {
  const { t } = useTranslation()

  const cells = useMemo(
    () =>
      computeMonthCells(
        month,
        monthMealPlans,
        aiStartDate,
        aiEndDate,
        aiLoading,
      ),
    [month, monthMealPlans, aiStartDate, aiEndDate, aiLoading],
  )

  return (
    <div className="mb-6">
      <p className="text-sm text-muted-foreground mb-4">
        {t(`months.${MONTH_KEYS[month.getMonth()]}`)} {month.getFullYear()}
      </p>

      {monthLoadError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {monthLoadError}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(
          (day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {t(`days.${day}`)}
            </div>
          ),
        )}
        {cells.map((cell, i) => (
          <button
            key={i}
            onClick={() => onDayClick(cell.weekStartStr, cell.dayOfWeek)}
            className={cn(
              'min-h-[60px] md:min-h-[80px] p-1.5 md:p-2 rounded-md border text-left transition-all',
              cell.isCurrentMonth ? 'bg-card' : 'bg-muted/30',
              cell.isToday
                ? 'border-primary/60 ring-1 ring-primary/20'
                : 'border-border hover:border-border/80',
              cell.isGenerating && 'animate-pulse',
            )}
          >
            <span
              className={cn(
                'text-xs md:text-sm font-medium',
                cell.isCurrentMonth
                  ? 'text-foreground'
                  : 'text-muted-foreground/50',
                cell.isToday && 'text-primary',
              )}
            >
              {cell.dayNum > 0 ? cell.dayNum : ''}
            </span>
            {cell.isGenerating ? (
              <div className="mt-1 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {cell.dayData?.mealName && cell.isCurrentMonth && (
                  <p className="text-[10px] md:text-xs font-medium text-foreground mt-0.5 line-clamp-2">
                    {cell.dayData.mealName}
                  </p>
                )}
                {cell.dayData?.recipeUrl && cell.isCurrentMonth && (
                  <ExternalLinkIcon className="w-2.5 h-2.5 text-muted-foreground mt-0.5" />
                )}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  )
})
