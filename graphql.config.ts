import { defineConfig } from "@effect/graphql-generator/Config"

export default defineConfig({
  schema: "./schema.graphql",
  documents: ["documents/**/*.graphql"],
  scalars: { Isbn: "./scalars.ts#Isbn" }
})
