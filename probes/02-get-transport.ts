import * as Effect from "effect/Effect"
import { GraphQLClient } from "effect/graphql"
import { SearchGraphQLGroup } from "../documents/Search.graphql.ts"
import { json, protocol, show, verdict, wire } from "./_mock.ts"

const run = (queryMethod?: "GET") =>
  Effect.gen(function*() {
    const client = yield* GraphQLClient.make(SearchGraphQLGroup)
    return yield* client.Search({ text: "x" })
  }).pipe(
    Effect.provide(protocol(() => json({ data: { search: [] } }), undefined, queryMethod ? { queryMethod } : {})),
    Effect.runPromise
  )

console.log("02 get-transport: which HTTP method a query uses\n")
await run()
show("default", { method: wire[0]?.method, urlParams: wire[0]?.urlParams })
await run("GET")
const get = wire[1]
const params = new URLSearchParams(get?.urlParams)
show("GET", { method: get?.method, urlParams: get?.urlParams })
const fixed = wire[0]?.method === "POST" && get?.method === "GET" &&
  params.has("query") && params.has("variables") && params.has("operationName")
console.log(`\nobserved: default sends ${wire[0]?.method}; with queryMethod: "GET" it sends ${get?.method} with query/variables/operationName as URL params.`)
console.log("before:   (091d1a1) a query was always sent as POST; layerHttp had no option for GET.")
console.log("wanted:   an opt-in GET transport for queries so CDN and HTTP caches can serve them.")
verdict(fixed)
