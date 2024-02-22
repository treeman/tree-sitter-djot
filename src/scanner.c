#include "tree_sitter/parser.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

// Maybe we should implement a growable stack or something,
// but this is probably fine.
#define STACK_SIZE 512

typedef enum {
  BLOCK_CLOSE,
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
} BlockType;

typedef struct {
  // Level can be either indentation or number of opening/ending symbols.
  // Or it may also be unused.
  uint8_t level;
  BlockType type;
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
} Scanner;

static void dump(Scanner *s, TSLexer *lexer) {
  printf("=== Lookahead: `%c`\n", lexer->lookahead);
  printf("--- Stack size: %zu\n", s->open_blocks.size);
  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    printf("  %d\n", b->level);
  }
  printf("---\n");
  printf("  blocks_to_close: %d\n", s->blocks_to_close);
  if (s->delayed_token != IGNORED) {
    printf("  delayed_token: %u\n", s->delayed_token);
    printf("  delayed_token_width: %d\n", s->delayed_token_width);
  }
  printf("  verbatim_tick_count: %u\n", s->verbatim_tick_count);
  printf("===\n");
}

static uint8_t consume_chars(Scanner *s, TSLexer *lexer, char c) {
  uint8_t count = 0;
  while (lexer->lookahead == c) {
    lexer->advance(lexer, false);
    ++count;
  }
  return count;
}

static void push_block(Scanner *s, uint8_t level, BlockType type) {
  Block *b = malloc(sizeof(Block));
  b->level = level;
  b->type = type;
  s->open_blocks.items[s->open_blocks.size++] = b;
}

static void pop_block(Scanner *s) {
  if (s->open_blocks.size > 0) {
    free(s->open_blocks.items[--s->open_blocks.size]);
  }
}

static bool has_block(Scanner *s) { return s->open_blocks.size > 0; }

static Block *peek_block(Scanner *s) {
  assert(s->open_blocks.size > 0);
  return s->open_blocks.items[s->open_blocks.size - 1];
}

void set_delayed_token(Scanner *s, TokenType token, uint8_t token_width) {
  s->delayed_token = token;
  s->delayed_token_width = token_width;
}

// How many blocks from the top of the stack can we find a matching block?
// If it's directly on the top, returns 1.
// If it cannot be found, returns 0.
static size_t number_of_blocks_from_top(Scanner *s, BlockType type,
                                        uint8_t level) {
  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    if (b->type == type && b->level == level) {
      return s->open_blocks.size - i;
    }
  }
  return 0;
}

// Remove 'count' blocks from the stack, freeing them.
static void remove_blocks(Scanner *s, size_t count) {
  while (count-- > 0) {
    pop_block(s);
  }
}

// Mark that we should close `count` blocks.
// This call will only emit a single BLOCK_CLOSE token,
// the other are emitted in `parse_block_close`.
//
// The final block type (such as a `DIV_END` token)
// is emitted from `output_delayed_token` when all BLOCK_CLOSE
// tokens are handled.
static void close_blocks(Scanner *s, TSLexer *lexer, size_t count,
                         TokenType final, uint8_t final_token_width) {
  set_delayed_token(s, final, final_token_width);
  s->blocks_to_close = count - 1;
  lexer->result_symbol = BLOCK_CLOSE;
  pop_block(s);
}

