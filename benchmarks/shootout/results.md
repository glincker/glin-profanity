# Benchmark Results: glin-profanity Shootout

_Generated: 2026-10-23  |  Torture-set: 1153 cases (893 English, 260 non-English)  |  Node v22.22.2_

## Accuracy (English cases)

| Library | Precision | Recall | F1 | FPR (all) | FPR (traps only) | TP | FP | FN | TN |
|---------|-----------|--------|----|-----------|------------------|----|----|----|----|
| glin-profanity | 92.3% | 68.2% | 78.4% | 8.2% | 3.0% (9/296) | 360 | 30 | 168 | 335 |
| allprofanity | 92.8% | 68.2% | 78.6% | 7.7% | 3.0% (9/296) | 360 | 28 | 168 | 337 |
| obscenity | 83.9% | 47.5% | 60.7% | 13.2% | 8.4% (25/296) | 251 | 48 | 277 | 317 |
| bad-words | 76.4% | 17.8% | 28.9% | 7.9% | 1.0% (3/296) | 94 | 29 | 434 | 336 |
| leo-profanity | 69.6% | 9.1% | 16.1% | 5.8% | 0.7% (2/296) | 48 | 21 | 480 | 344 |
| @2toad/profanity | 77.4% | 18.2% | 29.4% | 7.7% | 1.0% (3/296) | 96 | 28 | 432 | 337 |

"FPR (traps only)" excludes should-pass techniques whose verdict is context dependent (dictionary-ambiguous, person-name, medical-technical), where the dictionary lists the word on purpose.

## Recall by Category (English; positives caught / positives)

Cells for all-negative categories show false positives instead.

| Category | glin-profanity | allprofanity | obscenity | bad-words | leo-profanity | @2toad/profanity |
|----------|---|---|---|---|---|---|
| clean | OK | OK | 1 FP | OK | OK | OK |
| false-positive | 30 FP | 28 FP | 47 FP | 29 FP | 21 FP | 28 FP |
| plain | 11/11 | 11/11 | 11/11 | 11/11 | 11/11 | 11/11 |
| leetspeak | 32/37 | 29/37 | 28/37 | 5/37 | 0/37 | 6/37 |
| homoglyph | 53/54 | 32/54 | 45/54 | 0/54 | 0/54 | 0/54 |
| zero-width | 56/56 | 51/56 | 3/56 | 2/56 | 0/56 | 2/56 |
| separators | 17/61 | 26/61 | 2/61 | 4/61 | 1/61 | 5/61 |
| html | 14/67 | 16/67 | 18/67 | 14/67 | 5/67 | 14/67 |
| in-sentence | 67/87 | 77/87 | 61/87 | 36/87 | 11/87 | 36/87 |
| mixed-case | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 |
| stretched | 25/31 | 21/31 | 31/31 | 0/31 | 0/31 | 0/31 |
| masking | 0/26 | 16/26 | 4/26 | 0/26 | 0/26 | 0/26 |
| combining | 36/36 | 36/36 | 12/36 | 0/36 | 0/36 | 0/36 |
| mixed-technique | 29/42 | 25/42 | 16/42 | 2/42 | 0/42 | 2/42 |

## Recall by Technique (English)

<details><summary>Per-technique recall for should-flag techniques, FP counts for should-pass techniques</summary>

