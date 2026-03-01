import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { getGroup, leaveGroup } from '@/lib/server/groups'
import { currentWeekStart, getGroupFeed } from '@/lib/server/meal-plans'
import {
  addRecipeToGroup,
  getGroupRecipes,
  getMyRecipes,
} from '@/lib/server/recipes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/groups/$groupId')({
  component: GroupPage,
})

const DAY_SHORT = [
  'days.mon',
  'days.tue',
  'days.wed',
  'days.thu',
  'days.fri',
  'days.sat',
  'days.sun',
]

function GroupPage() {
  const { t } = useTranslation()
  const { groupId } = Route.useParams()
  const router = useRouter()
  const weekStart = currentWeekStart()

  const [group, setGroup] = useState<{
    id: string
    name: string
    inviteCode: string
    role: string
    members: Array<{ id: string; name: string; role: string }>
  } | null>(null)
  const [feed, setFeed] = useState<
    Array<{
      family: { id: string; name: string }
      days: Array<{
        dayOfWeek: number
        mealName: string | null
        recipeUrl: string | null
        constraintIds: Array<string>
      }>
      isMe: boolean
    }>
  >([])
  const [groupRecipes, setGroupRecipes] = useState<
    Array<{
      id: string
      title: string
      url: string | null
      tags: Array<string>
    }>
  >([])
  const [myRecipes, setMyRecipes] = useState<
    Array<{ id: string; title: string }>
  >([])
  const [tab, setTab] = useState<'feed' | 'recipes' | 'members'>('feed')
  const [addingRecipe, setAddingRecipe] = useState('')
  const [leaving, setLeaving] = useState(false)

  async function load() {
    try {
      const [g, f, gr, mr] = await Promise.all([
        getGroup({ data: { groupId } }),
        getGroupFeed({ data: { groupId, weekStart } }),
        getGroupRecipes({ data: { groupId } }),
        getMyRecipes(),
      ])
      setGroup(g as typeof group)
      setFeed(f as typeof feed)
      setGroupRecipes(gr as typeof groupRecipes)
      setMyRecipes(mr)
    } catch {
      router.navigate({ to: '/groups' })
    }
  }

  useEffect(() => {
    load()
  }, [groupId])

  async function handleAddRecipe() {
    if (!addingRecipe) return
    await addRecipeToGroup({ data: { groupId, recipeId: addingRecipe } })
    setAddingRecipe('')
    const gr = await getGroupRecipes({ data: { groupId } })
    setGroupRecipes(gr as typeof groupRecipes)
  }

  async function handleLeave() {
    if (!confirm(t('groups.leaveConfirm'))) return
    setLeaving(true)
    await leaveGroup({ data: { groupId } })
    router.navigate({ to: '/groups' })
  }

  if (!group) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t('common.loading')}
        </div>
      </AppLayout>
    )
  }

  const recipesNotInGroup = myRecipes.filter(
    (r) => !groupRecipes.find((gr) => gr.id === r.id),
  )

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              {group.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('groups.inviteCode')}{' '}
              <span className="font-mono font-semibold text-foreground">
                {group.inviteCode}
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeave}
            disabled={leaving}
          >
            {t('groups.leave')}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(['feed', 'recipes', 'members'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={cn(
                'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                tab === tabKey
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`groups.tabs.${tabKey}`)}
            </button>
          ))}
        </div>

        {/* Feed tab */}
        {tab === 'feed' && (
          <div>
            <p className="text-xs text-muted-foreground mb-4">
              {t('groups.feed.weekOf')}{' '}
              {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
              })}{' '}
              ·{' '}
              <Link to="/planner" className="text-primary hover:underline">
                {t('groups.feed.goToPlanner')}
              </Link>
            </p>

            <div className="space-y-4">
              {feed.map(({ family, days, isMe }) => (
                <div
                  key={family.id}
                  className={cn(
                    'bg-card border rounded-lg overflow-hidden',
                    isMe ? 'border-primary/40' : 'border-border',
                  )}
                >
                  {/* Member header */}
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: stringToColor(family.id) }}
                    >
                      {family.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">
                      {family.name}
                      {isMe && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {t('groups.feed.you')}
                        </span>
                      )}
                    </span>
                    {days.length === 0 && (
                      <span className="ml-auto text-xs text-muted-foreground italic">
                        {t('groups.feed.notShared')}
                      </span>
                    )}
                  </div>

                  {/* Days row */}
                  {days.length > 0 && (
                    <div className="grid grid-cols-7 divide-x divide-border">
                      {DAY_SHORT.map((dayName, i) => {
                        const day = days.find((d) => d.dayOfWeek === i)
                        return (
                          <div key={i} className="p-2.5 min-h-[70px]">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                              {t(dayName)}
                            </p>
                            {day?.mealName ? (
                              <p className="text-xs text-foreground leading-snug font-medium">
                                {day.mealName}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground/50 italic">
                                —
                              </p>
                            )}
                            {day?.recipeUrl && (
                              <a
                                href={day.recipeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-primary hover:underline truncate block mt-0.5"
                              >
                                ↗ {t('common.recipe')}
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recipes tab */}
        {tab === 'recipes' && (
          <div>
            {/* Add recipe to group */}
            {recipesNotInGroup.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4 mb-5 flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    {t('groups.links.shareOne')}
                  </label>
                  <select
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={addingRecipe}
                    onChange={(e) => setAddingRecipe(e.target.value)}
                  >
                    <option value="">{t('groups.links.selectLink')}</option>
                    {recipesNotInGroup.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleAddRecipe} disabled={!addingRecipe}>
                  {t('common.share')}
                </Button>
              </div>
            )}

            {groupRecipes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="font-display font-medium mb-1">
                  {t('groups.links.noLinks')}
                </p>
                <p className="text-sm">{t('groups.links.noLinksDesc')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groupRecipes.map((recipe) => (
                  <a
                    key={recipe.id}
                    href={recipe.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">
                        {recipe.title}
                      </p>
                      {recipe.url && (
                        <p className="text-xs text-muted-foreground truncate">
                          {recipe.url}
                        </p>
                      )}
                      {recipe.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {recipe.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[10px]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {recipe.url && (
                      <ExternalLinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary" />
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members tab */}
        {tab === 'members' && (
          <div className="space-y-2">
            {group.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: stringToColor(member.id) }}
                >
                  {member.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{member.name}</p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

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

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
