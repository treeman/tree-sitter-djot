module.exports = grammar({
  name: "Djot",

  // TODO need to escape special characters everywhere
  // maybe we can do this early and automatically skip them in our token logic?

  precedences: (_) => [["heading", "link_reference_definition", "paragraph"]],

  extras: (_) => [/\s/, "\r"],

  rules: {
    document: ($) => repeat($._block),

    // Every block contains a newline.
    _block: ($) =>
      choice(
        $._heading,
        $.blockquote,
        // $.list, // Needs external scanner to match indentation!
        $.codeblock, // Should be external to match number of `
        $.thematicbreak,
        // $.raw_block,
        // $.div, // External to match number of `:`
        // $.pipe_table, // External. Has a caption too that needs to match indent
        $.link_reference_definition,
        // $.footnote, // External, needs to consider indentation level
        $.block_attribute,
        $.paragraph
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
    heading1: ($) => seq("#", $._gobble_header),
    heading2: ($) => seq(/#{2}/, $._gobble_header),
    heading3: ($) => seq(/#{3}/, $._gobble_header),
    heading4: ($) => seq(/#{4}/, $._gobble_header),
    heading5: ($) => seq(/#{5}/, $._gobble_header),
    heading6: ($) => seq(/#{6}/, $._gobble_header),
    // NOTE because we don't tag the `#` character individually,
    // there's no need to match the beginning `#` of each consecutive line.
    _gobble_header: ($) => seq($._inline, $._eof_or_blankline),

    // It's fine to let inline gobble up leading `>` for lazy
    // quotes lines.
    blockquote: ($) => seq(">", $._inline, $._eof_or_blankline),

    // TODO move this to an external scanner so we can match the number of
    // opening/ending `, so we can embed ``` inside.
    // Also we need to implicitly close this when its parent container is closed...
    codeblock: ($) =>
      prec.right(
        seq("```", seq(optional($.language), "\n"), $.code, "```", "\n")
      ),
    language: (_) => prec(100, /\S+/),
    code: ($) => prec.left(repeat1($.line)),
    line: (_) => seq(repeat(/\S+/), "\n"),

    // This is quite ugly, maybe would've been simpler to use an external scanner?
    thematicbreak: ($) => choice($._star_thematicbreak, $._minus_thematicbreak),
    _star_thematicbreak: ($) =>
      prec.left(
        choice(
          seq("*", "*", "*", $._end_star_thematicbreak),
          seq("**", "*", $._end_star_thematicbreak),
          seq("*", "**", $._end_star_thematicbreak),
          seq("***", $._end_star_thematicbreak)
        )
      ),
    _end_star_thematicbreak: (_) => seq(repeat(/\*+/), "\n"),
    _minus_thematicbreak: ($) =>
      prec.left(
        choice(
          seq("-", "-", "-", $._end_minus_thematicbreak),
          seq("--", "-", $._end_minus_thematicbreak),
          seq("-", "--", $._end_minus_thematicbreak),
          seq("---", $._end_minus_thematicbreak)
        )
      ),
    _end_minus_thematicbreak: (_) => seq(repeat(/-+/), "\n"),

    link_reference_definition: ($) =>
      seq($.link_label, $.link_destination, "\n"),
    link_label: (_) =>
      token(prec(100, seq("[", token.immediate(/\S+/), token.immediate("]:")))),
    link_destination: (_) => /\S+/,

    block_attribute: ($) =>
      seq(
        token(prec(1000, "{")),
        repeat(choice($.class, $.identifier, $.key_value)),
        "}",
        "\n"
      ),

    class: ($) => seq(".", token.immediate(/[^}]+/)),
    identifier: ($) => token(prec(100, seq("#", token.immediate(/[^}]+/)))),
    key_value: ($) => seq($.key, "=", $.value),
    key: ($) => /\w+/,
    value: ($) => choice(seq('"', /[^"]+/, '"'), /\w+/),

    paragraph: ($) => seq($._inline, $._eof_or_blankline),

    _eof_or_blankline: (_) => choice("\0", "\n\n", "\n\0"),

    _soft_line_break: (_) => "\n",
    _hard_line_break: ($) => seq("\\", $._soft_line_break),

    _inline: ($) =>
      // prec.left(
      repeat1(
        choice(
          //       // $.link,
          //       // $.image,
          //       // $.autolink,
          //       // $.verbatim,
          //       // $.emphasis,
          //       // $.highlighted,
          //       // $.superscript,
          //       // $.subscript,
          //       // $.insert,
          //       // $.delete,
          //       // // Smart punctuation
          //       // $.math,
          //       // $.footnote_reference,
          //       // $.line_break,
          //       // $.comment,
          //       // $.symbol,
          //       // $.raw_inline,
          //       // $.span,
          //       // // $.inline_attribute,
          $._text
        )
      ),
    // ),
    _text: (_) => /\S+/,
  },
});