| Category / technique | n | glin-profanity | allprofanity | obscenity | bad-words | leo-profanity | @2toad/profanity |
|----------------------|---|---|---|---|---|---|---|
| clean/legacy-clean | 5 | OK | OK | OK | OK | OK | OK |
| false-positive/legacy-false-positive-trap | 10 | OK | OK | 1 FP | OK | OK | OK |
| plain/legacy-basic | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| leetspeak/legacy-leetspeak | 7 | 6/7 | 6/7 | 7/7 | 2/7 | 0/7 | 3/7 |
| homoglyph/legacy-homoglyph | 5 | 4/5 | 3/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| zero-width/legacy-zero-width | 3 | 3/3 | 3/3 | 1/3 | 1/3 | 0/3 | 1/3 |
| separators/legacy-word-break | 6 | 1/6 | 6/6 | 0/6 | 2/6 | 0/6 | 2/6 |
| html/legacy-html-injection | 3 | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| in-sentence/legacy-in-sentence | 4 | 1/4 | 2/4 | 2/4 | 1/4 | 0/4 | 1/4 |
| in-sentence/legacy-in-sentence-leetspeak | 3 | 2/3 | 3/3 | 3/3 | 1/3 | 0/3 | 1/3 |
| mixed-case/legacy-uppercase | 2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| mixed-case/legacy-mixed-case | 2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| separators/legacy-extra-spaces | 1 | 1/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| stretched/legacy-repeated-chars | 2 | 2/2 | 2/2 | 2/2 | 0/2 | 0/2 | 0/2 |
| clean/legacy-prompt-injection-not-profanity | 2 | OK | OK | OK | OK | OK | OK |
| plain/plain-title | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| mixed-case/alternating-lower-first | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| mixed-case/every-third | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| leetspeak/leet-l2-full | 5 | 4/5 | 3/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| leetspeak/leet-l2-single | 5 | 5/5 | 4/5 | 5/5 | 1/5 | 0/5 | 1/5 |
| leetspeak/leet-l3-full | 5 | 4/5 | 3/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| leetspeak/leet-l3-single | 4 | 3/4 | 3/4 | 0/4 | 0/4 | 0/4 | 0/4 |
| homoglyph/cyrillic-single | 4 | 4/4 | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 |
| homoglyph/cyrillic-full | 5 | 5/5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| homoglyph/greek-single | 5 | 5/5 | 5/5 | 4/5 | 0/5 | 0/5 | 0/5 |
| homoglyph/greek-full | 5 | 5/5 | 5/5 | 3/5 | 0/5 | 0/5 | 0/5 |
| homoglyph/fullwidth | 5 | 5/5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| homoglyph/fullwidth-upper | 5 | 5/5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| homoglyph/math-bold | 5 | 5/5 | 0/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| homoglyph/math-italic | 5 | 5/5 | 0/5 | 2/5 | 0/5 | 0/5 | 0/5 |
| homoglyph/math-mono | 5 | 5/5 | 0/5 | 3/5 | 0/5 | 0/5 | 0/5 |
| homoglyph/math-double | 5 | 5/5 | 0/5 | 4/5 | 0/5 | 0/5 | 0/5 |
| zero-width/zwnj-after-first | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| zero-width/zwj-after-first | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| zero-width/shy-after-first | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| zero-width/wj-after-first | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| zero-width/bom-after-first | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| zero-width/lrm-after-first | 5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| zero-width/zwsp-middle | 5 | 5/5 | 5/5 | 2/5 | 1/5 | 0/5 | 1/5 |
| zero-width/zwsp-every-letter | 4 | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 | 0/4 |
| zero-width/zwsp-multiple | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| zero-width/mixed-invisibles | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| separators/comma-full | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| separators/slash-full | 5 | 0/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| separators/pipe-full | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| separators/dot-single | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| separators/space-single | 5 | 1/5 | 1/5 | 2/5 | 1/5 | 1/5 | 1/5 |
| separators/double-space | 5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| separators/mixed-separators | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| separators/tab | 5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| masking/mask-hash | 4 | 0/4 | 4/4 | 1/4 | 0/4 | 0/4 | 0/4 |
| masking/mask-percent | 4 | 0/4 | 4/4 | 1/4 | 0/4 | 0/4 | 0/4 |
| masking/mask-question | 4 | 0/4 | 0/4 | 1/4 | 0/4 | 0/4 | 0/4 |
| masking/mask-underscore | 4 | 0/4 | 0/4 | 1/4 | 0/4 | 0/4 | 0/4 |
| masking/mask-interior | 4 | 0/4 | 2/4 | 0/4 | 0/4 | 0/4 | 0/4 |
| stretched/stretch-first | 5 | 4/5 | 4/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| stretched/stretch-last | 5 | 4/5 | 4/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| stretched/stretch-vowel-extreme | 5 | 4/5 | 4/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| stretched/stretch-all-double | 5 | 4/5 | 0/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| stretched/stretch-all-triple | 5 | 4/5 | 4/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| html/tag-split-br | 5 | 1/5 | 1/5 | 2/5 | 1/5 | 0/5 | 1/5 |
| html/tag-split-span | 5 | 1/5 | 1/5 | 2/5 | 1/5 | 0/5 | 1/5 |
| html/tag-wrapped | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 0/5 | 5/5 |
| html/tag-in-paragraph | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| html/tag-every-letter | 5 | 0/5 | 2/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| html/tag-comment | 5 | 1/5 | 1/5 | 2/5 | 1/5 | 0/5 | 1/5 |
| html/entity-dec-one | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| html/entity-hex-one | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| html/entity-dec-all | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| html/entity-hex-all | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| html/entity-shy | 5 | 1/5 | 1/5 | 2/5 | 1/5 | 0/5 | 1/5 |
| html/entity-double-encoded | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| combining/acute-second | 5 | 5/5 | 5/5 | 1/5 | 0/5 | 0/5 | 0/5 |
| combining/grave-all | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| combining/strikethrough | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| combining/underline | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| combining/ring-tilde | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| combining/precomposed-umlaut-full | 5 | 5/5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| mixed-technique/cyrillic+zwsp | 5 | 5/5 | 5/5 | 2/5 | 0/5 | 0/5 | 0/5 |
| mixed-technique/leet+stretch | 5 | 4/5 | 2/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| mixed-technique/fullwidth+zwsp | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| mixed-technique/greek+cyrillic | 5 | 5/5 | 5/5 | 4/5 | 0/5 | 0/5 | 0/5 |
| mixed-technique/mask+upper | 5 | 1/5 | 4/5 | 1/5 | 0/5 | 0/5 | 0/5 |
| mixed-technique/combining+space | 5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| leetspeak/leet-l1-full | 4 | 4/4 | 4/4 | 4/4 | 1/4 | 0/4 | 1/4 |
| leetspeak/leet-l1-single | 3 | 3/3 | 3/3 | 3/3 | 1/3 | 0/3 | 1/3 |
| leetspeak/leet-mixed | 4 | 3/4 | 3/4 | 4/4 | 0/4 | 0/4 | 0/4 |
| zero-width/zwsp-after-first | 4 | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 | 0/4 |
| separators/underscore-full | 4 | 0/4 | 4/4 | 0/4 | 1/4 | 0/4 | 2/4 |
| separators/hyphen-full | 3 | 0/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| separators/space-full | 4 | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 | 0/4 |
| masking/mask-star | 3 | 0/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| masking/mask-at | 2 | 0/2 | 2/2 | 0/2 | 0/2 | 0/2 | 0/2 |
| stretched/stretch-vowel | 4 | 3/4 | 3/4 | 4/4 | 0/4 | 0/4 | 0/4 |
| html/tag-split-bold | 4 | 0/4 | 0/4 | 0/4 | 0/4 | 0/4 | 0/4 |
| combining/precomposed-acute-single | 4 | 4/4 | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 |
| mixed-technique/leet+dot | 4 | 0/4 | 0/4 | 0/4 | 0/4 | 0/4 | 0/4 |
| mixed-technique/leet+case | 4 | 4/4 | 4/4 | 4/4 | 2/4 | 0/4 | 2/4 |
| mixed-technique/html+leet | 4 | 0/4 | 0/4 | 0/4 | 0/4 | 0/4 | 0/4 |
| mixed-case/upper | 3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| mixed-case/alternating-upper-first | 3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| separators/dot-full | 3 | 0/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 |
| combining/precomposed-acute-full | 2 | 2/2 | 2/2 | 2/2 | 0/2 | 0/2 | 0/2 |
| plain/plain | 1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| masking/mask-all-vowels | 1 | 0/1 | 1/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| in-sentence/plain | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| in-sentence/leet-l1-full | 5 | 5/5 | 5/5 | 5/5 | 2/5 | 1/5 | 2/5 |
| in-sentence/leet-l2-single | 5 | 5/5 | 4/5 | 5/5 | 1/5 | 0/5 | 1/5 |
| in-sentence/dot-full | 5 | 0/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| in-sentence/space-full | 5 | 4/5 | 4/5 | 0/5 | 1/5 | 0/5 | 1/5 |
| in-sentence/cyrillic-single | 5 | 5/5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| in-sentence/zwsp-after-first | 5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| in-sentence/stretch-vowel | 5 | 4/5 | 4/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| in-sentence/star-mask | 5 | 1/5 | 5/5 | 2/5 | 0/5 | 0/5 | 0/5 |
| in-sentence/upper | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| in-sentence/fullwidth | 5 | 5/5 | 5/5 | 5/5 | 0/5 | 0/5 | 0/5 |
| in-sentence/html-tag-split | 5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| in-sentence/punctuation | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 0/5 | 5/5 |
| in-sentence/quoted | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 0/5 | 5/5 |
| in-sentence/hashtag | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 0/5 | 5/5 |
| in-sentence/url-like | 5 | 5/5 | 5/5 | 4/5 | 5/5 | 0/5 | 5/5 |
| false-positive/scunthorpe-substring | 104 | 2 FP | 3 FP | 11 FP | 2 FP | 2 FP | 2 FP |
| false-positive/place-name | 26 | 1 FP | 2 FP | 8 FP | OK | OK | OK |
| false-positive/person-name | 17 | 8 FP | 8 FP | 10 FP | 9 FP | 8 FP | 9 FP |
| false-positive/medical-technical | 33 | 5 FP | 5 FP | 5 FP | 5 FP | 5 FP | 5 FP |
| false-positive/cross-word-boundary | 26 | OK | OK | OK | OK | OK | OK |
| false-positive/dictionary-ambiguous | 19 | 8 FP | 6 FP | 8 FP | 12 FP | 6 FP | 11 FP |
| false-positive/leet-lookalike-benign | 34 | 5 FP | OK | 2 FP | OK | OK | OK |
| false-positive/obfuscation-lookalike-benign | 51 | 1 FP | 4 FP | 2 FP | 1 FP | OK | 1 FP |
| clean/clean-sentence | 34 | OK | OK | 1 FP | OK | OK | OK |
| clean/prompt-injection-benign | 4 | OK | OK | OK | OK | OK | OK |

