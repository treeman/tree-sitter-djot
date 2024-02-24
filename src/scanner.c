#include "tree_sitter/parser.h"
#include <assert.h>
#include <stdio.h>

// Maybe we should implement a growable stack or something,
// but this is probably fine.
#define STACK_SIZE 512

// #define DEBUG

typedef enum {
  BLOCK_INDENT,
  BLOCK_CLOSE,
  EOF_OR_BLANKLINE,

  DIV_START,
  DIV_END,
  CODE_BLOCK_START,
  CODE_BLOCK_END,
  LIST_MARKER_DASH,
  LIST_ITEM_END,
  CLOSE_PARAGRAPH,

  VERBATIM_START,
  VERBATIM_END,
  VERBATIM_CONTENT,

  ERROR,
  IGNORED
} TokenType;

typedef enum {
  DIV,
  CODE_BLOCK,
  LIST_DASH,
} BlockType;

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

  // Currently consumed whitespace.
  uint8_t whitespace;
} Scanner;

static char *token_type_s(TokenType t) {
  switch (t) {
  case BLOCK_INDENT:
    return "BLOCK_INDENT";
  case BLOCK_CLOSE:
    return "BLOCK_CLOSE";
  case EOF_OR_BLANKLINE:
    return "EOF_OR_BLANKLINE";

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
  case LIST_ITEM_END:
    return "LIST_ITEM_END";
  case CLOSE_PARAGRAPH:
    return "CLOSE_PARAGRAPH";

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
  default:
    return "TypenType not printable";
  }
}

static bool is_list(BlockType type) { return type == LIST_DASH; }

static char *block_type_s(BlockType t) {
  switch (t) {
  case DIV:
    return "DIV";
  case CODE_BLOCK:
    return "CODE_BLOCK";
  case LIST_DASH:
    return "LIST_DASH";
  default:
    return "BlockType not printable";
  }
}

static void dump_scanner(Scanner *s) {
  printf("--- Open blocks: %zu\n", s->open_blocks.size);
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
  printf("# valid_symbols:\n");
  for (int i = 0; i <= IGNORED; ++i) {
    if (valid_symbols[i]) {
      printf("%s\n", token_type_s(i));
    }
  }
  printf("#\n");
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
  assert(s->open_blocks.size > 0);
  return s->open_blocks.items[s->open_blocks.size - 1];
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
  // FIXME should search from the top
  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    if (b->type == type && b->level == level) {
      return s->open_blocks.size - i;
    }
  }
  return 0;
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
//
// The final block type (such as a `DIV_END` token)
// is emitted from `output_delayed_token` when all BLOCK_CLOSE
// tokens are handled.
static void close_blocks_with_final_token(Scanner *s, TSLexer *lexer,
                                          size_t count, TokenType final,
                                          uint8_t final_token_width) {
  assert(s->blocks_to_close == 0);
  set_delayed_token(s, final, final_token_width);
  pop_block(s);
  s->blocks_to_close = count - 1;
  lexer->result_symbol = BLOCK_CLOSE;
}

static bool parse_block_close(Scanner *s, TSLexer *lexer) {
#ifdef DEBUG
  printf("PARSE_BLOCK_CLOSE\n");
#endif
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

  // If we're in a block that's in a list
  // we should check the indentation level,
  // and if it's less than the current list, we need to close that block.
  if (lexer->lookahead != '\n') {
    Block *top = peek_block(s);
    Block *list = get_open_list(s);
    if (list && list != top) {
      if (s->whitespace < list->level) {
#ifdef DEBUG
        printf("Closing block inside list item\n");
#endif
        lexer->result_symbol = BLOCK_CLOSE;
        pop_block(s);
        return true;
      }
    }
  }

  return false;
}

