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

    [$._inline_attribute_begin, $._inline_attribute_fallback],
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
              $._image,
              $._link,
              $._comment_with_spaces,
              $._todo_highlights,
              $._symbol_fallback,
              $._text,
            ),
            optional(choice($.inline_attribute, $._inline_attribute_fallback)),
          ),
          $.span,
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

    // No backlash escape in an autolink.
    autolink: (_) => seq("<", /[^>\s]+/, ">"),

    symbol: (_) => token(seq(":", /[\w\d_-]+/, ":")),

    footnote_reference: ($) =>
      seq(
        $.footnote_marker_begin,
        $._footnote_marker_mark_begin,
        $.reference_label,
        prec.dynamic(1000, $.footnote_marker_end),
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
    full_reference_image: ($) => seq($._image_description, $._link_label),
    collapsed_reference_image: ($) =>
      seq($._image_description, token.immediate("[]")),
    inline_image: ($) => seq($._image_description, $.inline_link_destination),

    _image_description: ($) =>
      seq(
        $._image_description_begin,
        $._image_description_mark_begin,
        optional(alias($._inline, $.image_description)),
        prec.dynamic(1000, $._image_description_end),
      ),
    _image_description_begin: (_) => "![",

    _link: ($) =>
      choice($.full_reference_link, $.collapsed_reference_link, $.inline_link),
    full_reference_link: ($) => seq($.link_text, $._link_label),
    collapsed_reference_link: ($) => seq($.link_text, token.immediate("[]")),
    inline_link: ($) => seq($.link_text, $.inline_link_destination),

    link_text: ($) => $._bracketed_text,

    span: ($) =>
      // Both bracketed_text and inline_attribute contributes +1000 each,
      // so we pull it back to 1000 so it's the same as other spans,
      // making precedence work properly.
      prec.dynamic(-1000, seq($._bracketed_text, $.inline_attribute)),

    inline_attribute: ($) =>
      seq(
        $._inline_attribute_begin,
        $._inline_attribute_mark_begin,
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
        prec.dynamic(1000, $._inline_attribute_end),
      ),
    _inline_attribute_begin: (_) => "{",

    _bracketed_text: ($) =>
      seq(
        $._bracketed_text_begin,
        $._bracketed_text_mark_begin,
        $._inline,
        prec.dynamic(1000, $._bracketed_text_end),
      ),
    _bracketed_text_begin: (_) => "[",

    _link_label: ($) =>
      seq("[", alias($._inline, $.link_label), token.immediate("]")),
    inline_link_destination: (_) => seq("(", /[^\)]+/, ")"),

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

        // Footnotes
        seq("[^", choice($._footnote_marker_mark_begin, $._in_fallback)),

        // Fallbacks for spans, links and images
        seq("![", choice($._image_description_mark_begin, $._in_fallback)),
        seq("[", choice($._bracketed_text_mark_begin, $._in_fallback)),

        // Autolink
        "<",
        seq("<", /[^>\s]+/),

        // Math
        "$",
      ),

    // Used to branch on inline attributes that may follow any element.
    _inline_attribute_fallback: ($) =>
      seq("{", choice($._inline_attribute_mark_begin, $._in_fallback)),

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
    // The bracketed text covers the first `[text]` portion of spans and links.
    $._bracketed_text_mark_begin,
    $._bracketed_text_end,
    // The image description is the first `![text]` part of the image.
    $._image_description_mark_begin,
    $._image_description_end,
    $._inline_attribute_mark_begin,
    $._inline_attribute_end,
    $._footnote_marker_mark_begin,
    $.footnote_marker_end,

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
