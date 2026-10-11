import * as Effect from "effect/Effect"
import { GraphQLClient } from "effect/graphql"
import { BookByIsbnGraphQLGroup } from "../documents/BookByIsbn.graphql.ts"
import { Publications, PublicationsGraphQLGroup } from "../documents/Publications.graphql.ts"
import { SearchGraphQLGroup } from "../documents/Search.graphql.ts"
import { Isbn } from "../scalars.ts"

export const program = Effect.gen(function*() {
  const publications = yield* GraphQLClient.make(PublicationsGraphQLGroup)
  const page: Publications.Result = yield* publications.Publications({ first: 10, after: null })
  const titles = page.publications.edges.map((edge) => {
    const node = edge.node
    const seconds: number = node.publishedAt
    return node.__typename === "Book" ? `${node.title} ${node.isbn} ${node.series?.cover?.url ?? ""} ${seconds}` : node.title
  })

  const search = yield* GraphQLClient.make(SearchGraphQLGroup)
  const hits = yield* search.Search({ text: "dune" })
  const names = hits.search.map((hit) => (hit.__typename === "Author" ? hit.name : hit.title))

  const books = yield* GraphQLClient.make(BookByIsbnGraphQLGroup)
  const book = yield* books.BookByIsbn({ isbn: Isbn.make("9780441013593") })

  return { titles, names, cursor: page.publications.pageInfo.endCursor, book: book.book?.title ?? null }
})
