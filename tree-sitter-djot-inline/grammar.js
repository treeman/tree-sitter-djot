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

    [$._image_description, $._symbol_fallback],
    [$.math, $._symbol_fallback],
    [$.link_text, $.span, $._symbol_fallback],

    [$._inline, $._comment_with_spaces],
    [$._inline_without_trailing_space, $._comment_with_spaces],
    [$._comment_with_spaces],
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
              $._comment_with_spaces,
              $._todo_highlights,
              $._symbol_fallback,
              $._text,
            ),
            optional($.inline_attribute),
          ),
          $.span,
        ),
      ),

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
        prec.dynamic(1000, $.emphasis_end),
      ),
    emphasis_begin: ($) => choice("{_", seq("_", $._non_whitespace_check)),

    strong: ($) =>
      seq(
        $.strong_begin,
        $._strong_mark_begin,
        alias($._inline_without_trailing_space, $.content),
        prec.dynamic(1000, $.strong_end),
      ),
    strong_begin: ($) => choice("{*", seq("*", $._non_whitespace_check)),

    // The syntax description isn't clear about if non-bracket can contain surrounding spaces.
    // The live playground suggests that yes they can, although it's a bit inconsistent.
    superscript: ($) =>
      seq(
        $.superscript_begin,
        $._superscript_mark_begin,
        alias($._inline, $.content),
        prec.dynamic(1000, $.superscript_end),
      ),
    superscript_begin: (_) => choice("{^", "^"),

    subscript: ($) =>
      seq(
        $.subscript_begin,
        $._subscript_mark_begin,
        alias($._inline, $.content),
        prec.dynamic(1000, $.subscript_end),
      ),
    subscript_begin: (_) => choice("{~", "~"),

    highlighted: ($) =>
      seq(
        $.highlighted_begin,
        $._highlighted_mark_begin,
        alias($._inline, $.content),
        prec.dynamic(1000, $.highlighted_end),
      ),
    highlighted_begin: (_) => "{=",
    insert: ($) =>
      seq(
        $.insert_begin,
        $._insert_mark_begin,
        alias($._inline, $.content),
        prec.dynamic(1000, $.insert_end),
      ),
    insert_begin: (_) => "{+",
    delete: ($) =>
      seq(
        $.delete_begin,
        $._delete_mark_begin,
        alias($._inline, $.content),
        prec.dynamic(1000, $.delete_end),
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

    autolink: (_) => seq("<", /[^>\s]+/, ">"),

    symbol: (_) => token(seq(":", /[^:\s]+/, ":")),

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
    full_reference_image: ($) => seq($._image_description, $._link_label),
    collapsed_reference_image: ($) =>
      seq($._image_description, token.immediate("[]")),
    inline_image: ($) => seq($._image_description, $.inline_link_destination),

    _image_description: ($) =>
      seq("![", optional(alias($._inline, $.image_description)), "]"),

    _link: ($) =>
      choice($.full_reference_link, $.collapsed_reference_link, $.inline_link),
    full_reference_link: ($) => seq($.link_text, $._link_label),
    collapsed_reference_link: ($) => seq($.link_text, token.immediate("[]")),
    inline_link: ($) => seq($.link_text, $.inline_link_destination),

    link_text: ($) => seq("[", $._inline, "]"),

    _link_label: ($) =>
      seq("[", alias($._inline, $.link_label), token.immediate("]")),
    inline_link_destination: (_) => seq("(", /[^\n\)]+/, ")"),

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

    // An inline attribute is only allowed to have surrounding spaces
    // if it only contains a comment.
    comment: ($) => seq("{", $._comment_with_newline, "}"),
    _comment_with_spaces: ($) => seq($._whitespace1, $.comment),

    span: ($) => seq("[", $._inline, "]", $.inline_attribute),

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
        "![",
        "[",
        "[^",
        "{",
        "<",
        "$",
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
      ),

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

    $._in_fallback,
    $._non_whitespace_check,

    // Never valid and is only used to signal an internal scanner error.
    $._error,
  ],
});
