# tree-sitter-djot

A [Djot][] parser for [tree-sitter][].

## Features

Aims to be feature complete with the [Djot specification][].

The parser contains some features outside the [Djot][] standard:

- Parses an optional frontmatter at the very start of the file, e.g:

  ````
  ---toml
  tag = "Some value"
  ---
  ````

- Highlights standalone `TODO`, `NOTE` and `FIXME`.

## Split parser

The parser is split into two grammars that you'll need to install/include:

1. `djot` that parses the block syntax on the top level.
2. `djot_inline` that parses all inline contexts and should be injected into the `inline` nodes from the block level parser.

> [!note]
> `split` is the main branch of this repository and the `master` branch with the old combined parser won't be maintained.

> [!warning]
> The generated language bindings for the split parsers haven't been thoroughly tested.
> If you find a problem please file an issue.

[tree-sitter]: https://tree-sitter.github.io/tree-sitter/
[Djot]: https://djot.net/
[Djot specification]: https://htmlpreview.github.io/?https://github.com/jgm/djot/blob/master/doc/syntax.html
