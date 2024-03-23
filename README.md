# tree-sitter-djot

This is an experimental [Tree-sitter][] grammar for [Djot][].

# Features

Aims to be fully feature complete with the [Djot specification][]:

- [x] Inline syntax
    - [x] Links
    - [x] Image
    - [x] Autolink
    - [x] Verbatim
    - [x] Emphasis/strong
    - [x] Highlighted
    - [x] Super/subscript
    - [x] Insert/delete
    - [x] Smart punctuation
    - [x] Math
    - [x] Footnote reference
    - [x] Line break
    - [x] Comment
    - [x] Symbols
    - [x] Raw inline
    - [x] Span
    - [x] Inline attributes
- [x] Block syntax
    - [x] Paragraph
    - [x] Heading
    - [x] Block quote
    - [x] List item with the different marker types
    - [x] List
    - [x] Code block
    - [x] Thematic break
    - [x] Raw block
    - [x] Div
    - [x] Pipe table
    - [x] Reference link definition
    - [x] Footnote
    - [x] Block attribute

Also contains some extra features not included in the Djot standard:

- Parses an optional frontmatter at the very start of the file, e.g:

  ````
  ---toml
  tag = "Some value"
  ---
  ````

- Highlights standalone `TODO`, `NOTE` and `FIXME`.

[Tree-sitter]: https://tree-sitter.github.io/tree-sitter/
[Djot]: https://djot.net/
[Djot specification]: https://htmlpreview.github.io/?https://github.com/jgm/djot/blob/master/doc/syntax.html
