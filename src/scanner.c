#include "tree_sitter/parser.h"
#include <assert.h>
#include <stdio.h>

// NOTE maybe we should never use asserts?
// Issue ERROR token instead.

// Maybe we should implement a growable stack or something,
// but this is probably fine.
#define STACK_SIZE 512

#define DEBUG

typedef enum {
  BLOCK_CLOSE,
  EOF_OR_BLANKLINE,
  NEWLINE,

  HEADING1_START,
  HEADING1_CONTINUATION,
  HEADING2_START,
  HEADING2_CONTINUATION,
  HEADING3_START,
  HEADING3_CONTINUATION,
  HEADING4_START,
  HEADING4_CONTINUATION,
  HEADING5_START,
  HEADING5_CONTINUATION,
  HEADING6_START,
  HEADING6_CONTINUATION,
  DIV_START,
  DIV_END,
  CODE_BLOCK_START,
  CODE_BLOCK_END,
  LIST_MARKER_DASH,
  LIST_MARKER_STAR,
  LIST_MARKER_PLUS,
  LIST_MARKER_TASK_START,
  LIST_MARKER_DEFINITION,
  LIST_MARKER_DECIMAL_PERIOD,
  LIST_MARKER_LOWER_ALPHA_PERIOD,
  LIST_MARKER_UPPER_ALPHA_PERIOD,
  LIST_MARKER_LOWER_ROMAN_PERIOD,
  LIST_MARKER_UPPER_ROMAN_PERIOD,
  LIST_MARKER_DECIMAL_PAREN,
  LIST_MARKER_LOWER_ALPHA_PAREN,
  LIST_MARKER_UPPER_ALPHA_PAREN,
  LIST_MARKER_LOWER_ROMAN_PAREN,
  LIST_MARKER_UPPER_ROMAN_PAREN,
  LIST_MARKER_DECIMAL_PARENS,
  LIST_MARKER_LOWER_ALPHA_PARENS,
  LIST_MARKER_UPPER_ALPHA_PARENS,
  LIST_MARKER_LOWER_ROMAN_PARENS,
  LIST_MARKER_UPPER_ROMAN_PARENS,
  LIST_ITEM_END,
  CLOSE_PARAGRAPH,
  BLOCK_QUOTE_START,
  BLOCK_QUOTE_CONTINUATION,
  THEMATIC_BREAK_DASH,
  THEMATIC_BREAK_STAR,

  VERBATIM_START,
  VERBATIM_END,
  VERBATIM_CONTENT,

  ERROR,
  IGNORED
} TokenType;

typedef enum {
  BLOCK_QUOTE,
  CODE_BLOCK,
  DIV,
  HEADING,
  LIST_DASH,
  LIST_STAR,
  LIST_PLUS,
  LIST_TASK,
  LIST_DEFINITION,
  LIST_DECIMAL_PERIOD,
  LIST_LOWER_ALPHA_PERIOD,
  LIST_UPPER_ALPHA_PERIOD,
  LIST_LOWER_ROMAN_PERIOD,
  LIST_UPPER_ROMAN_PERIOD,
  LIST_DECIMAL_PAREN,
  LIST_LOWER_ALPHA_PAREN,
  LIST_UPPER_ALPHA_PAREN,
  LIST_LOWER_ROMAN_PAREN,
  LIST_UPPER_ROMAN_PAREN,
  LIST_DECIMAL_PARENS,
  LIST_LOWER_ALPHA_PARENS,
  LIST_UPPER_ALPHA_PARENS,
  LIST_LOWER_ROMAN_PARENS,
  LIST_UPPER_ROMAN_PARENS,
} BlockType;

typedef enum {
  DECIMAL,
  LOWER_ALPHA,
  UPPER_ALPHA,
  LOWER_ROMAN,
  UPPER_ROMAN,
} OrderedListType;

typedef struct {
  BlockType type;
  // Level can be either indentation or number of opening/ending symbols.
  // Or it may also be unused.
  uint8_t level;
} Block;

typedef struct {
  struct {
    size_t size;
    Block *items[STACK_SIZE];
  } open_blocks;

  // How many $._close_block we should output right now?
  uint8_t blocks_to_close;

  // Delayed output of a token, used to first output closing token(s)
  // before this token.
  TokenType delayed_token;
  uint8_t delayed_token_width;

  // The number of ` we are currently matching, or 0 when not inside.
  uint8_t verbatim_tick_count;

  // What's our current block quote level?
  uint8_t block_quote_level;

  // Currently consumed whitespace.
  uint8_t whitespace;
} Scanner;

static void dump_scanner(Scanner *s);
static void dump(Scanner *s, TSLexer *lexer);
static void dump_valid_symbols(const bool *valid_symbols);

static char *token_type_s(TokenType t);
static char *block_type_s(BlockType t);

static TokenType scan_list_marker_token(Scanner *s, TSLexer *lexer);

static bool is_list(BlockType type) {
  switch (type) {
  case LIST_DASH:
  case LIST_STAR:
  case LIST_PLUS:
  case LIST_TASK:
  case LIST_DEFINITION:
  case LIST_DECIMAL_PERIOD:
  case LIST_LOWER_ALPHA_PERIOD:
  case LIST_UPPER_ALPHA_PERIOD:
  case LIST_LOWER_ROMAN_PERIOD:
  case LIST_UPPER_ROMAN_PERIOD:
  case LIST_DECIMAL_PAREN:
  case LIST_LOWER_ALPHA_PAREN:
  case LIST_UPPER_ALPHA_PAREN:
  case LIST_LOWER_ROMAN_PAREN:
  case LIST_UPPER_ROMAN_PAREN:
  case LIST_DECIMAL_PARENS:
  case LIST_LOWER_ALPHA_PARENS:
  case LIST_UPPER_ALPHA_PARENS:
  case LIST_LOWER_ROMAN_PARENS:
  case LIST_UPPER_ROMAN_PARENS:
    return true;
  default:
    return false;
  }
}

