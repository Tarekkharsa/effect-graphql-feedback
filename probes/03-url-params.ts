import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as UrlParams from "effect/http/UrlParams"
import { GraphQLClient, GraphQLMiddleware } from "effect/graphql"
import { SearchGraphQLGroup } from "../documents/Search.graphql.ts"
import { json, protocol, show, verdict, wire } from "./_mock.ts"

class Preview extends GraphQLMiddleware.Service<Preview>()("feedback/Preview") {}
const previewLayer = Layer.succeed(
  Preview,
  GraphQLMiddleware.mapRequest((request) =>
    Effect.succeed({ ...request, urlParams: UrlParams.set(request.urlParams, "preview", "mw-7") })
  )
)

const handler = () => json({ data: { search: [] } })

console.log("03 url-params: a per-call URL query parameter (e.g. ?preview=<token>)\n")
await Effect.gen(function*() {
  const client = yield* GraphQLClient.make(SearchGraphQLGroup)
  return yield* client.Search({ text: "x" }, { urlParams: { preview: "draft-42" } })
}).pipe(Effect.provide(protocol(handler)), Effect.runPromise)
const call = wire[0]
show("per-call", { url: call?.url, urlParams: call?.urlParams, headers: Object.keys(call?.headers ?? {}) })

await Effect.gen(function*() {
  const client = yield* GraphQLClient.make(SearchGraphQLGroup.middleware(Preview))
  return yield* client.Search({ text: "x" })
}).pipe(Effect.provide(protocol(handler)), Effect.provide(previewLayer), Effect.runPromise)
const mw = wire[1]
show("middleware", { url: mw?.url, urlParams: mw?.urlParams })

const fixed = new URLSearchParams(call?.urlParams).get("preview") === "draft-42" &&
  new URLSearchParams(mw?.urlParams).get("preview") === "mw-7"
console.log("\nobserved: { urlParams } per call and GraphQLRequest.urlParams in middleware both reach the URL; no carrier header, no HttpClient.mapRequest.")
console.log("before:   (091d1a1) per-call options took headers only; a carrier header plus HttpClient.mapRequest was needed.")
console.log("wanted:   a per-call (or middleware) way to set URL params on the request.")
verdict(fixed)
