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
  CLOSE_PARAGRAPH,
  VERBATIM_START,
  VERBATIM_END,
  VERBATIM_CONTENT,
  ERROR,
  UNUSED
} TokenType;

typedef enum {
  DIV,
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
  // After we have closed all blocks, what symbol should we output?
  TokenType block_close_final_token;
  uint8_t final_token_width;

  // The number of ` we are currently matching, or 0 when not inside.
  uint8_t verbatim_tick_count;
} Scanner;

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

static void dump(Scanner *s, TSLexer *lexer) {
  printf("=== Lookahead: `%c`\n", lexer->lookahead);
  printf("--- Stack size: %zu\n", s->open_blocks.size);
  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    printf("  %d\n", b->level);
  }
  printf("---\n");
  printf("  blocks_to_close: %d\n", s->blocks_to_close);
  printf("  final_token_width: %d\n", s->final_token_width);
  printf("  block_close_final_token: %u\n", s->block_close_final_token);
  printf("  verbatim_tick_count: %u\n", s->verbatim_tick_count);
  printf("===\n");
}

static void close_blocks(Scanner *s, TSLexer *lexer, size_t count,
                         TokenType final, uint8_t final_token_width) {
  // printf("CLOSE %zu blocks\n", count);
  s->block_close_final_token = final;
  s->blocks_to_close = count - 1;
  s->final_token_width = final_token_width;
  lexer->result_symbol = BLOCK_CLOSE;
  pop_block(s);
}

static uint8_t consume_chars(Scanner *s, TSLexer *lexer, char c) {
  uint8_t count = 0;
  while (lexer->lookahead == c) {
    lexer->advance(lexer, false);
    ++count;
  }
  return count;
}

static bool can_close_div(Scanner *s, TSLexer *lexer, uint8_t *colons,
                          size_t *from_top) {
  // Because we want to emit a BLOCK_CLOSE token before
  // consuming the `:::` token, we mark the end before advancing
  // to allow us to peek forward.
  lexer->mark_end(lexer);
  *colons = consume_chars(s, lexer, ':');

  if (*colons < 3) {
    return false;
  }

  *from_top = number_of_blocks_from_top(s, DIV, *colons);
  return true;
}

static bool should_close_paragraph(Scanner *s, TSLexer *lexer,
                                   const bool *valid_symbols) {
  uint8_t colons;
  size_t from_top;
  // FIXME maybe we can setup div end result here directly?
  return can_close_div(s, lexer, &colons, &from_top);
}

static bool parse_div(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  // The context could either be a start or an end token.
  // To figure out which we should do, we search through the entire
  // block stack to find if there's an open block somewhere
  // with the same number of colons.
  // If there is, we should close that one (and all open blocks before),
  // otherwise we start a new div.
  uint8_t colons;
  size_t from_top;
  if (!can_close_div(s, lexer, &colons, &from_top)) {
    return false;
  }

  if (from_top > 0) {
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

static bool parse_verbatim_start(Scanner *s, TSLexer *lexer) {
  uint8_t ticks = consume_chars(s, lexer, '`');
  if (ticks == 0) {
    return false;
  }
  lexer->mark_end(lexer);
  s->verbatim_tick_count = ticks;
  lexer->result_symbol = VERBATIM_START;
  return true;
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
        // end token properly. Maybe there is a way to make this more efficient,
        // but it's really not that expensive.
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

static bool parse_verbatim_end(Scanner *s, TSLexer *lexer) {
  if (s->verbatim_tick_count == 0) {
    return false;
  }
  bool at_end = lexer->lookahead == '\n' || lexer->eof(lexer);

  uint8_t ticks = consume_chars(s, lexer, '`');
  if (!at_end && ticks != s->verbatim_tick_count) {
    return false;
  }

  lexer->mark_end(lexer);
  s->verbatim_tick_count = 0;
  lexer->result_symbol = VERBATIM_END;
  return true;
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
  // printf("? VERBATIM_CONTENT %b\n", valid_symbols[VERBATIM_CONTENT]);
  // printf("current '%c'\n", lexer->lookahead);

  if (valid_symbols[CLOSE_PARAGRAPH] &&
      should_close_paragraph(s, lexer, valid_symbols)) {
    lexer->result_symbol = CLOSE_PARAGRAPH;
    return true;
  }

  // If we reach oef with open blocks, we should close them all.
  if (lexer->eof(lexer) && s->open_blocks.size > 0) {
    // printf("BLOCK_CLOSE eof\n");
    lexer->result_symbol = BLOCK_CLOSE;
    pop_block(s);
    return true;
  }

  if (valid_symbols[BLOCK_CLOSE] && s->blocks_to_close > 0) {
    // printf("BLOCK_CLOSE extra\n");
    lexer->result_symbol = BLOCK_CLOSE;
    --s->blocks_to_close;
    pop_block(s);
    return true;
  }
  if (s->blocks_to_close > 0) {
    // printf("REJECTED, MUST CLOSE BLOCKS\n");
    // Must close them blocks!
    return false;
  }

  if (s->blocks_to_close == 0 && valid_symbols[s->block_close_final_token]) {
    lexer->result_symbol = s->block_close_final_token;
    s->block_close_final_token = UNUSED;
    while (s->final_token_width--) {
      lexer->advance(lexer, false);
    }
    // printf("FINAL TOKEN\n");
    return true;
  }

  if (valid_symbols[DIV_START] || valid_symbols[DIV_END]) {
    if (parse_div(s, lexer, valid_symbols)) {
      return true;
    }
  }
  if (valid_symbols[VERBATIM_CONTENT] && parse_verbatim_content(s, lexer)) {
    return true;
  }
  if (valid_symbols[VERBATIM_END] && parse_verbatim_end(s, lexer)) {
    return true;
  }
  if (valid_symbols[VERBATIM_START] && parse_verbatim_start(s, lexer)) {
    return true;
  }

  return false;
}

void init(Scanner *s) {
  s->open_blocks.size = 0;
  s->final_token_width = 0;
  s->blocks_to_close = 0;
  s->verbatim_tick_count = 0;
  s->block_close_final_token = UNUSED;
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
  buffer[size++] = (char)s->block_close_final_token;
  buffer[size++] = (char)s->final_token_width;
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
    s->block_close_final_token = (TokenType)buffer[size++];
    s->final_token_width = (uint8_t)buffer[size++];
    s->verbatim_tick_count = (uint8_t)buffer[size++];

    size_t blocks_size = length - size;
    if (blocks_size > 0) {
      size_t blocks = blocks_size / sizeof(Block);
      memcpy(s->open_blocks.items, &buffer[size], blocks_size);
      s->open_blocks.size = blocks;
    }
  }
}
