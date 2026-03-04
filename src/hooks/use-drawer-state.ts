import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { RecipeData } from '@/hooks/use-recipe-form'
import type {
  DayTemplate,
  MealPlanData,
  MonthMealPlans,
} from '@/components/planner/types'
import {
  getHomeMealPlanWithSharing,
  getHomeMealPlansForMonth,
  upsertHomeDayPlan,
} from '@/lib/server/homes'
import { getMyRecipes } from '@/lib/server/recipes'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type DrawerState = {
  /** Which day-of-week is open (0=Mon..6=Sun), null = closed */
  editingDay: number | null
  /** Deferred day click from month view (needs navigation first) */
  pendingEdit: { dayOfWeek: number; weekStart: string } | null
  /** Form fields */
  meal: string
  notes: string
  recipeUrl: string
  constraintIds: Array<string>
  /** Recipe list for the drawer */
  recipes: Array<RecipeData>
  recipesLoading: boolean
  selectedRecipeId: string | null
  /** Save in progress */
  saving: boolean
}

const INITIAL_STATE: DrawerState = {
  editingDay: null,
  pendingEdit: null,
  meal: '',
  notes: '',
  recipeUrl: '',
  constraintIds: [],
  recipes: [],
  recipesLoading: false,
  selectedRecipeId: null,
  saving: false,
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type DrawerAction =
  | {
      type: 'OPEN'
      dayOfWeek: number
      meal: string
      notes: string
      recipeUrl: string
      constraintIds: Array<string>
    }
  | { type: 'OPEN_PENDING'; dayOfWeek: number; weekStart: string }
  | { type: 'CLOSE' }
  | { type: 'CLEAR_PENDING' }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'SET_CONSTRAINT_IDS'; constraintIds: Array<string> }
  | {
      type: 'SELECT_RECIPE'
      id: string | null
      meal: string
      recipeUrl: string
    }
  | {
      type: 'RECIPES_LOADED'
      recipes: Array<RecipeData>
      selectedRecipeId: string | null
    }
  | { type: 'RECIPES_LOADING' }
  | { type: 'RECIPES_DONE' }
  | { type: 'SAVING_START' }
  | { type: 'SAVING_DONE' }
  | {
      type: 'RECIPE_CREATED'
      meal: string
      recipeUrl: string
      selectedRecipeId: string
      recipes: Array<RecipeData>
    }

