import {
  HeadContent,
  Scripts,
  createRootRoute,
  redirect,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { getUser } from "@/lib/auth/get-user"
import type { User } from "@/lib/db/schema"

import appCss from "../styles.css?url"

const fetchUser = createServerFn({ method: "GET" }).handler(async () => {
  return getUser()
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Share Plate" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),

  beforeLoad: async ({ location }) => {
    const user = await fetchUser()
    const publicPaths = ["/login", "/register"]
    const isPublic = publicPaths.some((p) => location.pathname.startsWith(p))

    if (!user && !isPublic) {
      throw redirect({ to: "/login" })
    }
    if (user && isPublic) {
      throw redirect({ to: "/planner" })
    }

    return { user: user as User | null }
  },

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
        />
        <Scripts />
      </body>
    </html>
  )
}
