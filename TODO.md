# Performance TODO — post-spec re-evaluation

## Context

Branch `inline-scanner-rework` already shipped optimizations 1–9 from the
previous round (parser.c −17%, m.dj wall ~140 ms vs master's ~200 ms,
~1.4× faster). A markdown-comparison benchmark (m.md ~243 KB):

| Parser | Wall time | Bytes/ms |
|---|---|---|
| djot master | ~201 ms | ~1,650 |
| djot **this branch** | ~141 ms | ~2,250 |
| markdown block alone | ~43 ms | ~5,650 |
| markdown block + inline (sequential upper bound) | ~86 ms | ~2,830 |

So djot is still ~1.6× slower per byte than the markdown pair on
equivalent content. Splitting into block + inline parsers (markdown's
biggest architectural win) is **out of scope** — single grammar stays.

This TODO re-evaluates the optimizations identified by reading the
markdown parsers, after cross-referencing them against the actual djot
syntax spec at https://github.com/jgm/djot/blob/master/doc/syntax.html.
Several patterns that look like wins for markdown turn out not to apply
to djot, and a few new candidates surfaced from the spec.

## Spec findings that change the analysis

These are the load-bearing rules from the djot spec that determine
which markdown patterns transfer:

- **No flanking-delimiter rules.** Djot's open/close test is just
  "not directly followed/preceded by whitespace." No
  punctuation-context, no left-flanking vs right-flanking. Markdown's
  `LAST_TOKEN_WHITESPACE` / `LAST_TOKEN_PUNCTUATION` machinery is
  pure complexity for our case; we already cover the rule with a
  single `STATE_AFTER_NON_WHITESPACE_CHECK` flag.
- **Distinct delimiters per element.** `_` is emphasis, `*` is strong,
  `^` superscript, `~` subscript, etc. — each delimiter is one char,
  not a run. So `**hello**` in djot is `*` + `*hello*` + `*`, not a
  multi-level run. Markdown's "scan run once, replay decision" pattern
  has nothing to amortize over because there's no run.
- **"First opener that gets closed wins."** This is a *runtime* rule,
  not a structural one — `prec.dynamic` is fundamental, not a target
  to remove. (Confirms why #10 last round failed.)
- **"Block structure can be discerned prior to inline parsing and
  takes priority."** Block parsing is officially non-backtracking
  ("Blocks can be parsed line by line with no backtracking"). That
  gives us license to be more aggressive about block-side pruning
  than the current code is.
- **"Paragraphs can never be interrupted by other block-level
  elements."** Markdown's `paragraph_interrupt_symbols` array (and
  the recursive `scan()` call it gates) has no analogue we need —
  the rule itself doesn't apply.
- **Verbatim doesn't nest.** Already exploited via
  `parse_verbatim_content`; nothing to add.

## Re-evaluated optimization candidates

Ranked by payoff/difficulty after the spec cross-reference. Items
crossed out are dropped because they don't apply to djot.

### Worth doing

#### ~~A. STATE_MATCHING two-mode block scan~~ — closed without implementing

**Investigation result:** the optimization is real but the per-scan
op savings are bounded (~10-20 ops per scan), and on m.dj's ~50K
scanner invocations that's well within run-to-run noise on the
~150 ms wall time.

What I found when actually digging in:
- The valid_symbols-gated calls (`parse_indented_content_spacer`,
  `parse_list_item_continuation`, etc.) are already individually
  cheap when their tokens aren't valid — each is a single load + a
  branch. The "many sequential calls" view overstated the cost.
- `parse_block_quote` and `parse_heading` already early-out internally
  when none of their relevant valid_symbols are set, so the
  function-call cost on text bytes is dominated by the early bail.
- The bigger restructuring (`parse_block_quote` → `match_block_quote` +
  `open_block_quote`) would touch ordering dependencies the file
  itself flags as fragile (`scanner.c:3568`), with high regression risk
  and no measurable upside on the metric we care about.

**If we revisit:** the right entry point is item L (non-backtracking
investigation). If the spec's claim holds for djot, the work would
be cleaner because we could drop GLR-driven speculative paths
entirely, not just reorganize them. That's a separate, larger
project.

