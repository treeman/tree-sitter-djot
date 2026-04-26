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

## Next entry point: L (non-backtracking block parser investigation)

**Spec backing:** "Blocks can be parsed line by line with no
backtracking."

If the spec's claim holds for djot's grammar as it stands, the next
real-percentage win comes from removing GLR-driven speculative
*block* paths outright — not from rearranging which functions check
which valid_symbols when.

This is investigation, not a code change yet. Tasks:

1. Inventory every `prec.dynamic` and every `conflicts` entry in
   `grammar.js`. Categorize each as block-related or inline-related.
2. Inventory speculative scanner work that exists because the parser
   explores multiple block alternatives (e.g.,
   `scan_ordered_list_marker_token` walks alphanumeric runs even
   though the spec says block decisions are deterministic).
3. Read the djot reference implementation (`jgm/djot.lua`) to see
   how its block parser handles ambiguity. If it uses backtracking
   anywhere, the spec's claim has caveats we need to know.
4. Identify the concrete cases where the current grammar/scanner
   *needs* GLR for blocks. If the list is short, a follow-up branch
   could reshape those specific cases and drop the rest.

This is bounded research — a grep-and-read pass plus a look at
djot.lua. No commits expected from L itself; output is a written
finding that informs whatever the next code change is.

## Notes

- `m.md` is checked in as the markdown-comparison input, generated
  from `m.dj` by stripping djot-only `{...}` attribute syntax.
- After every change: `tree-sitter test` must pass all 382 tests,
  and `m.dj` wall time must not regress.
- Multi-line emphasis inside lists falls back to plain text
  (carry-over from `fa161f6`'s area). Acceptable trade; a precise
  gate would be a separate correctness improvement.
