import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { GraphQLClient, GraphQLProtocol } from "effect/graphql"
import { SearchGraphQLGroup } from "../documents/Search.graphql.ts"
import { failureOf, show } from "./_mock.ts"

const fixtureLayer = (fixtures: Record<string, unknown>) =>
  Layer.succeed(GraphQLProtocol.GraphQLProtocol, {
    execute: (request) => Effect.succeed({ data: fixtures[request.operationName ?? ""] }),
    subscribe: () => Stream.empty
  })

const run = (fixture: unknown) =>
  Effect.gen(function*() {
    const client = yield* GraphQLClient.make(SearchGraphQLGroup)
    return yield* client.Search({ text: "dune" })
  }).pipe(Effect.provide(fixtureLayer({ Search: fixture })), Effect.runPromiseExit)

console.log("05 test-layer: a GraphQLProtocol layer that serves fixtures by operationName\n")
const valid = await run({ search: [{ __typename: "Book", id: "b1", title: "Dune", isbn: "9780441013593" }] })
show("valid", valid._tag === "Success" ? valid.value : failureOf(valid))
const invalid = await run({ search: [{ id: "b1", title: "Dune", isbn: "9780441013593" }] })
show("invalid", invalid._tag === "Success" ? invalid.value : failureOf(invalid))
console.log("\nobserved: a hand-written GraphQLProtocol layer works and fixtures still go through the real decode; a fixture without __typename fails.")
console.log("wanted:   a shipped test helper (e.g. GraphQLProtocol.layerTest / layerFixtures keyed by operation) so every project does not hand-roll this.")
