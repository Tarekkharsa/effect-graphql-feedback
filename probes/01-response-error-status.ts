import * as Effect from "effect/Effect"
import { GraphQLClient } from "effect/graphql"
import { SearchGraphQLGroup } from "../documents/Search.graphql.ts"
import { failureOf, json, protocol, show, verdict } from "./_mock.ts"

const call = (response: () => Response) =>
  Effect.gen(function*() {
    const client = yield* GraphQLClient.make(SearchGraphQLGroup)
    return yield* client.Search({ text: "x" })
  }).pipe(Effect.provide(protocol(response)), Effect.runPromiseExit)

console.log("01 response-error-status: a GraphQL errors body with HTTP 401 vs HTTP 200\n")
const unauthorized = failureOf(await call(() => json({ errors: [{ message: "Not signed in" }] }, 401)))
show("401", unauthorized)
const ok = failureOf(await call(() => json({ errors: [{ message: "Not signed in" }] }, 200)))
show("200", ok)
const s401 = typeof unauthorized === "string" ? undefined : unauthorized.status
const s200 = typeof ok === "string" ? undefined : ok.status
console.log(`\nobserved: ResponseError.status is ${s401} for the 401 and ${s200} for the 200.`)
console.log("before:   (091d1a1) both failed with the same ResponseError shape and no status.")
console.log("wanted:   the HTTP status on the error, so a 401 can be told apart from a 200 with errors.")
verdict(s401 === 401 && s200 === 200)
