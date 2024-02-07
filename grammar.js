module.exports = grammar({
  name: "Djot",

  // precedences: (_) => [["heading", "paragraph"]],

  extras: (_) => [/\s/, "\r"],

  rules: {
    document: ($) => repeat($._block),

    // Blocks can be parsed line by line with no backtracking,
    // although newlines are recommended to separate blocks they aren't always required.
    _block: ($) =>
      choice(
        // $._heading,
        // $.block_quote,
        // $.list,
        // $.code_block,
        // $.thematic_break,
        // $.raw_block,
        // $.div,
        // $.pipe_table,
        // $.ref_link_def,
        // $.footnote,
        // $.block_attribute,
        $.paragraph
      ),

    // _heading: (
    //   $ //seq("#", /\s/, $.text),
    // ) =>
    //   choice(
    //   $.heading1,
    // // $.heading2,
    // // $.heading3,
    // // $.heading4,
    // // $.heading5,
    // // $.heading6
    // ),

    // heading1: ($) => seq($._heading1, $._eof_or_blankline),

    //   heading1: ($) =>
    //     prec.left(seq("#", repeat1($._inline), $._eof_or_blankline)),

    // paragraph: ($) => seq($._inline_lines, $._eof_or_blankline),
    //
    ///// Yet another approach:
    // Eat
    // paragraph: ($) => seq($.inline, $.soft_line_break, $._eof_or_blankline),
    paragraph: ($) => seq($.inline, $._eof_or_blankline),

    _eof_or_blankline: (_) => choice("\0", "\n\n", "\n\0"),

    eof: (_) => `\0`,
    soft_line_break: (_) => "\n",
    hard_line_break: ($) => seq("\\", $.soft_line_break),

    inline: ($) =>
      prec.left(
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
            $._text,
            /\s/
          )
        )
      ),
    _text: (_) => /\S+/,
  },
});
