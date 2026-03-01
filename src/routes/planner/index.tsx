import { createFileRoute, redirect } from '@tanstack/react-router'
import { currentWeekStart, isoWeek } from '@/lib/server/meal-plans'

export const Route = createFileRoute('/planner/')({
  beforeLoad: () => {
    const weekStart = currentWeekStart()
    throw redirect({
      to: '/planner/$week',
      params: { week: isoWeek(weekStart) },
    })
  },
  component: () => null,
})