static bool check_open_blocks(Scanner *s, TSLexer *lexer,
                              const bool *valid_symbols) {
  if (s->blocks_to_close > 0) {
    // We haven't closed all the blocks.
    // This should happen by handling BLOCK_CLOSE tokens in `parse_block_close`.
    // an assert may even be appropriate here as I think this signifies an
    // implementation error, but try to be nice to users.
    lexer->result_symbol = ERROR;
    return true;
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

static bool parse_div(Scanner *s, TSLexer *lexer) {
  // The context could either be a start or an end token.
  // To figure out which we should do, we search through the entire
  // block stack to find if there's an open block somewhere
  // with the same number of colons.
  // If there is, we should close that one (and all open blocks before),
  // otherwise we start a new div.
  uint8_t colons;
  size_t from_top;
  if (!scan_div_marker(s, lexer, &colons, &from_top)) {
    return false;
  }

  if (from_top > 0) {
    // The div we want to close is not the top, close the open blocks until this
    // div.
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

static bool parse_code_block(Scanner *s, TSLexer *lexer, uint8_t ticks) {
  if (ticks < 3) {
    return false;
  }

  if (s->open_blocks.size > 0) {
    // Code blocks can't contain other blocks, so we only look at the top.
    Block *top = peek_block(s);
    if (top->type == CODE_BLOCK) {
      if (top->level == ticks) {
        printf("CLOSING...\n");
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

static bool scan_list_marker_dash(Scanner *s, TSLexer *lexer) {
  if (lexer->lookahead == '-') {
    lexer->advance(lexer, false);
    if (lexer->lookahead == ' ') {
      lexer->advance(lexer, false);
      return true;
    }
  }
  return false;
}

static bool scan_list_marker(Scanner *s, TSLexer *lexer) {
  if (scan_list_marker_dash(s, lexer)) {
    return true;
  }
  return false;
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

static bool should_close_paragraph(Scanner *s, TSLexer *lexer) {
  uint8_t colons;
  size_t from_top;
  // FIXME should we setup the already parsed results here?
  if (scan_div_marker(s, lexer, &colons, &from_top)) {
    return true;
  }

  if (scan_list_marker(s, lexer)) {
    return true;
  }

  return false;
}

static bool parse_close_paragraph(Scanner *s, TSLexer *lexer) {
  if (should_close_paragraph(s, lexer)) {
    lexer->result_symbol = CLOSE_PARAGRAPH;
    return true;
  } else {
    return false;
  }
}

static void ensure_list_open(Scanner *s, BlockType type, uint8_t indent) {
  if (any_block(s)) {
    Block *top = peek_block(s);
#ifdef DEBUG
    printf("OPENING LIST\n");
    printf("indent: %d top->level: %d\n", indent, top->level);
#endif

    if (top->type == type) {
      if (top->level == indent) {
        // Found a list with the same type and indent, we should continue it.
        return;
      } else {
        // Found the same list type but with a different indent level... Close
        // it? Depending on if it's higher or lower?
      }
    } else if (is_list(top->type)) {
      // Found a different list, we should close it if this isn't a sublist I
      // guess But a sublist requires surrounding newlines so I dunno if this
      // should even happen?
    } else {
      // Found some other type of block.
      // Close it...?
      // We probably need to search for the topmost list instead...
    }
  }

  push_block(s, type, indent);
}

static bool parse_list_marker(Scanner *s, TSLexer *lexer,
                              const bool *valid_symbols) {

  TokenType marker_type;
  uint8_t token_width;
  if (valid_symbols[LIST_MARKER_DASH] && scan_list_marker_dash(s, lexer)) {
    ensure_list_open(s, LIST_DASH, s->whitespace + 1);
    lexer->result_symbol = LIST_MARKER_DASH;
    lexer->mark_end(lexer);
    return true;
  }

  return false;
}

static bool parse_list_item_end(Scanner *s, TSLexer *lexer,
                                const bool *valid_symbols) {
  // If we come here, we need to be in a list, but safeguards are nice.
  if (!any_block(s)) {
    return false;
  }
  // TODO maybe not only the top block.
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
  // TODO We may need to close more blocks.
  s->blocks_to_close = 1;
  return true;
}

static bool parse_block_indent(Scanner *s, TSLexer *lexer, uint8_t indent) {
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

  // It's important to try to close blocks before other things.
  if (valid_symbols[BLOCK_CLOSE] && parse_block_close(s, lexer)) {
    return true;
  }
  if (check_open_blocks(s, lexer, valid_symbols)) {
    return true;
  }

  // Buffered tokens can come after blocks are closed.
  if (output_delayed_token(s, lexer, valid_symbols)) {
    return true;
  }

  // if (valid_symbols[BLOCK_INDENT] && parse_block_indent(s, lexer, indent))
  // {
  //   return true;
  // }

  if (valid_symbols[EOF_OR_BLANKLINE] && parse_eof_or_blankline(s, lexer)) {
    return true;
  }

  if (valid_symbols[CLOSE_PARAGRAPH] && parse_close_paragraph(s, lexer)) {
    return true;
  }
  if (valid_symbols[DIV_START] || valid_symbols[DIV_END]) {
    if (parse_div(s, lexer)) {
      return true;
    }
  }
  if (valid_symbols[VERBATIM_CONTENT] && parse_verbatim_content(s, lexer)) {
    return true;
  }
  if (lexer->lookahead == '`' && parse_backtick(s, lexer, valid_symbols)) {
    return true;
  } else if (lexer->eof || lexer->lookahead == '\n') {
    if (try_close_verbatim(s, lexer)) {
      return true;
    }
  }

  // End previous list item before opening new ones.
  if (valid_symbols[LIST_ITEM_END] &&
      parse_list_item_end(s, lexer, valid_symbols)) {
    return true;
  }
  if (valid_symbols[LIST_MARKER_DASH]) {
    if (parse_list_marker(s, lexer, valid_symbols)) {
      return true;
    }
  }
  return false;
}

void init(Scanner *s) {
  s->open_blocks.size = 0;
  s->blocks_to_close = 0;
  s->delayed_token = IGNORED;
  s->delayed_token_width = 0;
  s->verbatim_tick_count = 0;
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
