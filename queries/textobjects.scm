; Classes, the highest level
(thematic_break) @class.outer
(heading1 (content) @class.inner) @class.outer
(heading2 (content) @class.inner) @class.outer
(heading3 (content) @class.inner) @class.outer
(heading4 (content) @class.inner) @class.outer
(heading5 (content) @class.inner) @class.outer
(heading6 (content) @class.inner) @class.outer

; Functions, the next level
(div (content) @function.inner) @function.outer
(block_quote (content) @function.inner) @function.outer
(code_block (code) @function.inner) @function.outer
(raw_block (content) @function.inner) @function.outer
; Inner selects current list item, outer selects whole list
; TODO I want a way to select list item content, without the marker
(list (_) @function.inner) @function.outer
; Inner selects row, outer selects whole table
(table (_) @function.inner) @function.outer
(footnote (footnote_content) @function.inner) @function.outer

; Blocks
(paragraph) @block.inner

; Attributes
(block_attribute (args) @attribute.inner) @attribute.outer
(inline_attribute (args) @attribute.inner) @attribute.outer
(table_caption (content) @attribute.inner) @attribute.outer

; Parameters
[
 (class_name)
 (class)
 (identifier)
 (key_value)
 (language)
] @parameter.outer

[
 (key)
 (value)
] @parameter.inner

[
 (table_cell_alignment)
 (table_cell)
] @parameter.inner

; Statements
(link_reference_definition (_) @statement.inner) @statement.outer

; Comments
(comment (content) @comment.inner) @comment.outer
