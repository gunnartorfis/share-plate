import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { deleteLink, getMyLinks, saveLink } from '@/lib/server/links'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/links')({ component: LinksPage })

type LinkData = {
  id: string
  title: string
  url: string
  description: string | null
  type: 'website' | 'recipe'
  tags: Array<string>
}

function LinksPage() {
  const [links, setLinks] = useState<Array<LinkData>>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LinkData | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'website' | 'recipe'>('recipe')
  const [tagsStr, setTagsStr] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const ls = await getMyLinks()
    setLinks(ls as Array<LinkData>)
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setEditing(null)
    setTitle('')
    setUrl('')
    setDescription('')
    setType('recipe')
    setTagsStr('')
    setShowForm(true)
  }

  function openEdit(link: LinkData) {
    setEditing(link)
    setTitle(link.title)
    setUrl(link.url)
    setDescription(link.description ?? '')
    setType(link.type)
    setTagsStr(link.tags.join(', '))
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      await saveLink({
        data: {
          id: editing?.id,
          title,
          url,
          description: description || undefined,
          type,
          tags,
        },
      })
      await load()
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this link?')) return
    await deleteLink({ data: { id } })
    await load()
  }

  const websites = links.filter((l) => l.type === 'website')
  const recipes = links.filter((l) => l.type === 'recipe')

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              Recipe links
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your personal library of recipe sources
            </p>
          </div>
          <Button onClick={openNew}>Add link</Button>
        </div>

        {links.length === 0 && !showForm ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-display font-medium mb-1">
              No links yet
            </p>
            <p className="text-sm mb-4">
              Add recipe websites or direct recipe links.
            </p>
            <Button onClick={openNew}>Add your first link</Button>
          </div>
        ) : (
          <>
            {websites.length > 0 && (
              <LinkSection
                title="Recipe websites"
                links={websites}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            )}
            {recipes.length > 0 && (
              <LinkSection
                title="Recipes"
                links={recipes}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            )}
          </>
        )}

        {/* Form drawer */}
        {showForm && (
          <div className="fixed inset-0 z-[60] flex">
            <div
              className="flex-1 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <div className="w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-display font-semibold">
                  {editing ? 'Edit link' : 'Add link'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <form
                id="link-form"
                onSubmit={handleSave}
                className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4"
              >
                {/* Type toggle */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <div className="flex rounded-md border border-border overflow-hidden">
                    {(['recipe', 'website'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={cn(
                          'flex-1 py-2 text-sm font-medium capitalize transition-colors',
                          type === t
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t === 'website' ? 'Recipe website' : 'Specific recipe'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {type === 'website'
                      ? 'A site with many recipes (e.g. seriouseats.com)'
                      : 'A link to one specific recipe (e.g. carbonara recipe)'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Serious Eats"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    placeholder="https://…"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief notes…"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input
                    id="tags"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    placeholder="e.g. italian, quick, fish"
                  />
                </div>
              </form>
              <div className="shrink-0 px-6 py-4 border-t border-border flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="link-form"
                  className="flex-1"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function LinkSection({
  title,
  links,
  onEdit,
  onDelete,
}: {
  title: string
  links: Array<LinkData>
  onEdit: (l: LinkData) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="mb-7">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h2>
      <div className="space-y-2">
        {links.map((link) => (
          <div
            key={link.id}
            className="flex items-start gap-3 bg-card border border-border rounded-lg p-4 group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-sm hover:text-primary transition-colors"
                >
                  {link.title}
                </a>
                {link.type === 'website' && (
                  <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-medium">
                    site
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {link.url}
              </p>
              {link.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {link.description}
                </p>
              )}
              {link.tags.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {link.tags.map((tag) => (
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
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onEdit(link)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded"
              >
                <EditIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(link.id)}
                className="p-1.5 text-muted-foreground hover:text-destructive rounded"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  )
}
function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        strokeLinecap="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="3 6 5 6 21 6" />
      <path
        d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
