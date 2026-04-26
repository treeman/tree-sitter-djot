# Performance TODO — honest state after audit

## What actually shipped on this branch

After auditing every "optimization" commit, only those with measurable
runtime or binary impact were kept. Optimizations that were
within-noise but added complexity (extra static tables, scanner-state
fields, control-flow branches) were reverted as dead weight.

### Kept

| Commit | Win |
|---|---|
| `9549fb5` Gate `scan_ordered_list_marker_token` on `valid_symbols` | m.dj 159→148 ms (~7%); test suite 1345→1613 b/ms |
| `fa161f6` Lookahead early-out in `parse_span` end-only path | Test suite 1728→1943 b/ms (+12%) |
| `1ed5467` Collapse 18 marker-styled list rules into one | parser.c 97k→80k LOC (−17%), 3.5MB→2.7MB |
| `8dc34f5` Drop redundant `get_column` call | One fewer indirect call per scan; cleaner |
| `11cace7` Fold lookahead-gated handlers into the dispatch switch | Cleaner organization (chars-in-switch matches reality) |

### Reverted (audit pass)

These all measured within run-to-run noise on both m.dj wall time and
test suite throughput, while adding source complexity:

| Reverted commit | Why removed |
|---|---|
| `bb6c424` Replace `inline_*` switches with lookup tables | Compiler had already optimized the switches; tables added 67 lines for no measurable gain |
| `b4ddb6b` Cache `list_open_count` | `find_list` iteration was already cheap (~3 elements typical); added a Scanner field, push/pop maintenance, deserialize rebuild |
| `54d3b1b` Replace `is_list`/`is_alpha_list` with tables | Compiler already emitted jump tables for these contiguous switches |
| `7dcaeda` Fast-path bail in `parse_open_curly_bracket` | Rarely fires on real djot content (most `{` chars are valid attribute starts); 26 lines for nothing |
| `48e6c72` Bulk memcpy serialize | Within noise even on GLR-fork-heavy parses; depended on b4ddb6b |
| `fe5701f` Identifier-char lookup table | `isalnum + 2 compares` was already fast; 30-line table for nothing |
| `c6da424` Top-level gate around `parse_span` chain | parse_span already short-circuits internally (per `fa161f6`); the outer gate was redundant |

The #10 (lower `prec.dynamic` to `prec` for `_image`/`_link`) attempt
was also reverted in-place earlier — see commit `04e82b6` — because
static precedence broke the empty-link `[](y)` case.

### Honest scoreboard

- m.dj wall time: ~150 ms (vs master's ~200 ms — the wins are
  `9549fb5` ordered-marker gate, `fa161f6` parse_span early-out, and
  the small collapse-driven cache effects).
- parser.c: 80k LOC, 2.7 MB (vs master's 94k LOC, 3.3 MB). Driven
  almost entirely by the list-rules collapse.
- Test suite: ~1850 b/ms (vs master's ~1600 b/ms).
- vs markdown pair (sequential upper bound 86 ms on equivalent input):
  djot is still ~1.7× slower per byte. Architectural change needed
  to close this further.

## L investigation — outcome: don't bother

The conjecture: if blocks really are line-by-line with no
backtracking, removing GLR-driven block paths is the next big win.

What I actually found:

### Grammar audit (grep `prec.dynamic` + `conflicts`)

- **12 `prec.dynamic` uses, ALL inline.** Lines 456–465 cover the 10
  inline elements (emphasis, strong, highlighted, sup/sub, insert,
  delete, footnote_reference, _image, _link). Line 483 is
  inline_attribute. Line 655 is span end-marker. Zero block rules
  use `prec.dynamic`.
- **13 `conflicts` entries, all inline-side.** Even `block_math` and
  `inline_math` conflict only with `_symbol_fallback`, which is the
  inline-level "this looks like a marker but is plain text"
  collector. The GLR fork is for the *inline* interpretation, not
  the block.

So the block side of the djot grammar is **already** GLR-free.
There's nothing to remove that would give a free win.

### Reference impl audit (djot.lua)

The spec's "blocks can be parsed line by line with no backtracking"
is **aspirational, not strict**. The reference `djot.lua` block
parser explicitly backtracks in at least two places:

- **Tables**: opens a table container, tries to parse the first row,
  removes the container if `parse_table_row` fails.
- **Block attributes**: speculatively feeds `{...}` content to an
  attribute parser, abandons the attempt if parsing fails.

So even the reference implementation's block side does what we'd
have to do anyway for djot's actual syntax.

### Scanner-side speculation that remains

The block-level speculative work that's still in our scanner is the
same shape as the reference impl's:

- `scan_ordered_list_marker_token` walks alphanumeric runs to
  distinguish roman numerals (`iii)`) from decimal (`3)`) from
  alpha (`c)`). This is inherent to djot's syntax — there's no
  shorter lookahead that decides. We already gate the call on
  `valid_symbols` (commit `9549fb5`) so it only fires when relevant.
- `parse_open_curly_bracket` walks `{...}` content to validate the
  attribute body. Same story — inherent to the syntax.

These can't be removed because they reflect genuine syntactic
requirements of djot, mirrored exactly in the reference impl.

### What this means for further work

The block-side optimization angle is closed. The next-percentage
gain on m.dj wall time would have to come from one of:

1. **Inline-side GLR reduction.** The 12 `prec.dynamic` uses + 13
   conflicts are all inline. A grammar restructure that lets us drop
   even some of these would reduce GLR fork-restore cost. Last
   round's #10 attempt failed empirically (`[](y)`); a more careful
   approach would need the markdown-style `_inline_element_no_X`
   rule generation pattern, which has its own cost.

2. **Inline-scanner-main per-scan overhead.** The inline scanner is
   invoked between every parser-internal token. Every saved
   per-scan op compounds, but our previous round of per-scan
   optimizations (B/C/D/E/A) all measured within noise. The signal
   is below the floor without a fundamental restructuring.

3. **Architectural split (#1).** Off the table per user direction.

None of these are quick wins. The branch is in a good spot to
land as-is.

## Notes

- `m.md` is checked in as the markdown-comparison input, generated
  from `m.dj` by stripping djot-only `{...}` attribute syntax.
- After every change: `tree-sitter test` must pass all 382 tests,
  and `m.dj` wall time must not regress.
- Multi-line emphasis inside lists falls back to plain text
  (carry-over from `fa161f6`'s area). Acceptable trade; a precise
  gate would be a separate correctness improvement.