</details>

## Multilingual (non-English cases)

Only libraries with non-English dictionaries are scored; the rest are English-only. Each case is run with that language's dictionary loaded.

| Language | Cases | glin-profanity recall | glin-profanity FP | allprofanity recall | allprofanity FP |
|----------|-------|---|---|---|---|
| fr | 31 | 23/27 | 0/4 | 26/27 | 0/4 |
| de | 31 | 24/27 | 0/4 | 27/27 | 0/4 |
| es | 31 | 24/27 | 0/4 | 27/27 | 0/4 |
| pt | 31 | 24/27 | 0/4 | 18/27 | 0/4 |
| it | 31 | 23/27 | 0/4 | N/A | N/A |
| tr | 22 | 16/18 | 0/4 | N/A | N/A |
| nl | 31 | 24/27 | 0/4 | N/A | N/A |
| ru | 22 | 16/18 | 0/4 | N/A | N/A |
| pl | 30 | 23/26 | 0/4 | N/A | N/A |

## Performance (ops/sec, 20 inputs per iteration)

| Library | ops/sec | avg latency |
|---------|---------|-------------|
| glin-profanity | 1,147 | 882.0 us |
| allprofanity | 37,621 | 28.0 us |
| obscenity | 5,819 | 174.5 us |
| bad-words | 218 | 4773.3 us |
| leo-profanity | 384,248 | 2.7 us |
| @2toad/profanity (fastest) | 835,215 | 1.3 us |

## Bundle Size (unminified JS dist)

| Library | Size |
|---------|------|
| glin-profanity | 110.7 KB |
| allprofanity | 90.6 KB |
| obscenity | 1.8 KB |
| bad-words | 2.8 KB |
| leo-profanity | 12.5 KB |
| @2toad/profanity | 5.2 KB |

## Notes

- **glin-profanity** configured with `detectLeetspeak: true, leetspeakLevel: 'aggressive', normalizeUnicode: true`; one filter per language for non-English cases
- **allprofanity** and all other libraries run with default settings; allprofanity loads extra languages with `loadLanguage`
- Headline accuracy uses English cases only so English-only libraries are not penalised for languages they do not claim
- Torture-set is generated by `generate-torture.mjs`; see README for the schema and methodology
- Performance measured with [tinybench](https://github.com/tinylibs/tinybench), 20 stride-sampled English inputs per iteration
- Bundle sizes are unminified source files; minified + gzipped sizes will be smaller
