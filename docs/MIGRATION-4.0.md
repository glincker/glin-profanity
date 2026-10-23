# Migrating to 4.0

4.0 adds an obfuscation pipeline that is on by default. Most apps need no code changes, but some verdicts and offsets differ from 3.x. This page lists them.

## What changed

### More obfuscation is caught by default

The default `obfuscation: 'standard'` now flags these in every language:

- separators: `f.u.c.k`
- masks: `f*ck`, `sh#t`
- stretched letters: `aaaasshole`
- HTML-wrapped and entity-encoded words: `<b>fuck</b>`, `f&#117;ck`

### Some text is newly clean

A built-in safe list removes dictionary hits that overlap known innocent words and phrases:

- `cl@ss` and `gl@ss` (with `detectLeetspeak: true`)
- `ass` followed by a zero-width character inside `assistant`
- `Moby Dick`, `Dick Van Dyke`, `Twatt Orkney`
- `cum laude`, `pussy willow`, `cock the hammer back`

`Dick Head` is still flagged. Add your own safe phrases with `whitelist: ['...']`. A hit is dropped only when it overlaps a safe span; the dictionary itself is untouched.

### Offsets and replacement

- `matches[].index` now refers to the original input, not the normalized text.
- `replaceWith` masks obfuscated spans by offset, so `so f.u.c.k you` becomes `so * you` with `replaceWith: '*'`.

### Leetspeak glyph order

Multi-character aggressive leetspeak patterns are now applied longest first (so `|_|` reads as `u` and `/\/\` as `m`), and the broken `><]` pattern for `x` is now `><`. With the `standard` level, `|`, `1` and `!` are also tried as `l` (for example `a$$ho|e`).

## Restoring old behavior

```ts
new Filter({ obfuscation: 'off' });      // plain scan, as in 3.x
new Filter({ wordBoundaries: false });   // legacy fuzzy scan, ignores the obfuscation options
```

`obfuscation` also accepts `basic`, `standard` (default) and `strict`, or an object of per-switch options. See [obfuscation](./advanced/obfuscation.md).

## Known limits

- `shi7e` is not detected (the form is not in the dictionary).
- Some Armenian homoglyphs, such as `ս` for `u`, are not mapped.
- Two-fragment space splits such as `fu ck` and `sh it` are not joined, because they collide with ordinary text like `pen is`.
- Four context-dependent false positives remain on the English shootout set: two medical or technical sentences, and the dictionary-ambiguous words `cock` and `jackass`.

Measured accuracy and its caveats: [benchmarks/shootout/README.md](../benchmarks/shootout/README.md). The test set was authored alongside the engine, so treat the numbers as optimistic.

## Performance

Throughput claims in earlier docs (21M ops/sec and similar) described the `checkProfanity()` result-cache path. Uncached `isProfane()` on short text runs about 300,000 ops/sec. See the [performance guide](./advanced/performance.md).
