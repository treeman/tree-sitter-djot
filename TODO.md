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

#### A. STATE_MATCHING two-mode block scan

**Difficulty:** medium-high. **Payoff:** medium-high (this is the
biggest remaining one given #1 is off the table).

Markdown's block scanner has two distinct modes:
- **Matching mode**: re-consume continuation markers for already-open
  blocks (e.g., `> ` for an open block_quote, indent for an open list
  item). One block per call until matched count == open_blocks size.
- **Scanning mode**: dispatch on lookahead to open new blocks.

Djot blends these. `parse_block_quote` handles both opening a new
block quote and continuing one; `close_list_nested_block_if_needed`
runs unconditionally early; the lookahead switch comes after several
valid-symbol-gated calls that are only meaningful in one mode.

Splitting the modes would:
- Let the lookahead switch be the **primary** dispatcher (markdown
  does this; we still have ~10 pre-switch calls).
- Eliminate per-call lookahead checks inside continuation handlers
  (they'd run only in matching mode).
- Make the soft-line-break-vs-block-close decision local to one mode.

Spec backing: "Blocks can be parsed line by line with no backtracking"
gives us the license — block decisions don't need GLR exploration, so
the two-mode split won't fight tree-sitter.

**Implementation sketch:**
1. Add `STATE_MATCHING` flag and `s->matched` counter.
2. Refactor `parse_block_quote` / `parse_list_item_continuation` /
   `parse_indented_content_spacer` into `match_X` functions called
   only from matching mode.
3. Move all block-open handlers under the lookahead switch.
4. Reset `matched` and re-enter matching mode on `LINE_ENDING`.

**Risk:** moderate. Block-level ordering dependencies are real
(close_list_nested_block, list_item_end, block_quote interactions).
Needs careful tests.

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

#### E. Cache `lexer->get_column(lexer)` more aggressively

**Difficulty:** low. **Payoff:** small.

Last round's #5 dropped one redundant `get_column` call. There are
several more sites in the scanner that call it inside loops or
across function boundaries. A single call at the top of
`tree_sitter_djot_external_scanner_scan` stored in a local could
replace 4–5 calls in the prologue and early dispatchers. `get_column`
is a virtual-function-style indirect call; it isn't free.

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

## Recommended order

1. **B (memcpy serialize)** — trivial, free win. Do first.
2. **E (cache get_column)** — trivial, small win.
3. **C (is_punctuation table)** + **D (inline-marker bitset)** —
   small but compounding; same shape, do together.
4. **A (STATE_MATCHING)** — the actual project. Do last because the
   smaller wins above don't depend on it and the test surface for A
   is large.

Items B/C/D/E are within-noise individually but together should
give a measurable bump. A is where the next real-percentage win is
likely to come from given #1 is off the table.

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
