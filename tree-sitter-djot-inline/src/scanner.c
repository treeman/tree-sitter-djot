#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"
#include <stdio.h>

// #define DEBUG

// The different tokens the external scanner support
// See `externals` in `grammar.js` for a description of most of them.
typedef enum {
  IGNORED,

  VERBATIM_BEGIN,
  VERBATIM_END,
  VERBATIM_CONTENT,

  // The different spans.
  // Begin is marked by a zero-width token to push elements on the open stack
  // (unless when we're parsing a fallback token).
  // End scans an actual ending token (such as `_}` or `_`) and checks the open
  // stack.
  EMPHASIS_MARK_BEGIN,
  EMPHASIS_END,

  // If we're scanning a fallback token then we should accept the beginning
  // markers, but not push anything on the stack.
  IN_FALLBACK,
  // Zero-width check for a non-whitespace token.
  NON_WHITESPACE_CHECK,

  ERROR,
} TokenType;

typedef enum {
  EMPHASIS,
  STRONG,
} ElementType;

typedef struct {
  ElementType type;
  // Different types may use data differently.
  // For differe
  uint8_t data;
} Element;

typedef struct {
  Array(Element *) * open_elements;

  // The number of ` we are currently matching, or 0 when not inside.
  // TODO move into open_elements
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

static bool is_whitespace(char c) {
  switch (c) {
  case ' ':
  case '\t':
  case '\r':
  case '\n':
    return true;
  default:
    return false;
  }
}

static uint8_t consume_whitespace(TSLexer *lexer) {
  uint8_t indent = 0;
  for (;;) {
    if (lexer->lookahead == ' ') {
      advance(lexer);
      ++indent;
    } else if (lexer->lookahead == '\r') {
      advance(lexer);
    } else if (lexer->lookahead == '\t') {
      advance(lexer);
      indent += 4;
    } else {
      break;
    }
  }
  return indent;
}

static Element *create_element(ElementType type, uint8_t data) {
  Element *e = ts_malloc(sizeof(Element));
  e->type = type;
  e->data = data;
  return e;
}

static void push_block(Scanner *s, ElementType type, uint8_t data) {
  array_push(s->open_elements, create_element(type, data));
}

static Element *peek_element(Scanner *s) {
  if (s->open_elements->size > 0) {
    return *array_back(s->open_elements);
  } else {
    return NULL;
  }
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

static bool element_on_top(Scanner *s, ElementType type) {
  return s->open_elements->size > 0 &&
         (*array_back(s->open_elements))->type == type;
}

static Element *find_element(Scanner *s, ElementType type) {
  for (int i = s->open_elements->size - 1; i >= 0; --i) {
    Element *e = *array_get(s->open_elements, i);
    if (e->type == type) {
      return e;
    }
  }
  return NULL;
}

static bool scan_span_end(TSLexer *lexer, char marker,
                          bool whitespace_sensitive) {
  if (lexer->lookahead == marker) {
    advance(lexer);
    if (lexer->lookahead == '}') {
      advance(lexer);
    }
    return true;
  }

  if (whitespace_sensitive && consume_whitespace(lexer) == 0) {
    return false;
  }

  if (lexer->lookahead != marker) {
    return false;
  }
  advance(lexer);
  if (lexer->lookahead != '}') {
    return false;
  }
  advance(lexer);
  return true;
}

static bool parse_span_end(Scanner *s, TSLexer *lexer, ElementType element,
                           TokenType token, char marker,
                           bool whitespace_sensitive) {
  Element *top = peek_element(s);
  if (!top || top->type != element) {
    return false;
  }

  if (top->data > 0) {
    return false;
  }

  if (!scan_span_end(lexer, marker, whitespace_sensitive)) {
    return false;
  }

  lexer->result_symbol = token;
  array_pop(s->open_elements);
  return true;
}

static bool mark_span_begin(Scanner *s, TSLexer *lexer,
                            const bool *valid_symbols, ElementType element,
                            TokenType token, char marker) {
  // If IN_FALLBACK is valid then it means we're processing the
  // `_symbol_fallback` branch (see `grammar.js`).
  if (valid_symbols[IN_FALLBACK]) {
    // If there's multiple valid opening spans, for example:
    //
    //      {_ {_ a_
    //
    // Then we should choose the shorter one and the first `{_`
    // should be regarded as regular text.
    // To handle this case we count the number of opening tags
    // an open element has and when we try to close an element with
    // open tags then we issue an error (in `parse_span_end`).
    //
    // The reason we're not immediately issuing an error here
    // is that spans might be nested, for example:
    //
    //      _a _b_ a_
    //
    // If we issue an error here at `_b` then we won't find the nested emphasis.
    // The solution i found was to do the check when closing the span instead.
    Element *open = find_element(s, element);
    if (open != NULL) {
      ++open->data;
    }
    // We need to output the token common to both the fallback symbol and
    // the span so the resolver will detect the collision.
    lexer->result_symbol = token;
    return true;
  } else {
    lexer->mark_end(lexer);
    lexer->result_symbol = token;
    push_block(s, element, 0);
    return true;
  }
}

static bool parse_span(Scanner *s, TSLexer *lexer, const bool *valid_symbols,
                       ElementType element, TokenType begin_token,
                       TokenType end_token, char marker,
                       bool whitespace_sensitive) {
  if (valid_symbols[end_token] &&
      parse_span_end(s, lexer, element, end_token, marker,
                     whitespace_sensitive)) {
    return true;
  }
  if (valid_symbols[begin_token] &&
      mark_span_begin(s, lexer, valid_symbols, element, begin_token, marker)) {
    return true;
  }
  return false;
}

static bool parse_emphasis(Scanner *s, TSLexer *lexer,
                           const bool *valid_symbols) {
  return parse_span(s, lexer, valid_symbols, EMPHASIS, EMPHASIS_MARK_BEGIN,
                    EMPHASIS_END, '_', true);
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
    Element *e = *array_get(s->open_elements, i);
    buffer[size++] = (char)e->type;
    buffer[size++] = (char)e->data;
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
      ElementType type = (ElementType)buffer[size++];
      uint8_t data = (uint8_t)buffer[size++];
      array_push(s->open_elements, create_element(type, data));
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

  case EMPHASIS_MARK_BEGIN:
    return "EMPHASIS_MARK_BEGIN";
  case EMPHASIS_END:
    return "EMPHASIS_END";

  case IN_FALLBACK:
    return "IN_FALLBACK";
  case NON_WHITESPACE_CHECK:
    return "NON_WHITESPACE_CHECK";

  case ERROR:
    return "ERROR";
  case IGNORED:
    return "IGNORED";
  }
}

static char *element_type_s(ElementType t) {
  switch (t) {
  case EMPHASIS:
    return "EMPHASIS";
  case STRONG:
    return "STRONG";
  }
}

static void dump_scanner(Scanner *s) {
  printf("--- Open elements: %u (last -> first)\n", s->open_elements->size);
  for (size_t i = 0; i < s->open_elements->size; ++i) {
    Element *e = *array_get(s->open_elements, i);
    printf("  %s data: %u ignore_end: %u\n", element_type_s(e->type), e->data,
           e->ignore_end);
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