static BlockType list_marker_to_block(TokenType type) {
  switch (type) {
  case LIST_MARKER_DASH:
    return LIST_DASH;
  case LIST_MARKER_STAR:
    return LIST_STAR;
  case LIST_MARKER_PLUS:
    return LIST_PLUS;
  case LIST_MARKER_TASK_START:
    return LIST_TASK;
  case LIST_MARKER_DEFINITION:
    return LIST_DEFINITION;
  case LIST_MARKER_DECIMAL_PERIOD:
    return LIST_DECIMAL_PERIOD;
  case LIST_MARKER_LOWER_ALPHA_PERIOD:
    return LIST_LOWER_ALPHA_PERIOD;
  case LIST_MARKER_UPPER_ALPHA_PERIOD:
    return LIST_UPPER_ALPHA_PERIOD;
  case LIST_MARKER_LOWER_ROMAN_PERIOD:
    return LIST_LOWER_ROMAN_PERIOD;
  case LIST_MARKER_UPPER_ROMAN_PERIOD:
    return LIST_UPPER_ROMAN_PERIOD;
  case LIST_MARKER_DECIMAL_PAREN:
    return LIST_DECIMAL_PAREN;
  case LIST_MARKER_LOWER_ALPHA_PAREN:
    return LIST_LOWER_ALPHA_PAREN;
  case LIST_MARKER_UPPER_ALPHA_PAREN:
    return LIST_UPPER_ALPHA_PAREN;
  case LIST_MARKER_LOWER_ROMAN_PAREN:
    return LIST_LOWER_ROMAN_PAREN;
  case LIST_MARKER_UPPER_ROMAN_PAREN:
    return LIST_UPPER_ROMAN_PAREN;
  case LIST_MARKER_DECIMAL_PARENS:
    return LIST_DECIMAL_PARENS;
  case LIST_MARKER_LOWER_ALPHA_PARENS:
    return LIST_LOWER_ALPHA_PARENS;
  case LIST_MARKER_UPPER_ALPHA_PARENS:
    return LIST_UPPER_ALPHA_PARENS;
  case LIST_MARKER_LOWER_ROMAN_PARENS:
    return LIST_LOWER_ROMAN_PARENS;
  case LIST_MARKER_UPPER_ROMAN_PARENS:
    return LIST_UPPER_ROMAN_PARENS;
  default:
    assert(false);
  }
}

static uint8_t consume_chars(Scanner *s, TSLexer *lexer, char c) {
  uint8_t count = 0;
  while (lexer->lookahead == c) {
    lexer->advance(lexer, false);
    ++count;
  }
  return count;
}

static uint8_t consume_whitespace(Scanner *s, TSLexer *lexer) {
  uint8_t indent = 0;
  for (;;) {
    if (lexer->lookahead == ' ') {
      lexer->advance(lexer, false);
      ++indent;
    } else if (lexer->lookahead == '\t') {
      lexer->advance(lexer, false);
      indent += 4;
    } else {
      break;
    }
  }
  return indent;
}

static Block *create_block(BlockType type, uint8_t level) {
  Block *b = malloc(sizeof(Block));
  b->type = type;
  b->level = level;
  return b;
}

static void push_block(Scanner *s, BlockType type, uint8_t level) {
  s->open_blocks.items[s->open_blocks.size++] = create_block(type, level);
}

static void pop_block(Scanner *s) {
  if (s->open_blocks.size > 0) {
    free(s->open_blocks.items[--s->open_blocks.size]);
    if (s->blocks_to_close > 0) {
      --s->blocks_to_close;
    }
  } else {
    assert(false);
  }
}

static bool any_block(Scanner *s) { return s->open_blocks.size > 0; }

static Block *peek_block(Scanner *s) {
  if (s->open_blocks.size == 0) {
    return NULL;
  } else {
    return s->open_blocks.items[s->open_blocks.size - 1];
  }
}

void set_delayed_token(Scanner *s, TokenType token, uint8_t token_width) {
  s->delayed_token = token;
  s->delayed_token_width = token_width;
}

static bool output_delayed_token(Scanner *s, TSLexer *lexer,
                                 const bool *valid_symbols) {
  if (s->delayed_token != IGNORED) {
    lexer->result_symbol = s->delayed_token;
    s->delayed_token = IGNORED;
    while (s->delayed_token_width--) {
      lexer->advance(lexer, false);
    }
    lexer->mark_end(lexer);
    return true;
  } else {
    return false;
  }
}

// How many blocks from the top of the stack can we find a matching block?
// If it's directly on the top, returns 1.
// If it cannot be found, returns 0.
static size_t number_of_blocks_from_top(Scanner *s, BlockType type,
                                        uint8_t level) {
  for (int i = s->open_blocks.size - 1; i >= 0; --i) {
    Block *b = s->open_blocks.items[i];
    if (b->type == type && b->level == level) {
      return s->open_blocks.size - i;
    }
  }
  return 0;
}

// static size_t number_of_blocks_from_top_no_level(Scanner *s, BlockType type)
// {
//   for (int i = s->open_blocks.size - 1; i >= 0; --i) {
//     Block *b = s->open_blocks.items[i];
//     if (b->type == type) {
//       return s->open_blocks.size - i;
//     }
//   }
//   return 0;
// }

static Block *find_block(Scanner *s, BlockType type) {
  for (int i = s->open_blocks.size - 1; i >= 0; --i) {
    Block *b = s->open_blocks.items[i];
    if (b->type == type) {
      return b;
    }
  }
  return NULL;
}

static Block *get_open_list(Scanner *s) {
  for (int i = s->open_blocks.size - 1; i >= 0; --i) {
    Block *b = s->open_blocks.items[i];
    if (is_list(b->type)) {
      return b;
    }
  }
  return NULL;
}

static bool has_open_list(Scanner *s) { return get_open_list(s) != NULL; }

// Mark that we should close `count` blocks.
// This call will only emit a single BLOCK_CLOSE token,
// the other are emitted in `parse_block_close`.
static void close_blocks(Scanner *s, TSLexer *lexer, size_t count) {
  // assert(s->blocks_to_close == 0);
  pop_block(s);
  s->blocks_to_close = s->blocks_to_close + count - 1;
  lexer->result_symbol = BLOCK_CLOSE;
}

// Mark that we should close `count` blocks.
// This call will only emit a single BLOCK_CLOSE token,
// the other are emitted in `parse_block_close`.
//
// The final block type (such as a `DIV_END` token)
// is emitted from `output_delayed_token` when all BLOCK_CLOSE
// tokens are handled.
static void close_blocks_with_final_token(Scanner *s, TSLexer *lexer,
                                          size_t count, TokenType final,
                                          uint8_t final_token_width) {
  close_blocks(s, lexer, count);
  set_delayed_token(s, final, final_token_width);
}

static bool handle_blocks_to_close(Scanner *s, TSLexer *lexer) {
  if (s->open_blocks.size == 0) {
    return false;
  }

  // If we reach eof with open blocks, we should close them all.
  if (lexer->eof(lexer)) {
    lexer->result_symbol = BLOCK_CLOSE;
    pop_block(s);
    return true;
  }
  if (s->blocks_to_close > 0) {
    lexer->result_symbol = BLOCK_CLOSE;
    pop_block(s);
    return true;
  }
  return false;
}

static bool close_different_list_if_needed(Scanner *s, TSLexer *lexer,
                                           Block *list, TokenType list_marker) {
  if (list_marker != IGNORED) {
    BlockType to_open = list_marker_to_block(list_marker);
    if (list->type != to_open) {
      lexer->result_symbol = BLOCK_CLOSE;
      pop_block(s);
      return true;
    }
  }
  return false;
}

