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
} Scanner;

static void push_block(Scanner *s, uint8_t level, BlockType type) {
  Block *b = malloc(sizeof(Block));
  b->level = level;
  b->type = type;
  s->open_blocks.items[s->open_blocks.size++] = b;
}

static void pop_block(Scanner *s) {
  if (s->open_blocks.size > 0) {
    // printf("POP\n");
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

static void dump(Scanner *s) {
  printf("=== Stack size: %zu\n", s->open_blocks.size);
  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    printf("  %d\n", b->level);
  }
  printf("---\n");
  printf("  blocks_to_close: %d\n", s->blocks_to_close);
  printf("  final_token_width: %d\n", s->final_token_width);
  printf("  block_close_final_token: %u\n", s->block_close_final_token);
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

static bool should_close_paragraph(Scanner *s, TSLexer *lexer,
                                   const bool *valid_symbols) {
  // We're only peeking
  // FIXME combine with parse_div
  lexer->mark_end(lexer);

  uint8_t colons = 0;
  // Because we want to emit a BLOCK_CLOSE token before
  // consuming the `:::` token, we mark the end before advancing
  // to allow us to peek forward.
  lexer->mark_end(lexer);
  while (lexer->lookahead == ':') {
    lexer->advance(lexer, false);
    ++colons;
  }

  if (colons < 3) {
    return false;
  }

  size_t from_top = number_of_blocks_from_top(s, DIV, colons);
  return from_top != 0;
}

static bool parse_div(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  uint8_t colons = 0;
  // Because we want to emit a BLOCK_CLOSE token before
  // consuming the `:::` token, we mark the end before advancing
  // to allow us to peek forward.
  lexer->mark_end(lexer);
  while (lexer->lookahead == ':') {
    lexer->advance(lexer, false);
    ++colons;
  }

  if (colons < 3) {
    return false;
  }

  // The context could either be a start or an end token.
  // To figure out which we should do, we search through the entire
  // block stack to find if there's an open block somewhere
  // with the same number of colons.
  // If there is, we should close that one (and all open blocks before),
  // otherwise we start a new div.
  size_t from_top = number_of_blocks_from_top(s, DIV, colons);
  // printf("from top: %zu\n", from_top);
  if (from_top > 0) {
    close_blocks(s, lexer, from_top, DIV_END, 3);
    // dump(s);
    return true;
  } else {
    // We can consume the colons as we start a new div now.
    lexer->mark_end(lexer);
    push_block(s, colons, DIV);
    lexer->result_symbol = DIV_START;
    // printf("DIV_START\n");
    // dump(s);
    return true;
  }
}

bool tree_sitter_djot_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {

  Scanner *s = (Scanner *)payload;

  // printf("SCAN\n");
  // dump(s);
  // printf("? BLOCK_CLOSE %b\n", valid_symbols[BLOCK_CLOSE]);
  // printf("? DIV_START %b\n", valid_symbols[DIV_START]);
  // printf("? DIV_END %b\n", valid_symbols[DIV_END]);
  // printf("? CLOSE_PARAGRAPH %b\n", valid_symbols[CLOSE_PARAGRAPH]);
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
    return parse_div(s, lexer, valid_symbols);
  }

  return false;
}

void *tree_sitter_djot_external_scanner_create() {
  Scanner *s = (Scanner *)malloc(sizeof(Scanner));
  s->open_blocks.size = 0;
  s->final_token_width = 0;
  s->blocks_to_close = 0;
  s->block_close_final_token = UNUSED;
  // s->open_blocks.items = (Block *)calloc(1, sizeof(Block));
  return s;
}

void tree_sitter_djot_external_scanner_destroy(void *payload) {
  Scanner *s = (Scanner *)payload;
  // printf("%zu", s->open_blocks.size);
  for (size_t i = 0; i < s->open_blocks.size; i++) {
    free(s->open_blocks.items[i]);
  }
  // free(s->open_blocks.items);
  free(s);
}

unsigned tree_sitter_djot_external_scanner_serialize(void *payload,
                                                     char *buffer) {
  Scanner *s = (Scanner *)payload;
  unsigned size = 0;
  buffer[size++] = (char)s->blocks_to_close;
  buffer[size++] = (char)s->block_close_final_token;
  buffer[size++] = (char)s->final_token_width;
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
  s->open_blocks.size = 0;
  s->final_token_width = 0;
  s->blocks_to_close = 0;
  s->block_close_final_token = UNUSED;
  if (length > 0) {
    size_t size = 0;
    s->blocks_to_close = (uint8_t)buffer[size++];
    s->block_close_final_token = (TokenType)buffer[size++];
    s->final_token_width = (uint8_t)buffer[size++];

    size_t blocks_size = length - size;
    if (blocks_size > 0) {
      size_t blocks = blocks_size / sizeof(Block);
      memcpy(s->open_blocks.items, &buffer[size], blocks_size);
      s->open_blocks.size = blocks;
    }
  }
}
