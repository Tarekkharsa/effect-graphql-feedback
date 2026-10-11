import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import type * as HttpClientRequest from "effect/http/HttpClientRequest"
import { GraphQLClient, GraphQLResolver } from "effect/graphql"
import { BooksByIsbnGraphQLGroup } from "../documents/BooksByIsbn.graphql.ts"
import { Isbn } from "../scalars.ts"
import { json, protocol, show, verdict, wire } from "./_mock.ts"

const catalog: Record<string, { id: string; title: string; isbn: string }> = {
  "9780441013593": { id: "b1", title: "Dune", isbn: "9780441013593" },
  "9780547928227": { id: "b2", title: "The Hobbit", isbn: "9780547928227" },
  "9780553293357": { id: "b3", title: "Foundation", isbn: "9780553293357" }
}

const sent: Array<ReadonlyArray<string>> = []
const variablesOf = (req: HttpClientRequest.HttpClientRequest): { isbns: Array<string> } =>
  req.body._tag === "Uint8Array" ? JSON.parse(new TextDecoder().decode(req.body.body)).variables : { isbns: [] }

const handler = (req: HttpClientRequest.HttpClientRequest) => {
  const { isbns } = variablesOf(req)
  sent.push(isbns)
  return json({ data: { books: isbns.map((isbn) => catalog[isbn] ?? null) } })
}

const keys = ["9780441013593", "9780547928227", "9780441013593", "9780553293357", "0000000000000"].map((key) => Isbn.make(key))

console.log("06 resolver: GraphQLResolver.ordered over books(isbns:), several lookups run in parallel\n")
const results = await Effect.gen(function*() {
  const client = yield* GraphQLClient.make(BooksByIsbnGraphQLGroup)
  const BookByIsbn = GraphQLResolver.ordered(client.BooksByIsbn, {
    variables: (isbns: ReadonlyArray<typeof Isbn.Type>) => ({ isbns }),
    path: ["books"]
  })
  const getBook = GraphQLResolver.request(BookByIsbn)
  return yield* Effect.forEach(
    keys,
    (isbn) =>
      getBook(isbn).pipe(
        Effect.map((book) => `${book.isbn} ${book.title}`),
        Effect.catchIf(Cause.isNoSuchElementError, () => Effect.succeed(`${isbn} missing (NoSuchElementError)`))
      ),
    { concurrency: "unbounded" }
  )
}).pipe(Effect.provide(protocol(handler)), Effect.runPromise)

show("lookups", keys.length)
show("wire", wire.length)
show("variables", sent)
show("results", results)

console.log(`\nobserved: ${keys.length} concurrent request(isbn) calls became ${wire.length} HTTP ${wire.length === 1 ? "request" : "requests"}; the repeated isbn was sent once and`)
console.log("          both callers got its result; a null entry failed only its own lookup with NoSuchElementError.")
console.log("before:   (7ee8dca) no GraphQLResolver; batching lookups meant a hand-written RequestResolver.")
console.log("new:      GraphQLResolver.ordered / findById / request batch lookups through a generated client method.")
verdict(wire.length === 1 && results.length === keys.length && sent[0]?.length === 4, "NEW")