static bool close_lists_if_needed(Scanner *s, TSLexer *lexer, bool non_newline,
                                  TokenType ordered_list_marker) {
  if (s->open_blocks.size == 0) {
    return false;
  }

  Block *top = peek_block(s);
  Block *list = get_open_list(s);

  // If we're in a block that's in a list
  // we should check the indentation level,
  // and if it's less than the current list, we need to close that block.
  if (non_newline && list && list != top) {
    if (s->whitespace < list->level) {
      lexer->result_symbol = BLOCK_CLOSE;
      pop_block(s);
      return true;
    }
  }

  // If we're about to open a list of a different type, we
  // need to close the previous list.
  if (list) {
    if (close_different_list_if_needed(s, lexer, list, ordered_list_marker)) {
      return true;
    }
    TokenType other_list_marker = scan_list_marker_token(s, lexer);
    if (close_different_list_if_needed(s, lexer, list, other_list_marker)) {
      return true;
    }
  }

  return false;
}

static bool scan_div_marker(Scanner *s, TSLexer *lexer, uint8_t *colons,
                            size_t *from_top) {
  *colons = consume_chars(s, lexer, ':');
  if (*colons < 3) {
    return false;
  }
  *from_top = number_of_blocks_from_top(s, DIV, *colons);
  return true;
}

static bool is_div_marker_next(Scanner *s, TSLexer *lexer) {
  uint8_t colons;
  size_t from_top;
  return scan_div_marker(s, lexer, &colons, &from_top);
}

static bool parse_code_block(Scanner *s, TSLexer *lexer, uint8_t ticks) {
  if (ticks < 3) {
    return false;
  }

  if (s->open_blocks.size > 0) {
    // Code blocks can't contain other blocks, so we only look at the top.
    Block *top = peek_block(s);
    if (top->type == CODE_BLOCK) {
      if (top->level == ticks) {
        // Found a matching block that we should close.
        lexer->mark_end(lexer);
        // Issue BLOCK_CLOSE before CODE_BLOCK_END.
        close_blocks_with_final_token(s, lexer, 1, CODE_BLOCK_END, 3);
        return true;
      } else {
        // We're in a code block with a different number of `, ignore these.
        return false;
      }
    }
  }

  // Not in a code block, let's start a new one.
  lexer->mark_end(lexer);
  push_block(s, CODE_BLOCK, ticks);
  lexer->result_symbol = CODE_BLOCK_START;
  return true;
}

static bool parse_verbatim_start(Scanner *s, TSLexer *lexer, uint8_t ticks) {
  lexer->mark_end(lexer);
  s->verbatim_tick_count = ticks;
  lexer->result_symbol = VERBATIM_START;
  return true;
}

static bool parse_verbatim_end(Scanner *s, TSLexer *lexer, uint8_t ticks) {
  if (s->verbatim_tick_count == 0) {
    return false;
  }

  lexer->mark_end(lexer);
  s->verbatim_tick_count = 0;
  lexer->result_symbol = VERBATIM_END;
  return true;
}

static bool try_close_verbatim(Scanner *s, TSLexer *lexer) {
  if (s->verbatim_tick_count > 0) {
    s->verbatim_tick_count = 0;
    lexer->result_symbol = VERBATIM_END;
    return true;
  } else {
    return false;
  }
}

static bool parse_verbatim_content(Scanner *s, TSLexer *lexer) {
  if (s->verbatim_tick_count == 0) {
    return false;
  }

  uint8_t ticks = 0;
  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '\n') {
      // We shouldn't consume the newline, leave that for VERBATIM_END.
      break;
    } else if (lexer->lookahead == '`') {
      // If we find a `, we need to count them to see if we should stop.
      uint8_t current = consume_chars(s, lexer, '`');
      if (current == s->verbatim_tick_count) {
        // We found a matching number of `
        // We need to return VERBATIM_CONTENT then VERBATIM_END in the next
        // scan.
        s->verbatim_tick_count = 0;
        set_delayed_token(s, VERBATIM_END, current);
        break;
      } else {
        // Found a number of ` that doesn't match the start,
        // we should consume them.
        lexer->mark_end(lexer);
        ticks = 0;
      }
    } else {
      // Non-` token found, this we should consume.
      lexer->advance(lexer, false);
      lexer->mark_end(lexer);
      ticks = 0;
    }
  }
  lexer->result_symbol = VERBATIM_CONTENT;
  return true;
}

static bool parse_backtick(Scanner *s, TSLexer *lexer,
                           const bool *valid_symbols) {
  uint8_t ticks = consume_chars(s, lexer, '`');
  if (ticks == 0) {
    return false;
  }

  // CODE_BLOCK_END is issued after BLOCK_CLOSE and is handled with a delayed
  // output.
  if (valid_symbols[CODE_BLOCK_START] || valid_symbols[BLOCK_CLOSE]) {
    if (parse_code_block(s, lexer, ticks)) {
      return true;
    }
  }
  if (valid_symbols[VERBATIM_END] && parse_verbatim_end(s, lexer, ticks)) {
    return true;
  }
  if (valid_symbols[VERBATIM_START] && parse_verbatim_start(s, lexer, ticks)) {
    return true;
  }
  return false;
}

static bool scan_bullet_list_marker(Scanner *s, TSLexer *lexer, char marker) {
  if (lexer->lookahead != marker) {
    return false;
  }
  lexer->advance(lexer, false);
  if (lexer->lookahead != ' ') {
    return false;
  }
  lexer->advance(lexer, false);
  return true;
}

static bool is_decimal(char c) { return '0' <= c && c <= '9'; }
static bool is_lower_alpha(char c) { return 'a' <= c && c <= 'z'; }
static bool is_upper_alpha(char c) { return 'A' <= c && c <= 'Z'; }
static bool is_lower_roman(char c) {
  switch (c) {
  case 'i':
  case 'v':
  case 'x':
  case 'l':
  case 'c':
  case 'd':
  case 'm':
    return true;
  default:
    return false;
  }
}
static bool is_upper_roman(char c) {
  switch (c) {
  case 'I':
  case 'V':
  case 'X':
  case 'L':
  case 'C':
  case 'D':
  case 'M':
    return true;
  default:
    return false;
  }
}

static bool matches_ordered_list(OrderedListType type, char c) {
  switch (type) {
  case DECIMAL:
    return is_decimal(c);
  case LOWER_ALPHA:
    return is_lower_alpha(c);
  case UPPER_ALPHA:
    return is_upper_alpha(c);
  case LOWER_ROMAN:
    return is_lower_roman(c);
  case UPPER_ROMAN:
    return is_upper_roman(c);
  }
}

// Return true if we scan any character.
static bool scan_ordered_list_enumerator(Scanner *s, TSLexer *lexer,
                                         OrderedListType type) {
  uint8_t scanned = 0;
  while (!lexer->eof(lexer)) {
    if (matches_ordered_list(type, lexer->lookahead)) {
      ++scanned;
      lexer->advance(lexer, false);
    } else {
      break;
    }
  }
  return scanned > 0;
}

