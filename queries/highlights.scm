[
 (heading1)
 (heading2)
 (heading3)
 (heading4)
 (heading5)
 (heading6)
 ] @text.title

(heading1 (marker) @punctuation.special)
(heading2 (marker) @punctuation.special)
(heading3 (marker) @punctuation.special)
(heading4 (marker) @punctuation.special)
(heading5 (marker) @punctuation.special)
(heading6 (marker) @punctuation.special)

(thematic_break) @punctuation.special

[
 (div_marker_begin)
 (div_marker_end)
 (code_block_marker_begin)
 (code_block_marker_end)
 (raw_block_marker_begin)
 (raw_block_marker_end)
 ] @punctuation.delimiter

(language) @tag.attribute
(language_marker) @punctuation.delimiter
(class_name) @tag.attribute

(block_quote) @comment

(table_header) @text.title
(table_header "|" @punctuation.delimiter)
(table_row "|" @punctuation.delimiter)
(table_separator) @punctuation.delimiter
(table_caption (marker) @punctuation.delimiter)
(table_caption) @comment

[
 (list_marker_dash)
 (list_marker_plus)
 (list_marker_star)
 (list_marker_task)
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
] @punctuation.special

(list_marker_task (checked) @constant.builtin)
(list_item (term) @type)

[
 (ellipsis)
 (en_dash)
 (em_dash)
 (straight_quote)
 ] @punctuation.special

(emphasis) @text.emphasis
(strong) @text.strong
; FIXME match end _} tokens, can contain arbitrary many leading blanklines...
(emphasis ["_" "{_"] @punctuation.delimiter)
(strong ["*" "{*"] @punctuation.delimiter)

(highlighted) @text.note
(highlighted ["{=" "=}"] @punctuation.delimiter)

(insert) @text.underline
(insert ["{+" "+}"] @punctuation.delimiter)

(delete) @text.strike
(delete ["{-" "-}"] @punctuation.delimiter)

(symbol) @symbol

(superscript) @text.literal
(superscript ["^" "{^" "^}"] @punctuation.delimiter)

(subscript) @text.literal
(subscript ["~" "{~" "~}"] @punctuation.delimiter)

(verbatim) @text.literal
[
 (verbatim_marker_begin)
 (verbatim_marker_end)
 ] @punctuation.delimiter

[
 (math_marker)
 (math_marker_begin)
 (math_marker_end)
 ] @punctuation.delimiter

[
 (raw_inline_attribute)
 (raw_inline_marker_begin)
 (raw_inline_marker_end)
 ] @punctuation.delimiter

(raw_inline_attribute (language) @attribute)

; FIXME how to handle spell?

(paragraph) @text
; (paragraph) @spell ; Can't really do this, then everything will be marked as spell?
; Or we do it, and then set @nospell everywhere else

(span ["[" "]"] @punctuation.delimiter)
(inline_attribute ["{" "}"] @punctuation.delimiter)
(block_attribute ["{" "}"] @punctuation.delimiter)

(comment) @comment
(class) @tag.attribute
(identifier) @tag
(key_value "=" @operator)
(key_value (key) @constant)
(key_value (value) @string)

[
  (backslash_escape)
  (hard_line_break)
] @string.escape

(reference_label) @label
(footnote_marker_begin) @punctuation.delimiter
(footnote_marker_end) @punctuation.delimiter

; TODO rework links
; Maybe we could also detect if a link reference exists or not...?
[
 (link_text)
 (image_description)
] @string
[
 (link_label)
] @label
; These aren't highlighted very nicely
(inline_link_destination ["(" ")"] @punctuation.delimiter)
(link_label ["[" "]"] @punctuation.delimiter)
(link_text ["[" "]"] @punctuation.delimiter)
(collapsed_reference_link "[]" @punctuation.delimiter)
(collapsed_reference_link "[]" @punctuation.delimiter)
(image_description ["![" "]"] @punctuation.delimiter)
; (link_reference_definition (link_label ["[" "]"]) @punctuation.delimiter)

; These are probably fine
[
  (autolink)
  (inline_link_destination)
  (link_destination)
] @text.uri
