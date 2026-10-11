# effect-graphql-feedback

Small reproductions for feedback on [Effect-TS/effect#8979](https://github.com/Effect-TS/effect/pull/8979) (`effect/graphql` and `@effect/graphql-generator`).

The aggregate numbers from a private production schema are in the PR comment:
<https://github.com/Effect-TS/effect/pull/8979#issuecomment-6106601819>.
This repo reproduces the same behavior with an invented "library" schema, so it can be shared.

## Versions

| Package | Version |
| --- | --- |
| `effect` | pkg.pr.new preview `091d1a1` |
| `@effect/graphql-generator` | pkg.pr.new preview `091d1a1` |
| `@effect/platform-node` | pkg.pr.new preview `091d1a1` |
| `typescript-7` | `typescript@7.0.2` (native `tsc`) |
| `typescript` | `@typescript/typescript6@6.0.2` (classic JS API; its `tsc6` reports 6.0.3) |
| Node | 24.14.1 (needs >= 22.18 for type stripping) |

## Why TypeScript 7 matters

gql.tada infers result types through the classic TypeScript language-service API. Native TypeScript 7 does not expose that API, and gql.tada support for it was closed as not planned: <https://github.com/0no-co/gql.tada/issues/519>. A project that moves to TS 7 needs generated types instead. This repo keeps both compilers side by side, as a migrating project would.

## Schema

`schema.graphql` is invented. It has the shapes that matter for the generator:

- an interface (`Publication`) and a union (`SearchResult`), so the generator adds `__typename`
- a Relay-style connection with `pageInfo` and a nullable `$after`
- an `Int` timestamp (`publishedAt`)
- a custom scalar `Isbn`, mapped in `graphql.config.ts` to `scalars.ts#Isbn`
- a nullable parent with a non-null child (`Series.cover: Image` with `Image.url: String!`)

`documents/*.graphql` are the operations and one fragment. The generated `*.graphql.ts` files and `schema.graphql.ts` are committed.

## Run

```sh
npm install
npm run generate        # writes the .graphql.ts files
npm run check           # graphqlgen --check, exits 0 when the output is current
npm run typecheck:ts7   # native tsc 7.0.2
npm run typecheck:ts6   # tsc 6 (classic API)
npm run probes          # all probes; or npm run probe:01 ... probe:05
```

Each probe uses a mock `HttpClient` under `GraphQLProtocol.layerHttp` (probe 05 replaces the protocol itself). Each prints what it observed next to what is wanted, and exits 0. The probes document behavior; they are not failing tests.

## Gaps

| Gap | Probe | Observed | Wanted |
| --- | --- | --- | --- |
| TS 7 support | `probe:00` (`typecheck:ts7`) | Generated code and a call site type-check on TS 7.0.2 with no TS2589. | Works as is. Listed as the reason to adopt. |
| HTTP status on errors | `probes/01-response-error-status.ts` | A 401 with a GraphQL errors body and a 200 with the same body both give `ResponseError` with no status. | The HTTP status (and headers) on the error. |
| GET transport | `probes/02-get-transport.ts` | Queries are always sent as `POST`. | An opt-in GET transport for queries, so HTTP and CDN caches can serve them. |
| Per-call URL params | `probes/03-url-params.ts` | Per-call options take headers only. A carrier header plus `HttpClient.mapRequest` works around it. | A per-call or middleware way to set URL params. |
| Middleware for runtime documents | `probes/04-batching-middleware.ts` | `GraphQLProtocol.execute` skips group middleware. `GraphQL.query(..., { result: Schema.Json })` in a group keeps it. | A documented path for runtime-built documents (for example batched aliases) through the client. |
| Test layer | `probes/05-test-layer.ts` | A hand-written `GraphQLProtocol` layer serves fixtures by `operationName`; fixtures go through the real decode, and one without `__typename` fails. | A shipped fixture or test layer. |

## License

MIT
