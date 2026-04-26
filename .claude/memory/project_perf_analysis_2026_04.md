---
name: Scanner+grammar perf analysis (2026-04-26)
description: Ranked optimization opportunities found during analysis on branch inline-scanner-rework. Baseline ~1.5KB/ms on m.dj.
type: project
originSessionId: 47abc584-c751-42e9-b513-b152f6a1bf84
---
Baseline (2026-04-26, branch `inline-scanner-rework`): parsing m.dj (244KB) takes ~150-170ms (~1.5KB/ms). Slow for tree-sitter.

**Why:** User asked for further optimization opportunities after recent perf work (commits `669f3eb`, `f47d7a9`, `385e7e0`, `260729d`).
**How to apply:** Tackle in this order — items 1-3 are mechanical and isolated; benchmark each as separate commit.

### Ranked opportunities

1. **Gate `scan_ordered_list_marker_token`** at `scanner.c:3642`. Called unconditionally near end of every dispatch even when no list marker token is in `valid_symbols`. Add a guard checking `LIST_MARKER_DECIMAL_PERIOD…LIST_MARKER_UPPER_ROMAN_PARENS` or `BLOCK_CLOSE`. Probably the biggest single win for paragraph-heavy docs.

2. **Lookahead early-out in `parse_span`** at `scanner.c:3377` (called 10× per scan). Add `if (lexer->lookahead != inline_marker(element) && lexer->lookahead != '{') return false;` before the switch lookups. Kills 9 of 10 calls outright on a typical text byte.

3. **Replace `inline_*` switches with `static const` lookup tables** — `inline_marker`, `inline_begin_token`, `inline_end_token`, `inline_span_type` (lines 2593-2698). Indexed by `InlineType` enum. Called from inside hot loops (`scan_until`, `consume_if_span_end_marker`, every `parse_span`).

4. **Reorder dispatch: push `switch (lookahead)` earlier** in main `tree_sitter_djot_external_scanner_scan` (lines 3406-3580). Currently ~20 sequential `if (valid_symbols[X] && parse_X())` calls before the lookahead switch. Move the rest into the switch.

5. **Cache `lexer->get_column(lexer)`** at `scanner.c:3425, 3427` — called twice in prologue.

6. **Hoist `find_list(s)` out of `mark_span_begin`'s same-line gate** — currently O(line) lookahead per emphasis/strong opener whenever any list is open. Either set a `s->state` "inside list" flag, or memoize "same-line close found for char `c`" cleared on newline.

7. **Lookup tables for `is_list`, `list_marker_to_block`, `is_alpha_list`** — same shape as #3.

8. **Grammar shrink: collapse 19 list rules** at `grammar.js:97-359`. Generates large LR table (parser.c is 97k LOC). Risk: moderate; needs GLR conflict verification. Distinguishing block type can move into scanner.

9. **Fast-path `parse_open_curly_bracket`** at `scanner.c:2275` — bail early if char after `{` is not `[%a-zA-Z._#]`.

10. **Lower `prec.dynamic` to `prec`** for `_image`/`_link` in `_inline_element` (`grammar.js:620`) now that scanner-side gates exist. Reduces GLR branching.
