import { z } from "zod"

// Schéma TOLÉRANT de la réponse Unsplash : tous les champs sont optionnels et on
// parse au plus près de ce qu'on consomme. But : isoler la forme de la réponse
// externe (qui peut dériver) du reste du code sans faire échouer la recherche
// entière si un item est légèrement malformé — on filtre ensuite les items sans
// URL exploitable.
const unsplashResponseSchema = z.object({
  results: z
    .array(
      z
        .object({
          id: z.string().optional(),
          urls: z
            .object({
              regular: z.string().optional(),
              small: z.string().optional(),
              thumb: z.string().optional(),
            })
            .optional(),
          user: z
            .object({
              name: z.string().optional(),
              links: z.object({ html: z.string().optional() }).optional(),
            })
            .optional(),
        })
        .optional(),
    )
    .optional(),
})

export type UnsplashPhoto = {
  id?: string
  url: string
  thumb?: string
  author?: string
  authorUrl?: string
}

export const isUnsplashConfigured = () =>
  Boolean(process.env.UNSPLASH_ACCESS_KEY)

export const searchUnsplash = async (
  query: string,
  options: { page?: number; perPage?: number; landscape?: boolean } = {},
): Promise<UnsplashPhoto[]> => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY

  if (!accessKey) {
    throw new Error("UNSPLASH_ACCESS_KEY non configurée sur le serveur")
  }

  const params = new URLSearchParams({
    query,
    page: String(options.page ?? 1),
  })
  params.set("per_page", String(options.perPage ?? 24))

  if (options.landscape) {
    params.set("orientation", "landscape")
    params.set("content_filter", "high")
  }

  const response = await fetch(
    `https://api.unsplash.com/search/photos?${params}`,
    { headers: { Authorization: `Client-ID ${accessKey}` } },
  )

  if (!response.ok) {
    throw new Error(`Unsplash returned status ${response.status}`)
  }

  const parsed = unsplashResponseSchema.safeParse(await response.json())
  const items = parsed.success ? (parsed.data.results ?? []) : []

  return items.flatMap((item) => {
    const url = item?.urls?.regular

    if (!item || !url) {
      return []
    }

    return [
      {
        id: item.id,
        url,
        thumb: item.urls?.small || item.urls?.thumb,
        author: item.user?.name,
        authorUrl: item.user?.links?.html,
      },
    ]
  })
}