static bool scan_ordered_list_type(Scanner *s, TSLexer *lexer,
                                   OrderedListType *res) {
  // How to decide between alpha and roman?
  // For now just prefer roman (starting with i seems a bit weird for alpha?)
  bool first_lower_alpha = is_lower_alpha(lexer->lookahead);
  bool first_upper_alpha = is_upper_alpha(lexer->lookahead);

  if (scan_ordered_list_enumerator(s, lexer, DECIMAL)) {
    *res = DECIMAL;
    return true;
  }
  if (scan_ordered_list_enumerator(s, lexer, LOWER_ROMAN)) {
    *res = LOWER_ROMAN;
    return true;
  }
  if (scan_ordered_list_enumerator(s, lexer, UPPER_ROMAN)) {
    *res = UPPER_ROMAN;
    return true;
  }
  if (scan_ordered_list_enumerator(s, lexer, LOWER_ALPHA)) {
    *res = LOWER_ALPHA;
    return true;
  }
  if (scan_ordered_list_enumerator(s, lexer, UPPER_ALPHA)) {
    *res = UPPER_ALPHA;
    return true;
  }
  return false;
}

static TokenType scan_ordered_list_marker_token(Scanner *s, TSLexer *lexer) {
  bool surrounding_parens = false;
  if (lexer->lookahead == '(') {
    surrounding_parens = true;
    lexer->advance(lexer, false);
  }

  OrderedListType list_type;
  if (!scan_ordered_list_type(s, lexer, &list_type)) {
    return IGNORED;
  }

  switch (lexer->lookahead) {
  case ')':
    if (surrounding_parens) {
      switch (list_type) {
      case DECIMAL:
        return LIST_MARKER_DECIMAL_PARENS;
      case LOWER_ALPHA:
        return LIST_MARKER_LOWER_ALPHA_PARENS;
      case UPPER_ALPHA:
        return LIST_MARKER_UPPER_ALPHA_PARENS;
      case LOWER_ROMAN:
        return LIST_MARKER_LOWER_ROMAN_PARENS;
      case UPPER_ROMAN:
        return LIST_MARKER_UPPER_ROMAN_PARENS;
      }
    } else {
      switch (list_type) {
      case DECIMAL:
        return LIST_MARKER_DECIMAL_PAREN;
      case LOWER_ALPHA:
        return LIST_MARKER_LOWER_ALPHA_PAREN;
      case UPPER_ALPHA:
        return LIST_MARKER_UPPER_ALPHA_PAREN;
      case LOWER_ROMAN:
        return LIST_MARKER_LOWER_ROMAN_PAREN;
      case UPPER_ROMAN:
        return LIST_MARKER_UPPER_ROMAN_PAREN;
      }
    }
  case '.':
    switch (list_type) {
    case DECIMAL:
      return LIST_MARKER_DECIMAL_PERIOD;
    case LOWER_ALPHA:
      return LIST_MARKER_LOWER_ALPHA_PERIOD;
    case UPPER_ALPHA:
      return LIST_MARKER_UPPER_ALPHA_PERIOD;
    case LOWER_ROMAN:
      return LIST_MARKER_LOWER_ROMAN_PERIOD;
    case UPPER_ROMAN:
      return LIST_MARKER_UPPER_ROMAN_PERIOD;
    }
  default:
    return IGNORED;
  }
}

static TokenType scan_list_marker_token(Scanner *s, TSLexer *lexer) {
  if (scan_bullet_list_marker(s, lexer, '-')) {
    if (lexer->lookahead == '[') {
      return LIST_MARKER_TASK_START;
    } else {
      return LIST_MARKER_DASH;
    }
  }
  if (scan_bullet_list_marker(s, lexer, '*')) {
    if (lexer->lookahead == '[') {
      return LIST_MARKER_TASK_START;
    } else {
      return LIST_MARKER_STAR;
    }
  }
  if (scan_bullet_list_marker(s, lexer, '+')) {
    if (lexer->lookahead == '[') {
      return LIST_MARKER_TASK_START;
    } else {
      return LIST_MARKER_PLUS;
    }
  }
  if (scan_bullet_list_marker(s, lexer, ':')) {
    return LIST_MARKER_DEFINITION;
  }
  return scan_ordered_list_marker_token(s, lexer);
}

static bool scan_list_marker(Scanner *s, TSLexer *lexer) {
  return scan_list_marker_token(s, lexer) != IGNORED;
}

static bool scan_eof_or_blankline(Scanner *s, TSLexer *lexer) {
  if (lexer->eof(lexer)) {
    return true;
  } else if (lexer->lookahead == '\n') {
    lexer->advance(lexer, false);
    return true;
  } else {
    return false;
  }
}

static bool parse_eof_or_blankline(Scanner *s, TSLexer *lexer) {
  if (!scan_eof_or_blankline(s, lexer)) {
    return false;
  }

  lexer->mark_end(lexer);
  lexer->result_symbol = EOF_OR_BLANKLINE;
  return true;
}

// Can we scan a block closing marker?
// For example, if we see a valid div marker.
static bool scan_containing_block_closing_marker(Scanner *s, TSLexer *lexer) {
  if (is_div_marker_next(s, lexer)) {
    return true;
  }

  if (scan_list_marker(s, lexer)) {
    return true;
  }

  return false;
}

static bool parse_close_paragraph(Scanner *s, TSLexer *lexer) {
  if (scan_containing_block_closing_marker(s, lexer)) {
    lexer->result_symbol = CLOSE_PARAGRAPH;
    return true;
  }

  return false;
}

static void ensure_list_open(Scanner *s, BlockType type, uint8_t indent) {
  if (any_block(s)) {
    Block *top = peek_block(s);
    // Found a list with the same type and indent, we should continue it.
    if (top->type == type && top->level == indent) {
      return;
    }
    // There might be other cases, like if the top list is a list of different
    // types, but that's handled by BLOCK_CLOSE in `close_lists_if_needed` and
    // we shouldn't see that state here.
  }

  push_block(s, type, indent);
}

static bool handle_ordered_list_marker(Scanner *s, TSLexer *lexer,
                                       const bool *valid_symbols,
                                       TokenType marker) {
  if (marker != IGNORED && valid_symbols[marker]) {
    ensure_list_open(s, list_marker_to_block(marker), s->whitespace + 1);
    lexer->result_symbol = marker;
    lexer->mark_end(lexer);
    return true;
  } else {
    return false;
  }
}

