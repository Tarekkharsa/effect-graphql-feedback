import * as Effect from "effect/Effect"
import { GraphQLClient } from "effect/graphql"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import { SearchGraphQLGroup } from "../documents/Search.graphql.ts"
import { json, protocol, show, wire } from "./_mock.ts"

const CARRIER = "x-url-param-preview"

const headerToUrlParam = (client: HttpClient.HttpClient) =>
  HttpClient.mapRequest(client, (req) => {
    const value = req.headers[CARRIER]
    return value === undefined
      ? req
      : req.pipe(HttpClientRequest.removeHeader(CARRIER), HttpClientRequest.setUrlParam("preview", value))
  })

const run = (map?: (client: HttpClient.HttpClient) => HttpClient.HttpClient) =>
  Effect.gen(function*() {
    const client = yield* GraphQLClient.make(SearchGraphQLGroup)
    return yield* client.Search({ text: "x" }, { headers: { [CARRIER]: "draft-42" } })
  }).pipe(Effect.provide(protocol(() => json({ data: { search: [] } }), map)), Effect.runPromise)

console.log("03 url-params: a per-call URL query parameter (e.g. ?preview=<token>)\n")
await run()
show("plain", { url: wire[0]?.url, urlParams: wire[0]?.urlParams, carrier: wire[0]?.headers[CARRIER] })
await run(headerToUrlParam)
show("workaround", { url: wire[1]?.url, urlParams: wire[1]?.urlParams, carrier: wire[1]?.headers[CARRIER] ?? null })
console.log("\nobserved: the per-call options take headers only; a URL param needs a carrier header plus HttpClient.mapRequest under layerHttp.")
console.log("wanted:   a per-call (or middleware) way to set URL params on the request, e.g. { urlParams: { preview } }.")
