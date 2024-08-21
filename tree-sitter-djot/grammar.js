module.exports = grammar({
  name: "djot",

  extras: (_) => ["\r"],

  conflicts: ($) => [
    [$._table_content],
    [$.link_reference_definition, $._symbol_fallback],
    [$.table_row, $._symbol_fallback],
  ],

  rules: {
    document: ($) =>
      seq(optional($.frontmatter), repeat($._block_with_section)),

    frontmatter: ($) =>
      seq(
        $.frontmatter_marker,
        $._whitespace,
        optional($.language),
        $._newline,
        $.frontmatter_content,
        $.frontmatter_marker,
        $._newline,
      ),
    frontmatter_content: ($) => repeat1($._line),

    // A section is only valid on the top level, or nested inside other sections.
    // Otherwise standalone headings are used (inside divs for example).
    _block_with_section: ($) => choice($.section, $._block_element, $._newline),
    _block_with_heading: ($) => choice($.heading, $._block_element, $._newline),

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
        $.link_reference_definition,
        $.block_attribute,
        $._paragraph,
      ),

    // Section should end by a new header with the same or fewer amount of `#`.
    section: ($) =>
      seq(
        $.heading,
        alias(repeat($._block_with_section), $.section_content),
        $._block_close,
      ),

    // The external scanner allows for an arbitrary number of `#`
    // that can be continued on the next line.
    heading: ($) =>
      seq(
        alias($._heading_begin, $.marker),
        alias($._heading_content, $.content),
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
        $.list_marker_dash,
        $.list_item_content,
      ),

    _list_plus: ($) =>
      seq(repeat1(alias($._list_item_plus, $.list_item)), $._block_close),
    _list_item_plus: ($) =>
      seq(
        optional($._block_quote_prefix),
        $.list_marker_plus,
        $.list_item_content,
      ),

    _list_star: ($) =>
      seq(repeat1(alias($._list_item_star, $.list_item)), $._block_close),
    _list_item_star: ($) =>
      seq(
        optional($._block_quote_prefix),
        $.list_marker_star,
        $.list_item_content,
      ),

    _list_task: ($) =>
      seq(repeat1(alias($._list_item_task, $.list_item)), $._block_close),
    _list_item_task: ($) =>
      seq(
        optional($._block_quote_prefix),
        $.list_marker_task,
        $.list_item_content,
      ),
    list_marker_task: ($) =>
      seq(
        $._list_marker_task_begin,
        choice($.checked, $.unchecked),
        $._whitespace1,
      ),
    checked: (_) => seq("[", choice("x", "X"), "]"),
    unchecked: (_) => seq("[", " ", "]"),

    _list_definition: ($) =>
      seq(repeat1(alias($._list_item_definition, $.list_item)), $._block_close),
    _list_item_definition: ($) =>
      seq(
        $.list_marker_definition,
        alias($._paragraph_content, $.term),
        choice($._eof_or_newline, $._close_paragraph),
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
        $._list_item_end,
      ),

    _list_decimal_period: ($) =>
      seq(
        repeat1(alias($._list_item_decimal_period, $.list_item)),
        $._block_close,
      ),
    _list_item_decimal_period: ($) =>
      seq($.list_marker_decimal_period, $.list_item_content),
    _list_decimal_paren: ($) =>
      seq(
        repeat1(alias($._list_item_decimal_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_decimal_paren: ($) =>
      seq($.list_marker_decimal_paren, $.list_item_content),
    _list_decimal_parens: ($) =>
      seq(
        repeat1(alias($._list_item_decimal_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_decimal_parens: ($) =>
      seq($.list_marker_decimal_parens, $.list_item_content),

    _list_lower_alpha_period: ($) =>
      seq(
        repeat1(alias($._list_item_lower_alpha_period, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_alpha_period: ($) =>
      seq($.list_marker_lower_alpha_period, $.list_item_content),
    _list_lower_alpha_paren: ($) =>
      seq(
        repeat1(alias($._list_item_lower_alpha_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_alpha_paren: ($) =>
      seq($.list_marker_lower_alpha_paren, $.list_item_content),
    _list_lower_alpha_parens: ($) =>
      seq(
        repeat1(alias($._list_item_lower_alpha_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_alpha_parens: ($) =>
      seq($.list_marker_lower_alpha_parens, $.list_item_content),

    _list_upper_alpha_period: ($) =>
      seq(
        repeat1(alias($._list_item_upper_alpha_period, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_alpha_period: ($) =>
      seq($.list_marker_upper_alpha_period, $.list_item_content),
    _list_upper_alpha_paren: ($) =>
      seq(
        repeat1(alias($._list_item_upper_alpha_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_alpha_paren: ($) =>
      seq($.list_marker_upper_alpha_paren, $.list_item_content),
    _list_upper_alpha_parens: ($) =>
      seq(
        repeat1(alias($._list_item_upper_alpha_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_alpha_parens: ($) =>
      seq($.list_marker_upper_alpha_parens, $.list_item_content),

    _list_lower_roman_period: ($) =>
      seq(
        repeat1(alias($._list_item_lower_roman_period, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_roman_period: ($) =>
      seq($.list_marker_lower_roman_period, $.list_item_content),
    _list_lower_roman_paren: ($) =>
      seq(
        repeat1(alias($._list_item_lower_roman_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_roman_paren: ($) =>
      seq($.list_marker_lower_roman_paren, $.list_item_content),
    _list_lower_roman_parens: ($) =>
      seq(
        repeat1(alias($._list_item_lower_roman_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_lower_roman_parens: ($) =>
      seq($.list_marker_lower_roman_parens, $.list_item_content),

    _list_upper_roman_period: ($) =>
      seq(
        repeat1(alias($._list_item_upper_roman_period, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_roman_period: ($) =>
      seq($.list_marker_upper_roman_period, $.list_item_content),
    _list_upper_roman_paren: ($) =>
      seq(
        repeat1(alias($._list_item_upper_roman_paren, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_roman_paren: ($) =>
      seq($.list_marker_upper_roman_paren, $.list_item_content),
    _list_upper_roman_parens: ($) =>
      seq(
        repeat1(alias($._list_item_upper_roman_parens, $.list_item)),
        $._block_close,
      ),
    _list_item_upper_roman_parens: ($) =>
      seq($.list_marker_upper_roman_parens, $.list_item_content),

    list_item_content: ($) =>
      seq(
        $._block_with_heading,
        optional(
          repeat(
            seq(
              optional($._block_quote_prefix),
              $._list_item_continuation,
              $._block_with_heading,
            ),
          ),
        ),
        $._list_item_end,
      ),

    table: ($) =>
      prec.right(
        seq(
          repeat1($._table_content),
          optional($._newline),
          optional($.table_caption),
        ),
      ),
    _table_content: ($) =>
      choice(
        $.table_separator,
        seq(alias($.table_row, $.table_header), $.table_separator),
        $.table_row,
      ),
    table_separator: ($) =>
      prec.right(
        seq(
          optional($._block_quote_prefix),
          "|",
          $.table_cell_alignment,
          repeat(seq("|", $.table_cell_alignment)),
          "|",
          $._newline,
        ),
      ),
    table_row: ($) =>
      prec.right(
        seq(
          optional($._block_quote_prefix),
          "|",
          $.table_cell,
          repeat(seq("|", $.table_cell)),
          "|",
          $._newline,
        ),
      ),
    table_cell_alignment: (_) => token.immediate(prec(100, /\s*:?-+:?\s*/)),
    table_cell: ($) => $._inline,
    table_caption: ($) =>
      seq(
        alias($._table_caption_begin, $.marker),
        alias(repeat1($._inline_line), $.content),
        choice($._table_caption_end, "\0"),
      ),

    footnote: ($) =>
      seq(
        alias($._footnote_begin, $.footnote_marker_begin),
        $.reference_label,
        alias("]:", $.footnote_marker_end),
        $.footnote_content,
        $._footnote_end,
      ),
    footnote_content: ($) => repeat1($._block_with_heading),

    div: ($) =>
      seq(
        $.div_marker_begin,
        $._newline,
        alias(repeat($._block_with_heading), $.content),
        optional($._block_quote_prefix),
        $._block_close,
        optional(seq(alias($._div_end, $.div_marker_end), $._newline)),
      ),
    div_marker_begin: ($) =>
      seq($._div_begin, optional(seq($._whitespace1, $.class_name))),
    class_name: ($) => $._id,

    code_block: ($) =>
      seq(
        alias($._code_block_begin, $.code_block_marker_begin),
        $._whitespace,
        optional($.language),
        $._newline,
        optional($.code),
        $._block_close,
        optional(
          seq(alias($._code_block_end, $.code_block_marker_end), $._newline),
        ),
      ),
    raw_block: ($) =>
      seq(
        alias($._code_block_begin, $.raw_block_marker_begin),
        $._whitespace,
        $.raw_block_info,
        $._newline,
        optional(alias($.code, $.content)),
        $._block_close,
        optional(
          seq(alias($._code_block_end, $.raw_block_marker_end), $._newline),
        ),
      ),
    raw_block_info: ($) => seq(alias("=", $.language_marker), $.language),

    language: (_) => /[^\n\t \{\}=]+/,
    code: ($) =>
      prec.left(repeat1(seq(optional($._block_quote_prefix), $._line))),
    _line: ($) => seq(/[^\n]*/, $._newline),

    thematic_break: ($) =>
      choice($._thematic_break_dash, $._thematic_break_star),

    block_quote: ($) =>
      seq(
        alias($._block_quote_begin, $.block_quote_marker),
        alias($._block_quote_content, $.content),
        $._block_close,
      ),
    _block_quote_content: ($) =>
      seq(
        choice($.heading, $._block_element),
        repeat(seq($._block_quote_prefix, optional($._block_element))),
      ),
    _block_quote_prefix: ($) =>
      prec.left(
        repeat1(alias($._block_quote_continuation, $.block_quote_marker)),
      ),

    link_reference_definition: ($) =>
      seq(
        "[",
        $.link_label,
        "]",
        ":",
        $._whitespace1,
        $.link_destination,
        $._whitespace,
        $._one_or_two_newlines,
      ),
    link_label: ($) => $._inline,
    link_destination: (_) => /\S+/,

    block_attribute: ($) =>
      seq(
        "{",
        alias(
          repeat(
            choice(
              $.class,
              $.identifier,
              $.key_value,
              alias($._comment_no_newline, $.comment),
              $._whitespace1,
            ),
          ),
          $.args,
        ),
        "}",
        $._newline,
      ),
    class: ($) => seq(".", alias($.class_name, "class")),
    identifier: (_) => token(seq("#", token.immediate(/[^\s\}]+/))),
    key_value: ($) => seq($.key, "=", $.value),
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
        $._inline,
        repeat(seq($._newline_inline, $._inline)),
        // Last newline can be of the normal variant to signal the end of the paragraph.
        $._eof_or_newline,
      ),

    _one_or_two_newlines: ($) =>
      prec.left(
        choice(seq($._eof_or_newline, $._eof_or_newline), $._eof_or_newline),
      ),

    _whitespace: (_) => token.immediate(/[ \t]*/),
    _whitespace1: (_) => token.immediate(/[ \t]+/),

    // Use repeat1 over /[^\n]+/ regex to not gobble up everything
    // and allow other tokens to interrupt the inline capture.
    _inline: ($) => prec.left(repeat1(choice(/[^\n]/, $._symbol_fallback))),
    _inline_line: ($) => seq($._inline, $._eof_or_newline),

    _symbol_fallback: ($) =>
      prec.dynamic(
        -1000,
        choice(
          // "![",
          // "*",
          "[",
          // "[^",
          // "^",
          // "_",
          "{",
          // "{*",
          // "{+",
          "{-",
          // "{=",
          // "{^",
          // "{_",
          // "{~",
          "|",
          // "~",
          // "<",
          // "$",
        ),
      ),

    backslash_escape: (_) => /\\[^\\\r\n]/,

    reference_label: ($) => $._id,
    _id: (_) => /[\w_-]+/,

    _comment_no_newline: ($) =>
      seq(
        "%",
        alias(repeat(choice($.backslash_escape, /[^%\n]/)), $.content),
        "%",
      ),
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
    $._block_quote_continuation,
    $._thematic_break_dash,
    $._thematic_break_star,
    // Footnotes have significant whitespace.
    $._footnote_begin,
    $._footnote_end,
    // Table captions have significant whitespace.
    $._table_caption_begin,
    $._table_caption_end,

    // Inline elements.

    // Verbatim is handled externally to match a varying number of `,
    // and to close open verbatim when a paragraph ends with a blankline.
    $._verbatim_begin,
    $._verbatim_end,
    $._verbatim_content,

    // Never valid and is only used to signal an internal scanner error.
    $._error,
  ],
});