// Consumes until newline or eof, only allowing 'c' or whitespace.
// Returns the number of 'c' encountered (0 if any other character is
// encountered).
static uint8_t consume_line_with_char_or_whitespace(Scanner *s, TSLexer *lexer,
                                                    char c) {
  uint8_t seen = 0;
  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == c) {
      ++seen;
      lexer->advance(lexer, false);
    } else if (lexer->lookahead == ' ') {
      lexer->advance(lexer, false);
    } else if (lexer->lookahead == '\n') {
      break;
    } else {
      return 0;
    }
  }
  return seen;
}

// Either parse a list item marker (like '- ') or a thematic break
// (like '- - -').
static bool parse_list_marker_or_thematic_break(
    Scanner *s, TSLexer *lexer, const bool *valid_symbols, char marker,
    TokenType marker_type, BlockType list_type, TokenType thematic_break_type) {
  if (!valid_symbols[marker_type] && !valid_symbols[thematic_break_type] &&
      !valid_symbols[LIST_MARKER_TASK_START]) {
    return false;
  }

  assert(lexer->lookahead == marker);
  lexer->advance(lexer, false);
  // If we advance and check thematic break, we can still go back to only
  // consume the list marker.
  lexer->mark_end(lexer);

  // We should prioritize a thematic break over lists.
  // We need to remember if a '- ' is found, which means we can open a list.
  bool can_be_list_marker =
      (valid_symbols[marker_type] || valid_symbols[LIST_MARKER_TASK_START]) &&
      lexer->lookahead == ' ';

  // We have now checked the two first characters.
  uint32_t marker_count = lexer->lookahead == marker ? 2 : 1;
  bool can_be_thematic_break = marker_count == 2 || lexer->lookahead == ' ';

  // Advance once more so we can check '['
  lexer->advance(lexer, false);
  bool can_be_task = can_be_list_marker && lexer->lookahead == '[';

  // Now check the entire line, if possible.
  if (valid_symbols[thematic_break_type] && can_be_thematic_break) {
    marker_count += consume_line_with_char_or_whitespace(s, lexer, marker);
    if (marker_count >= 3) {
      lexer->result_symbol = thematic_break_type;
      lexer->mark_end(lexer);
      return true;
    }
  }

  if (valid_symbols[LIST_MARKER_TASK_START] && can_be_task) {
    lexer->advance(lexer, false); // Consume the '['
    ensure_list_open(s, LIST_TASK, s->whitespace + 1);
    lexer->result_symbol = LIST_MARKER_TASK_START;
    lexer->mark_end(lexer);
    return true;
  }
  if (valid_symbols[marker_type] && can_be_list_marker) {
    ensure_list_open(s, list_type, s->whitespace + 1);
    lexer->result_symbol = marker_type;
    return true;
  }

  return false;
}

static bool parse_dash(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  return parse_list_marker_or_thematic_break(s, lexer, valid_symbols, '-',
                                             LIST_MARKER_DASH, LIST_DASH,
                                             THEMATIC_BREAK_DASH);
}

static bool parse_star(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  return parse_list_marker_or_thematic_break(s, lexer, valid_symbols, '*',
                                             LIST_MARKER_STAR, LIST_STAR,
                                             THEMATIC_BREAK_STAR);
}

static bool parse_plus(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  if (!valid_symbols[LIST_MARKER_PLUS] &&
      !valid_symbols[LIST_MARKER_TASK_START]) {
    return false;
  }
  if (!scan_bullet_list_marker(s, lexer, '+')) {
    return false;
  }

  if (lexer->lookahead == '[') {
    lexer->advance(lexer, false); // Consume the '['
    ensure_list_open(s, LIST_TASK, s->whitespace + 1);
    lexer->result_symbol = LIST_MARKER_TASK_START;
    lexer->mark_end(lexer);
    return true;
  } else {
    ensure_list_open(s, LIST_PLUS, s->whitespace + 1);
    lexer->result_symbol = LIST_MARKER_PLUS;
    lexer->mark_end(lexer);
    return true;
  }
}

static bool parse_list_item_end(Scanner *s, TSLexer *lexer,
                                const bool *valid_symbols) {
  // If we come here, we need to be in a list, but safeguards are nice.
  if (!any_block(s)) {
    return false;
  }
  // We only look at the top, list item end is only valid if we're
  // about to close the list. Otherwise we need to close the open blocks
  // first.
  Block *list = peek_block(s);
  if (!is_list(list->type)) {
    return false;
  }

  // We're inside the list item, don't end it yet.
  if (s->whitespace >= list->level) {
    return false;
  }

  if (scan_list_marker(s, lexer)) {
    lexer->result_symbol = LIST_ITEM_END;
    return true;
  }

  lexer->result_symbol = LIST_ITEM_END;
  s->blocks_to_close = 1;
  return true;
}

static bool parse_colon(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  bool can_be_div = valid_symbols[DIV_START] || valid_symbols[DIV_END];
  if (!valid_symbols[LIST_MARKER_DEFINITION] && !can_be_div) {
    return false;
  }
  assert(lexer->lookahead == ':');
  lexer->advance(lexer, false);

  if (lexer->lookahead == ' ') {
    if (valid_symbols[LIST_MARKER_DEFINITION]) {
      ensure_list_open(s, LIST_DEFINITION, s->whitespace + 1);
      lexer->result_symbol = LIST_MARKER_DEFINITION;
      lexer->mark_end(lexer);
      return true;
    } else {
      // Can't be a div anymore.
      return false;
    }
  }

  if (!can_be_div) {
    return false;
  }

  // We consume a colon in the start of the function.
  uint8_t colons = consume_chars(s, lexer, ':') + 1;
  if (colons < 3) {
    return false;
  }

  size_t from_top = number_of_blocks_from_top(s, DIV, colons);

  if (from_top > 0) {
    // The div we want to close is not the top, close the open blocks until
    // this div.
    close_blocks_with_final_token(s, lexer, from_top, DIV_END, 3);
    return true;
  } else {
    // We can consume the colons as we start a new div now.
    lexer->mark_end(lexer);
    push_block(s, DIV, colons);
    lexer->result_symbol = DIV_START;
    return true;
  }
}

static TokenType heading_start_token(uint8_t level) {
  switch (level) {
  case 1:
    return HEADING1_START;
  case 2:
    return HEADING2_START;
  case 3:
    return HEADING3_START;
  case 4:
    return HEADING4_START;
  case 5:
    return HEADING5_START;
  case 6:
    return HEADING6_START;
  default:
    return ERROR;
  }
}

static TokenType heading_continuation_token(uint8_t level) {
  switch (level) {
  case 1:
    return HEADING1_CONTINUATION;
  case 2:
    return HEADING2_CONTINUATION;
  case 3:
    return HEADING3_CONTINUATION;
  case 4:
    return HEADING4_CONTINUATION;
  case 5:
    return HEADING5_CONTINUATION;
  case 6:
    return HEADING6_CONTINUATION;
  default:
    return ERROR;
  }
}

