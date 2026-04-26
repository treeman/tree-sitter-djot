---
name: Nested-bracket inline precedence bug
description: All five-step fix done — image+bracket gating + GLR tie-break fix + bracketed-vs-single peek + fallback-bracket pairing on branch inline-scanner-rework, commits eb30e6a/1186a09/e1b0603/2d8e81c/0953a20; only 1 red left (374 unrelated list/blockquote); failing test suite under "Nested precedence" prefix in test/corpus/syntax.txt
type: project
originSessionId: be1428a4-e673-4908-b556-8ec5828f23ce
---

Originally: inputs like `![[a](bc)](a_b_c)` parse as `inline_link [a](bc) + emphasis _b_` instead of as an `inline_image` containing the link. Outer container gets dropped whenever the outer destination/attribute region contains emphasis-bait. Same pattern across image, link, span, all `{X..X}` bracketed forms, plain emphasis/strong as outer wrappers.

**Root cause:** Both interpretations survive to the end of input (verified via `tree-sitter parse -d normal`). Fallback wins at `condense` because tree-sitter's GLR dynamic precedence is per-conflict-point, not summed across the tree, and the shallow `inline_link + emphasis` tree ties or beats the deeper `inline_image{ inline_link }` tree.

**Direction:** Single-package fix — user rejected splitting into djot + djot-inline parsers. Implement two-pass-equivalent inline parsing inside the existing external scanner. Each bracketed/delimited container's start token gets gated by a scanner-side validator that does balanced-delimiter lookahead and rejects the open if the structure isn't well-formed end-to-end, or if an enclosing element's end marker would close inside the candidate region (preserves "shorter element wins" precedence). Emphasis stays GLR-driven.

**Test surface** is in `test/corpus/syntax.txt` under the `Nested precedence` prefix — see for the failure/regression pinning grid. Section right after `Image: fallback`.

## Current status (branch `inline-scanner-rework`)

**Step 1 done** — commit `eb30e6a`. Added external token `_image_open_check` (zero-width gate) required after `_image_description_begin` in `image_description`. Scanner's `parse_image_open_check` (in src/scanner.c near `update_square_bracket_lookahead_states`) does balanced-`[]` lookahead, then validates a `(...)` / `[ref]` / `[]` tail, with a `top` parameter passed through `scan_balanced_close_bracket` and `scan_link_destination_or_label` to abort on enclosing-span end markers. Removed the now-dead `[$._image_description_begin, $._symbol_fallback]` conflict.

Test movement: 350→366 passing (out of 374). 16 fixes:
- All 8 image-as-outer Nested-precedence tests
- All 7 `{X..X}` bracketed wrappers around link-wrapping-image
- Strong-wrapping-link-wrapping-image

1 regression: `Image: inline precedence 2` (`*![*](y)`). When the parser forks at `*` (strong-open vs fallback), the no-strong branch validates image cleanly (top=NULL) and tree-sitter's GLR tie-break picks that branch over the strong-then-fallback branch. Old behavior preferred strong via "earliest-close" tie-break. Suspected cause: the extra zero-width gate token in the parse stream changed when reductions happen and disrupted the tie-break ordering. Other 5 of 6 image-precedence tests still pass — only the single-`(y)` form is broken.

**Step 2 done** — commit `1186a09`. Added external token `_bracketed_text_open_check` (zero-width gate) required after `_bracketed_text_begin` in `link_text` and `span`. Scanner's `parse_bracketed_text_open_check` mirrors `parse_image_open_check` but accepts `{attr}` as a fourth trailing form. Removed the now-dead `[$._bracketed_text_begin, $._symbol_fallback]` conflict. Also reordered `scan_until` to check the target char before the span-end-marker, so `]` in a `[ref]` label scanned inside a SQUARE_BRACKET_SPAN top reads as the label-close (target), not the outer span-end. Fixed 214/215/216/217/218/222 (+6) but regressed 240/307/332/334 (−4) via GLR tie-break breaks (now resolved in Step 3).

**Step 5 done** — commit `0953a20`. Fixed test 220 (`![[a]](abc)`) plus latent breakages like `[[a [b] c](u)]{.d}` (deep nested fallback brackets). Added external token `_square_bracket_span_text_close` that consumes `]` and decrements `find_inline(SQUARE_BRACKET_SPAN)->data`. Wired into `_symbol_fallback` choice. Emits when there's an open SQUARE_BRACKET_SPAN with `data > 0` and lookahead is `]`; otherwise declines so the existing SQUARE_BRACKET_SPAN_END / `_text_token1` paths handle the `]`. Each fallback `[` increment is now matched by exactly one fallback `]` decrement, so the outer span's close lands at the actual unmatched `]`. Reason for the new token rather than a fix in `parse_span_end`: tree-sitter rolls back any state mutation made on `return false` (state restored from previous serialize checkpoint, verified via `fprintf` instrumentation). Returning `true` from emission causes serialize to commit. Test movement: 372→373/375.

