import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { GraphQLClient, GraphQLGroup, GraphQLProtocol } from "effect/graphql"
import { BookByIsbn } from "../documents/BookByIsbn.graphql.ts"
import { Search } from "../documents/Search.graphql.ts"
import { Isbn } from "../scalars.ts"
import { failureOf, show, verdict } from "./_mock.ts"

const LibraryGraphQLGroup = GraphQLGroup.make(Search, BookByIsbn)

class Library extends Context.Service<Library>()("feedback/Library", {
  make: GraphQLClient.make(LibraryGraphQLGroup)
}) {
  static readonly layerTest = GraphQLClient.layerTest(Library, LibraryGraphQLGroup)
}

const isbn = Isbn.make("9780441013593")
const millis = 1_700_000_000_000

const search = Library.use((library) => library.Search({ text: "dune" }))
const book = Library.use((library) => library.BookByIsbn({ isbn }))

const outcome = (exit: Exit.Exit<unknown, unknown>) => {
  if (exit._tag === "Success") return exit.value
  const reason = exit.cause.reasons[0]
  if (reason?._tag === "Die") {
    const defect = reason.defect as Error
    return { die: defect.name, message: defect.message }
  }
  return failureOf(exit)
}

console.log("05 test-layer: the shipped mock client and the scripted protocol path\n")

console.log("a) Library.layerTest = GraphQLClient.layerTest(Library, group): handlers return decoded values")
const mock = Library.layerTest({
  Search: ({ text }) => Effect.succeed({ search: [{ __typename: "Book", id: "b1", title: `Hit for ${text}`, isbn }] })
})
const handled = await Effect.runPromiseExit(search.pipe(Effect.provide(mock)))
show("handled", outcome(handled))
const missing = await Effect.runPromiseExit(book.pipe(Effect.provide(mock)))
show("missing", outcome(missing))
const skipped = await Effect.runPromiseExit(book.pipe(Effect.provide(Library.layerTest({
  BookByIsbn: () =>
    Effect.succeed({
      book: { id: "b1", title: "Dune", publishedAt: millis, isbn, pageCount: null, author: null, series: null }
    })
}))))
show("no decode", outcome(skipped))

console.log("\nb) GraphQLClient.make over a scripted GraphQLProtocol layer: fixtures go through the real decode")
const scripted = (fixtures: Record<string, unknown>) =>
  Layer.succeed(GraphQLProtocol.GraphQLProtocol, {
    execute: (request) => Effect.succeed({ body: { data: fixtures[request.operationName ?? ""] } }),
    subscribe: () => Stream.empty
  })
const real = <A, E>(effect: Effect.Effect<A, E, Library>, fixtures: Record<string, unknown>) =>
  Effect.runPromiseExit(effect.pipe(Effect.provide(Layer.effect(Library, Library.make)), Effect.provide(scripted(fixtures))))

const valid = await real(search, { Search: { search: [{ __typename: "Book", id: "b1", title: "Dune", isbn }] } })
show("valid", outcome(valid))
const noTypename = await real(search, { Search: { search: [{ id: "b1", title: "Dune", isbn }] } })
show("typename", outcome(noTypename))
const bookFixture = (publishedAt: number) => ({
  BookByIsbn: {
    book: { __typename: "Book", id: "b1", title: "Dune", publishedAt, isbn, pageCount: null, author: null, series: null }
  }
})
const seconds = await real(book, bookFixture(1_700_000_000))
show("seconds", outcome(seconds))
const overflow = await real(book, bookFixture(millis))
show("int32", outcome(overflow))

const reason = (exit: Exit.Exit<unknown, unknown>) => {
  const failure = outcome(exit)
  return typeof failure === "object" && failure !== null && "reason" in failure ? failure.reason : undefined
}
const missingDie = outcome(missing)
const fixed = Exit.isSuccess(handled) &&
  typeof missingDie === "object" && missingDie !== null && "die" in missingDie && missingDie.die === "UnimplementedError" &&
  Exit.isSuccess(skipped) &&
  Exit.isSuccess(valid) && reason(noTypename) === "DecodeError" &&
  Exit.isSuccess(seconds) && reason(overflow) === "DecodeError"

console.log("\nobserved: a) layerTest returns the handler's value; an operation without a handler dies with UnimplementedError;")
console.log(`          a publishedAt of ${millis} (above Int's 2147483647) passes, because makeTest does not encode, decode or validate (documented).`)
console.log("          b) over a scripted GraphQLProtocol the real client decodes: a valid fixture passes, a fixture without")
console.log("          __typename and the same millisecond publishedAt both fail with DecodeError.")
console.log("before:   (7ee8dca) no shipped helper; every project hand-wrote a GraphQLProtocol layer.")
console.log("wanted:   a shipped test helper, and a clear path that still checks fixtures against the schema.")
verdict(fixed)
