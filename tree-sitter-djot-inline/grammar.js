const ELEMENT_PRECEDENCE = 100;

module.exports = grammar({
  name: "djot_inline",

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
    [$.math, $._symbol_fallback],

    [$._curly_bracket_span_begin, $._curly_bracket_span_fallback],
  ],

  rules: {
    // Top level to capture everything in the inline context.
    inline: ($) => $._inline,

    _inline: ($) =>
      prec.left(repeat1(choice($._element, $._newline, $._whitespace1))),

    _inline_without_trailing_space: ($) =>
      seq(
        prec.left(repeat(choice($._element, $._newline, $._whitespace1))),
        $._element,
      ),

    _element: ($) =>
      prec.left(
        choice(
          // Span is declared separately because it always parses an `inline_attribute`,
          // while the attribute is optional for everything else.
          $.span,
          seq(
            choice(
              $.hard_line_break,
              $._smart_punctuation,
              $.backslash_escape,
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
              $.math,
              $.raw_inline,
              $.symbol,
              $._comment_with_spaces,
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
                prec.dynamic(ELEMENT_PRECEDENCE, $.inline_attribute),
                $._curly_bracket_span_fallback,
              ),
            ),
          ),
        ),
      ),

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
        $.emphasis_begin,
        $._emphasis_mark_begin,
        alias($._inline_without_trailing_space, $.content),
        $.emphasis_end,
      ),
    emphasis_begin: ($) => choice("{_", seq("_", $._non_whitespace_check)),

    strong: ($) =>
      seq(
        $.strong_begin,
        $._strong_mark_begin,
        alias($._inline_without_trailing_space, $.content),
        $.strong_end,
      ),
    strong_begin: ($) => choice("{*", seq("*", $._non_whitespace_check)),

    // The syntax description isn't clear about if non-bracket can contain surrounding spaces.
    // The live playground suggests that yes they can, although it's a bit inconsistent.
    superscript: ($) =>
      seq(
        $.superscript_begin,
        $._superscript_mark_begin,
        alias($._inline, $.content),
        $.superscript_end,
      ),
    superscript_begin: (_) => choice("{^", "^"),

    subscript: ($) =>
      seq(
        $.subscript_begin,
        $._subscript_mark_begin,
        alias($._inline, $.content),
        $.subscript_end,
      ),
    subscript_begin: (_) => choice("{~", "~"),

    highlighted: ($) =>
      seq(
        $.highlighted_begin,
        $._highlighted_mark_begin,
        alias($._inline, $.content),
        $.highlighted_end,
      ),
    highlighted_begin: (_) => "{=",
    insert: ($) =>
      seq(
        $.insert_begin,
        $._insert_mark_begin,
        alias($._inline, $.content),
        $.insert_end,
      ),
    insert_begin: (_) => "{+",
    delete: ($) =>
      seq(
        $.delete_begin,
        $._delete_mark_begin,
        alias($._inline, $.content),
        $.delete_end,
      ),
    delete_begin: (_) => "{-",

    hard_line_break: ($) => seq("\\", $._newline),

    _smart_punctuation: ($) =>
      choice($.quotation_marks, $.ellipsis, $.em_dash, $.en_dash),
    // NOTE it would be nice to be able to mark bare " and ', but then we'd have to be smarter
    // so we don't mark the ' in `it's`.
    quotation_marks: (_) => token(choice('{"', '"}', "{'", "'}", '\\"', "\\'")),
    ellipsis: (_) => "...",
    em_dash: (_) => "---",
    en_dash: (_) => "--",

    backslash_escape: (_) => /\\[^\\\r\n]/,

    // No backlash escape in an autolink.
    autolink: (_) => seq("<", /[^>\s]+/, ">"),

    symbol: (_) => token(seq(":", /[\w\d_-]+/, ":")),

    footnote_reference: ($) =>
      seq(
        $.footnote_marker_begin,
        $._square_bracket_span_begin,
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
    full_reference_image: ($) => seq($.image_description, $._link_label),
    collapsed_reference_image: ($) =>
      seq($.image_description, token.immediate("[]")),
    inline_image: ($) => seq($.image_description, $.inline_link_destination),

    image_description: ($) =>
      seq(
        $._image_description_begin,
        $._square_bracket_span_begin,
        optional($._inline),
        alias($._square_bracket_span_end, "]"),
      ),
    _image_description_begin: (_) => "![",

    _link: ($) =>
      choice($.full_reference_link, $.collapsed_reference_link, $.inline_link),
    full_reference_link: ($) => seq($.link_text, $._link_label),
    collapsed_reference_link: ($) => seq($.link_text, token.immediate("[]")),
    inline_link: ($) => seq($.link_text, $.inline_link_destination),

    link_text: ($) =>
      seq(
        $._bracketed_text_begin,
        $._square_bracket_span_begin,
        $._inline,
        // Alias to "]" to allow us to highlight it in Neovim.
        // Maybe some bug, or some undocumented behavior?
        alias($._square_bracket_span_end, "]"),
      ),

    span: ($) =>
      seq(
        $._bracketed_text_begin,
        $._square_bracket_span_begin,
        alias($._inline, $.content),
        // Prefer span over regular text + inline attribute.
        prec.dynamic(
          ELEMENT_PRECEDENCE,
          alias($._square_bracket_span_end, "]"),
        ),
        $.inline_attribute,
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
              alias($._comment_with_newline, $.comment),
              $._whitespace1,
              $._newline,
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
        $._square_bracket_span_begin,
        $._inline,
        $._square_bracket_span_end,
      ),

    _link_label: ($) =>
      seq("[", alias($._inline, $.link_label), token.immediate("]")),
    inline_link_destination: ($) =>
      seq(
        $._parens_span_begin,
        $._parens_span_mark_begin,
        // Can escape `)`, but shouldn't capture it.
        /([^\)]|\\\))+/,
        alias($._parens_span_end, ")"),
      ),
    _parens_span_begin: (_) => "(",

    // An inline attribute is only allowed to have surrounding spaces
    // if it only contains a comment.
    comment: ($) => seq("{", $._comment_with_newline, "}"),
    _comment_with_spaces: ($) => seq($._whitespace1, $.comment),

    _comment_with_newline: ($) =>
      seq(
        "%",
        // With a whitespace here there's weirdly enough no conflict with
        // `_comment_no_newline` despite only a single choice difference.
        $._whitespace,
        alias(
          repeat(choice($.backslash_escape, /[^%\n]/, $._newline)),
          $.content,
        ),
        "%",
      ),
    _comment_no_newline: ($) =>
      seq(
        "%",
        alias(repeat(choice($.backslash_escape, /[^%\n]/)), $.content),
        "%",
      ),

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
        seq("[^", choice($._square_bracket_span_begin, $._in_fallback)),
        seq("![", choice($._square_bracket_span_begin, $._in_fallback)),
        seq("[", choice($._square_bracket_span_begin, $._in_fallback)),
        seq("(", choice($._parens_span_mark_begin, $._in_fallback)),

        // Autolink
        "<",
        seq("<", /[^>\s]+/),

        // Math
        "$",
      ),

    // Used to branch on inline attributes that may follow any element.
    _curly_bracket_span_fallback: ($) =>
      seq("{", choice($._curly_bracket_span_mark_begin, $._in_fallback)),

    language: (_) => /[^\n\t \{\}=]+/,

    _whitespace: (_) => token.immediate(/[ \t]*/),
    _whitespace1: (_) => token.immediate(/[ \t]+/),
    _newline: (_) => "\n",

    _text: (_) => repeat1(/\S/),

    class_name: ($) => $._id,
    class: ($) => seq(".", alias($.class_name, "class")),
    identifier: (_) => token(seq("#", token.immediate(/[^\s\}]+/))),
    key_value: ($) => seq($.key, "=", $.value),
    key: ($) => $._id,
    value: (_) => choice(seq('"', /[^"\n]+/, '"'), /\w+/),
  },

  externals: ($) => [
    // Used as default value in scanner, should never be referenced.
    $._ignored,

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
    $._square_bracket_span_begin,
    $._square_bracket_span_end,

    // A signaling token that's used to signal that a fallback token should be scanned,
    // and should never be output.
    // It's used to notify the external scanner if we're in the fallback branch or in
    // if we're scanning a span. This so the scanner knows if the current element should
    // be stored on the stack or not.
    $._in_fallback,
    // A zero-width whitespace check token.
    $._non_whitespace_check,

    // Should never be used in the grammar and is output when a branch should be pruned.
    $._error,
  ],
});
