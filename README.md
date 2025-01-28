# tree-sitter-djot

This is an experimental [Tree-sitter][] grammar for [Djot][].

# Features

Aims to be fully feature complete with the [Djot specification][] with a few extra features:


- Parses an optional frontmatter at the very start of the file, e.g:

  ````
  ---toml
  tag = "Some value"
  ---
  ````

- Parses tight sublists.

  Normally in Djot you need to surround a list inside a list with spaces:

  ```
  - List

    - Another
    - list
  ```

  This grammar doesn't require a space and recognizes this as a sublist:

  ```
  - List
    - Another
    - list
   ```

- Parses standalone `TODO`, `NOTE` and `FIXME`.

[Tree-sitter]: https://tree-sitter.github.io/tree-sitter/
[Djot]: https://djot.net/
[Djot specification]: https://htmlpreview.github.io/?https://github.com/jgm/djot/blob/master/doc/syntax.html