function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
  switch (action.type) {
    case 'OPEN':
      return {
        ...state,
        editingDay: action.dayOfWeek,
        meal: action.meal,
        notes: action.notes,
        recipeUrl: action.recipeUrl,
        constraintIds: action.constraintIds,
        recipesLoading: true,
        selectedRecipeId: null,
      }
    case 'OPEN_PENDING':
      return {
        ...state,
        pendingEdit: {
          dayOfWeek: action.dayOfWeek,
          weekStart: action.weekStart,
        },
      }
    case 'CLOSE':
      return { ...state, editingDay: null }
    case 'CLEAR_PENDING':
      return { ...state, pendingEdit: null }
    case 'SET_NOTES':
      return { ...state, notes: action.notes }
    case 'SET_CONSTRAINT_IDS':
      return { ...state, constraintIds: action.constraintIds }
    case 'SELECT_RECIPE':
      return {
        ...state,
        selectedRecipeId: action.id,
        meal: action.meal,
        recipeUrl: action.recipeUrl,
      }
    case 'RECIPES_LOADED':
      return {
        ...state,
        recipes: action.recipes,
        selectedRecipeId: action.selectedRecipeId,
      }
    case 'RECIPES_LOADING':
      return { ...state, recipesLoading: true }
    case 'RECIPES_DONE':
      return { ...state, recipesLoading: false }
    case 'SAVING_START':
      return { ...state, saving: true }
    case 'SAVING_DONE':
      return { ...state, saving: false }
    case 'RECIPE_CREATED':
      return {
        ...state,
        meal: action.meal,
        recipeUrl: action.recipeUrl,
        selectedRecipeId: action.selectedRecipeId,
        recipes: action.recipes,
      }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type UseDrawerStateOptions = {
  weekStart: string
  mealPlan: MealPlanData | null
  dayTemplates: Array<DayTemplate>
  view: 'week' | 'month'
  monthYear: number
  monthIdx: number
  /** Callbacks to update parent data after save */
  onMealPlanUpdated: (mp: MealPlanData) => void
  onMonthMealPlansUpdated: (mmp: MonthMealPlans) => void
}

export function useDrawerState(options: UseDrawerStateOptions) {
  const {
    weekStart,
    mealPlan,
    dayTemplates,
    view,
    monthYear,
    monthIdx,
    onMealPlanUpdated,
    onMonthMealPlansUpdated,
  } = options

  const [state, dispatch] = useReducer(drawerReducer, INITIAL_STATE)

  // Recipe cache — survives drawer open/close but is tied to component lifecycle
  const recipeCacheRef = useRef<Array<RecipeData> | null>(null)
  const recipeLoadRequestRef = useRef(0)

  const fetchRecipesCached = useCallback(
    async (forceRefresh = false): Promise<Array<RecipeData>> => {
      if (!forceRefresh && recipeCacheRef.current) return recipeCacheRef.current
      const rs = await getMyRecipes()
      recipeCacheRef.current = rs as Array<RecipeData>
      return recipeCacheRef.current
    },
    [],
  )

  // ------------------------------------------------------------------
  // openEdit — populate form state from meal plan data and load recipes
  // ------------------------------------------------------------------
  const openEdit = useCallback(
    (dayOfWeek: number): boolean => {
      const requestId = ++recipeLoadRequestRef.current
      if (!mealPlan || mealPlan.plan.weekStart !== weekStart) {
        // Data not ready yet — just mark the day; the pending-edit effect will
        // call openEdit again once data arrives.
        dispatch({
          type: 'OPEN',
          dayOfWeek,
          meal: '',
          notes: '',
          recipeUrl: '',
          constraintIds: [],
        })
        return false
      }

      const day = mealPlan.days.find((d) => d.dayOfWeek === dayOfWeek)
      const template = dayTemplates.find((tpl) => tpl.dayOfWeek === dayOfWeek)

      dispatch({
        type: 'OPEN',
        dayOfWeek,
        meal: day?.mealName ?? '',
        notes: day?.notes ?? '',
        recipeUrl: day?.recipeUrl ?? '',
        constraintIds: day?.constraintIds ?? template?.constraintIds ?? [],
      })

      // Load recipes (cached)
      fetchRecipesCached()
        .then((typedRecipes) => {
          if (recipeLoadRequestRef.current !== requestId) return
          let matchId: string | null = null
          if (day?.recipeUrl) {
            matchId =
              typedRecipes.find((r) => r.url === day.recipeUrl)?.id ?? null
          } else if (day?.mealName) {
            matchId =
              typedRecipes.find((r) => r.title === day.mealName)?.id ?? null
          }
          dispatch({
            type: 'RECIPES_LOADED',
            recipes: typedRecipes,
            selectedRecipeId: matchId,
          })
        })
        .finally(() => {
          if (recipeLoadRequestRef.current === requestId) {
            dispatch({ type: 'RECIPES_DONE' })
          }
        })
      return true
    },
    [mealPlan, weekStart, dayTemplates, fetchRecipesCached],
  )

  // ------------------------------------------------------------------
  // Pending edit resolution — month-view click navigates first, then opens
  // ------------------------------------------------------------------
  useEffect(() => {
    if (
      state.pendingEdit !== null &&
      state.pendingEdit.weekStart === weekStart
    ) {
      const hydrated = openEdit(state.pendingEdit.dayOfWeek)
      if (hydrated) {
        dispatch({ type: 'CLEAR_PENDING' })
      }
    }
  }, [mealPlan, state.pendingEdit, weekStart, openEdit])

  // ------------------------------------------------------------------
  // Actions exposed to consumers
  // ------------------------------------------------------------------

  const close = useCallback(() => {
    // Invalidate any in-flight recipe loads for previously opened day.
    recipeLoadRequestRef.current += 1
    dispatch({ type: 'CLOSE' })
  }, [])

  const setPendingEditDay = useCallback(
    (dayOfWeek: number, targetWeekStart: string) =>
      dispatch({
        type: 'OPEN_PENDING',
        dayOfWeek,
        weekStart: targetWeekStart,
      }),
    [],
  )

  const setNotes = useCallback(
    (notes: string) => dispatch({ type: 'SET_NOTES', notes }),
    [],
  )

  const setConstraintIds = useCallback(
    (updater: Array<string> | ((prev: Array<string>) => Array<string>)) => {
      if (typeof updater === 'function') {
        // For functional updates we need current state — dispatch a thunk-like
        // pattern. Since useReducer doesn't support thunks, we rely on React's
        // guarantee that dispatch within the same tick sees latest state via
        // the reducer. We use a small trick: wrap in a custom action that the
        // reducer handles, but since we can't pass functions in actions easily,
        // we'll compute it here and dispatch the result.
        // However, we DON'T have access to current state outside reducer.
        // Solution: we keep a ref to constraintIds.
        dispatch({
          type: 'SET_CONSTRAINT_IDS',
          constraintIds: updater(constraintIdsRef.current),
        })
      } else {
        dispatch({ type: 'SET_CONSTRAINT_IDS', constraintIds: updater })
      }
    },
    [],
  )

  // Ref to track constraintIds for functional updates from DrawerForm
  const constraintIdsRef = useRef(state.constraintIds)
  constraintIdsRef.current = state.constraintIds

  const selectRecipe = useCallback(
    (id: string | null) => {
      if (id) {
        const recipe = state.recipes.find((r) => r.id === id)
        dispatch({
          type: 'SELECT_RECIPE',
          id,
          meal: recipe?.title ?? '',
          recipeUrl: recipe?.url ?? '',
        })
      } else {
        dispatch({ type: 'SELECT_RECIPE', id: null, meal: '', recipeUrl: '' })
      }
    },
    [state.recipes],
  )

  const handleRecipeCreated = useCallback(
    (id: string, title: string, url: string | null) => {
      // Invalidate cache and refresh
      recipeCacheRef.current = null
      fetchRecipesCached(true).then((rs) => {
        dispatch({
          type: 'RECIPE_CREATED',
          meal: title,
          recipeUrl: url ?? '',
          selectedRecipeId: id,
          recipes: rs,
        })
      })
    },
    [fetchRecipesCached],
  )

  // Refs to capture latest values for handleSave without stale closures
  const stateRef = useRef(state)
  stateRef.current = state

  const handleSave = useCallback(async () => {
    const s = stateRef.current
    if (!mealPlan || s.editingDay === null) return

    dispatch({ type: 'SAVING_START' })
    try {
      await upsertHomeDayPlan({
        data: {
          weekStart,
          dayOfWeek: s.editingDay,
          mealName: s.meal || undefined,
          notes: s.notes || undefined,
          recipeUrl: s.recipeUrl || undefined,
          constraintIds: s.constraintIds,
        },
      })

      // Re-fetch data BEFORE closing the drawer so the UI updates atomically
      const [mp, mmp] = await Promise.all([
        getHomeMealPlanWithSharing({ data: { weekStart } }),
        view === 'month'
          ? getHomeMealPlansForMonth({
              data: { year: monthYear, month: monthIdx + 1 },
            })
          : Promise.resolve(null),
      ])

      onMealPlanUpdated(mp as MealPlanData)
      if (mmp !== null) {
        onMonthMealPlansUpdated(mmp as MonthMealPlans)
      }

      // Close AFTER data is refreshed
      dispatch({ type: 'CLOSE' })
    } finally {
      dispatch({ type: 'SAVING_DONE' })
    }
  }, [
    mealPlan,
    weekStart,
    view,
    monthYear,
    monthIdx,
    onMealPlanUpdated,
    onMonthMealPlansUpdated,
  ])

  return {
    // State (read-only for consumers)
    editingDay: state.editingDay,
    pendingEditDay: state.pendingEdit?.dayOfWeek ?? null,
    meal: state.meal,
    notes: state.notes,
    recipeUrl: state.recipeUrl,
    constraintIds: state.constraintIds,
    recipes: state.recipes,
    recipesLoading: state.recipesLoading,
    selectedRecipeId: state.selectedRecipeId,
    saving: state.saving,

    // Actions
    openEdit,
    close,
    setPendingEditDay,
    setNotes,
    setConstraintIds,
    selectRecipe,
    handleRecipeCreated,
    handleSave,
  }
}
