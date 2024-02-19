#include "tree_sitter/parser.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

// Maybe we should implement a growable stack or something,
// but this is probably fine.
#define STACK_SIZE 512

typedef enum { BLOCK_CLOSE, DIV_START, DIV_END, ERROR, UNUSED } TokenType;

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
    free(s->open_blocks.items[--s->open_blocks.size]);
  }
}

static bool has_block(Scanner *s) { return s->open_blocks.size > 0; }

static Block *peek_block(Scanner *s) {
  assert(s->open_blocks.size > 0);
  return s->open_blocks.items[s->open_blocks.size - 1];
}

static Block *find_block(Scanner *s, BlockType type, uint8_t level) {
  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    if (b->type == type && b->level == level) {
      return b;
    }
  }
  return NULL;
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

// Remove blocks until 'b' is reached.
// Is inclusive, so will free 'b'!
static uint8_t remove_blocks_until(Scanner *s, Block *b) {
  uint8_t removed = 0;
  for (;;) {
    Block *top = peek_block(s);
    bool found = top == b;
    // printf("-> removing block %d\n", top->level);
    // TODO should issue a $._block_close token
    // instead of just removing it here...
    // So we need to set some kind of state here instead
    // and pop the topmost block until we reach
    // our target block.
    pop_block(s);
    ++removed;
    // dump_stack(s);

    // Should always work, size check is just a safeguard.
    if (found || s->open_blocks.size == 0) {
      return removed;
    }
  }
}

static void close_blocks(Scanner *s, TSLexer *lexer, Block *last_to_remove,
                         TokenType final, uint8_t final_token_width) {
  uint8_t removal_count = remove_blocks_until(s, last_to_remove);
  if (removal_count <= 1) {
    // We're closing the current block, so we can output the
    // final token immediately.
    printf("Closing current block\n");
    lexer->mark_end(lexer);
    lexer->result_symbol = final;
  } else {
    // We need to close some blocks.
    // The way we do this is we first issue BLOCK_CLOSE tokens
    // until the very last one, which is supposed to be the `final` token.
    printf("Close %d blocks\n", removal_count);
    s->block_close_final_token = final;
    s->blocks_to_close = removal_count - 1;
    s->final_token_width = final_token_width;
    lexer->result_symbol = BLOCK_CLOSE;
  }
}

static bool close_block(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  if (s->blocks_to_close > 0) {
    lexer->result_symbol = BLOCK_CLOSE;
    --s->blocks_to_close;
    return true;
  } else {
    return false;
  }
}

static bool parse_div(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  uint8_t colons = 0;
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
  // If there is, we should close that one, otherwise
  // we start a new div.
  Block *existing = find_block(s, DIV, colons);
  if (existing) {
    // s->blocks_to_close = remove_blocks_until(s, existing) - 1;
    // s->block_close_final_symbol = DIV_END;
    // lexer->result_symbol = DIV_END;

    close_blocks(s, lexer, existing, DIV_END, 3);
    dump(s);
    return true;
  } else {
    lexer->mark_end(lexer);
    push_block(s, colons, DIV);
    lexer->result_symbol = DIV_START;
    printf("DIV_START\n");
    dump(s);
    return true;
  }

  // if (has_block(s)) {
  //   Block *current = peek_block(s);
  //   // We found a matching closing div tag
  //   if (current->type == DIV && current->level == colons) {
  //     pop_block(s);
  //     lexer->result_symbol = DIV_END;
  //     return true;
  //   }
  // }
}

bool tree_sitter_djot_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {

  Scanner *s = (Scanner *)payload;

  // If we reach oef with open blocks, we should close them all.
  // if (lexer->eof(lexer)) {
  // }

  printf("SCAN\n");
  dump(s);
  printf("? BLOCK_CLOSE %b\n", valid_symbols[BLOCK_CLOSE]);
  printf("? DIV_START %b\n", valid_symbols[DIV_START]);
  printf("? DIV_END %b\n", valid_symbols[DIV_END]);
  printf("current '%c'\n", lexer->lookahead);

  if (valid_symbols[BLOCK_CLOSE] && s->blocks_to_close > 0) {
    printf("! Closing extra block\n");
    lexer->result_symbol = BLOCK_CLOSE;
    --s->blocks_to_close;
    return true;
  }
  if (s->blocks_to_close > 0) {
    printf("REJECTED, MUST CLOSE BLOCKS\n");
    // Must close them blocks!
    return false;
  }

  // FIXME multiple rules can match a zero-width BLOCK_CLOSE token...
  // No need to emit more than one
  if (s->blocks_to_close == 0 && valid_symbols[s->block_close_final_token]) {
    lexer->result_symbol = s->block_close_final_token;
    s->block_close_final_token = UNUSED;
    while (s->final_token_width--) {
      lexer->advance(lexer, false);
    }
    printf("FINAL TOKEN\n");
    return true;
  }
  // if (valid_symbols

  if (valid_symbols[DIV_START] || valid_symbols[DIV_END]) {
    return parse_div(s, lexer, valid_symbols);
  } else if (valid_symbols[BLOCK_CLOSE]) {
    return close_block(s, lexer, valid_symbols);
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
