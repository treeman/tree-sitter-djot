# Scanner + grammar optimization TODO

Baseline (2026-04-26, branch `inline-scanner-rework`): m.dj parses ~150-170 ms (~1.5KB/ms).

## Done

- [x] Fix `mark_span_begin` same-line gate blocking IN_FALLBACK path (commit `65fd2f2`)
- [x] Pin precedence for `*not strong *strong*` with position-aware `:cst` test (commit `df3e042`)
- [x] **#1** Gate `scan_ordered_list_marker_token` on `valid_symbols` (commit `9549fb5`) — m.dj 159→148 ms (~7%); test suite avg 1345→1613 bytes/ms
- [x] **#2** Lookahead early-out in `parse_span` — restricted to the end-only path (begin tokens fire after the opener is already consumed, so lookahead is arbitrary on begin). Test suite 1728→1943 bytes/ms (+12%); m.dj wall time unchanged (~140 ms — m.dj is begin-token heavy).

## Remaining

### High impact, low risk

- [ ] **#3** Replace `inline_*` switches with `static const` lookup tables — `inline_marker`, `inline_begin_token`, `inline_end_token`, `inline_span_type` (lines 2593-2698). Indexed by `InlineType` enum. Called from inside hot loops (`scan_until`, `consume_if_span_end_marker`, every `parse_span`).

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
