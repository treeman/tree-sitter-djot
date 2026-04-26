---
name: Single-parser distribution preferred
description: User rejects splitting tree-sitter-djot into separate djot + djot-inline parsers; wants two-pass semantics inside the existing external scanner instead
type: feedback
originSessionId: be1428a4-e673-4908-b556-8ec5828f23ce
---
Don't propose splitting tree-sitter-djot into a separate block parser + inline parser package, even when a two-pass design would be the cleanest fix.

**Why:** The user finds it annoying for downstream consumers to have to install and manage two grammars/parsers. They know another markdown tree-sitter parser does the two-pass split and explicitly didn't want to follow that path. The empty `tree-sitter-djot-inline/` directory in the repo is a vestige of considering this, not a plan to ship it.

**How to apply:** When solving inline-parsing ambiguity, design fixes that keep the single-package shape — typically by moving more disambiguation logic into the existing external scanner (`src/scanner.c`) so it acts as an embedded inline state machine, rather than relying on grammar.js + GLR conflict resolution to settle inline structure. The scanner is the right place to add balanced-delimiter validation, container-stack matching, and lookahead-driven token-gating; the grammar should shrink toward "compose pre-validated tokens" rather than "enumerate ambiguous productions and hope precedence picks the right one."
