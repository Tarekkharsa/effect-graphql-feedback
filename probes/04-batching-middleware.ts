import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { GraphQL, GraphQLClient, GraphQLGroup, GraphQLMiddleware, GraphQLProtocol } from "effect/graphql"
import { json, protocol, show, wire } from "./_mock.ts"

class Tenant extends GraphQLMiddleware.Service<Tenant>()("feedback/Tenant") {}
const tenantLayer = Layer.succeed(
  Tenant,
  GraphQLMiddleware.mapRequest((request) => Effect.succeed({ ...request, headers: { ...request.headers, "x-tenant": "branch-7" } }))
)

const batched = "query BatchedShelves{a0:shelves{id}a1:shelves{name}}"
const handler = () => json({ data: { a0: [], a1: [] } })

console.log("04 batching-middleware: a runtime-built aliased query (e.g. a batch) and group middleware\n")

await Effect.gen(function*() {
  const proto = yield* GraphQLProtocol.GraphQLProtocol
  return yield* proto.execute({ query: batched, operationName: "BatchedShelves", variables: {}, headers: {} })
}).pipe(Effect.provide(protocol(handler)), Effect.provide(tenantLayer), Effect.runPromise)
show("execute", { "x-tenant": wire[0]?.headers["x-tenant"] ?? null })

const Batched = GraphQL.query("BatchedShelves", { document: batched, result: Schema.Json })
await Effect.gen(function*() {
  const client = yield* GraphQLClient.make(GraphQLGroup.make(Batched).middleware(Tenant))
  return yield* client.BatchedShelves()
}).pipe(Effect.provide(protocol(handler)), Effect.provide(tenantLayer), Effect.runPromise)
show("group", { "x-tenant": wire[1]?.headers["x-tenant"] ?? null })

console.log("\nobserved: GraphQLProtocol.execute skips group middleware; wrapping the runtime document in GraphQL.query(..., { result: Schema.Json }) inside a group keeps it.")
console.log("wanted:   a documented way to run a runtime-built document through the client and its middleware (the Schema.Json wrapper works but loses typing and is not documented).")