static bool parse_heading(Scanner *s, TSLexer *lexer,
                          const bool *valid_symbols) {
  // It's fine to always consume, since this only parses '#'
  uint8_t hash_count = consume_chars(s, lexer, '#');

  // Note that headings don't contain other blocks, only inline.
  Block *top = peek_block(s);
  bool top_heading = top && top->type == HEADING;

  if (hash_count > 0 && lexer->lookahead == ' ') {
    TokenType start_token = heading_start_token(hash_count);
    TokenType continuation_token = heading_continuation_token(hash_count);

    if (!valid_symbols[start_token] && !valid_symbols[continuation_token] &&
        !valid_symbols[BLOCK_CLOSE]) {
      return false;
    }

    lexer->advance(lexer, false); // Consume the ' '

    if (valid_symbols[continuation_token] && top_heading &&
        top->level == hash_count) {
      // We're in a heading matching the same number of '#'
      lexer->mark_end(lexer);
      lexer->result_symbol = continuation_token;
      return true;
    }

    if (valid_symbols[BLOCK_CLOSE] && top_heading && top->level != hash_count) {
      // Found a mismatched heading level, need to close the previous
      // before opening this one.
      close_blocks_with_final_token(s, lexer, 1, start_token, hash_count + 1);
      return true;
    }

    // Open a new heading
    lexer->mark_end(lexer);
    push_block(s, HEADING, hash_count);
    lexer->result_symbol = start_token;
    return true;
  } else if (hash_count == 0 && top_heading) {
    // We need to always provide a BLOCK_CLOSE to end headings.
    // We do this here, either when a blankline is followed or
    // by the end of a container block.
    if (valid_symbols[BLOCK_CLOSE] &&
        (scan_eof_or_blankline(s, lexer) ||
         scan_containing_block_closing_marker(s, lexer))) {
      pop_block(s);
      lexer->result_symbol = BLOCK_CLOSE;
      return true;
    }

    // We should continue the heading, if it's open.
    TokenType res = heading_continuation_token(top->level);
    if (valid_symbols[res]) {
      lexer->result_symbol = res;
      return true;
    }
  }

  return false;
}

static bool scan_block_quote_marker(Scanner *s, TSLexer *lexer,
                                    bool *ending_newline) {
  if (lexer->lookahead != '>') {
    return false;
  }
  lexer->advance(lexer, false);
  if (lexer->lookahead == ' ') {
    lexer->advance(lexer, false);
    return true;
  } else if (lexer->lookahead == '\n') {
    lexer->advance(lexer, false);
    *ending_newline = true;
    return true;
  } else {
    return false;
  }
}

// Parse block quote related things.
//
// It's made complicated by the need to match nested quotes,
// but we still want to keep block quotes separated,
// so we can't match '> > ' in one go, but in multiple passes.
//
// We also need to close any contained paragraphs if there's a mismatch of
// quote indentation, or if there's an "empty line" (only > on a line).
//
// And we also need to close open blocks when we go down a nesting level.
static bool parse_block_quote(Scanner *s, TSLexer *lexer,
                              const bool *valid_symbols) {
  // Don't scan unless needed.
  if (!valid_symbols[BLOCK_QUOTE_START] &&
      !valid_symbols[BLOCK_QUOTE_CONTINUATION] && !valid_symbols[BLOCK_CLOSE] &&
      !valid_symbols[CLOSE_PARAGRAPH]) {
    return false;
  }

  // A valid marker is a '> ' or '>\n'.
  bool ending_newline = false;
  bool has_marker = scan_block_quote_marker(s, lexer, &ending_newline);
  // Store nesting level on the scanner, to keep it between runs.
  uint8_t marker_count = s->block_quote_level + has_marker;

  size_t matching_block_pos =
      number_of_blocks_from_top(s, BLOCK_QUOTE, marker_count);
  Block *highest_block_quote = find_block(s, BLOCK_QUOTE);

  // If we have a marker but with an empty line,
  // we need to close the paragraph.
  if (has_marker && ending_newline && valid_symbols[CLOSE_PARAGRAPH]) {
    lexer->result_symbol = CLOSE_PARAGRAPH;
    return true;
  }

  // There is an open block quote with a higher nesting level than what we've
  // found.
  if (highest_block_quote && marker_count < highest_block_quote->level) {
    // Close the paragraph, but allow lazy continuation (without any > marker).
    if (valid_symbols[CLOSE_PARAGRAPH] && has_marker) {
      lexer->result_symbol = CLOSE_PARAGRAPH;
      return true;
    }
    if (valid_symbols[BLOCK_CLOSE]) {
      // We may need to close more than one block (nested block quotes, lists,
      // etc).
      size_t close_pos =
          number_of_blocks_from_top(s, BLOCK_QUOTE, marker_count + 1);
      close_blocks(s, lexer, close_pos);
      return true;
    }
  }

  // If we should continue an open block quote.
  if (valid_symbols[BLOCK_QUOTE_CONTINUATION] && has_marker &&
      matching_block_pos != 0) {
    lexer->mark_end(lexer);
    // It's important to always clear the stored level on newlines.
    if (ending_newline) {
      s->block_quote_level = 0;
    } else {
      s->block_quote_level = marker_count;
    }
    lexer->result_symbol = BLOCK_QUOTE_CONTINUATION;
    return true;
  }

  // Finally, start a new block quote if there's any marker.
  if (valid_symbols[BLOCK_QUOTE_START] && has_marker) {
    push_block(s, BLOCK_QUOTE, marker_count);
    lexer->mark_end(lexer);
    // It's important to always clear the stored level on newlines.
    if (ending_newline) {
      s->block_quote_level = 0;
    } else {
      s->block_quote_level = marker_count;
    }
    lexer->result_symbol = BLOCK_QUOTE_START;
    return true;
  }

  return false;
}

