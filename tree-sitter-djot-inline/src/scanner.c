#include "tree_sitter/alloc.h"
#include "tree_sitter/parser.h"
#include <stdio.h>

// The different tokens the external scanner support
// See `externals` in `grammar.js` for a description of most of them.
typedef enum {
  IGNORED,

  VERBATIM_BEGIN,
  VERBATIM_END,
  VERBATIM_CONTENT,

  ERROR,
} TokenType;

typedef struct {
  // The number of ` we are currently matching, or 0 when not inside.
  uint8_t verbatim_tick_count;
} Scanner;

static void advance(Scanner *s, TSLexer *lexer) {
  lexer->advance(lexer, false);
  // Carriage returns should simply be ignored.
  if (lexer->lookahead == '\r') {
    lexer->advance(lexer, false);
  }
}

static uint8_t consume_chars(Scanner *s, TSLexer *lexer, char c) {
  uint8_t count = 0;
  while (lexer->lookahead == c) {
    advance(s, lexer);
    ++count;
  }
  return count;
}

static bool parse_verbatim_content(Scanner *s, TSLexer *lexer) {
  uint8_t ticks = 0;
  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '`') {
      // If we find a `, we need to count them to see if we should stop.
      uint8_t current = consume_chars(s, lexer, '`');
      if (current == s->verbatim_tick_count) {
        // We found a matching number of `
        break;
      } else {
        // Found a number of ` that doesn't match the start,
        // we should consume them.
        lexer->mark_end(lexer);
        ticks = 0;
      }
    } else {
      // Non-` token found, just consume.
      advance(s, lexer);
      lexer->mark_end(lexer);
      ticks = 0;
    }
  }

  // Scanned all the verbatim.
  lexer->result_symbol = VERBATIM_CONTENT;
  return true;
}

static bool parse_verbatim_end(Scanner *s, TSLexer *lexer) {
  if (lexer->eof(lexer)) {
    lexer->result_symbol = VERBATIM_END;
    return true;
  }
  if (s->verbatim_tick_count == 0) {
    return false;
  }
  uint8_t ticks = consume_chars(s, lexer, '`');
  if (ticks != s->verbatim_tick_count) {
    return false;
  }
  s->verbatim_tick_count = 0;
  lexer->mark_end(lexer);
  lexer->result_symbol = VERBATIM_END;
  return true;
}

static bool parse_verbatim_start(Scanner *s, TSLexer *lexer) {
  uint8_t ticks = consume_chars(s, lexer, '`');
  if (ticks == 0) {
    return false;
  }
  s->verbatim_tick_count = ticks;
  lexer->mark_end(lexer);
  lexer->result_symbol = VERBATIM_BEGIN;
  return true;
}

bool tree_sitter_djot_inline_external_scanner_scan(void *payload,
                                                   TSLexer *lexer,
                                                   const bool *valid_symbols) {

  Scanner *s = (Scanner *)payload;

  if (valid_symbols[VERBATIM_CONTENT] && parse_verbatim_content(s, lexer)) {
    return true;
  }
  if (valid_symbols[VERBATIM_END] && parse_verbatim_end(s, lexer)) {
    return true;
  }
  if (valid_symbols[VERBATIM_BEGIN] && parse_verbatim_start(s, lexer)) {
    return true;
  }

  return false;
}

void init(Scanner *s) { s->verbatim_tick_count = 0; }

void *tree_sitter_djot_inline_external_scanner_create() {
  Scanner *s = (Scanner *)ts_malloc(sizeof(Scanner));
  init(s);
  return s;
}

void tree_sitter_djot_inline_external_scanner_destroy(void *payload) {
  Scanner *s = (Scanner *)payload;
  ts_free(s);
}

unsigned tree_sitter_djot_inline_external_scanner_serialize(void *payload,
                                                            char *buffer) {
  Scanner *s = (Scanner *)payload;
  unsigned size = 0;
  buffer[size++] = (char)s->verbatim_tick_count;
  return size;
}

void tree_sitter_djot_inline_external_scanner_deserialize(void *payload,
                                                          char *buffer,
                                                          unsigned length) {
  Scanner *s = (Scanner *)payload;
  init(s);
  if (length > 0) {
    size_t size = 0;
    s->verbatim_tick_count = (uint8_t)buffer[size++];
  }
}
