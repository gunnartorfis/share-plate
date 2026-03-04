import { useTranslation } from 'react-i18next'
import type { RecipeMetadata } from '@/hooks/use-recipe-form'
import { SparkleIcon, XIcon } from '@/components/ui/icons'

export function RecipePreviewCard({
  metadata,
  onClear,
}: {
  metadata: RecipeMetadata
  onClear: () => void
}) {
  const { t } = useTranslation()
  const recipe = metadata.recipe
  const imageUrl = metadata.image || recipe?.image

  return (
    <div className="relative rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
      <button
        onClick={onClear}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors"
        title="Clear fetched data"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>

      {imageUrl && (
        <div className="h-28 overflow-hidden">
          <img
            src={Array.isArray(imageUrl) ? imageUrl[0] : imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <SparkleIcon className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">
            {t('recipes.aiScanned')}
          </span>
        </div>

        {recipe?.name && (
          <h4 className="font-semibold text-sm text-foreground mb-0.5">
            {recipe.name}
          </h4>
        )}
        {recipe?.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {recipe.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {recipe?.totalTime && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white text-[10px] font-medium">
              {recipe.totalTime}
            </span>
          )}
          {recipe?.recipeYield && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white text-[10px] text-muted-foreground">
              {recipe.recipeYield}
            </span>
          )}
        </div>

        {recipe?.recipeIngredient && recipe.recipeIngredient.length > 0 && (
          <div className="mt-2 pt-2 border-t border-amber-200">
            <p className="text-[10px] font-medium text-amber-800 mb-1">
              {t('recipes.ingredients')} ({recipe.recipeIngredient.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {recipe.recipeIngredient.slice(0, 4).map((ing, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded-full bg-white text-[10px] text-muted-foreground"
                >
                  {typeof ing === 'string' ? ing.slice(0, 18) : '...'}
                </span>
              ))}
              {recipe.recipeIngredient.length > 4 && (
                <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  +{recipe.recipeIngredient.length - 4} {t('recipes.more')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