bool tree_sitter_djot_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {

  Scanner *s = (Scanner *)payload;

#ifdef DEBUG
  printf("SCAN\n");
  dump(s, lexer);
  dump_valid_symbols(valid_symbols);
#endif

  // Mark end right from the start and then when outputting results
  // we mark it again to make it consume.
  // I found it easier to opt-in to consume tokens.
  lexer->mark_end(lexer);
  s->whitespace = consume_whitespace(s, lexer);
  bool is_newline = lexer->lookahead == '\n';

  if (is_newline) {
    s->block_quote_level = 0;
  }

  if (valid_symbols[BLOCK_CLOSE] && handle_blocks_to_close(s, lexer)) {
    return true;
  }
  assert(s->blocks_to_close == 0);

  // Buffered tokens can come after blocks are closed.
  if (output_delayed_token(s, lexer, valid_symbols)) {
    return true;
  }

  if (parse_block_quote(s, lexer, valid_symbols)) {
    return true;
  }
  if (parse_heading(s, lexer, valid_symbols)) {
    return true;
  }
  if (valid_symbols[CLOSE_PARAGRAPH] && parse_close_paragraph(s, lexer)) {
    return true;
  }

  // Closing verbatim is a bit special as we need to match number of `
  // or eof and we can always consume everything until newline.
  if (valid_symbols[VERBATIM_CONTENT] && parse_verbatim_content(s, lexer)) {
    return true;
  }
  if (valid_symbols[VERBATIM_END] && lexer->eof) {
    if (try_close_verbatim(s, lexer)) {
      return true;
    }
  }

  // End previous list item before opening new ones.
  if (valid_symbols[LIST_ITEM_END] &&
      parse_list_item_end(s, lexer, valid_symbols)) {
    return true;
  }

  switch (lexer->lookahead) {
  case '-':
    if (parse_dash(s, lexer, valid_symbols)) {
      return true;
    }
    break;
  case '*':
    if (parse_star(s, lexer, valid_symbols)) {
      return true;
    }
    break;
  case '+':
    if (parse_plus(s, lexer, valid_symbols)) {
      return true;
    }
    break;
  case ':':
    if (parse_colon(s, lexer, valid_symbols)) {
      return true;
    }
    break;
  case '`':
    if (parse_backtick(s, lexer, valid_symbols)) {
      return true;
    }
    break;
  case '\n':
    if (try_close_verbatim(s, lexer)) {
      return true;
    }
    break;
  default:
    break;
  }

  // Scan ordered list markers outside because the parsing may conflict with
  // closing of lists (both may try to parse the same characters).
  TokenType ordered_list_marker = scan_ordered_list_marker_token(s, lexer);
  if (ordered_list_marker != IGNORED &&
      handle_ordered_list_marker(s, lexer, valid_symbols,
                                 ordered_list_marker)) {
    return true;
  }

  // May scan a complete list marker, which we can't do before checking if
  // we should output the list marker itself.
  // Yeah, the order dependencies aren't very nice.
  if (valid_symbols[BLOCK_CLOSE] &&
      close_lists_if_needed(s, lexer, !is_newline, ordered_list_marker)) {
    return true;
  }

  // We need to handle NEWLINE in the external scanner for our
  // changes to the Scanner state to be saved
  // (the reset of `block_quote_level` at newline).
  if (valid_symbols[NEWLINE] && is_newline) {
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    lexer->result_symbol = NEWLINE;
    return true;
  }

  // After some refactoring, this might be doable in grammar.js,
  // but I don't care to refactor and try it. This works well.
  if (valid_symbols[EOF_OR_BLANKLINE] && parse_eof_or_blankline(s, lexer)) {
    return true;
  }

  return false;
}

void init(Scanner *s) {
  s->open_blocks.size = 0;
  s->blocks_to_close = 0;
  s->delayed_token = IGNORED;
  s->delayed_token_width = 0;
  s->verbatim_tick_count = 0;
  s->block_quote_level = 0;
  s->whitespace = 0;
}

void *tree_sitter_djot_external_scanner_create() {
  Scanner *s = (Scanner *)malloc(sizeof(Scanner));
  init(s);
  return s;
}

void tree_sitter_djot_external_scanner_destroy(void *payload) {
  Scanner *s = (Scanner *)payload;
  for (size_t i = 0; i < s->open_blocks.size; i++) {
    free(s->open_blocks.items[i]);
  }
  free(s);
}

unsigned tree_sitter_djot_external_scanner_serialize(void *payload,
                                                     char *buffer) {
  Scanner *s = (Scanner *)payload;
  unsigned size = 0;
  buffer[size++] = (char)s->blocks_to_close;
  buffer[size++] = (char)s->delayed_token;
  buffer[size++] = (char)s->delayed_token_width;
  buffer[size++] = (char)s->verbatim_tick_count;
  buffer[size++] = (char)s->block_quote_level;
  buffer[size++] = (char)s->whitespace;

  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    buffer[size++] = (char)b->type;
    buffer[size++] = (char)b->level;
  }

  return size;
}

void tree_sitter_djot_external_scanner_deserialize(void *payload, char *buffer,
                                                   unsigned length) {
  Scanner *s = (Scanner *)payload;
  init(s);
  if (length > 0) {
    size_t size = 0;
    s->blocks_to_close = (uint8_t)buffer[size++];
    s->delayed_token = (TokenType)buffer[size++];
    s->delayed_token_width = (uint8_t)buffer[size++];
    s->verbatim_tick_count = (uint8_t)buffer[size++];
    s->block_quote_level = (uint8_t)buffer[size++];
    s->whitespace = (uint8_t)buffer[size++];

    size_t blocks = 0;
    while (size < length) {
      BlockType type = (BlockType)buffer[size++];
      uint8_t level = (uint8_t)buffer[size++];
      s->open_blocks.items[blocks++] = create_block(type, level);
    }
    s->open_blocks.size = blocks;
  }
}