**Step 4 done** — commit `2d8e81c`. Fixed test 240 (`{_[a](u_v_w)_}`). Added `bracketed` field to the `Inline` struct (round-tripped through serialize/deserialize). `mark_span_begin` sets it based on `STATE_AFTER_NON_WHITESPACE_CHECK` for EMPHASIS/STRONG (single form always preceded by `_non_whitespace_check`, so absence implies `{_`/`{*`); SpanBracketed types get bracketed=1 unconditionally; SUPERSCRIPT/SUBSCRIPT stay at 0 (no nws_check distinguisher; latent peek over-aggressiveness for their bracketed form remains but no failing test). Refactored scan helpers (`scan_until`/`scan_balanced_close_bracket`/`scan_link_destination_or_label`/`scan_bracketed_text_trailer`) to take `const Inline *` instead of `InlineType *`, and replaced `peek_span_end_marker` with `consume_if_span_end_marker` which advances past the marker char when a trailing `}` check is needed and signals "consumed but not real close" via an out param. Synthetic-top construction in `parse_bracketed_text_open_check` and `update_square_bracket_lookahead_states` now builds a stack-allocated `Inline` with bracketed=0. Test movement: 371→372/374.

**Step 3 done** — commit `e1b0603`. Fixed all four GLR tie-break regressions (195/307/332/334). Two-part fix in scanner.c:

*Part A — speculative-opener tracking.* When tree-sitter forks at `*[`/`_[`/etc., `mark_span_begin` for the opener mark_begin gets `IN_FALLBACK` valid (both forks live), so it doesn't push to `open_inline`. The bracketed gate that fires at the inner `[` therefore sees `top=NULL` even in the fork that's *inside* the speculative emphasis/strong, and validates the link/span as if there were no enclosing — making the no-opener-fork's link decisively reduce and win the tie-break against the opener fork. New per-scanner field `pending_inline_open_before_bracket` (a marker char `*`/`_`/`^`/`~`) is set in `mark_span_begin` when the previous emission was `_non_whitespace_check` (which only appears in the single-char form of emphasis/strong's opener) AND lookahead is `[`. The gate and `update_square_bracket_lookahead_states` synthesize a `top` from this marker when no real top is on the stack, so both forks now correctly reject the link region containing the marker. Cleared by the gate on success and by `update_square_bracket_lookahead_states` after read; otherwise persists across calls (overwritten by next opener emission).

*Part B — non-destructive span-end peek.* The original `scan_span_end_marker` advances the lexer when matching (because it shares logic with the actual close-token consumer). Within a single dispatch, that meant: gate runs, advances past the marker, returns false; then the fallback path's `update_square_bracket_lookahead_states` runs from the post-advance position and reaches wrong conclusions about the bracket region (e.g. for `*[*](y)` it would skip the `*` and find `]` immediately, treating `[*]` as a valid bracket structure). New helper `peek_span_end_marker` does a single-char lookahead-only check and replaces `scan_span_end_marker` calls inside `scan_until` and `scan_balanced_close_bracket`. Single-char peek is exact for SpanSingle types and sufficient for SpanBracketedAndSingle* (the `_}` form starts with `_`); over-aggressive only for SpanBracketed types (`=}` etc.) when they enclose a `[`, which isn't covered by any current failing test.

Test movement: 367→371 passing (out of 374). All 4 GLR-tie-break regressions fixed, no new regressions.

**Remaining 1 red**:
- 374: `List: Immediate blockquote` — unrelated to inline parsing. There's also user-experimental test 32 (`Block quote: don't continue with only a space and newline`) committed as `51a1ac4` (WIP block-quote exploration); the scanner-side check is currently commented out so the test fails as expected.

User-WIP commit `51a1ac4` is on branch but unrelated to the inline-scanner-rework work; the user can continue or revert it independently.

## Picking up where we left off

Branch is `inline-scanner-rework`, six commits ahead of master (eb30e6a, 1186a09, e1b0603, 2d8e81c, 51a1ac4 [user WIP], 0953a20). Master has not been merged in. All Nested-precedence reds are resolved. Possible next steps:

1. **Merge to master.** Step 1–5 are self-contained and the test movement is clean: 350→373/375 over five commits. Consider squashing or keeping the per-step granularity; commits are well-scoped and reviewable as individual logical changes.

2. **Optional follow-up**: extend Step 4's bracketed-tracking to SUPERSCRIPT/SUBSCRIPT. Currently a latent peek over-aggressiveness exists when `{^...^}` or `{~...~}` encloses a `^`/`~` (e.g. in a URL). No failing test exercises this. Cleanest fix would be to add a separate `STATE_AFTER_BRACKETED_LITERAL` flag set by a scanner emission triggered by the `{` of `{^`/`{~`, but the literal `{^` is currently matched by the internal lexer, not the scanner — would need a grammar change to route through a scanner check.

3. **Unrelated red 374**: `List: Immediate blockquote`. Out of scope for this branch.

Do not propose splitting into djot + djot-inline parsers (see `feedback_single_parser.md`).

## How to verify warnings on scanner.c

`tree-sitter generate` only regenerates `parser.c`; `tree-sitter test` compiles silently. To audit scanner.c with warnings:

```fish
cc -fsyntax-only -Wall -Wextra -Wpedantic -std=c11 -Isrc src/scanner.c
```

Or override Makefile CFLAGS: `make clean && make CFLAGS="-Wall -Wextra -Wpedantic -Werror -std=c11 -fPIC -Isrc"`. The Makefile uses `override CFLAGS += …` so passed-in CFLAGS are merged. `-Wconversion` is noisy with the existing uint8_t arithmetic — treat as one-off audit, not CI.