static bool parse_block_close(Scanner *s, TSLexer *lexer) {
  // If we reach eof with open blocks, we should close them all.
  if (lexer->eof(lexer) && s->open_blocks.size > 0) {
    lexer->result_symbol = BLOCK_CLOSE;
    pop_block(s);
    return true;
  }
  if (s->blocks_to_close > 0) {
    lexer->result_symbol = BLOCK_CLOSE;
    --s->blocks_to_close;
    pop_block(s);
    return true;
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

static bool output_delayed_token(Scanner *s, TSLexer *lexer,
                                 const bool *valid_symbols) {
  if (s->delayed_token != IGNORED) {
    lexer->result_symbol = s->delayed_token;
    s->delayed_token = IGNORED;
    while (s->delayed_token_width--) {
      lexer->advance(lexer, false);
    }
    return true;
  } else {
    return false;
  }
}

static bool scan_div_marker(Scanner *s, TSLexer *lexer, uint8_t *colons,
                            size_t *from_top) {
  // Because we want to emit a BLOCK_CLOSE token before
  // consuming the tokens (such as `:::` for DIV), we mark the end before
  // advancing to allow us to peek forward.
  lexer->mark_end(lexer);

  *colons = consume_chars(s, lexer, ':');
  if (*colons < 3) {
    return false;
  }
  *from_top = number_of_blocks_from_top(s, DIV, *colons);
  return true;
}

static bool should_close_paragraph(Scanner *s, TSLexer *lexer) {
  uint8_t colons;
  size_t from_top;
  return scan_div_marker(s, lexer, &colons, &from_top);
}

static bool parse_close_paragraph(Scanner *s, TSLexer *lexer) {
  if (should_close_paragraph(s, lexer)) {
    lexer->result_symbol = CLOSE_PARAGRAPH;
    return true;
  } else {
    return false;
  }
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
    close_blocks(s, lexer, from_top, DIV_END, 3);
    return true;
  } else {
    // We can consume the colons as we start a new div now.
    lexer->mark_end(lexer);
    push_block(s, colons, DIV);
    lexer->result_symbol = DIV_START;
    return true;
  }
}

static bool parse_code_block(Scanner *s, TSLexer *lexer, uint8_t ticks) {
  if (ticks < 3) {
    return false;
  }

  if (s->open_blocks.size > 0) {
    // Code blocks can't contain other blocks, so we onlyook at the top.
    Block *top = peek_block(s);
    if (top->type == CODE_BLOCK && top->level == ticks) {
      // Found a matching block that we should close.
      lexer->mark_end(lexer);
      pop_block(s);
      lexer->result_symbol = CODE_BLOCK_END;
      return true;
    } else {
      // We're in a code block with a different number of `, ignore these.
      return false;
    }
  } else {
    // Not in a code block, let's start a new one.
    lexer->mark_end(lexer);
    push_block(s, ticks, CODE_BLOCK);
    lexer->result_symbol = CODE_BLOCK_START;
    return true;
  }
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
        // We found a matching number of `, abort but -don't- consume them.
        // Leave that for VERBATIM_END.
        // Yes, this is inefficient, but we need to let VERBATIM_END capture the
        // end token properly. We could do use `final_token_width`
        // but I haven't bothered and it's not that expensive to parse it again.
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

  if (valid_symbols[CODE_BLOCK_END] || valid_symbols[CODE_BLOCK_START]) {
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

static bool parse_list_marker(Scanner *s, TSLexer *lexer,
                              const bool *valid_symbols) {
  if (lexer->lookahead == '-') {
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    lexer->result_symbol = LIST_MARKER_DASH;
    return true;
  } else {
    return false;
  }
}

bool tree_sitter_djot_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {

  Scanner *s = (Scanner *)payload;

  // printf("SCAN\n");
  // dump(s, lexer);
  // printf("? BLOCK_CLOSE %b\n", valid_symbols[BLOCK_CLOSE]);
  // printf("? DIV_START %b\n", valid_symbols[DIV_START]);
  // printf("? DIV_END %b\n", valid_symbols[DIV_END]);
  // printf("? CLOSE_PARAGRAPH %b\n", valid_symbols[CLOSE_PARAGRAPH]);
  // printf("? VERBATIM_START %b\n", valid_symbols[VERBATIM_START]);
  // printf("? VERBATIM_END %b\n", valid_symbols[VERBATIM_END]);
  // printf("? CODE_BLOCK_START %b\n", valid_symbols[CODE_BLOCK_START]);
  // printf("? CODE_BLOCK_END %b\n", valid_symbols[CODE_BLOCK_END]);

  // It's important to try to close blocks before other things.
  if (valid_symbols[BLOCK_CLOSE] && parse_block_close(s, lexer)) {
    return true;
  }
  if (check_open_blocks(s, lexer, valid_symbols)) {
    return true;
  }

  if (output_delayed_token(s, lexer, valid_symbols)) {
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
  if (valid_symbols[LIST_MARKER_DASH] &&
      parse_list_marker(s, lexer, valid_symbols)) {
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
  size_t blocks = s->open_blocks.size;
  if (blocks > 0) {
    size_t blocks_size = blocks * sizeof(Block);
    memcpy(&buffer[size], s->open_blocks.items, blocks_size);
    size += blocks_size;
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

    size_t blocks_size = length - size;
    if (blocks_size > 0) {
      size_t blocks = blocks_size / sizeof(Block);
      memcpy(s->open_blocks.items, &buffer[size], blocks_size);
      s->open_blocks.size = blocks;
    }
  }
}
