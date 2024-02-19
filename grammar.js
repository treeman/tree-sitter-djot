module.exports = grammar({
  name: "djot",

  // TODO need to escape special characters everywhere
  // maybe we can do this early and automatically skip them in our token logic?

  // Can be directly followed:
  // - Thematic break or fenced block can be followed by paragraph
  // But maybe we already have this?

  // Paragraph can never be interrupted by the start of another block level element
  // Paragraph end: blankline, eof, end of containing block

  // Containing block should automatically close:
  // - Paragraph
  // - Header
  // - Changing list style closes adjacent list of other type
  // - Code block
  // - Raw block
  // - Div

  // Container blocks that can close:
  // - Code block
  // - Raw block
  // - Block quote
  // - Div

  // Link def url can be split into multiple lines

  // Strategy with external scanner:
  // Identify start and end of all blocks.
  //
  // Keep a stack of block level elements to close inside
  // (meaning we need to track all blocks).
  //
  // When something is closed, we should issue a "$._close_block" token
  // that we always match to close all blocks.
  //
  // Need to track paragraphs as well, and paragraphs should close
  // either via $._close_block or blankline or eof.

  extras: (_) => ["\r"],

  rules: {
    document: ($) => repeat($._block),

    // Every block contains a newline.
    _block: ($) =>
      choice(
        $._heading,
        // $.list, // Needs external scanner to match indentation!
        // $.pipe_table, // External. Has a caption too that needs to match indent
        // $.footnote, // External, needs to consider indentation level
        $.div,
        // $.codeblock,
        // $.raw_block,
        // $.thematicbreak,
        $.blockquote,
        $.link_reference_definition,
        // $.block_attribute,
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
    heading1: ($) => seq("#", $._gobble_header),
    heading2: ($) => seq(/#{2}/, $._gobble_header),
    heading3: ($) => seq(/#{3}/, $._gobble_header),
    heading4: ($) => seq(/#{4}/, $._gobble_header),
    heading5: ($) => seq(/#{5}/, $._gobble_header),
    heading6: ($) => seq(/#{6}/, $._gobble_header),
    // NOTE because we don't tag the `#` character individually,
    // there's no need to match the beginning `#` of each consecutive line.
    _gobble_header: ($) => seq($._inline_with_newlines, $._eof_or_blankline),

    // I guess we could use an external scanner to allow arbitrary symbols,
    // but this was easier :)
    // div: ($) => choice($._div3, $._div4, $._div5, $._div6, $._div7, $._div8),
    // _div3: ($) => seq(/:{3}/, $._inside_div, /:{3}/),
    // _div4: ($) => seq(/:{4}/, $._inside_div, /:{4}/),
    // _div5: ($) => seq(/:{5}/, $._inside_div, /:{5}/), _div6: ($) => seq(/:{6}/, $._inside_div, /:{6}/),
    // _div7: ($) => seq(/:{7}/, $._inside_div, /:{7}/),
    // _div8: ($) => seq(/:{8}/, $._inside_div, /:{8}/),
    // _inside_div: ($) =>
    //   prec.left(seq(/[ ]*/, optional($.class_name), "\n", repeat($._block))),
    // class_name: (_) => /\w+/,
    div: ($) =>
      seq(
        alias($._div_start, $.div_marker_start),
        optional($.class_name),
        "\n",
        repeat($._block),
        alias($._block_close, $.block_close),
        optional(alias($._div_end, $.div_marker_end))
        // choice(
        //   seq(
        //     alias($._div_end, $.div_marker_end),
        //     alias($._block_close, $.block_close_with_div)
        //   ),
        //   alias($._block_close, $.block_close_no_div)
        // )
      ),
    class_name: (_) => /\w+/,

    // It's fine to let inline gobble up leading `>` for lazy
    // quotes lines.
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

    paragraph: ($) => seq($._inline_with_newlines, $._eof_or_blankline),

    _eof_or_blankline: (_) => choice("\0", "\n\n", "\n\0"),
    _one_or_two_newlines: (_) => choice("\0", "\n\n", "\n"),

    _inline: ($) =>
      repeat1(
        choice(
          // $.image,
          // $.autolink,
          // $.verbatim, // Should match ` count
          // $.emphasis,
          // $.strong,
          // $.highlighted,
          // $.superscript,
          // $.subscript,
          // $.insert,
          // $.delete,
          // // Smart punctuation
          // $.math,
          // $.footnote_reference,
          // $.line_break,
          // $.comment,
          // $.symbol,
          // $.raw_inline,
          // $.span,
          // // $.inline_attribute,
          $._link,
          $._text,
          // alias($._text, $.txt)
          " "
        )
      ),
    _inline_with_newlines: ($) => repeat1(prec.left(choice($._inline, /\s/))),

    _link: ($) =>
      choice($.full_reference_link, $.collapsed_reference_link, $.inline_link),

    full_reference_link: ($) => seq($.link_text, $.link_label),
    collapsed_reference_link: ($) => seq($.link_text, token.immediate("[]")),
    inline_link: ($) => seq($.link_text, $.inline_link_destination),

    link_text: ($) => seq("[", $._inline, "]"),

    link_label: ($) => seq("[", $._inline, token.immediate("]")),
    inline_link_destination: (_) => seq("(", /[^\)]+/, ")"),

    _text: (_) => /\S/,
  },

  externals: ($) => [
    $._block_close,
    $._div_start,
    $._div_end,

    // Never valid and is used to kill parse branches.
    $._error,
    // Should never be used.
    $._unusued,
  ],
});
