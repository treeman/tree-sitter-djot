#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"
#include <stdio.h>

#define DEBUG

// The different tokens the external scanner support
// See `externals` in `grammar.js` for a description of most of them.
typedef enum {
  IGNORED,

  VERBATIM_BEGIN,
  VERBATIM_END,
  VERBATIM_CONTENT,

  EMPHASIS_BEGIN,
  EMPHASIS_END,
  STRONG_BEGIN,
  STRONG_END,

  EMPHASIS_BEGIN_CHECK,
  EMPHASIS_END_CHECK,
  IN_REAL_EMPHASIS,
  IN_FALLBACK,
  NON_WHITESPACE_CHECK,

  ERROR,
} TokenType;

typedef enum {
  EMPHASIS,
  STRONG,
} ElementType;

typedef struct {
  Array(ElementType) * open_elements;

  // The number of ` we are currently matching, or 0 when not inside.
  uint8_t verbatim_tick_count;
} Scanner;

#ifdef DEBUG
#include <assert.h>
static void dump(Scanner *s, TSLexer *lexer);
static void dump_valid_symbols(const bool *valid_symbols);
#endif

static void advance(TSLexer *lexer) {
  lexer->advance(lexer, false);
  // Carriage returns should simply be ignored.
  if (lexer->lookahead == '\r') {
    lexer->advance(lexer, false);
  }
}

static uint8_t consume_chars(TSLexer *lexer, char c) {
  uint8_t count = 0;
  while (lexer->lookahead == c) {
    advance(lexer);
    ++count;
  }
  return count;
}

static bool parse_verbatim_content(Scanner *s, TSLexer *lexer) {
  uint8_t ticks = 0;
  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '`') {
      // If we find a `, we need to count them to see if we should stop.
      uint8_t current = consume_chars(lexer, '`');
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
      advance(lexer);
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
  uint8_t ticks = consume_chars(lexer, '`');
  if (ticks != s->verbatim_tick_count) {
    return false;
  }
  s->verbatim_tick_count = 0;
  lexer->mark_end(lexer);
  lexer->result_symbol = VERBATIM_END;
  return true;
}

static bool parse_verbatim_start(Scanner *s, TSLexer *lexer) {
  uint8_t ticks = consume_chars(lexer, '`');
  if (ticks == 0) {
    return false;
  }
  s->verbatim_tick_count = ticks;
  lexer->mark_end(lexer);
  lexer->result_symbol = VERBATIM_BEGIN;
  return true;
}

static bool element_on_top(Scanner *s, ElementType e) {
  return s->open_elements->size > 0 && *array_back(s->open_elements) == e;
}

static bool find_element(Scanner *s, ElementType e) {
  for (int i = s->open_elements->size - 1; i >= 0; --i) {
    if (*array_get(s->open_elements, i) == e) {
      return true;
    }
  }
  return false;
}

static bool emphasis_begin_check(Scanner *s, TSLexer *lexer) {
  lexer->result_symbol = EMPHASIS_BEGIN_CHECK;
  array_push(s->open_elements, EMPHASIS);
  return true;
}

static bool emphasis_end_check(Scanner *s, TSLexer *lexer) {
  if (!element_on_top(s, EMPHASIS)) {
    return false;
  }

  lexer->result_symbol = EMPHASIS_END_CHECK;
  array_pop(s->open_elements);
  return true;
}

// IN_FALLBACK will only be valid during symbol fallback

static bool parse_emphasis(Scanner *s, TSLexer *lexer,
                           const bool *valid_symbols) {
  if (valid_symbols[EMPHASIS_END_CHECK] && emphasis_end_check(s, lexer)) {
    return true;
  }
  if (valid_symbols[EMPHASIS_BEGIN_CHECK]) {
    if (valid_symbols[IN_FALLBACK]) {
      // If we can find an open emphasis element that means we should choose
      // this one instead because we should prefer the shorter emphasis if two
      // are valid. By issuing an error we'll prune this branch
      // and make the resolver choose the other branch where we chose the
      // fallback for the previous begin marker instead.
      if (find_element(s, EMPHASIS)) {
        lexer->result_symbol = ERROR;
        return true;
      } else {
        // We need to output the token common to both the fallback symbol and
        // the emphasis so the resolver will branch.
        lexer->result_symbol = EMPHASIS_BEGIN_CHECK;
        return true;
      }
    } else if (emphasis_begin_check(s, lexer)) {
      return true;
    }
  }
  return false;
}

static bool check_non_whitespace(Scanner *s, TSLexer *lexer) {
  switch (lexer->lookahead) {
  case ' ':
  case '\t':
  case '\r':
  case '\n':
    return false;
  default:
    lexer->result_symbol = NON_WHITESPACE_CHECK;
    return true;
  }
}

