module.exports = grammar({
  name: "djot",

  // TODO need to escape special characters everywhere
  // maybe we can do this early and automatically skip them in our token logic?
  // But we shouldn't mark things inside verbatim or code blocks

  // Containing block should automatically close:
  // - Paragraph
  // - Header
  // - Changing list style closes adjacent list of other type
  // - Code block (from blockquote or list)
  // - Raw block
  // - Div

  // Container blocks that can close:
  // - Block quote
  // - Div
  // - List

  extras: (_) => ["\r"],

  // conflicts: ($) => [
  // NOTE I don't know how/when these take into effect?
  // [$._inline],
  // [$._inline_no_spaces],
  // [$.emphasis, $._text],
  // [$._inline_no_surrounding_spaces],
  //   [$.paragraph, $.div],
  //   [$._inline_with_newlines, $._close_paragraph],
  // ],

  rules: {
    document: ($) => repeat($._block),

    // Every block contains a newline.
    _block: ($) =>
      choice(
        $._heading,
        $.list,
        // $.pipe_table, // External. Has a caption too that needs to match indent
        // $.footnote, // External, needs to consider indentation level
        $.div,
        $.raw_block,
        $.code_block,
        // FIXME maybe need to make this external, to not clash with lists?
        $.thematicbreak,
        $.blockquote, // External, can close other blocks end should capture marker + continuation
        $.link_reference_definition,
        $.block_attribute,
        $.paragraph,
        "\n"
      ),

    _heading: ($) =>
      choice(
        $.heading1,
        $.heading2,
        $.heading3,
        $.heading4,
        $.heading5,
        $.heading6
      ),
    // TODO mark '#' with marker
    heading1: ($) => seq("#", $._gobble_header),
    heading2: ($) => seq(/#{2}/, $._gobble_header),
    heading3: ($) => seq(/#{3}/, $._gobble_header),
    heading4: ($) => seq(/#{4}/, $._gobble_header),
    heading5: ($) => seq(/#{5}/, $._gobble_header),
    heading6: ($) => seq(/#{6}/, $._gobble_header),
    // NOTE because we don't tag the `#` character individually,
    // there's no need to match the beginning `#` of each consecutive line.
    _gobble_header: ($) => seq($._inline_with_newlines, $._eof_or_blankline),

    list: ($) =>
      // Djot has a crazy number of different list types,
      // that we need to keep separate from each other.
      prec.left(
        choice(
          $._list_dash
          // $._list_plus,
          // $._list_star,
          // $._list_decimal_period,
          // $._list_decimal_paren,
          // $._list_decimal_parens,
          // $._list_lower_alpha_period,
          // $._list_lower_alpha_paren,
          // $._list_lower_alpha_parens,
          // $._list_upper_alpha_period,
          // $._list_upper_alpha_paren,
          // $._list_upper_alpha_parens,
          // $._list_lower_roman_period,
          // $._list_lower_roman_paren,
          // $._list_lower_roman_parens,
          // $._list_upper_roman_period,
          // $._list_upper_roman_paren,
          // $._list_upper_roman_parens,
          // $._list_definition,
          // $._list_task
        )
      ),
    _list_dash: ($) =>
      seq(
        repeat1(alias($._list_item_dash, $.list_item)),
        // alias($._block_close, $.list_block_close)
        $._block_close
      ),
    _list_item_dash: ($) => seq($.list_marker_dash, $._list_item_content),

    _list_item_content: ($) =>
      // seq(repeat1($._block), alias($._list_item_end, $.list_item_end)),
      seq(repeat1($._block), $._list_item_end),

    div: ($) =>
      seq(
        $.div_marker_start,
        "\n",
        repeat($._block),
        $._block_close,
        optional(alias($._div_end, $.div_marker_end))
      ),
    div_marker_start: ($) =>
      seq($._div_start, optional(seq($._whitespace1, $.class_name))),
    class_name: (_) => /\w+/,

    raw_block: ($) =>
      seq(
        alias($._code_block_start, $.raw_block_marker_start),
        $._whitespace,
        $.raw_block_info,
        /[ ]*\n/,
        alias($.code, $.content),
        $._block_close,
        optional(alias($._code_block_end, $.raw_block_marker_end))
      ),
    raw_block_info: ($) => seq(alias("=", $.language_marker), $.language),

    code_block: ($) =>
      seq(
        alias($._code_block_start, $.code_block_marker_start),
        $._whitespace,
        optional($.language),
        /[ ]*\n/,
        $.code,
        $._block_close,
        optional(alias($._code_block_end, $.code_block_marker_end))
      ),
    language: (_) => /[^\n\t \{\}=]+/,
    code: ($) => prec.left(repeat1($._line)),
    _line: (_) => /[^\n]*\n/,

    thematicbreak: ($) => choice($._star_thematicbreak, $._minus_thematicbreak),
    // Very pretty!
    _star_thematicbreak: (_) => /[ ]*\*[ ]*\*[ ]*\*[ \*]*\n/,
    _minus_thematicbreak: (_) => /[ ]*-[ ]*-[ ]*-[ \-]*\n/,

    // It's fine to let inline gobble up leading `>` for lazy
    // quotes lines.
    // ... But is it really?? Shouldn't we mark them as something as well?
    blockquote: ($) => seq(">", $._inline_with_newlines, $._eof_or_blankline),

    link_reference_definition: ($) =>
      seq(
        alias($._reference_link_label, $.link_label),
        token.immediate(":"),
        /\s+/,
        $.link_destination,
        $._one_or_two_newlines
      ),
    _reference_link_label: (_) =>
      token(seq("[", token.immediate(/\w+/), token.immediate("]"))),
    link_destination: (_) => /\S+/,

    block_attribute: ($) =>
      seq(
        "{",
        repeat(
          choice(
            $.class,
            $.identifier,
            $.key_value,
            alias($._comment_no_newline, $.comment),
            $._whitespace1
          )
        ),
        "}"
      ),
    class: ($) => seq(".", alias($.class_name, "class")),
    identifier: (_) => token(seq("#", token.immediate(/\w+/))),
    key_value: ($) => seq($.key, "=", $.value),
    key: (_) => /\w+/,
    value: (_) => choice(seq('"', /[^"\n]+/, '"'), /\w+/),

    paragraph: ($) =>
      seq(
        // repeat1(seq(optional($._block_indent), $._inline, choice("\n", "\0"))),
        repeat1(seq($._inline, choice("\n", "\0"))),
        choice($._eof_or_blankline, $._close_paragraph)
      ),

    // _eof_or_blankline: (_) => choice("\0", "\n"),
    _one_or_two_newlines: (_) => choice("\0", "\n\n", "\n"),

    _whitespace: (_) => token.immediate(/[ \t]*/),
    _whitespace1: (_) => token.immediate(/[ \t]+/),

    _inline: ($) => repeat1(choice($._inline_no_spaces, " ")),
    _inline_no_spaces: ($) =>
      choice(
        seq(
          choice(
            $.autolink,
            $.emphasis,
            $.strong,
            $.highlighted,
            $.superscript,
            $.subscript,
            $.insert,
            $.delete,
            $._smart_punctuation,
            $.verbatim,
            $.math,
            $.raw_inline,
            $.footnote_reference,
            $.hard_line_break,
            $.symbol,
            $.span,
            $._image,
            $._link,
            $._text
          ),
          optional($.inline_attribute)
        ),
        $.span
      ),
    _inline_no_surrounding_spaces: ($) =>
      choice(
        repeat1(prec.left($._inline_no_spaces)),
        seq($._inline_no_spaces, $._inline, $._inline_no_spaces)
      ),
    _inline_with_newlines: ($) => repeat1(prec.left(choice($._inline, /\s/))),

    autolink: (_) => token(seq("<", /[^>\s]+/, ">")),

    // FIXME errors out if there's spaces instead of parsing other inline options
    // need to somehow tell it to explore all possibilities?
    emphasis: ($) =>
      seq($._emphasis_start, $._inline_no_surrounding_spaces, $._emphasis_end),
    _emphasis_start: (_) => token(choice(seq("{_", /[ ]*/), "_")),
    _emphasis_end: (_) => token.immediate(choice(seq(/[ ]*/, "_}"), "_")),

    strong: ($) =>
      seq($._strong_start, $._inline_no_surrounding_spaces, $._strong_end),
    _strong_start: (_) => token(choice(seq("{*", /[ ]*/), "*")),
    _strong_end: (_) => token.immediate(choice(seq(/[ ]*/, "*}"), "*")),

    highlighted: ($) => prec.left(seq("{=", $._inline, "=}")),
    insert: ($) => prec.left(seq("{+", $._inline, "+}")),
    delete: ($) => prec.left(seq("{-", $._inline, "-}")),
    symbol: (_) => token(seq(":", /[^:\s]+/, ":")),

    // The syntax description isn't clear about this.
    // Can the non-bracketed versions include spaces?
    superscript: ($) =>
      prec.left(seq(choice("{^", "^"), $._inline, choice("^}", "^"))),
    subscript: ($) =>
      prec.left(seq(choice("{~", "~"), $._inline, choice("~}", "~"))),

    _smart_punctuation: ($) =>
      choice($.escaped_quote, $.ellipsis, $.em_dash, $.en_dash),
    escaped_quote: (_) => token(choice('{"', '}"', "{'", "}'", '\\"', "\\'")),
    ellipsis: (_) => "...",
    em_dash: (_) => "---",
    en_dash: (_) => "--",

    footnote_reference: ($) => seq("[^", $.reference_label, "]"),
    reference_label: (_) => /\w+/,

    hard_line_break: (_) => "\\\n",

    _image: ($) =>
      choice(
        $.full_reference_image,
        $.collapsed_reference_image,
        $.inline_image
      ),
    full_reference_image: ($) => seq($.image_description, $.link_label),
    collapsed_reference_image: ($) =>
      seq($.image_description, token.immediate("[]")),
    inline_image: ($) => seq($.image_description, $.inline_link_destination),

    image_description: ($) => seq("![", $._inline, "]"),

    _link: ($) =>
      choice($.full_reference_link, $.collapsed_reference_link, $.inline_link),
    full_reference_link: ($) => seq($.link_text, $.link_label),
    collapsed_reference_link: ($) => seq($.link_text, token.immediate("[]")),
    inline_link: ($) => seq($.link_text, $.inline_link_destination),

    link_text: ($) => seq(`[`, $._inline, "]"),

    link_label: ($) => seq("[", $._inline, token.immediate("]")),
    inline_link_destination: (_) => seq("(", /[^\)]+/, ")"),

    inline_attribute: ($) =>
      seq(
        token.immediate("{"),
        repeat(
          choice(
            $.class,
            $.identifier,
            $.key_value,
            alias($._comment_with_newline, $.comment),
            /\s+/
          )
        ),
        "}"
      ),

    span: ($) => seq("[", $._inline, "]", $.inline_attribute),

    _comment_with_newline: (_) => seq("%", /[^%]+/, "%"),
    _comment_no_newline: (_) => seq("%", /[^%\n]+/, "%"),

    raw_inline: ($) =>
      seq(
        alias($._verbatim_start, $.raw_inline_marker_start),
        $._verbatim_content,
        alias($._verbatim_end, $.raw_inline_marker_end),
        $.raw_inline_attribute
      ),
    raw_inline_attribute: ($) => seq(token.immediate("{="), $.language, "}"),
    math: ($) =>
      seq(
        alias("$", $.math_marker),
        alias($._verbatim_start, $.math_marker_start),
        $._verbatim_content,
        alias($._verbatim_end, $.math_marker_end)
      ),
    verbatim: ($) =>
      seq(
        alias($._verbatim_start, $.verbatim_marker_start),
        $._verbatim_content,
        alias($._verbatim_end, $.verbatim_marker_end)
      ),

    _text: (_) => /\S/,
  },

  externals: ($) => [
    // Block management
    $._block_indent,
    $._block_close,
    $._eof_or_blankline,

    // Blocks
    $._div_start,
    $._div_end,
    $._code_block_start,
    $._code_block_end,
    $.list_marker_dash,
    $._list_item_end,
    $._close_paragraph,

    // Inline
    $._verbatim_start,
    $._verbatim_end,
    $._verbatim_content,

    // Never valid and is used to kill parse branches.
    $._error,
    // Used as default value in scanner, should never be referenced.
    $._ignored,
  ],
});