static char *token_type_s(TokenType t) {
  switch (t) {
  case BLOCK_CLOSE:
    return "BLOCK_CLOSE";
  case EOF_OR_BLANKLINE:
    return "EOF_OR_BLANKLINE";
  case NEWLINE:
    return "NEWLINE";

  case HEADING1_START:
    return "HEADING1_START";
  case HEADING1_CONTINUATION:
    return "HEADING1_CONTINUATION";
  case HEADING2_START:
    return "HEADING2_START";
  case HEADING2_CONTINUATION:
    return "HEADING2_CONTINUATION";
  case HEADING3_START:
    return "HEADING3_START";
  case HEADING3_CONTINUATION:
    return "HEADING3_CONTINUATION";
  case HEADING4_START:
    return "HEADING4_START";
  case HEADING4_CONTINUATION:
    return "HEADING4_CONTINUATION";
  case HEADING5_START:
    return "HEADING5_START";
  case HEADING5_CONTINUATION:
    return "HEADING5_CONTINUATION";
  case HEADING6_START:
    return "HEADING6_START";
  case HEADING6_CONTINUATION:
    return "HEADING6_CONTINUATION";
  case DIV_START:
    return "DIV_START";
  case DIV_END:
    return "DIV_END";
  case CODE_BLOCK_START:
    return "CODE_BLOCK_START";
  case CODE_BLOCK_END:
    return "CODE_BLOCK_END";
  case LIST_MARKER_DASH:
    return "LIST_MARKER_DASH";
  case LIST_MARKER_STAR:
    return "LIST_MARKER_STAR";
  case LIST_MARKER_PLUS:
    return "LIST_MARKER_PLUS";
  case LIST_MARKER_TASK_START:
    return "LIST_MARKER_TASK_START";
  case LIST_MARKER_DEFINITION:
    return "LIST_MARKER_DEFINITION";
  case LIST_MARKER_DECIMAL_PERIOD:
    return "LIST_MARKER_DECIMAL_PERIOD";
  case LIST_MARKER_LOWER_ALPHA_PERIOD:
    return "LIST_MARKER_LOWER_ALPHA_PERIOD";
  case LIST_MARKER_UPPER_ALPHA_PERIOD:
    return "LIST_MARKER_UPPER_ALPHA_PERIOD";
  case LIST_MARKER_LOWER_ROMAN_PERIOD:
    return "LIST_MARKER_LOWER_ROMAN_PERIOD";
  case LIST_MARKER_UPPER_ROMAN_PERIOD:
    return "LIST_MARKER_UPPER_ROMAN_PERIOD";
  case LIST_MARKER_DECIMAL_PAREN:
    return "LIST_MARKER_DECIMAL_PAREN";
  case LIST_MARKER_LOWER_ALPHA_PAREN:
    return "LIST_MARKER_LOWER_ALPHA_PAREN";
  case LIST_MARKER_UPPER_ALPHA_PAREN:
    return "LIST_MARKER_UPPER_ALPHA_PAREN";
  case LIST_MARKER_LOWER_ROMAN_PAREN:
    return "LIST_MARKER_LOWER_ROMAN_PAREN";
  case LIST_MARKER_UPPER_ROMAN_PAREN:
    return "LIST_MARKER_UPPER_ROMAN_PAREN";
  case LIST_MARKER_DECIMAL_PARENS:
    return "LIST_MARKER_DECIMAL_PARENS";
  case LIST_MARKER_LOWER_ALPHA_PARENS:
    return "LIST_MARKER_LOWER_ALPHA_PARENS";
  case LIST_MARKER_UPPER_ALPHA_PARENS:
    return "LIST_MARKER_UPPER_ALPHA_PARENS";
  case LIST_MARKER_LOWER_ROMAN_PARENS:
    return "LIST_MARKER_LOWER_ROMAN_PARENS";
  case LIST_MARKER_UPPER_ROMAN_PARENS:
    return "LIST_MARKER_UPPER_ROMAN_PARENS";
  case LIST_ITEM_END:
    return "LIST_ITEM_END";
  case CLOSE_PARAGRAPH:
    return "CLOSE_PARAGRAPH";
  case BLOCK_QUOTE_START:
    return "BLOCK_QUOTE_START";
  case BLOCK_QUOTE_CONTINUATION:
    return "BLOCK_QUOTE_CONTINUATION";
  case THEMATIC_BREAK_DASH:
    return "THEMATIC_BREAK_DASH";
  case THEMATIC_BREAK_STAR:
    return "THEMATIC_BREAK_STAR";

  case VERBATIM_START:
    return "VERBATIM_START";
  case VERBATIM_END:
    return "VERBATIM_END";
  case VERBATIM_CONTENT:
    return "VERBATIM_CONTENT";

  case ERROR:
    return "ERROR";
  case IGNORED:
    return "IGNORED";
  }
}

static char *block_type_s(BlockType t) {
  switch (t) {
  case HEADING:
    return "HEADING";
  case DIV:
    return "DIV";
  case BLOCK_QUOTE:
    return "BLOCK_QUOTE";
  case CODE_BLOCK:
    return "CODE_BLOCK";
  case LIST_DASH:
    return "LIST_DASH";
  case LIST_STAR:
    return "LIST_STAR";
  case LIST_PLUS:
    return "LIST_PLUS";
  case LIST_TASK:
    return "LIST_TASK";
  case LIST_DEFINITION:
    return "LIST_DEFINITION";
  case LIST_DECIMAL_PERIOD:
    return "LIST_DECIMAL_PERIOD";
  case LIST_LOWER_ALPHA_PERIOD:
    return "LIST_LOWER_ALPHA_PERIOD";
  case LIST_UPPER_ALPHA_PERIOD:
    return "LIST_UPPER_ALPHA_PERIOD";
  case LIST_LOWER_ROMAN_PERIOD:
    return "LIST_LOWER_ROMAN_PERIOD";
  case LIST_UPPER_ROMAN_PERIOD:
    return "LIST_UPPER_ROMAN_PERIOD";
  case LIST_DECIMAL_PAREN:
    return "LIST_DECIMAL_PAREN";
  case LIST_LOWER_ALPHA_PAREN:
    return "LIST_LOWER_ALPHA_PAREN";
  case LIST_UPPER_ALPHA_PAREN:
    return "LIST_UPPER_ALPHA_PAREN";
  case LIST_LOWER_ROMAN_PAREN:
    return "LIST_LOWER_ROMAN_PAREN";
  case LIST_UPPER_ROMAN_PAREN:
    return "LIST_UPPER_ROMAN_PAREN";
  case LIST_DECIMAL_PARENS:
    return "LIST_DECIMAL_PARENS";
  case LIST_LOWER_ALPHA_PARENS:
    return "LIST_LOWER_ALPHA_PARENS";
  case LIST_UPPER_ALPHA_PARENS:
    return "LIST_UPPER_ALPHA_PARENS";
  case LIST_LOWER_ROMAN_PARENS:
    return "LIST_LOWER_ROMAN_PARENS";
  case LIST_UPPER_ROMAN_PARENS:
    return "LIST_UPPER_ROMAN_PARENS";
  }
}

static void dump_scanner(Scanner *s) {
  printf("--- Open blocks: %zu (last -> first)\n", s->open_blocks.size);
  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    printf("  %d %s\n", b->level, block_type_s(b->type));
  }
  printf("---\n");
  printf("  blocks_to_close: %d\n", s->blocks_to_close);
  if (s->delayed_token != IGNORED) {
    printf("  delayed_token: %s\n", token_type_s(s->delayed_token));
    printf("  delayed_token_width: %d\n", s->delayed_token_width);
  }
  printf("  verbatim_tick_count: %u\n", s->verbatim_tick_count);
  printf("  block_quote_level: %u\n", s->block_quote_level);
  printf("  whitespace: %u\n", s->whitespace);
  printf("===\n");
}

static void dump(Scanner *s, TSLexer *lexer) {
  printf("=== Lookahead: ");
  if (lexer->eof(lexer)) {
    printf("eof\n");
  } else {
    printf("`%c`\n", lexer->lookahead);
  }
  dump_scanner(s);
}

static void dump_valid_symbols(const bool *valid_symbols) {
  // printf("# valid_symbols:\n");
  // for (int i = 0; i <= IGNORED; ++i) {
  //   if (valid_symbols[i]) {
  //     printf("%s\n", token_type_s(i));
  //   }
  // }
  printf("# valid_symbols (shortened):\n");
  for (int i = 0; i <= IGNORED; ++i) {
    switch (i) {
    case BLOCK_CLOSE:
    case BLOCK_QUOTE_START:
    case BLOCK_QUOTE_CONTINUATION:
    case CLOSE_PARAGRAPH:
      if (valid_symbols[i]) {
        printf("%s\n", token_type_s(i));
      }
      break;
    default:
      continue;
    }
  }
  printf("#\n");
}