#### B. Block-stack memcpy serialize

**Difficulty:** trivial. **Payoff:** small but free.

Djot's `Block` is `{uint8_t type, uint8_t data}` — 2 bytes, fixed
layout. The current serialize does a per-block loop:

```c
buffer[size++] = (char)b->type;
buffer[size++] = (char)b->data;
```

Markdown does `memcpy(&buffer[size], items, count * sizeof(Block))`.
For djot the layout is compatible; should be a one-line change.
Symmetric on deserialize.

GLR forks pay this serialize cost on every fork-restore, so even
small savings compound across speculative parses.

#### C. is_punctuation lookup table (inline scanner side)

**Difficulty:** trivial. **Payoff:** small.

Djot doesn't *use* `is_punctuation` because it has no flanking rules,
but it does have several similar `isalnum`/character-class checks in
`parse_open_curly_bracket`, `scan_identifier`, etc. A cached
256-byte lookup table for the common inline-marker / identifier-start
character classes would replace branch-heavy `isalnum` calls.

Same shape as the `inline_marker_table` we already added in #3 last
round.

#### D. Inline-marker bitset for fast text-byte rejection

**Difficulty:** low. **Payoff:** small-medium.

Djot's inline scanner is invoked between every parser-internal token,
which is roughly every text byte. Most bytes are content (no marker).
We already short-circuit `parse_span` (last round's #2), but the main
dispatcher still:
- Computes `is_newline = lexer->lookahead == '\n'`
- Calls `consume_whitespace` if at column 0
- Goes through ~10 valid-symbol-gated calls
- Hits the lookahead switch
- Falls through to `parse_span` × 10 (now mostly fast-bailing)

For the common case "lookahead is a non-marker, non-whitespace text
byte", we could check a single 256-byte bool table to bail right
after the early pre-switch checks. Build `is_inline_active_char[]`
at static-init time as the union of all `inline_marker_table`
values plus `\\`, `\n`, `\r`, ` `, `\t`, `[`, `]`, `(`, `)`, `{`,
`}`, `<`, `>`, `$`, `\``. If lookahead isn't in that set and
neither newline nor block-mode work is needed, we can return false
immediately.

Risk: easy to get the set wrong; needs full test pass. But it's a
single-table-lookup gate in front of a lot of conditional logic.

#### ~~E. Cache `lexer->get_column(lexer)` more aggressively~~

Closed on inspection: only 2 calls remain after last round's #5, one
in the scan prologue (column-0 gate) and one in `parse_newline`
(records column-of-newline). They query different points in time and
can't be coalesced into one cached value without restructuring the
control flow more invasively than the gain would justify.

### Not applicable to djot

#### ~~F. Pre-scan delimiter run + replay decision~~ (was #2 above)

Markdown amortizes the open/close decision across `***...***` runs.
Djot has no such runs — `*`, `_`, `^`, `~`, `=`, `+`, `-` are each
single-char single-element delimiters; consecutive same chars are
either the same element opening twice (nested) or two distinct elements
attempting to open. No shared decision to amortize.

The deferred problem from last round's #6 (memoize
`scan_for_same_line_close`) is a *line-level* memoization, not a
run-level one — different shape, same conclusion: still hard to do
without per-position invalidation.

#### ~~G. LAST_TOKEN_WHITESPACE / LAST_TOKEN_PUNCTUATION grammar tokens~~ (was #3 above)

Markdown needs prev-token punctuation context for flanking rules.
Djot's open/close rule is just "not directly preceded/followed by
whitespace" — already covered by
`STATE_AFTER_NON_WHITESPACE_CHECK`. Nothing to gain by moving that
flag from scanner state to grammar tokens.

#### ~~H. Encode block sub-state in the Block enum~~

Markdown uses `LIST_ITEM_1_INDENTATION` … `LIST_ITEM_14_INDENTATION`
to compress block + indent into one byte. Djot's `Block` is already
2 bytes (`{type, data}`); item B (`memcpy` serialize) captures the
same compactness goal without enum bloat. Skip.

#### ~~I. Programmatic rule generation (`add_inline_rules`)~~

