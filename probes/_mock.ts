import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/http/HttpClient"
import type * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import { GraphQLProtocol } from "effect/graphql"

export const ENDPOINT = "http://library.example/graphql"

export interface WireRecord {
  readonly method: string
  readonly url: string
  readonly urlParams: string
  readonly headers: Record<string, string>
}

export const wire: Array<WireRecord> = []

export const json = (body: unknown, status = 200, contentType = "application/json") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } })

export const mockHttp = (
  handler: (req: HttpClientRequest.HttpClientRequest) => Response,
  map: (client: HttpClient.HttpClient) => HttpClient.HttpClient = (client) => client
) =>
  Layer.succeed(
    HttpClient.HttpClient,
    map(HttpClient.make((req) =>
      Effect.sync(() => {
        wire.push({
          method: req.method,
          url: req.url,
          urlParams: new URLSearchParams(req.urlParams as unknown as Array<[string, string]>).toString(),
          headers: { ...req.headers }
        })
        return HttpClientResponse.fromWeb(req, handler(req))
      })
    ))
  )

export const protocol = (
  handler: (req: HttpClientRequest.HttpClientRequest) => Response,
  map?: (client: HttpClient.HttpClient) => HttpClient.HttpClient
) => GraphQLProtocol.layerHttp({ url: ENDPOINT }).pipe(Layer.provide(mockHttp(handler, map)))

export const show = (label: string, value: unknown) =>
  console.log(`${label.padEnd(10)} ${JSON.stringify(value, (_, x) => (typeof x === "bigint" ? String(x) : x))}`)

export const failureOf = (exit: { _tag: string; cause?: unknown }) => {
  const reasons = (exit.cause as { reasons?: Array<{ error?: any }> } | undefined)?.reasons
  const error = reasons?.[0]?.error
  if (!error) return String(exit.cause)
  return {
    tag: error._tag,
    reason: error.reason?._tag,
    status: error.reason?.status ?? error.status,
    errors: error.reason?.errors,
    message: String(error.reason?.message ?? error.message ?? "").slice(0, 160)
  }
}
