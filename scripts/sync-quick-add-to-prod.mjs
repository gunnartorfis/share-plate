import { createClient } from '@libsql/client'

function getEnv(name, fallback) {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseBooleanEnv(name, defaultValue) {
  const raw = process.env[name]
  if (!raw) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
}

function recipeKey(recipe) {
  return `${recipe.title.trim().toLowerCase()}::${recipe.url ?? ''}`
}

async function ensureCuratedUser(targetClient, curatedUserId, email) {
  await targetClient.execute({
    sql: `
      INSERT INTO users (id, email, name, password_hash, home_setup_completed, created_at)
      VALUES (?, ?, ?, ?, 1, unixepoch())
      ON CONFLICT(id) DO NOTHING
    `,
    args: [curatedUserId, email, 'System', 'n/a'],
  })
}

async function main() {
  const sourceUrl = getEnv(
    'SOURCE_TURSO_DATABASE_URL',
    process.env.TURSO_DATABASE_URL,
  )
  const sourceAuthToken = getEnv(
    'SOURCE_TURSO_AUTH_TOKEN',
    process.env.TURSO_AUTH_TOKEN,
  )
  const targetUrl = getEnv(
    'TARGET_TURSO_DATABASE_URL',
    process.env.PROD_TURSO_DATABASE_URL,
  )
  const targetAuthToken = getEnv(
    'TARGET_TURSO_AUTH_TOKEN',
    process.env.PROD_TURSO_AUTH_TOKEN,
  )

  const sourceUserId = process.env.SOURCE_USER_ID || null
  const includeCuratedFromSource = parseBooleanEnv(
    'INCLUDE_CURATED_FROM_SOURCE',
    true,
  )
  const replaceTargetCurated = parseBooleanEnv('REPLACE_TARGET_CURATED', true)
  const targetCuratedUserId =
    process.env.TARGET_CURATED_USER_ID || 'system-curated'
  const targetCuratedUserEmail =
    process.env.TARGET_CURATED_USER_EMAIL || 'system@platepool.internal'

  const sourceClient = createClient({ url: sourceUrl, authToken: sourceAuthToken })
  const targetClient = createClient({ url: targetUrl, authToken: targetAuthToken })

  const sourceRowsResult = await sourceClient.execute(`
    SELECT
      id,
      user_id,
      title,
      url,
      description,
      metadata,
      tags,
      stars,
      curated
    FROM recipe_links
    WHERE title IS NOT NULL AND TRIM(title) <> ''
  `)

  const sourceRecipes = sourceRowsResult.rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    url: row.url == null ? null : String(row.url),
    description: row.description == null ? null : String(row.description),
    metadata: row.metadata == null ? null : String(row.metadata),
    tags: row.tags == null ? '[]' : String(row.tags),
    stars: Number(row.stars ?? 0),
    curated: Number(row.curated ?? 0),
  }))

  const filteredSourceRecipes = sourceRecipes.filter((recipe) => {
    if (!sourceUserId) return true
    if (recipe.userId === sourceUserId) return true
    if (includeCuratedFromSource && recipe.curated === 1) return true
    return false
  })

  const dedupedByRecipe = new Map()
  for (const recipe of filteredSourceRecipes) {
    dedupedByRecipe.set(recipeKey(recipe), recipe)
  }
  const recipesToCopy = [...dedupedByRecipe.values()]

  if (recipesToCopy.length === 0) {
    throw new Error(
      'No source recipes matched. Check SOURCE_USER_ID / INCLUDE_CURATED_FROM_SOURCE settings.',
    )
  }

  await ensureCuratedUser(
    targetClient,
    targetCuratedUserId,
    targetCuratedUserEmail,
  )

  if (replaceTargetCurated) {
    await targetClient.execute('DELETE FROM recipe_links WHERE curated = 1')
  }

  for (const recipe of recipesToCopy) {
    await targetClient.execute({
      sql: `
        INSERT INTO recipe_links (
          id,
          user_id,
          title,
          url,
          description,
          metadata,
          tags,
          stars,
          curated,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, unixepoch())
      `,
      args: [
        crypto.randomUUID(),
        targetCuratedUserId,
        recipe.title,
        recipe.url,
        recipe.description,
        recipe.metadata,
        recipe.tags,
        recipe.stars,
      ],
    })
  }

  console.log(`Source recipes read: ${sourceRecipes.length}`)
  console.log(`Source recipes matched: ${filteredSourceRecipes.length}`)
  console.log(`Unique recipes copied: ${recipesToCopy.length}`)
  console.log(
    `Target curated set ${replaceTargetCurated ? 'replaced' : 'appended'} successfully.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