Markdown's pattern is: generate `_inline_element_no_star`,
`_inline_element_no_underscore`, etc. so emphasis content can
structurally exclude unmatched delimiters. This lets markdown use
static `prec` for emphasis/strong instead of `prec.dynamic`.

Djot's spec rule is "first opener that gets closed wins" — a
genuinely runtime decision. We can't structurally encode it; the
`prec.dynamic` is doing real work. Last round's #10 confirmed this
empirically (failed on `[](y)`). Skip.

#### ~~J. `simulate` mode for stateless lookahead~~

Markdown uses this for soft-line-break decisions ("would a new block
open across this newline?"). Djot has no equivalent feature —
`mark_end()` advance-and-rewind handles our needs. Park unless we
add a feature that requires it.

#### ~~K. paragraph_interrupt_symbols recursive scan~~

Markdown allows certain blocks to interrupt paragraphs (setext
headings, list markers, etc.) and uses a restricted `scan()` to
detect those interruption points. Djot spec: "Paragraphs can never
be interrupted by other block-level elements." The whole machinery
is unnecessary. (Not even an item to apply or skip — simply doesn't
exist in djot.)

## Outcomes (what shipped this round)

- **B**: shipped (commit). Bulk memcpy for `open_blocks` /
  `open_inline` (de)serialize. Within noise on synchronous parse
  metrics; helps GLR fork-restore which isn't isolated by the
  benchmark.
- **C**: shipped. 256-byte `is_identifier_char` table replacing
  libc `isalnum() || c=='_' || c=='-'` in `scan_identifier` and the
  `parse_open_curly_bracket` fast-path. Within noise.
- **D**: shipped. Top-level `inline_active_byte_table` gate around
  the `parse_span` × 10 chain — skips the whole chain on plain text
  bytes when no begin token is valid. Within noise on m.dj
  specifically (begin tokens are usually valid in inline-heavy
  content), but the gate has the right shape.
- **E**: closed without changes — only 2 needed `get_column` calls
  remain after last round's #5.
- **A**: closed without changes — see entry above. Real STATE_MATCHING
  work is below noise without going further (item L).

## Next entry point

**L (non-backtracking investigation)** is the next move, not another
round of micro-optimizations. The smaller wins are exhausted; the
remaining headroom needs an architectural answer to "do block
decisions need GLR at all?"

## Speculative — investigate before committing

### L. Non-backtracking block parser

**Spec backing:** "Blocks can be parsed line by line with no backtracking."

This is stronger than the STATE_MATCHING split (item A) — it says
block-level decisions are *deterministic* given the line and the
current open-block stack. If true in practice for djot, the block
side could in principle be implemented as a simple LL/state-machine
walk that never asks tree-sitter's GLR to fork.

What that would mean concretely:
- Block-opening symbols could be emitted with no `prec.dynamic`,
  no conflicts list, no fallback paths.
- The scanner could commit decisions immediately rather than relying
  on the parser to prune later.
- GLR fork-restore cost on block transitions would drop to near-zero.

Open questions to investigate before any work:
- Does *any* block construct in the current grammar use
  `prec.dynamic` or live in a `conflicts` entry? List the offenders
  if so.
- Are there cases where the same line could legitimately open more
  than one block type (e.g., setext heading vs paragraph
  continuation in markdown — does djot have an analogue)?
- The current scanner already does some speculative work (e.g.,
  `scan_ordered_list_marker_token` walks alphanumeric runs). Are
  any of those walks needed because the parser explores alternatives
  that the spec actually forbids?

This is investigation, not implementation. If the spec's claim
holds, the payoff could be substantial; if it doesn't, the cost
of finding out is bounded (a grep-and-read pass over the grammar).
Worth running before A so the result can inform A's design.

## Notes

- After every change: `tree-sitter test` must pass all 382 tests,
  and `m.dj` wall time must not regress.
- The markdown comparison should be re-run after item A to see
  whether the gap to ~86 ms (markdown sequential upper bound)
  closes meaningfully.
- Multi-line emphasis inside lists currently falls back to plain
  text (carry-over from earlier rework). Acceptable trade; a
  more precise gate would be a separate correctness improvement.
