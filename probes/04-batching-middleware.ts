import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as UrlParams from "effect/http/UrlParams"
import { GraphQL, GraphQLClient, GraphQLGroup, GraphQLMiddleware, GraphQLProtocol } from "effect/graphql"
import { json, protocol, show, verdict, wire } from "./_mock.ts"

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
  return yield* proto.execute({
    kind: "query",
    query: batched,
    operationName: "BatchedShelves",
    variables: {},
    headers: {},
    urlParams: UrlParams.empty
  })
}).pipe(Effect.provide(protocol(handler)), Effect.provide(tenantLayer), Effect.runPromise)
show("execute", { "x-tenant": wire[0]?.headers["x-tenant"] ?? null })

const Batched = GraphQL.query("BatchedShelves", { document: batched, result: Schema.Json })
await Effect.gen(function*() {
  const client = yield* GraphQLClient.make(GraphQLGroup.make(Batched).middleware(Tenant))
  return yield* client.BatchedShelves()
}).pipe(Effect.provide(protocol(handler)), Effect.provide(tenantLayer), Effect.runPromise)
const group = wire[1]?.headers["x-tenant"] ?? null
show("README", { "x-tenant": group })

console.log("\nobserved: the README Batching pattern (GraphQL.query(name, { document, result: Schema.Json }) in GraphQLClient.make(GraphQLGroup.make(op).middleware(Tag))) runs middleware; raw GraphQLProtocol.execute still skips it.")
console.log("before:   (091d1a1) the same wrapper worked but was not documented.")
console.log("wanted:   a documented way to run a runtime-built document through the client and its middleware.")
verdict(group === "branch-7")
