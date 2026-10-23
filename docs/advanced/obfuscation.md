# Obfuscation handling

`Filter` runs a pipeline of transformers before dictionary matching. Each one returns the new text plus an index map back to your original string, so offsets in `matches` and `replaceWith` refer to the text you passed in.

| Transformer | Catches | Example |
| --- | --- | --- |
| html | tags, comments, named, numeric, hex and double-encoded entities, soft hyphens | `f<b>u</b>ck`, `f&amp;#117;ck` |
| separators | `. , / \| _ -` between letters, single dots, rotating separators | `f.u.c.k`, `b.itch`, `f.u_c-k` |
| masking | one mask character per hidden letter | `f*ck`, `sh#t`, `b*****d`, `@sshole` |
| stretch | repeated letters, with legitimate double letters kept | `aaaasshole` |
| leetspeak | `\|_\|`, `\|<`, `/\`, and `\|`, `1`, `!` read as `l` | `f\|_\|ck`, `a$$ho\|e` |
| whitelist | built-in safe words and names; hits inside the protected word are dropped | `cl@ss`, `Moby Dick`, `cum laude` |

## Options

```ts
new Filter({ obfuscation: 'standard' });          // default
new Filter({ obfuscation: 'off' });               // plain matching only
new Filter({
  obfuscation: {
    level: 'basic',                               // off | basic | standard | strict
    separators: { chars: '.,/|_-', minTwoPieceLength: 4 },
    masking: { chars: '*#@$%_?!', minVisible: 1 },
    html: { decodeDepth: 2 },
    builtinWhitelist: true,
  },
  whitelist: ['shit happens'],                    // extra safe phrases
});
```

| Level | Switches on |
| --- | --- |
| `off` | nothing (behaves like earlier versions) |
| `basic` | html, stretch, built-in whitelist |
| `standard` (default) | basic, separators, masking, `l` reading of `\|`/`1`/`!` |
| `strict` | standard, spaces allowed after one other separator, shorter two-fragment joins |

Defaults can be overridden from the environment: `GLIN_HTML_DECODE_DEPTH`, `GLIN_SEPARATOR_MIN_JOIN`, `GLIN_MASK_MIN_VISIBLE`.

## Safeguards

- A mask only resolves when a dictionary word of the same length fits it, so `****`, `p@ssword` and markdown `**bold**` stay clean.
- Separator joins must start and end on a fragment boundary and include a single-letter fragment, so `end.fuck`, `e.g.`, `B.S.` and `well-known` produce nothing new.
- Stretched tokens must contain the word's own letter runs, only longer, so `as` never becomes `ass`.
- The whitelist drops a hit only when it lies fully inside the protected word of an entry (`cum` in `cum laude`, `Dick` in `Moby Dick`). Other profane words around it are still flagged, so `Fuck Dick` reports `fuck`. A capitalized word before `Dick` such as `You` or `Big` does not make it a name. The dictionary itself is untouched.
- A spelled-out chain joins only at a word end: `a s s i g n m e n t` and `c.o.c.k.p.i.t` stay clean, `f.u.c.k.s.h.i.t` is still found.
- `wordBoundaries: false` (also the default when `allowObfuscatedMatch: true`) keeps the earlier fuzzy scan. The `obfuscation` options and the built-in whitelist apply only with word boundaries on. The scan still honors `ignoreWords` and your own `whitelist` phrases (matched on word edges), but not the built-in list.
- `replaceWith` masks by the offsets of the reported hits, so a whitelisted name in the same text stays readable.
- `enableContextAware` scans the same views as the plain path; it only adds the context scoring of `ContextAnalyzer` (JS).

## Known gaps

Two-word splits such as `fu ck` or `sh it` are not joined (they collide with ordinary text like `pen is`). Names other than Dick, and idioms outside the built-in list, need `whitelist`.
