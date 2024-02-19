#include "tree_sitter/parser.h"
#include <assert.h>
#include <stdio.h>

// Maybe we should implement a growable stack or something,
// but this is probably fine.
#define STACK_SIZE 512

typedef enum { BLOCK_CLOSE, DIV_START, DIV_END, ERROR_SENTINEL } TokenType;

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

static void dump_stack(Scanner *s) {
  printf("=== Stack size: %zu\n", s->open_blocks.size);
  for (size_t i = 0; i < s->open_blocks.size; ++i) {
    Block *b = s->open_blocks.items[i];
    printf("  %d\n", b->level);
  }
  printf("=== Stack\n");
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

static bool parse_div(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  uint8_t colons = 0;
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
    lexer->result_symbol = DIV_END;
    s->blocks_to_close = remove_blocks_until(s, existing);

    return true;
  } else {
    push_block(s, colons, DIV);
    lexer->result_symbol = DIV_START;

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

static bool close_block(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  if (s->blocks_to_close > 0) {
    lexer->result_symbol = BLOCK_CLOSE;
    --s->blocks_to_close;
    return true;
  } else {
    return false;
  }
}

bool tree_sitter_djot_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {

  Scanner *s = (Scanner *)payload;

  // If we reach oef with open blocks, we should close them all.
  // if (lexer->eof(lexer)) {
  // }

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
  return 0;
}

void tree_sitter_djot_external_scanner_deserialize(void *payload, char *buffer,
                                                   unsigned length) {
  Scanner *s = (Scanner *)payload;
}