bool tree_sitter_djot_inline_external_scanner_scan(void *payload,
                                                   TSLexer *lexer,
                                                   const bool *valid_symbols) {

  Scanner *s = (Scanner *)payload;

#ifdef DEBUG
  printf("SCAN\n");
  dump(s, lexer);
  dump_valid_symbols(valid_symbols);
#endif

  if (valid_symbols[ERROR]) {
    lexer->result_symbol = ERROR;
    return true;
  }

  if (valid_symbols[VERBATIM_CONTENT] && parse_verbatim_content(s, lexer)) {
    return true;
  }
  if (lexer->eof(lexer)) {
    if (valid_symbols[VERBATIM_END] && parse_verbatim_end(s, lexer)) {
      return true;
    }
  }

  if (valid_symbols[NON_WHITESPACE_CHECK] && check_non_whitespace(s, lexer)) {
    return true;
  }

  if (parse_emphasis(s, lexer, valid_symbols)) {
    return true;
  }

  switch (lexer->lookahead) {
  case '`':
    if (valid_symbols[VERBATIM_BEGIN] && parse_verbatim_start(s, lexer)) {
      return true;
    }
    if (valid_symbols[VERBATIM_END] && parse_verbatim_end(s, lexer)) {
      return true;
    }
    break;
  // case '*':
  //   if (parse_strong(s, lexer, valid_symbols)) {
  //     return true;
  //   }
  //   break;
  // case '_':
  //   if (parse_emphasis(s, lexer, valid_symbols)) {
  //     return true;
  //   }
  //   break;
  default:
    break;
  }

  return false;
}

void init(Scanner *s) {
  array_init(s->open_elements);
  s->verbatim_tick_count = 0;
}

void *tree_sitter_djot_inline_external_scanner_create() {
  Scanner *s = (Scanner *)ts_malloc(sizeof(Scanner));
  s->open_elements = ts_malloc(sizeof(Array(ElementType)));
  init(s);
  return s;
}

void tree_sitter_djot_inline_external_scanner_destroy(void *payload) {
  Scanner *s = (Scanner *)payload;
  array_delete(s->open_elements);
  ts_free(s);
}

unsigned tree_sitter_djot_inline_external_scanner_serialize(void *payload,
                                                            char *buffer) {
  Scanner *s = (Scanner *)payload;
  unsigned size = 0;
  buffer[size++] = (char)s->verbatim_tick_count;

  for (size_t i = 0; i < s->open_elements->size; ++i) {
    ElementType e = *array_get(s->open_elements, i);
    buffer[size++] = (char)e;
  }
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

    while (size < length) {
      ElementType e = (ElementType)buffer[size++];
      array_push(s->open_elements, e);
    }
  }
}

#ifdef DEBUG

static char *token_type_s(TokenType t) {
  switch (t) {
  case VERBATIM_BEGIN:
    return "VERBATIM_BEGIN";
  case VERBATIM_END:
    return "VERBATIM_END";
  case VERBATIM_CONTENT:
    return "VERBATIM_CONTENT";

  case EMPHASIS_BEGIN:
    return "EMPHASIS_BEGIN";
  case EMPHASIS_END:
    return "EMPHASIS_END";
  case STRONG_BEGIN:
    return "STRONG_BEGIN";
  case STRONG_END:
    return "STRONG_END";

  case EMPHASIS_BEGIN_CHECK:
    return "EMPHASIS_BEGIN_CHECK";
  case EMPHASIS_END_CHECK:
    return "EMPHASIS_END_CHECK";
  case IN_REAL_EMPHASIS:
    return "IN_REAL_EMPHASIS";
  case IN_FALLBACK:
    return "IN_FALLBACK";

  case ERROR:
    return "ERROR";
  case IGNORED:
    return "IGNORED";
  default:
    return "NOT IMPLEMENTED";
  }
}

static char *element_type_s(ElementType t) {
  switch (t) {
  case EMPHASIS:
    return "EMPHASIS";
  case STRONG:
    return "STRONG";
  default:
    return "NOT IMPLEMENTED";
  }
}

static void dump_scanner(Scanner *s) {
  printf("--- Open elements: %u (last -> first)\n", s->open_elements->size);
  for (size_t i = 0; i < s->open_elements->size; ++i) {
    ElementType e = *array_get(s->open_elements, i);
    printf("  %s\n", element_type_s(e));
  }
  printf("---\n");
  printf("  verbatim_tick_count: %u\n", s->verbatim_tick_count);
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
  for (int i = 0; i <= ERROR; ++i) {
    if (valid_symbols[i]) {
      printf("%s\n", token_type_s(i));
    }
  }
}

#endif
