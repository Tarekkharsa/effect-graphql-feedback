# effect-graphql-feedback

Small reproductions for feedback on [Effect-TS/effect#8979](https://github.com/Effect-TS/effect/pull/8979) (`effect/graphql` and `@effect/graphql-generator`).

The aggregate numbers from a private production schema are in the PR comment:
<https://github.com/Effect-TS/effect/pull/8979#issuecomment-6106601819>.
This repo reproduces the same behavior with an invented "library" schema, so it can be shared.

## Versions

| Package | Version |
| --- | --- |
| `effect` | pkg.pr.new preview `d24d55e` |
| `@effect/graphql-generator` | pkg.pr.new preview `d24d55e` |
| `@effect/platform-node` | pkg.pr.new preview `d24d55e` |
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
- a list lookup that returns one entry per key, in order (`books(isbns: [Isbn!]!): [Book]!`)

`documents/*.graphql` are the operations and one fragment. The generated `*.graphql.ts` files and `schema.graphql.ts` are committed.

## Run

```sh
npm install
npm run generate        # writes the .graphql.ts files
npm run check           # graphqlgen --check, exits 0 when the output is current
npm run typecheck:ts7   # native tsc 7.0.2
npm run typecheck:ts6   # tsc 6 (classic API)
npm run probes          # all probes; or npm run probe:01 ... probe:06
```

Each probe uses a mock `HttpClient` under `GraphQLProtocol.layerHttp` (probe 05 uses `GraphQLClient.layerTest` and a scripted `GraphQLProtocol` layer instead). Each prints what it observed next to what is wanted, and exits 0. The probes document behavior; they are not failing tests.

## Gaps

Re-run against `d24d55e` (earlier runs: `091d1a1`, `7ee8dca`). Probes 01 to 04 ran unchanged.

| Gap | Probe | Status | Observed on `d24d55e` |
| --- | --- | --- | --- |
| TS 7 support | `probe:00` (`typecheck:ts7`) | Works | Generated code and call sites type-check on TS 7.0.2 and TS 6 with no TS2589. |
| HTTP status on errors | `probes/01-response-error-status.ts` | Fixed in 7ee8dca | `ResponseError.status` is 401 for a 401 with an errors body and 200 for a 200 with the same body. Before: no status. |
| GET transport | `probes/02-get-transport.ts` | Fixed in 7ee8dca | With `layerHttp({ queryMethod: "GET" })` a query is sent as `GET` with `query`, `variables`, `operationName` as URL params. Default is still `POST`. |
| Per-call URL params | `probes/03-url-params.ts` | Fixed in 7ee8dca | `client.Search(vars, { urlParams: { preview } })` and `GraphQLRequest.urlParams` in middleware both reach the URL. No carrier header or `HttpClient.mapRequest`. |
| Middleware for runtime documents | `probes/04-batching-middleware.ts` | Fixed in 7ee8dca | The README Batching pattern (`GraphQL.query(name, { document, result: Schema.Json })` in its own group with `.middleware(Tag)`) runs middleware. Raw `GraphQLProtocol.execute` still skips it. |
| Test layer | `probes/05-test-layer.ts` | Fixed in d24d55e | Two paths. `GraphQLClient.makeTest` / `layerTest` answer from handlers with decoded values and skip encode, decode and middleware (documented), so a `publishedAt` above the `Int` range passes; a missing handler dies with `UnimplementedError`. `GraphQLClient.make` over a scripted `GraphQLProtocol` layer runs the real decode: a fixture without `__typename` and a millisecond `publishedAt` both fail with `DecodeError`. |
| Batched lookups | `probes/06-resolver.ts` | New in d24d55e | `GraphQLResolver.ordered` over `books(isbns:)`: 5 concurrent `request(isbn)` calls send 1 HTTP request with 4 distinct isbns; the duplicate shares its result and a `null` entry fails only its lookup with `NoSuchElementError`. |

## License

MIT
