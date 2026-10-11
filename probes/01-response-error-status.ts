import * as Effect from "effect/Effect"
import { GraphQLClient } from "effect/graphql"
import { SearchGraphQLGroup } from "../documents/Search.graphql.ts"
import { failureOf, json, protocol, show } from "./_mock.ts"

const call = (response: () => Response) =>
  Effect.gen(function*() {
    const client = yield* GraphQLClient.make(SearchGraphQLGroup)
    return yield* client.Search({ text: "x" })
  }).pipe(Effect.provide(protocol(response)), Effect.runPromiseExit)

console.log("01 response-error-status: a GraphQL errors body with HTTP 401 vs HTTP 200\n")
const unauthorized = await call(() => json({ errors: [{ message: "Not signed in" }] }, 401))
show("401", failureOf(unauthorized))
const ok = await call(() => json({ errors: [{ message: "Not signed in" }] }, 200))
show("200", failureOf(ok))
console.log("\nobserved: both fail with the same ResponseError shape; the HTTP status is not on the error.")
console.log("wanted:   the HTTP status (and ideally headers) on the error, so a 401 can be told apart from a 200 with errors.")
