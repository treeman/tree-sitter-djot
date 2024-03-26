module.exports = grammar({
  name: "djot",

  extras: (_) => ["\r"],

  conflicts: ($) => [
    [$._table_content],
    [$._inline_no_surrounding_spaces],
    [$._inline_element_with_whitespace, $._inline_no_surrounding_spaces],
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

    // Headings can't be mixed, this verbose description (together with the external scanner)
    // ensures that they're not.
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

    // Djot has a crazy number of different list types,
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
    table_cell: ($) =>
      prec.left(repeat1($._inline_element_with_whitespace_without_newline)),
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
        repeat(
          seq(
            $._block_quote_prefix,
            optional($._block_without_standalone_newline),
          ),
        ),
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
        // Blankline is split out from paragraph to enable textobject
        // to not select newline up to following text.
        alias($._paragraph_content, $.paragraph),
        choice($._eof_or_blankline, $._close_paragraph),
      ),
    _paragraph_content: ($) => seq($._inline, $._newline),

    _one_or_two_newlines: ($) =>
      prec.left(choice("\0", seq($._newline, $._newline), $._newline)),

    _whitespace: (_) => token.immediate(/[ \t]*/),
    _whitespace1: (_) => token.immediate(/[ \t]+/),

    _inline: ($) => prec.left(repeat1($._inline_element_with_whitespace)),

    _inline_element_with_whitespace: ($) =>
      choice($._inline_element_with_newline, $._whitespace1),
    _inline_element_with_whitespace_without_newline: ($) =>
      choice($._inline_core_element, $._whitespace1),
    _inline_element_without_whitespace: ($) =>
      choice($._inline_element_with_newline, $._whitespace1),
    _inline_element_with_newline: ($) =>
      choice(
        $._inline_core_element,
        seq($._newline_inline, optional($._block_quote_prefix)),
      ),

    _inline_core_element: ($) =>
      prec.left(
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
      ),

    // Emphasis and strong markers aren't allowed to exist next a space.
    // This incarnation exists to ensure that the content doesn't start or end
    // with a space.
    _inline_no_surrounding_spaces: ($) =>
      choice(
        $._inline_element_with_newline,
        seq(
          $._inline_element_with_newline,
          repeat($._inline_element_with_whitespace),
          $._inline_element_with_newline,
        ),
      ),

    _inline_line: ($) => seq($._inline, $._newline),

    hard_line_break: ($) =>
      seq("\\", $._newline, optional($._block_quote_prefix)),

    _smart_punctuation: ($) =>
      choice($.straight_quote, $.ellipsis, $.em_dash, $.en_dash),
    straight_quote: (_) => token(choice('{"', '}"', "{'", "}'", '\\"', "\\'")),
    ellipsis: (_) => "...",
    em_dash: (_) => "---",
    en_dash: (_) => "--",

    backslash_escape: (_) => /\\[^\\\n]/,

    autolink: (_) => seq("<", /[^>\s]+/, ">"),

    emphasis: ($) =>
      seq(
        $.emphasis_begin,
        alias($._inline_no_surrounding_spaces, $.content),
        $.emphasis_end,
      ),

    // Use explicit begin/end to be able to capture ending tokens with arbitrary whitespace.
    // Note that I couldn't replace repeat(" ") with $._whitespace for some reason...
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
    // prefixes. A collision isn't detected with a string and the
    // catch-all `_text` regex.
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
    $._eof_or_blankline,
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
    $._heading1_begin,
    // Heading continuation can continue a heading, but only if
    // they match the number of `#` (or there's no `#`).
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

    // Never valid and is used to kill parse branches.
    $._error,
  ],
});
