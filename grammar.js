module.exports = grammar({
  name: "djot",

  extras: (_) => ["\r"],

  conflicts: ($) => [
    [$._table_content],
    [$._inline],
    [$._inline_no_prec],
    [$._inline_no_prec, $._inline_no_surrounding_spaces],
    [$._inline_no_surrounding_spaces],
    [$.emphasis_begin, $._symbol_fallback],
    [$.strong_begin, $._symbol_fallback],
    [$.highlighted, $._symbol_fallback],
    [$.superscript, $._symbol_fallback],
    [$.subscript, $._symbol_fallback],
    [$.insert, $._symbol_fallback],
    [$.delete, $._symbol_fallback],
    [$.table_row, $._symbol_fallback],
    [$.image_description, $._symbol_fallback],
    [$.math, $._symbol_fallback],
    [$.link_text, $.span, $._symbol_fallback],
    [$.link_reference_definition, $.link_text, $.span, $._symbol_fallback],
    [$.block_attribute, $._symbol_fallback],
  ],

  rules: {
    document: ($) => seq(optional($.frontmatter), repeat($._block)),

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

    // Every block contains a newline.
    _block: ($) => choice($._block_without_standalone_newline, $._newline),

    _block_without_standalone_newline: ($) =>
      choice(
        $._heading,
        $.list,
        $.table,
        $.footnote,
        $.div,
        $.raw_block,
        $.code_block,
        $.thematic_break,
        $.block_quote,
        $.link_reference_definition,
        // NOTE Maybe the block attribute should be included inside all blocks?
        $.block_attribute,
        $._paragraph,
      ),

    _heading: ($) =>
      choice(
        $.heading1,
        $.heading2,
        $.heading3,
        $.heading4,
        $.heading5,
        $.heading6,
      ),
    heading1: ($) =>
      seq(
        alias($._heading1_begin, $.marker),
        alias($._heading1_content, $.content),
        $._block_close,
        optional($._eof_or_blankline),
      ),
    _heading1_content: ($) =>
      seq(
        $._inline_line,
        repeat(seq(alias($._heading1_continuation, $.marker), $._inline_line)),
      ),
    heading2: ($) =>
      seq(
        alias($._heading2_begin, $.marker),
        alias($._heading2_content, $.content),
        $._block_close,
        optional($._eof_or_blankline),
      ),
    _heading2_content: ($) =>
      seq(
        $._inline_line,
        repeat(seq(alias($._heading2_continuation, $.marker), $._inline_line)),
      ),
    heading3: ($) =>
      seq(
        alias($._heading3_begin, $.marker),
        alias($._heading5_content, $.content),
        $._block_close,
        optional($._eof_or_blankline),
      ),
    _heading3_content: ($) =>
      seq(
        $._inline_line,
        repeat(seq(alias($._heading3_continuation, $.marker), $._inline_line)),
      ),
    heading4: ($) =>
      seq(
        alias($._heading4_begin, $.marker),
        alias($._heading5_content, $.content),
        $._block_close,
        optional($._eof_or_blankline),
      ),
    _heading4_content: ($) =>
      seq(
        $._inline_line,
        repeat(seq(alias($._heading4_continuation, $.marker), $._inline_line)),
      ),
    heading5: ($) =>
      seq(
        alias($._heading5_begin, $.marker),
        alias($._heading5_content, $.content),
        $._block_close,
        optional($._eof_or_blankline),
      ),
    _heading5_content: ($) =>
      seq(
        $._inline_line,
        repeat(seq(alias($._heading5_continuation, $.marker), $._inline_line)),
      ),
    heading6: ($) =>
      seq(
        alias($._heading6_begin, $.marker),
        alias($._heading6_content, $.content),
        $._block_close,
        optional($._eof_or_blankline),
      ),
    _heading6_content: ($) =>
      seq(
        $._inline_line,
        repeat(seq(alias($._heading6_continuation, $.marker), $._inline_line)),
      ),

    list: ($) =>
      // Djot has a crazy number of different list types,
      // that we need to keep separate from each other.
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
    _list_item_dash: ($) => seq($.list_marker_dash, $.list_item_content),

    _list_plus: ($) =>
      seq(repeat1(alias($._list_item_plus, $.list_item)), $._block_close),
    _list_item_plus: ($) => seq($.list_marker_plus, $.list_item_content),

    _list_star: ($) =>
      seq(repeat1(alias($._list_item_star, $.list_item)), $._block_close),
    _list_item_star: ($) => seq($.list_marker_star, $.list_item_content),

    _list_task: ($) =>
      seq(repeat1(alias($._list_item_task, $.list_item)), $._block_close),
    _list_item_task: ($) => seq($.list_marker_task, $.list_item_content),
    list_marker_task: ($) =>
      seq(
        $._list_marker_task_begin,
        "[",
        choice(alias(" ", $.unchecked), alias(choice("x", "X"), $.checked)),
        "]",
        $._whitespace1,
      ),

    _list_definition: ($) =>
      seq(repeat1(alias($._list_item_definition, $.list_item)), $._block_close),
    _list_item_definition: ($) =>
      seq(
        $.list_marker_definition,
        alias($._paragraph_content, $.term),
        choice($._eof_or_blankline, $._close_paragraph),
        alias(optional(repeat($._block)), $.definition),
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

    list_item_content: ($) => seq(repeat1($._block), $._list_item_end),

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
    table_cell_alignment: (_) => token.immediate(prec(100, /:?-+:?/)),
    table_cell: ($) => prec.left($._inline),
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
    footnote_content: ($) => repeat1($._block),

    div: ($) =>
      seq(
        $.div_marker_begin,
        $._newline,
        alias(repeat($._block), $.content),
        $._block_close,
        optional(alias($._div_end, $.div_marker_end)),
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
        optional(alias($._code_block_end, $.code_block_marker_end)),
      ),
    raw_block: ($) =>
      seq(
        alias($._code_block_begin, $.raw_block_marker_begin),
        $._whitespace,
        $.raw_block_info,
        $._newline,
        optional(alias($.code, $.content)),
        $._block_close,
        optional(alias($._code_block_end, $.raw_block_marker_end)),
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
        $._block_without_standalone_newline,
        repeat(seq($._block_quote_prefix, $._block_without_standalone_newline)),
      ),
    _block_quote_prefix: ($) =>
      prec.left(
        repeat1(alias($._block_quote_continuation, $.block_quote_marker)),
      ),

    link_reference_definition: ($) =>
      seq(
        "[",
        alias($._inline, $.link_label),
        "]",
        ":",
        $._whitespace1,
        $.link_destination,
        $._one_or_two_newlines,
      ),
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
      ),
    class: ($) => seq(".", alias($.class_name, "class")),
    identifier: (_) => token(seq("#", token.immediate(/[^\s\}]+/))),
    key_value: ($) => seq($.key, "=", $.value),
    key: ($) => $._id,
    value: (_) => choice(seq('"', /[^"\n]+/, '"'), /\w+/),

    _paragraph: ($) =>
      seq(
        // Blankline is split out from paragraph to enable textobject
        // to not select newline up to following text
        alias($._paragraph_content, $.paragraph),
        choice($._eof_or_blankline, $._close_paragraph),
      ),
    _paragraph_content: ($) =>
      repeat1(seq(optional($._block_quote_prefix), $._inline_line)),

    _one_or_two_newlines: ($) =>
      prec.left(choice("\0", seq($._newline, $._newline), $._newline)),

    _whitespace: (_) => token.immediate(/[ \t]*/),
    _whitespace1: (_) => token.immediate(/[ \t]+/),

    _inline: ($) =>
      prec.left(
        seq(
          $._inline_with_whitespace,
          repeat(seq($._newline, $._inline_with_whitespace)),
        ),
      ),
    _inline_no_prec: ($) =>
      seq(
        $._inline_with_whitespace,
        repeat(seq($._newline, $._inline_with_whitespace)),
      ),
    _inline_with_whitespace: ($) =>
      repeat1(choice($._inline_no_spaces, $._whitespace1)),
    _inline_no_spaces: ($) =>
      choice(
        seq(
          choice(
            $.hard_line_break,
            $._smart_punctuation,
            $.backslash_escape,
            $.autolink,
            $.emphasis,
            $.strong,
            $.highlighted,
            $.superscript,
            $.subscript,
            $.insert,
            $.delete,
            $.verbatim,
            $.math,
            $.raw_inline,
            $.footnote_reference,
            $.symbol,
            $.span,
            $._image,
            $._link,
            $._todo_highlights,
            $._symbol_fallback,
            $._text,
          ),
          optional($.inline_attribute),
        ),
        $.span,
      ),
    _inline_no_surrounding_spaces: ($) =>
      choice(
        // Workaround for a weird issue where nested emphasis
        // of a certain length isn't recognized properly.
        // I have no idea how that happens, almost feels like a bug?
        prec(100, repeat1($._inline_no_spaces)),
        seq(
          // This is pretty gross...
          // I wonder if there's a smarter way to solve this?
          // There are various edge cases that needs to be considered.
          repeat1($._inline_no_spaces),
          optional($._newline),
          optional(seq($._inline_no_prec, optional($._newline))),
          repeat1($._inline_no_spaces),
        ),
      ),

    _inline_line: ($) => seq($._inline, $._newline),

    hard_line_break: ($) => seq("\\", $._newline),

    _smart_punctuation: ($) =>
      choice($.straight_quote, $.ellipsis, $.em_dash, $.en_dash),
    straight_quote: (_) => token(choice('{"', '}"', "{'", "}'", '\\"', "\\'")),
    ellipsis: (_) => "...",
    em_dash: (_) => "---",
    en_dash: (_) => "--",

    backslash_escape: (_) => /\\[^\\\n]/,

    autolink: (_) => seq("<", /[^>\s]+/, ">"),

    // Note that I couldn't replace repeat(" ") with $._whitespace for some reason...
    emphasis: ($) =>
      seq(
        $.emphasis_begin,
        alias($._inline_no_surrounding_spaces, $.content),
        $.emphasis_end,
      ),

    // Use explicit begin/end to be able to capture ending tokens with arbitrary whitespace.
    emphasis_begin: (_) => choice(seq("{_", repeat(" ")), "_"),
    emphasis_end: (_) => choice(token(seq(repeat(" "), "_}")), "_"),

    strong: ($) =>
      seq(
        $.strong_begin,
        alias($._inline_no_surrounding_spaces, $.content),
        $.strong_end,
      ),
    strong_begin: (_) => choice(seq("{*", repeat(" ")), "*"),
    strong_end: (_) => choice(token(seq(repeat(" "), "*}")), "*"),

    highlighted: ($) => seq("{=", alias($._inline, $.content), "=}"),
    insert: ($) => seq("{+", alias($._inline, $.content), "+}"),
    delete: ($) => seq("{-", alias($._inline, $.content), "-}"),
    symbol: (_) => token(seq(":", /[^:\s]+/, ":")),

    // The syntax description isn't clear about if non-bracket can contain surrounding spaces?
    // The live playground suggests that yes they can.
    superscript: ($) =>
      seq(choice("{^", "^"), alias($._inline, $.content), choice("^}", "^")),
    subscript: ($) =>
      seq(choice("{~", "~"), alias($._inline, $.content), choice("~}", "~")),

    footnote_reference: ($) =>
      seq(
        alias("[^", $.footnote_marker_begin),
        $.reference_label,
        alias("]", $.footnote_marker_end),
      ),

    reference_label: ($) => $._id,
    _id: (_) => /[\w_-]+/,

    _image: ($) =>
      choice(
        $.full_reference_image,
        $.collapsed_reference_image,
        $.inline_image,
      ),
    full_reference_image: ($) => seq($.image_description, $.link_label),
    collapsed_reference_image: ($) =>
      seq($.image_description, token.immediate("[]")),
    inline_image: ($) => seq($.image_description, $.inline_link_destination),

    image_description: ($) => seq("![", optional($._inline), "]"),

    _link: ($) =>
      choice($.full_reference_link, $.collapsed_reference_link, $.inline_link),
    full_reference_link: ($) => seq($.link_text, $.link_label),
    collapsed_reference_link: ($) => seq($.link_text, token.immediate("[]")),
    inline_link: ($) => seq($.link_text, $.inline_link_destination),

    link_text: ($) => seq("[", $._inline, "]"),

    link_label: ($) => seq("[", $._inline, token.immediate("]")),
    inline_link_destination: (_) => seq("(", /[^\)]+/, ")"),

    inline_attribute: ($) =>
      seq(
        token.immediate("{"),
        alias(
          repeat(
            choice(
              $.class,
              $.identifier,
              $.key_value,
              alias($._comment_with_newline, $.comment),
              $._whitespace1,
              $._newline,
            ),
          ),
          $.args,
        ),
        "}",
      ),

    span: ($) => seq("[", $._inline, "]", $.inline_attribute),

    _comment_with_newline: ($) =>
      seq("%", $._whitespace, alias(/[^%]+/, $.content), "%"),
    _comment_no_newline: ($) =>
      seq("%", $._whitespace, alias(/[^%\n]+/, $.content), "%"),

    raw_inline: ($) =>
      seq(
        alias($._verbatim_begin, $.raw_inline_marker_begin),
        alias($._verbatim_content, $.content),
        alias($._verbatim_end, $.raw_inline_marker_end),
        $.raw_inline_attribute,
      ),
    raw_inline_attribute: ($) => seq(token.immediate("{="), $.language, "}"),
    math: ($) =>
      seq(
        alias("$", $.math_marker),
        alias($._verbatim_begin, $.math_marker_begin),
        alias($._verbatim_content, $.content),
        alias($._verbatim_end, $.math_marker_end),
      ),
    verbatim: ($) =>
      seq(
        alias($._verbatim_begin, $.verbatim_marker_begin),
        alias($._verbatim_content, $.content),
        alias($._verbatim_end, $.verbatim_marker_end),
      ),

    _todo_highlights: ($) => choice($.todo, $.note, $.fixme),
    todo: (_) => "TODO",
    note: (_) => "NOTE",
    fixme: (_) => "FIXME",

    // These exists to explicit trigger an LR collision with existing
    // prefixes. A collision isn't detected with a string and a
    // catch-all _text regex.
    _symbol_fallback: ($) =>
      prec.dynamic(
        -1000,
        choice(
          "![",
          "*",
          "[",
          "[^",
          "^",
          "_",
          "{",
          "{*",
          "{+",
          "{-",
          "{=",
          "{^",
          "{_",
          "{~",
          "|",
          "~",
          "<",
          "$",
        ),
      ),
    // Could think that a repeat1() here would be useful,
    // but for some reason it breaks one edge case test.
    _text: (_) => /\S/,
  },

  externals: ($) => [
    // Block management
    $._block_close,
    $._eof_or_blankline,
    $._newline,

    // Special
    $.frontmatter_marker,

    // Blocks
    $._heading1_begin,
    $._heading1_continuation,
    $._heading2_begin,
    $._heading2_continuation,
    $._heading3_begin,
    $._heading3_continuation,
    $._heading4_begin,
    $._heading4_continuation,
    $._heading5_begin,
    $._heading5_continuation,
    $._heading6_begin,
    $._heading6_continuation,
    $._div_begin,
    $._div_end,
    $._code_block_begin,
    $._code_block_end,
    $.list_marker_dash,
    $.list_marker_star,
    $.list_marker_plus,
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
    $._list_item_end,
    $._close_paragraph,
    $._block_quote_begin,
    $._block_quote_continuation,
    $._thematic_break_dash,
    $._thematic_break_star,
    $._footnote_begin,
    $._footnote_end,
    $._table_caption_begin,
    $._table_caption_end,

    // Inline
    $._verbatim_begin,
    $._verbatim_end,
    $._verbatim_content,

    // Never valid and is used to kill parse branches.
    $._error,
    // Used as default value in scanner, should never be referenced.
    $._ignored,
  ],
});
