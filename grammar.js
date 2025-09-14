const ELEMENT_PRECEDENCE = 100;

module.exports = grammar({
  name: "djot",

  extras: (_) => ["\r"],

  conflicts: ($) => [
    [$.emphasis_begin, $._symbol_fallback],
    [$.strong_begin, $._symbol_fallback],
    [$.superscript_begin, $._symbol_fallback],
    [$.subscript_begin, $._symbol_fallback],
    [$.highlighted_begin, $._symbol_fallback],
    [$.insert_begin, $._symbol_fallback],
    [$.delete_begin, $._symbol_fallback],
    [$._bracketed_text_begin, $._symbol_fallback],
    [$._image_description_begin, $._symbol_fallback],
    [$.footnote_marker_begin, $._symbol_fallback],
    [$.block_math, $._symbol_fallback],
    [$.inline_math, $._symbol_fallback],
    [$.link_text, $._symbol_fallback],
    [$._curly_bracket_span_begin, $._curly_bracket_span_fallback],
  ],

  rules: {
    document: ($) =>
      seq(optional($.frontmatter), repeat($._block_with_section)),

    frontmatter: ($) =>
      seq(
        $.frontmatter_marker,
        $._whitespace,
        optional(field("language", $.language)),
        $._newline,
        field("content", $.frontmatter_content),
        $.frontmatter_marker,
        $._newline,
      ),
    frontmatter_content: ($) => repeat1($._line),

    // A section is only valid on the top level, or nested inside other sections.
    // Otherwise standalone headings are used (inside divs for example).
    _block_with_section: ($) => choice($.section, $._block_element, $._newline),
    _block_with_heading: ($) =>
      seq(
        optional($._block_quote_continuation),
        choice($.heading, $._block_element, $._newline),
      ),
    _block_element: ($) =>
      choice(
        $.list,
        $.table,
        $.footnote,
        $.div,
        $.raw_block,
        $.code_block,
        $.thematic_break,
        $.block_quote,
        alias($.block_math, $.math),
        $.link_reference_definition,
        $.block_attribute,
        $._paragraph,
      ),

    // Section should end by a new header with the same or fewer amount of '#'.
    section: ($) =>
      seq(
        field("heading", $.heading),
        field(
          "content",
          alias(repeat($._block_with_section), $.section_content),
        ),
        $._block_close,
      ),

    // The external scanner allows for an arbitrary number of `#`
    // that can be continued on the next line.
    heading: ($) =>
      seq(
        field("marker", alias($._heading_begin, $.marker)),
        field("content", alias($._heading_content, $.content)),
        $._block_close,
        optional($._eof_or_newline),
      ),
    _heading_content: ($) =>
      seq(
        $._inline_line,
        repeat(seq(alias($._heading_continuation, $.marker), $._inline_line)),
      ),

    // Djot has a crazy number of different list types
    // that we need to keep separate from each other.
    list: ($) =>
      prec.left(
        choice(
          $._list_dash,
          $._list_plus,
          $._list_star,
          $._list_task,
          $._list_definition,
          $._list_decimal_period,
          $._list_decimal_paren,
          $._list_decimal_parens,
          $._list_lower_alpha_period,
          $._list_lower_alpha_paren,
          $._list_lower_alpha_parens,
          $._list_upper_alpha_period,
          $._list_upper_alpha_paren,
          $._list_upper_alpha_parens,
          $._list_lower_roman_period,
          $._list_lower_roman_paren,
          $._list_lower_roman_parens,
          $._list_upper_roman_period,
          $._list_upper_roman_paren,
          $._list_upper_roman_parens,
        ),
      ),
    _list_dash: ($) =>
      seq(repeat1(alias($._list_item_dash, $.list_item)), $._block_close),
    _list_item_dash: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_dash),
        field("content", $.list_item_content),
      ),

    _list_plus: ($) =>
      seq(repeat1(alias($._list_item_plus, $.list_item)), $._block_close),
    _list_item_plus: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_plus),
        field("content", $.list_item_content),
      ),

    _list_star: ($) =>
      seq(repeat1(alias($._list_item_star, $.list_item)), $._block_close),
    _list_item_star: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_star),
        field("content", $.list_item_content),
      ),

    _list_task: ($) =>
      seq(repeat1(alias($._list_item_task, $.list_item)), $._block_close),
    _list_item_task: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_task),
        field("content", $.list_item_content),
      ),
    list_marker_task: ($) =>
      seq(
        $._list_marker_task_begin,
        field("checkmark", choice($.checked, $.unchecked)),
        $._whitespace1,
      ),
    checked: (_) => seq("[", choice("x", "X"), "]"),
    unchecked: (_) => seq("[", " ", "]"),

    _list_definition: ($) =>
      seq(repeat1(alias($._list_item_definition, $.list_item)), $._block_close),
    _list_item_definition: ($) =>
      seq(
        field("marker", $.list_marker_definition),
        field("term", alias($._paragraph_content, $.term)),
        choice($._eof_or_newline, $._close_paragraph),
        field(
          "definition",
          alias(
            optional(
              repeat(
                seq(
                  optional($._block_quote_prefix),
                  $._list_item_continuation,
                  $._block_with_heading,
                ),
              ),
            ),
            $.definition,
          ),
        ),
        $._list_item_end,
      ),

    _list_decimal_period: ($) =>
      seq(
        repeat1(alias($._list_item_decimal_period, $.list_item)),
        $._block_close,
      ),
    _list_item_decimal_period: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_decimal_period),
        field("content", $.list_item_content),
      ),
    _list_decimal_paren: ($) =>
      seq(
        repeat1(alias($._list_item_decimal_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_decimal_paren: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_decimal_paren),
        field("content", $.list_item_content),
      ),
    _list_decimal_parens: ($) =>
      seq(
        repeat1(alias($._list_item_decimal_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_decimal_parens: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_decimal_parens),
        field("content", $.list_item_content),
      ),

    _list_lower_alpha_period: ($) =>
      seq(
        repeat1(alias($._list_item_lower_alpha_period, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_alpha_period: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_lower_alpha_period),
        field("content", $.list_item_content),
      ),
    _list_lower_alpha_paren: ($) =>
      seq(
        repeat1(alias($._list_item_lower_alpha_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_alpha_paren: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_lower_alpha_paren),
        field("content", $.list_item_content),
      ),
    _list_lower_alpha_parens: ($) =>
      seq(
        repeat1(alias($._list_item_lower_alpha_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_alpha_parens: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_lower_alpha_parens),
        field("content", $.list_item_content),
      ),

    _list_upper_alpha_period: ($) =>
      seq(
        repeat1(alias($._list_item_upper_alpha_period, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_alpha_period: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_upper_alpha_period),
        field("content", $.list_item_content),
      ),
    _list_upper_alpha_paren: ($) =>
      seq(
        repeat1(alias($._list_item_upper_alpha_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_alpha_paren: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_upper_alpha_paren),
        field("content", $.list_item_content),
      ),
    _list_upper_alpha_parens: ($) =>
      seq(
        repeat1(alias($._list_item_upper_alpha_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_alpha_parens: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_upper_alpha_parens),
        field("content", $.list_item_content),
      ),

    _list_lower_roman_period: ($) =>
      seq(
        repeat1(alias($._list_item_lower_roman_period, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_roman_period: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_lower_roman_period),
        field("content", $.list_item_content),
      ),
    _list_lower_roman_paren: ($) =>
      seq(
        repeat1(alias($._list_item_lower_roman_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_roman_paren: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_lower_roman_paren),
        field("content", $.list_item_content),
      ),
    _list_lower_roman_parens: ($) =>
      seq(
        repeat1(alias($._list_item_lower_roman_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_roman_parens: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_lower_roman_parens),
        field("content", $.list_item_content),
      ),

    _list_upper_roman_period: ($) =>
      seq(
        repeat1(alias($._list_item_upper_roman_period, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_roman_period: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_upper_roman_period),
        field("content", $.list_item_content),
      ),
    _list_upper_roman_paren: ($) =>
      seq(
        repeat1(alias($._list_item_upper_roman_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_roman_paren: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_upper_roman_paren),
        field("content", $.list_item_content),
      ),
    _list_upper_roman_parens: ($) =>
      seq(
        repeat1(alias($._list_item_upper_roman_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_roman_parens: ($) =>
      seq(
        optional($._block_quote_prefix),
        field("marker", $.list_marker_upper_roman_parens),
        field("content", $.list_item_content),
      ),

    list_item_content: ($) =>
      seq(
        $._block_with_heading,
        $._indented_content_spacer,
        optional(
          repeat(
            seq(
              optional($._block_quote_prefix),
              $._list_item_continuation,
              $._block_with_heading,
              $._indented_content_spacer,
            ),
          ),
        ),
        $._list_item_end,
      ),

    table: ($) =>
      prec.right(
        seq(
          repeat1($._table_row),
          optional($._newline),
          optional($.table_caption),
        ),
      ),
    _table_row: ($) =>
      seq(
        optional($._block_quote_prefix),
        choice($.table_header, $.table_separator, $.table_row),
      ),
    table_header: ($) =>
      seq(
        alias($._table_header_begin, "|"),
        repeat($._table_cell),
        $._table_row_end_newline,
      ),
    table_separator: ($) =>
      seq(
        alias($._table_separator_begin, "|"),
        repeat($._table_cell_alignment),
        $._table_row_end_newline,
      ),
    table_row: ($) =>
      seq(
        alias($._table_row_begin, "|"),
        repeat($._table_cell),
        $._table_row_end_newline,
      ),
    _table_cell: ($) =>
      seq(alias($._inline, $.table_cell), alias($._table_cell_end, "|")),
    _table_cell_alignment: ($) =>
      seq(
        // Note that alignment appearance is already checked in the external
        // scanner when `_table_separator_begin` is output.
        // Therefore this regex can be simplified.
        alias(token.immediate(/[^|]+/), $.table_cell_alignment),
        alias($._table_cell_end, "|"),
      ),
    table_caption: ($) =>
      seq(
        field("marker", alias($._table_caption_begin, $.marker)),
        field("content", alias(repeat1($._inline_line), $.content)),
        choice($._table_caption_end, "\0"),
      ),

    footnote: ($) =>
      seq(
        $._footnote_mark_begin,
        $.footnote_marker_begin,
        field("label", $.reference_label),
        alias("]:", $.footnote_marker_end),
        $._whitespace1,
        field("content", $.footnote_content),
      ),
    footnote_content: ($) =>
      seq(
        $._block_with_heading,
        $._indented_content_spacer,
        optional(
          repeat(
            seq(
              optional($._block_quote_prefix),
              $._footnote_continuation,
              $._block_with_heading,
              $._indented_content_spacer,
            ),
          ),
        ),
        $._footnote_end,
      ),

    div: ($) =>
      seq(
        $._div_marker_begin,
        $._newline,
        field("content", alias(repeat($._block_with_heading), $.content)),
        optional($._block_quote_prefix),
        $._block_close,
        optional(seq(alias($._div_end, $.div_marker_end), $._newline)),
      ),
    _div_marker_begin: ($) =>
      seq(
        alias($._div_begin, $.div_marker_begin),
        optional(seq($._whitespace1, field("class", $.class_name))),
      ),
    class_name: ($) => $._id,

    code_block: ($) =>
      seq(
        alias($._code_block_begin, $.code_block_marker_begin),
        $._whitespace,
        optional(field("language", $.language)),
        $._newline,
        optional(field("code", $.code)),
        $._block_close,
        optional(
          seq(alias($._code_block_end, $.code_block_marker_end), $._newline),
        ),
      ),
    raw_block: ($) =>
      seq(
        alias($._code_block_begin, $.raw_block_marker_begin),
        $._whitespace,
        field("info", $.raw_block_info),
        $._newline,
        field("content", optional(alias($.code, $.content))),
        $._block_close,
        optional(
          seq(alias($._code_block_end, $.raw_block_marker_end), $._newline),
        ),
      ),
    raw_block_info: ($) =>
      seq(
        field("marker", alias("=", $.language_marker)),
        field("language", $.language),
      ),

    language: (_) => /[^\n\t \{\}=]+/,
    code: ($) =>
      prec.left(repeat1(seq(optional($._block_quote_prefix), $._line))),
    _line: ($) => seq(/[^\n]*/, $._newline),

    thematic_break: ($) =>
      seq(choice($._thematic_break_dash, $._thematic_break_star), $._newline),

    block_quote: ($) =>
      seq(
        alias($._block_quote_begin, $.block_quote_marker),
        field("content", alias($._block_quote_content, $.content)),
        $._block_close,
      ),
    _block_quote_content: ($) =>
      seq(
        choice($.heading, $._block_element),
        repeat(seq($._block_quote_prefix, optional($._block_element))),
      ),
    _block_quote_prefix: ($) =>
      prec.left(
        repeat1(
          prec.left(alias($._block_quote_continuation, $.block_quote_marker)),
        ),
      ),

    block_math: ($) =>
      seq(
        field("math_marker", alias("$$", $.math_marker)),
        field("begin_marker", alias($._verbatim_begin, $.math_marker_begin)),
        field("content", alias($._verbatim_content, $.content)),
        field("end_marker", alias($._verbatim_end, $.math_marker_end)),
        $._newline,
      ),

    link_reference_definition: ($) =>
      seq(
        $._link_ref_def_mark_begin,
        "[",
        field("label", alias($._inline, $.link_label)),
        $._link_ref_def_label_end,
        "]",
        ":",
        optional(seq($._whitespace1, field("destination", $.link_destination))),
        $._newline,
      ),
    link_destination: (_) => /\S+/,

    block_attribute: ($) =>
      seq(
        alias($._block_attribute_begin, "{"),
        field(
          "args",
          alias(
            repeat(
              choice(
                $.class,
                $.identifier,
                $.key_value,
                alias($._comment, $.comment),
                $._whitespace1,
                $._newline,
              ),
            ),
            $.args,
          ),
        ),
        "}",
        $._newline,
      ),
    class: ($) => seq(".", alias($.class_name, "class")),
    identifier: (_) => token(seq("#", token.immediate(/[^\s\}]+/))),
    key_value: ($) => seq(field("key", $.key), "=", field("value", $.value)),
    key: ($) => $._id,
    value: (_) => choice(seq('"', /[^"\n]+/, '"'), /\w+/),

    // Paragraphs are a bit special parsing wise as it's the "fallback"
    // block, where everything that doesn't fit will go.
    // There's no "start" token and they're not tracked by the external scanner.
    //
    // Instead they're ended by either a blankline or by an explicit
    // `_close_paragraph` token (by for instance div markers).
    //
    // Lines inside paragraphs are handled by the `_newline_inline` token
    // that's a newline character only valid inside an `_inline` context.
    // When the `newline_inline` token is no longer valid, the `_newline`
    // token can be emitted which closes the paragraph content.
    _paragraph: ($) =>
      seq(
        alias($._paragraph_content, $.paragraph),
        // Blankline is split out from paragraph to enable textobject
        // to not select newline up to following text.
        choice($._eof_or_newline, $._close_paragraph),
      ),
    _paragraph_content: ($) =>
      // Newlines inside inline blocks should be of the `_newline_inline` type.
      seq(
        optional($._block_quote_prefix),
        $._inline,
        repeat(
          seq($._newline_inline, optional($._block_quote_prefix), $._inline),
        ),
        // Last newline can be of the normal variant to signal the end of the paragraph.
        $._eof_or_newline,
      ),

    _whitespace: (_) => token.immediate(/[ \t]*/),
    _whitespace1: (_) => token.immediate(/[ \t]+/),

    _inline: ($) =>
      prec.left(
        repeat1(choice($._inline_element, $._newline_inline, $._whitespace1)),
      ),

    _inline_without_trailing_space: ($) =>
      seq(
        prec.left(
          repeat(choice($._inline_element, $._newline_inline, $._whitespace1)),
        ),
        $._inline_element,
      ),

    _inline_element: ($) =>
      prec.left(
        choice(
          // Span is declared separately because it always parses an `inline_attribute`,
          // while the attribute is optional for everything else.
          $.span,
          seq(
            choice(
              $._smart_punctuation,
              $.backslash_escape,
              $.hard_line_break,
              // Elements containing other inline elements needs to have the same precedence level
              // so we can choose the element that's closed first.
              //
              // For example:
              //
              //     *[x](y*)
              //
              // Should parse a strong element instead of a link because it's closed before the link.
              //
              // They also need a higher precedence than the fallback tokens so that:
              //
              //     _a_
              //
              // Is parsed as emphasis instead of just text with `_symbol_fallback` tokens.
              prec.dynamic(ELEMENT_PRECEDENCE, $.emphasis),
              prec.dynamic(ELEMENT_PRECEDENCE, $.strong),
              prec.dynamic(ELEMENT_PRECEDENCE, $.highlighted),
              prec.dynamic(ELEMENT_PRECEDENCE, $.superscript),
              prec.dynamic(ELEMENT_PRECEDENCE, $.subscript),
              prec.dynamic(ELEMENT_PRECEDENCE, $.insert),
              prec.dynamic(ELEMENT_PRECEDENCE, $.delete),
              prec.dynamic(ELEMENT_PRECEDENCE, $.footnote_reference),
              prec.dynamic(ELEMENT_PRECEDENCE, $._image),
              prec.dynamic(ELEMENT_PRECEDENCE, $._link),
              $.autolink,
              $.verbatim,
              alias($.inline_math, $.math),
              $.raw_inline,
              $.symbol,
              $.inline_comment,
              $._todo_highlights,
              // Text and the symbol fallback matches everything not matched elsewhere.
              $._symbol_fallback,
              $._text,
            ),
            optional(
              // We need a separate fallback token for the opening `{`
              // for the parser to recognize the conflict.
              choice(
                // Use precedence for inline attribute as well to allow
                // closure before other elements.
                prec.dynamic(
                  2 * ELEMENT_PRECEDENCE,
                  field("attribute", $.inline_attribute),
                ),
                $._curly_bracket_span_fallback,
              ),
            ),
          ),
        ),
      ),

    _inline_line: ($) => seq($._inline, $._eof_or_newline),

    _smart_punctuation: ($) =>
      choice($.quotation_marks, $.ellipsis, $.em_dash, $.en_dash),
    // It would be nice to be able to mark bare " and ', but then we'd have to be smarter
    // so we don't mark the ' in `it's`. Not sure if we can do that in a correct way.
    quotation_marks: (_) => token(choice('{"', '"}', "{'", "'}", '\\"', "\\'")),
    ellipsis: (_) => "...",
    em_dash: (_) => "---",
    en_dash: (_) => "--",

    backslash_escape: (_) => /\\[^\r\n]/,

    autolink: (_) => seq("<", /[^>\s]+/, ">"),

    symbol: (_) => token(seq(":", /[\w\d_-]+/, ":")),

    // Emphasis and strong are a little special as they don't allow spaces next
    // to begin and end markers unless using the bracketed variant.
    // The strategy to solve this:
    //
    // Begin: Use the zero-width `$._non_whitespace_check` token to avoid the `_ ` case.
    // End: Use `$._inline_without_trailing_space` to match inline without a trailing space
    //      and let the end token in the external scanner consume space for the `_}` case
    //      and not for the `_` case.
    emphasis: ($) =>
      seq(
        field("begin_marker", $.emphasis_begin),
        $._emphasis_mark_begin,
        field("content", alias($._inline_without_trailing_space, $.content)),
        field("end_marker", $.emphasis_end),
      ),
    emphasis_begin: ($) => choice("{_", seq("_", $._non_whitespace_check)),

    strong: ($) =>
      seq(
        field("begin_marker", $.strong_begin),
        $._strong_mark_begin,
        field("content", alias($._inline_without_trailing_space, $.content)),
        field("end_marker", $.strong_end),
      ),
    strong_begin: ($) => choice("{*", seq("*", $._non_whitespace_check)),

    // The syntax description isn't clear about if non-bracket can contain surrounding spaces.
    // The live playground suggests that yes they can, although it's a bit inconsistent.
    superscript: ($) =>
      seq(
        field("begin_marker", $.superscript_begin),
        $._superscript_mark_begin,
        field("content", alias($._inline, $.content)),
        field("end_marker", $.superscript_end),
      ),
    superscript_begin: (_) => choice("{^", "^"),

    subscript: ($) =>
      seq(
        field("begin_marker", $.subscript_begin),
        $._subscript_mark_begin,
        field("content", alias($._inline, $.content)),
        field("end_marker", $.subscript_end),
      ),
    subscript_begin: (_) => choice("{~", "~"),

    highlighted: ($) =>
      seq(
        field("begin_marker", $.highlighted_begin),
        $._highlighted_mark_begin,
        field("content", alias($._inline, $.content)),
        field("end_marker", $.highlighted_end),
      ),
    highlighted_begin: (_) => "{=",
    insert: ($) =>
      seq(
        field("begin_marker", $.insert_begin),
        $._insert_mark_begin,
        field("content", alias($._inline, $.content)),
        field("end_marker", $.insert_end),
      ),
    insert_begin: (_) => "{+",
    delete: ($) =>
      seq(
        field("begin_marker", $.delete_begin),
        $._delete_mark_begin,
        field("content", alias($._inline, $.content)),
        field("end_marker", $.delete_end),
      ),
    delete_begin: (_) => "{-",

    footnote_reference: ($) =>
      seq(
        $.footnote_marker_begin,
        $._square_bracket_span_mark_begin,
        $.reference_label,
        alias($._square_bracket_span_end, $.footnote_marker_end),
      ),
    footnote_marker_begin: (_) => "[^",

    reference_label: ($) => $._id,
    _id: (_) => /[\w_-]+/,

    _image: ($) =>
      choice(
        $.full_reference_image,
        $.collapsed_reference_image,
        $.inline_image,
      ),
    full_reference_image: ($) =>
      seq(field("description", $.image_description), $._link_label),
    collapsed_reference_image: ($) =>
      seq(field("description", $.image_description), token.immediate("[]")),
    inline_image: ($) =>
      seq(
        field("description", $.image_description),
        field("destination", $.inline_link_destination),
      ),

    image_description: ($) =>
      seq(
        $._image_description_begin,
        $._square_bracket_span_mark_begin,
        optional($._inline),
        alias($._square_bracket_span_end, "]"),
      ),
    _image_description_begin: (_) => "![",

    _link: ($) =>
      choice($.full_reference_link, $.collapsed_reference_link, $.inline_link),
    full_reference_link: ($) => seq(field("text", $.link_text), $._link_label),
    collapsed_reference_link: ($) =>
      seq(field("text", $.link_text), token.immediate("[]")),
    inline_link: ($) =>
      seq(
        field("text", $.link_text),
        field("destination", $.inline_link_destination),
      ),

    link_text: ($) =>
      choice(
        seq(
          $._bracketed_text_begin,
          $._square_bracket_span_mark_begin,
          $._inline,
          // Alias to "]" to allow us to highlight it in Neovim.
          // Maybe some bug, or some undocumented behavior?
          alias($._square_bracket_span_end, "]"),
        ),
        // Required as we track fallback characters between bracketed begin and end,
        // but when it's empty it skips blocks the inline link destination.
        // This is an easy workaround for that special case.
        "[]",
      ),

    span: ($) =>
      seq(
        $._bracketed_text_begin,
        $._square_bracket_span_mark_begin,
        field("content", alias($._inline, $.content)),
        // Prefer span over regular text + inline attribute.
        prec.dynamic(
          ELEMENT_PRECEDENCE,
          alias($._square_bracket_span_end, "]"),
        ),
        field("attribute", $.inline_attribute),
      ),

    _bracketed_text_begin: (_) => "[",

    inline_attribute: ($) =>
      seq(
        $._curly_bracket_span_begin,
        $._curly_bracket_span_mark_begin,
        alias(
          repeat(
            choice(
              $.class,
              $.identifier,
              $.key_value,
              alias($._comment, $.comment),
              $._whitespace1,
              $._newline_inline,
            ),
          ),
          $.args,
        ),
        alias($._curly_bracket_span_end, "}"),
      ),
    _curly_bracket_span_begin: (_) => "{",

    _bracketed_text: ($) =>
      seq(
        $._bracketed_text_begin,
        $._square_bracket_span_mark_begin,
        $._inline,
        $._square_bracket_span_end,
      ),

    _link_label: ($) =>
      seq(
        "[",
        field("label", alias($._inline, $.link_label)),
        token.immediate("]"),
      ),
    inline_link_destination: ($) =>
      seq(
        $._parens_span_begin,
        $._parens_span_mark_begin,
        $._inline_link_url,
        alias($._parens_span_end, ")"),
      ),
    _inline_link_url: ($) =>
      // Can escape `)`, but shouldn't capture it.
      repeat1(choice(/([^\)\n]|\\\))+/, $._newline_inline)),
    _parens_span_begin: (_) => "(",

    _comment: ($) =>
      seq(
        "%",
        field(
          "content",
          alias(repeat(choice($.backslash_escape, /[^%}]/)), $.content),
        ),
        choice(alias($._comment_end_marker, "%"), $._comment_close),
      ),

    inline_comment: ($) =>
      seq(
        $._whitespace1,
        $._inline_comment_begin,
        $._curly_bracket_span_mark_begin,
        $._comment,
        alias($._curly_bracket_span_end, "}"),
      ),

    raw_inline: ($) =>
      seq(
        field(
          "begin_marker",
          alias($._verbatim_begin, $.raw_inline_marker_begin),
        ),
        field("content", alias($._verbatim_content, $.content)),
        field("end_marker", alias($._verbatim_end, $.raw_inline_marker_end)),
        field("attribute", $.raw_inline_attribute),
      ),
    raw_inline_attribute: ($) =>
      seq(token.immediate("{="), field("language", $.language), "}"),
    inline_math: ($) =>
      seq(
        field("math_marker", alias("$", $.math_marker)),
        field("begin_marker", alias($._verbatim_begin, $.math_marker_begin)),
        field("content", alias($._verbatim_content, $.content)),
        field("end_marker", alias($._verbatim_end, $.math_marker_end)),
      ),
    verbatim: ($) =>
      seq(
        field(
          "begin_marker",
          alias($._verbatim_begin, $.verbatim_marker_begin),
        ),
        field("content", alias($._verbatim_content, $.content)),
        field("end_marker", alias($._verbatim_end, $.verbatim_marker_end)),
      ),

    _todo_highlights: ($) => choice($.todo, $.note, $.fixme),
    todo: (_) => choice("TODO", "WIP"),
    note: (_) => choice("NOTE", "INFO", "XXX"),
    fixme: (_) => "FIXME",

    // These exists to explicit trigger an LR collision with existing
    // prefixes. A collision isn't detected with a string and the
    // catch-all `_text` regex.
    //
    // Don't use dynamic precedence on the fallback, instead use it
    // on span end tokens to prevent these branches from getting pruned
    // when the tree grows large.
    //
    // Block level collisions handled by the scanner scanning ahead.
    _symbol_fallback: ($) =>
      choice(
        // Standalone emphasis and strong markers are required for backtracking
        "_",
        "*",
        // Whitespace sensitive
        seq(
          choice("{_", seq("_", $._non_whitespace_check)),
          choice($._emphasis_mark_begin, $._in_fallback),
        ),
        seq(
          choice("{*", seq("*", $._non_whitespace_check)),
          choice($._strong_mark_begin, $._in_fallback),
        ),
        // Not sensitive to whitespace
        seq(
          choice("{^", "^"),
          choice($._superscript_mark_begin, $._in_fallback),
        ),
        seq(choice("{~", "~"), choice($._subscript_mark_begin, $._in_fallback)),
        // Only bracketed versions
        seq("{=", choice($._highlighted_mark_begin, $._in_fallback)),
        seq("{+", choice($._insert_mark_begin, $._in_fallback)),
        seq("{-", choice($._delete_mark_begin, $._in_fallback)),

        // Bracketed spans
        seq("[^", choice($._square_bracket_span_mark_begin, $._in_fallback)),
        seq("![", choice($._square_bracket_span_mark_begin, $._in_fallback)),
        seq("[", choice($._square_bracket_span_mark_begin, $._in_fallback)),
        seq("(", choice($._parens_span_mark_begin, $._in_fallback)),

        // Autolink
        "<",
        seq("<", /[^>\s]+/),

        // Math
        "$$",
        "$",

        // Empty link text
        "[]",
      ),

    // Used to branch on inline attributes that may follow any element.
    _curly_bracket_span_fallback: ($) =>
      seq("{", choice($._curly_bracket_span_mark_begin, $._in_fallback)),

    // It's a bit faster with repeat1 here.
    _text: (_) => repeat1(/\S/),
  },

  externals: ($) => [
    // Used as default value in scanner, should never be referenced.
    $._ignored,

    // Token to implicitly terminate open blocks,
    // for instance in this case:
    //
    //    :::
    //    ::::
    //    txt
    //    :::   <- closes both divs
    //
    // `_block_close` is used to close both open divs,
    // and the outer most div consumes the optional ending div marker.
    $._block_close,

    // Different kinds of newlines are handled by the external scanner so
    // we can manually track indent (and reset it on newlines).
    $._eof_or_newline,
    // `_newline` is a regular newline, and is used to end paragraphs and other blocks.
    $._newline,
    // `_newline_inline` is a newline that's only valid inside an inline context.
    // It contains logic on when to terminate a paragraph.
    // When a paragraph should be closed, `_newline_inline` will not be valid,
    // so `_newline` will have to be used, which is only valid at the end of a paragraph.
    $._newline_inline,
    // A zero-width whitespace check token.
    $._non_whitespace_check,
    // A hard line break that doesn't consume a newline.
    $.hard_line_break,

    // Detects a frontmatter delimiters: `---`
    // Handled externally to resolve conflicts with list markers and thematic breaks.
    $.frontmatter_marker,

    // Blocks.
    // The external scanner keeps a stack of blocks for context in order to
    // match and close against open blocks.

    // Headings open and close sections, but they're not exposed to `grammar.js`
    // but is used by the external scanner internally.
    $._heading_begin,
    // Heading continuation can continue a heading, but only if
    // they match the number of `#` (or there's no `#`).
    $._heading_continuation,

    // Matches div markers with varying number of `:`.
    $._div_begin,
    $._div_end,
    // Matches code block markers with varying number of `.
    $._code_block_begin,
    $._code_block_end,
    // There are lots of lists in Djot that shouldn't be mixed.
    // Parsing a list marker opens or closes lists depending on the marker type.
    $.list_marker_dash,
    $.list_marker_star,
    $.list_marker_plus,
    // `list_marker_task_begin` only matches opening `- `, `+ `, or `* `, but
    // only if followed by a valid task box.
    // This is done to allow the task box markers like `x` to have their own token.
    $._list_marker_task_begin,
    $.list_marker_definition,
    $.list_marker_decimal_period,
    $.list_marker_lower_alpha_period,
    $.list_marker_upper_alpha_period,
    $.list_marker_lower_roman_period,
    $.list_marker_upper_roman_period,
    $.list_marker_decimal_paren,
    $.list_marker_lower_alpha_paren,
    $.list_marker_upper_alpha_paren,
    $.list_marker_lower_roman_paren,
    $.list_marker_upper_roman_paren,
    $.list_marker_decimal_parens,
    $.list_marker_lower_alpha_parens,
    $.list_marker_upper_alpha_parens,
    $.list_marker_lower_roman_parens,
    $.list_marker_upper_roman_parens,
    // List item continuation consumes whitespace indentation for lists.
    $._list_item_continuation,
    // `_list_item_end` is responsible for closing an open list,
    // if indent or list markers are mismatched.
    $._list_item_end,
    // `_indented_content_spacer` is either a blankline separating
    // indented content or a zero-width marker if content continues immediately.
    //
    //    - a
    //              <- spacer
    //      ```
    //      x
    //      ```
    //      b       <- zero-width spacer (followed by a list item continuation).
    //
    $._indented_content_spacer,
    // Paragraphs are anonymous blocks and open blocks aren't tracked by the
    // external scanner. `close_paragraph` is a marker that's responsible
    // for closing the paragraph early, for example on a div marker.
    $._close_paragraph,
    $._block_quote_begin,
    // `block_quote_continuation` continues an open block quote, and can be included
    // in other elements. For example:
    //
    //    > a   <- `block_quote_begin` (before the paragraph)
    //    > b   <- `block_quote_continuation` (inside the paragraph)
    //
    $._block_quote_continuation,
    $._thematic_break_dash,
    $._thematic_break_star,
    // Footnotes have significant whitespace and can contain blocks,
    // the same as lists.
    $._footnote_mark_begin,
    $._footnote_continuation,
    $._footnote_end,
    // Link reference definitions needs to make sure
    // that inline content doesn't escape the label brackets
    // or continue into other lines, like this:
    //
    //    [one_]: /can_have_many_underscores_in_url
    //    [two_]: /should_not_be_emphasis
    //
    // The above should be two definitions, not a paragraph with emphasis.
    $._link_ref_def_mark_begin,
    $._link_ref_def_label_end,
    // Table begin consumes a `|` if the row is a valid table row.
    // In Djot the number of table cells don't have to match for in the table.
    // The different types are here to let the scanner take care of the detection
    // to avoid tree-sitter branching.
    // `header`, `separator`, and `row` are just different types of table rows.
    $._table_header_begin,
    $._table_separator_begin,
    $._table_row_begin,
    // `_table_row_end_newline` consumes the ending newline.
    $._table_row_end_newline,
    // `_table_cell_end` consumes the ending `|`.
    $._table_cell_end,
    // Table captions have significant whitespace but contain only inline.
    $._table_caption_begin,
    $._table_caption_end,
    // The `{` that begins a block attribute (scans the entire attribute to avoid
    // excessive branching).
    $._block_attribute_begin,
    // A comment can be closed by a `%` or implicitly when the attribute closes at `}`.
    $._comment_end_marker,
    $._comment_close,

    // Inline elements.

    // Zero-width check if a standalone comment is valid.
    $._inline_comment_begin,

    // Verbatim is handled externally to match a varying number of `,
    // and to close open verbatim when a paragraph ends with a blankline.
    $._verbatim_begin,
    $._verbatim_end,
    $._verbatim_content,

    // The different spans.
    // Begin is marked by a zero-width token and the end is the actual
    // ending token (such as `_}`).
    $._emphasis_mark_begin,
    $.emphasis_end,
    $._strong_mark_begin,
    $.strong_end,
    $._superscript_mark_begin,
    $.superscript_end,
    $._subscript_mark_begin,
    $.subscript_end,
    $._highlighted_mark_begin,
    $.highlighted_end,
    $._insert_mark_begin,
    $.insert_end,
    $._delete_mark_begin,
    $.delete_end,
    // Spans where the external scanner uses a zero-width begin marker
    // and parser the end token as ), } or ].
    $._parens_span_mark_begin,
    $._parens_span_end,
    $._curly_bracket_span_mark_begin,
    $._curly_bracket_span_end,
    $._square_bracket_span_mark_begin,
    $._square_bracket_span_end,

    // A signaling token that's used to signal that a fallback token should be scanned,
    // and should never be output.
    // It's used to notify the external scanner if we're in the fallback branch or in
    // if we're scanning a span. This so the scanner knows if the current element should
    // be stored on the stack or not.
    $._in_fallback,

    // Never valid and is only used to signal an internal scanner error.
    $._error,
  ],
});
