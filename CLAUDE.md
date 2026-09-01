# CLAUDE.md

Fresco — `@pragmatic-tech-ai/fresco`, the layout/graph-engine package (consumed by
Plexus for the diagram layout pipeline). ESM; tests via
`tsx --test "src/**/*.test.ts"`.

## Testing

- **Every test file lives in a `tests/` subfolder next to the code it
  exercises** — `src/ge/tests/configuration-loader.test.ts`, never
  `src/ge/configuration-loader.test.ts`. The runner globs `src/**/*.test.ts`
  either way, so this is organizational: keep source directories free of test
  files.
