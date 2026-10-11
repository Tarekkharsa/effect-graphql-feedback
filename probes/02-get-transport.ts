import * as Effect from "effect/Effect"
import { GraphQLClient } from "effect/graphql"
import { SearchGraphQLGroup } from "../documents/Search.graphql.ts"
import { json, protocol, show, wire } from "./_mock.ts"

console.log("02 get-transport: which HTTP method a query uses\n")
await Effect.gen(function*() {
  const client = yield* GraphQLClient.make(SearchGraphQLGroup)
  return yield* client.Search({ text: "x" })
}).pipe(Effect.provide(protocol(() => json({ data: { search: [] } }))), Effect.runPromise)
show("query", { method: wire[0]?.method, urlParams: wire[0]?.urlParams })
console.log("\nobserved: a query is always sent as POST; layerHttp has no option for GET.")
console.log("wanted:   an opt-in GET transport for queries (query/variables/operationName as URL params) so CDN and HTTP caches can serve them.")
