# Scanner + grammar optimization TODO

Baseline (2026-04-26, branch `inline-scanner-rework`): m.dj parses ~150-170 ms (~1.5KB/ms).

## Done

- [x] Fix `mark_span_begin` same-line gate blocking IN_FALLBACK path (commit `65fd2f2`)
- [x] Pin precedence for `*not strong *strong*` with position-aware `:cst` test (commit `df3e042`)
- [x] **#1** Gate `scan_ordered_list_marker_token` on `valid_symbols` (commit `9549fb5`) — m.dj 159→148 ms (~7%); test suite avg 1345→1613 bytes/ms
- [x] **#2** Lookahead early-out in `parse_span` — restricted to the end-only path (begin tokens fire after the opener is already consumed, so lookahead is arbitrary on begin). Test suite 1728→1943 bytes/ms (+12%); m.dj wall time unchanged (~140 ms — m.dj is begin-token heavy).
- [x] **#3** Replaced `inline_*` switches with `static const` lookup tables. Within run-to-run noise (~1900 bytes/ms test suite); the compiler had already optimized the switches. Cleaner code; no regression.
- [x] **#4** Folded `parse_comment_end` (`%`/`}`) and `parse_square_bracket_span_text_close` (`]`) into the lookahead switch. `parse_block_quote`/`parse_heading` couldn't move — both do work for arbitrary lookahead (block-close paths). Within noise (~1950 bytes/ms test suite, m.dj ~2240 bytes/ms); cleaner, no regression.

## Remaining

### High impact, low risk

### Medium impact

- [ ] **#4** Reorder dispatch: push `switch (lookahead)` earlier in main `tree_sitter_djot_external_scanner_scan` (lines 3406-3580). Currently ~20 sequential `if (valid_symbols[X] && parse_X())` calls before the lookahead switch. Move the rest into the switch.

- [ ] **#5** Cache `lexer->get_column(lexer)` at `scanner.c:3425, 3427` — called twice in prologue.

- [ ] **#6** Hoist `find_list(s)` out of `mark_span_begin`'s same-line gate. Currently O(line) lookahead per emphasis/strong opener whenever any list is open. Either set a `s->state` "inside list" flag, or memoize "same-line close found for char `c`" cleared on newline.

### Smaller wins / harder calls

- [ ] **#7** Lookup tables for `is_list`, `list_marker_to_block`, `is_alpha_list` — same shape as #3.

- [ ] **#8** Grammar shrink: collapse 19 list rules at `grammar.js:97-359`. Generates large LR table (parser.c is 97k LOC). Risk: moderate; needs GLR conflict verification. Distinguishing block type can move into scanner.

- [ ] **#9** Fast-path `parse_open_curly_bracket` at `scanner.c:2275` — bail early if char after `{` is not `[%a-zA-Z._#]`.

- [ ] **#10** Lower `prec.dynamic` to `prec` for `_image`/`_link` in `_inline_element` (`grammar.js:620`) now that scanner-side gates exist. Reduces GLR branching.

## Notes

- After every change: `tree-sitter test` must pass all (currently 382), and time `m.dj` to confirm no regression.
- Multi-line emphasis inside lists currently falls back to plain text (won't render as emphasis). Acceptable trade — the only alternative was the parser erroring. A more precise gate (e.g. only refuse opener if next line starts with a list marker) would be a separate correctness improvement.
