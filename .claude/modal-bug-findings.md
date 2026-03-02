# Modal Bug Findings

## Bug Description

After registering and writing a home name in the modal on `/`, navigating away and returning to `/` shows the modal again. Repeatable infinitely.

## System Overview

- `_index.tsx`: On mount, runs `useEffect` → `getHomeSetupCompleted()` → if false, opens `renameOpen` dialog
- `register.tsx`: Calls `markHomeSetupCompleted()` before navigating to `/`
- `getHomeSetupCompleted`: Reads `users.homeSetupCompleted` (SQLite boolean = 0/1)
- `markHomeSetupCompleted`: Updates `users.homeSetupCompleted = true`
- DB: Turso/libsql, column added via migration `0000_add_home_setup_completed.sql`

## Key Code

```jsx
// _index.tsx - dialog onOpenChange
onOpenChange={async (open) => {
  if (!open) {
    await markHomeSetupCompleted()
  } else {
    setNewName(home.name)
  }
  setRenameOpen(open)
}}

// Save button
<Button onClick={() => {
  handleUpdateName()
  setRenameOpen(false)  // ← Does NOT go through onOpenChange?
}}>Save</Button>

// Cancel button
<Button onClick={() => setRenameOpen(false)}>Cancel</Button>
```

## Hypotheses Under Investigation

### H1: Radix Dialog onOpenChange bypass (Agent 1)

Does Radix UI's controlled `<Dialog open={...} onOpenChange={...}>` call `onOpenChange` when you programmatically call `setRenameOpen(false)` via a button? Or does Radix only call `onOpenChange` for user-initiated events (Escape, backdrop click)?

### H2: Migration not applied (Agent 2)

Has `0000_add_home_setup_completed.sql` actually been run against Turso? If not, `markHomeSetupCompleted` fails silently or errors, `getHomeSetupCompleted` always returns false.

### H3: Browser navigation unmounts component (Agent 3)

When user navigates via browser back/forward while the dialog is open, the component unmounts. Does Radix call `onOpenChange(false)` on unmount? Or is `markHomeSetupCompleted` never called?

### H4: Register flow doesn't always call markHomeSetupCompleted (Agent 4)

Are there registration paths that skip `markHomeSetupCompleted`? What if the user is already registered and logs in for the first time after the migration?

### H5: The `renameInitialized` ref race (Agent 5)

The `useEffect` with `renameInitialized` ref is meant to run once. But does it fire before `markHomeSetupCompleted` from the dialog completes? Are there timing issues?

## Agent Findings

### A1: Base UI onOpenChange bypass — CONFIRMED ROOT CAUSE

Library is `@base-ui/react` ^1.2.0. Read source: `DialogStore.setOpen()` is the ONLY place `onOpenChange` fires, and it's only called for user interactions (Escape, backdrop). When `setRenameOpen(false)` is called from Cancel/Save buttons, Base UI's `useControlledProp` syncs state without calling `onChange`. **`markHomeSetupCompleted()` is never called via Save/Cancel/Enter key.**

### A2: Migration snapshot gap

Migration file exists and journal tracks it. But the snapshot (`0000_snapshot.json`) does NOT include `home_setup_completed` in `users` table columns — indicating the snapshot was taken before the column was added. If migration wasn't applied to Turso, all reads return `undefined ?? false = false`. Secondary concern, but real.

### A3: Component always remounts on navigation — CONFIRMED

TanStack Router with no `loader`/`beforeLoad` on `_index` route: component fully unmounts/remounts on every navigation. The `renameInitialized` ref (created per component instance) resets to `false` on every remount. So `checkSetup()` fires again on every visit to `/`.

### A4: Login and other paths never call markHomeSetupCompleted

- `register.tsx` ✅ calls it for create AND join paths
- `login.tsx` ❌ never calls it — all existing pre-migration users affected
- Sidebar navigation ❌ never calls it
- Logout redirect ❌ never calls it
- Also confirmed: no `DialogClose` component in dialog — only manual `setRenameOpen(false)` calls

### A5: onOpenChange is unreliable for programmatic state changes

Confirmed Base UI behavior. Also found: `handleUpdateName()` in Save button correctly saves to DB but does not call `markHomeSetupCompleted`. The onOpenChange handler with async `markHomeSetupCompleted` + then `setRenameOpen(open)` is fragile even if it did fire.

## Consensus Fix

**Move `markHomeSetupCompleted()` to fire immediately when we decide to show the dialog** — in `checkSetup()`. This is robust against ALL close paths: Save, Cancel, Enter, Escape, backdrop, and browser navigation away.

```tsx
// BEFORE (broken):
async function checkSetup() {
  const completed = await getHomeSetupCompleted()
  if (!completed) {
    setRenameOpen(true)  // markHomeSetupCompleted relied on onOpenChange - never fires!
  }
}
onOpenChange={async (open) => {
  if (!open) { await markHomeSetupCompleted() }  // unreachable for Save/Cancel
  ...
}}

// AFTER (fixed):
async function checkSetup() {
  const completed = await getHomeSetupCompleted()
  if (!completed) {
    setRenameOpen(true)
    markHomeSetupCompleted()  // fire immediately — idempotent, safe here
  }
}
onOpenChange={(open) => {
  if (open) setNewName(home.name)
  setRenameOpen(open)
}}
```
