(heading1) @markup.heading.1
(heading2) @markup.heading.2
(heading3) @markup.heading.3
(heading4) @markup.heading.4
(heading5) @markup.heading.5
(heading6) @markup.heading.6

(thematic_break) @string.special

[
 (div_marker_begin)
 (div_marker_end)
 ] @punctuation.delimiter

[
  (code_block)
  (raw_block)
] @markup.raw
[
  (code_block_marker_begin)
  (code_block_marker_end)
  (raw_block_marker_begin)
  (raw_block_marker_end)
] @punctuation.delimiter

(language) @tag.attribute
(language_marker) @tag.delimiter
(class_name) @tag.attribute

(block_quote) @markup.quote
(block_quote_marker) @punctuation.special

(table_header) @text.title
(table_header "|" @punctuation.special)
(table_row "|" @punctuation.special)
(table_separator) @punctuation.special
(table_caption (marker) @punctuation.special)
(table_caption) @markup.caption

[
 (list_marker_dash)
 (list_marker_plus)
 (list_marker_star)
 (list_marker_definition)
 (list_marker_decimal_period)
 (list_marker_decimal_paren)
 (list_marker_decimal_parens)
 (list_marker_lower_alpha_period)
 (list_marker_lower_alpha_paren)
 (list_marker_lower_alpha_parens)
 (list_marker_upper_alpha_period)
 (list_marker_upper_alpha_paren)
 (list_marker_upper_alpha_parens)
 (list_marker_lower_roman_period)
 (list_marker_lower_roman_paren)
 (list_marker_lower_roman_parens)
 (list_marker_upper_roman_period)
 (list_marker_upper_roman_paren)
 (list_marker_upper_roman_parens)
] @markup.list

(list_marker_task (unchecked) @constant.builtin) @markup.list.unchecked
(list_marker_task (checked) @constant.builtin) @markup.list.checked
(list_item (term) @define)

[
 (ellipsis)
 (en_dash)
 (em_dash)
 (straight_quote)
 ] @string.special

(emphasis) @markup.italic
(strong) @markup.strong
(emphasis (emphasis_begin) @punctuation.delimiter)
(emphasis (emphasis_end) @punctuation.delimiter)
(strong (strong_begin) @punctuation.delimiter)
(strong (strong_end) @punctuation.delimiter)

; TODO use @markup.highlighted, delete, insert, super, sub instead and add them to our highlighting?
(highlighted) @markup.highlighted
(highlighted ["{=" "=}"] @punctuation.delimiter)

(insert) @markup.insert
(insert ["{+" "+}"] @punctuation.delimiter)

(delete) @markup.delete
(delete ["{-" "-}"] @punctuation.delimiter)

(symbol) @markup.symbol

(superscript) @markup.superscript
(superscript ["^" "{^" "^}"] @punctuation.delimiter)

(subscript) @markup.subscript
(subscript ["~" "{~" "~}"] @punctuation.delimiter)

(verbatim) @markup.raw
[
 (verbatim_marker_begin)
 (verbatim_marker_end)
 ] @punctuation.delimiter

(math) @markup.math
[
 (math_marker)
 (math_marker_begin)
 (math_marker_end)
 ] @punctuation.delimiter

(raw_inline) @markup.raw
[
 (raw_inline_attribute)
 (raw_inline_marker_begin)
 (raw_inline_marker_end)
 ] @punctuation.delimiter

(paragraph) @markup

(span ["[" "]"] @punctuation.bracket)
(inline_attribute ["{" "}"] @punctuation.bracket)
(block_attribute ["{" "}"] @punctuation.bracket)

(comment) @comment
(class) @tag.attribute
(identifier) @tag
(key_value "=" @operator)
(key_value (key) @variable)
(key_value (value) @string)

[
  (backslash_escape)
  (hard_line_break)
] @string.escape

(inline_link_destination ["(" ")"] @punctuation.bracket)
(link_label ["[" "]"] @punctuation.bracket)
(link_text ["[" "]"] @punctuation.bracket)
(collapsed_reference_link "[]" @punctuation.bracket)
(collapsed_reference_image "[]" @punctuation.bracket)
(image_description ["![" "]"] @punctuation.bracket)
(link_reference_definition ["[" "]"] @punctuation.bracket)
(link_reference_definition ":" @punctuation.special)
(autolink ["<" ">"] @punctuation.bracket)

; Not usually how it's done, but this allows us to differentiate
; how to color `text` in [text][myref] and [text][].
(full_reference_link (link_text) @markup.link.label)
(full_reference_link (link_label) @markup.link.reference)
(collapsed_reference_link (link_text) @markup.link.label)
(collapsed_reference_link (link_text) @markup.link.reference)
(inline_link (link_text) @markup.link.label)
(full_reference_image (link_label) @markup.link.reference)
(image_description) @markup.link.label
(link_reference_definition (link_label) @markup.link.definition)

[
  (autolink)
  (inline_link_destination)
  (link_destination)
  (link_reference_definition)
] @markup.link.url

; This always errors out...?
; Should try mark invalid references with @exception or something
; ((link_label) @label (#is-not? local))
; ((link_label) @label)

(footnote (reference_label) @markup.footnote.definition) @markup.footnote
(footnote_reference (reference_label) @markup.footnote.reference)
[
  (footnote_marker_begin)
  (footnote_marker_end)
] @punctuation.bracket

(todo) @markup.todo
(note) @markup.note
(fixme) @markup.fixme

[
 (paragraph)
 (comment)
 (table_cell)
 ] @spell
[
 (autolink)
 (inline_link_destination)
 (link_destination)
 (code_block)
 (raw_block)
 (math)
 (raw_inline)
 (verbatim)
 (reference_label)
 (class)
 (class_name)
 (identifier)
 (key_value)
] @nospell
(full_reference_link (link_label) @nospell)
(full_reference_image (link_label) @nospell)

