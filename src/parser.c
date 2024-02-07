#include <tree_sitter/parser.h>

#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wmissing-field-initializers"
#endif

#define LANGUAGE_VERSION 14
#define STATE_COUNT 9
#define LARGE_STATE_COUNT 4
#define SYMBOL_COUNT 13
#define ALIAS_COUNT 0
#define TOKEN_COUNT 6
#define EXTERNAL_TOKEN_COUNT 0
#define FIELD_COUNT 0
#define MAX_ALIAS_SEQUENCE_LENGTH 2
#define PRODUCTION_ID_COUNT 1

enum {
  anon_sym_ = 1,
  anon_sym_LF_LF = 2,
  anon_sym_LF = 3,
  anon_sym_BSLASH = 4,
  sym__text = 5,
  sym_document = 6,
  sym__block = 7,
  sym_paragraph = 8,
  sym__eof_or_blankline = 9,
  sym_inline = 10,
  aux_sym_document_repeat1 = 11,
  aux_sym_inline_repeat1 = 12,
};

static const char * const ts_symbol_names[] = {
  [ts_builtin_sym_end] = "end",
  [anon_sym_] = " ",
  [anon_sym_LF_LF] = "\n\n",
  [anon_sym_LF] = "\n ",
  [anon_sym_BSLASH] = "\\",
  [sym__text] = "_text",
  [sym_document] = "document",
  [sym__block] = "_block",
  [sym_paragraph] = "paragraph",
  [sym__eof_or_blankline] = "_eof_or_blankline",
  [sym_inline] = "inline",
  [aux_sym_document_repeat1] = "document_repeat1",
  [aux_sym_inline_repeat1] = "inline_repeat1",
};

static const TSSymbol ts_symbol_map[] = {
  [ts_builtin_sym_end] = ts_builtin_sym_end,
  [anon_sym_] = anon_sym_,
  [anon_sym_LF_LF] = anon_sym_LF_LF,
  [anon_sym_LF] = anon_sym_LF,
  [anon_sym_BSLASH] = anon_sym_BSLASH,
  [sym__text] = sym__text,
  [sym_document] = sym_document,
  [sym__block] = sym__block,
  [sym_paragraph] = sym_paragraph,
  [sym__eof_or_blankline] = sym__eof_or_blankline,
  [sym_inline] = sym_inline,
  [aux_sym_document_repeat1] = aux_sym_document_repeat1,
  [aux_sym_inline_repeat1] = aux_sym_inline_repeat1,
};

static const TSSymbolMetadata ts_symbol_metadata[] = {
  [ts_builtin_sym_end] = {
    .visible = false,
    .named = true,
  },
  [anon_sym_] = {
    .visible = true,
    .named = false,
  },
  [anon_sym_LF_LF] = {
    .visible = true,
    .named = false,
  },
  [anon_sym_LF] = {
    .visible = true,
    .named = false,
  },
  [anon_sym_BSLASH] = {
    .visible = true,
    .named = false,
  },
  [sym__text] = {
    .visible = false,
    .named = true,
  },
  [sym_document] = {
    .visible = true,
    .named = true,
  },
  [sym__block] = {
    .visible = false,
    .named = true,
  },
  [sym_paragraph] = {
    .visible = true,
    .named = true,
  },
  [sym__eof_or_blankline] = {
    .visible = false,
    .named = true,
  },
  [sym_inline] = {
    .visible = true,
    .named = true,
  },
  [aux_sym_document_repeat1] = {
    .visible = false,
    .named = false,
  },
  [aux_sym_inline_repeat1] = {
    .visible = false,
    .named = false,
  },
};

static const TSSymbol ts_alias_sequences[PRODUCTION_ID_COUNT][MAX_ALIAS_SEQUENCE_LENGTH] = {
  [0] = {0},
};

static const uint16_t ts_non_terminal_alias_map[] = {
  0,
};

static const TSStateId ts_primary_state_ids[STATE_COUNT] = {
  [0] = 0,
  [1] = 1,
  [2] = 2,
  [3] = 3,
  [4] = 4,
  [5] = 5,
  [6] = 6,
  [7] = 7,
  [8] = 8,
};

static bool ts_lex(TSLexer *lexer, TSStateId state) {
  START_LEXER();
  eof = lexer->eof(lexer);
  switch (state) {
    case 0:
      if (eof) ADVANCE(7);
      if (lookahead == 0) ADVANCE(9);
      if (lookahead == '\n') ADVANCE(1);
      if (lookahead == '\t' ||
          lookahead == '\r' ||
          lookahead == ' ') SKIP(0)
      if (lookahead == '\\') ADVANCE(11);
      if (lookahead != 0) ADVANCE(12);
      END_STATE();
    case 1:
      if (lookahead == 0) ADVANCE(9);
      if (lookahead == '\n') ADVANCE(1);
      if (lookahead == '\t' ||
          lookahead == '\r' ||
          lookahead == ' ') SKIP(1)
      if (lookahead == '\\') ADVANCE(11);
      if (lookahead != 0) ADVANCE(12);
      END_STATE();
    case 2:
      if (lookahead == 0) ADVANCE(9);
      if (lookahead == '\n') ADVANCE(10);
      if (lookahead == '\t' ||
          lookahead == '\r' ||
          lookahead == ' ') SKIP(3)
      if (lookahead != 0) ADVANCE(12);
      END_STATE();
    case 3:
      if (lookahead == 0) ADVANCE(9);
      if (lookahead == '\n') ADVANCE(2);
      if (lookahead == '\t' ||
          lookahead == '\r' ||
          lookahead == ' ') SKIP(3)
      if (lookahead != 0) ADVANCE(12);
      END_STATE();
    case 4:
      if (lookahead == 0) ADVANCE(8);
      if (lookahead == '\n') ADVANCE(10);
      if (lookahead == '\t' ||
          lookahead == '\r' ||
          lookahead == ' ') SKIP(5)
      END_STATE();
    case 5:
      if (lookahead == 0) ADVANCE(8);
      if (lookahead == '\n') ADVANCE(4);
      if (lookahead == '\t' ||
          lookahead == '\r' ||
          lookahead == ' ') SKIP(5)
      END_STATE();
    case 6:
      if (eof) ADVANCE(7);
      if (lookahead == '\t' ||
          lookahead == '\n' ||
          lookahead == '\r' ||
          lookahead == ' ') SKIP(6)
      if (lookahead != 0) ADVANCE(12);
      END_STATE();
    case 7:
      ACCEPT_TOKEN(ts_builtin_sym_end);
      END_STATE();
    case 8:
      ACCEPT_TOKEN(anon_sym_);
      END_STATE();
    case 9:
      ACCEPT_TOKEN(anon_sym_);
      if (lookahead != 0 &&
          lookahead != '\t' &&
          lookahead != '\n' &&
          lookahead != '\r' &&
          lookahead != ' ') ADVANCE(12);
      END_STATE();
    case 10:
      ACCEPT_TOKEN(anon_sym_LF_LF);
      if (lookahead == '\n') ADVANCE(10);
      END_STATE();
    case 11:
      ACCEPT_TOKEN(anon_sym_BSLASH);
      if (lookahead != 0 &&
          lookahead != '\t' &&
          lookahead != '\n' &&
          lookahead != '\r' &&
          lookahead != ' ') ADVANCE(12);
      END_STATE();
    case 12:
      ACCEPT_TOKEN(sym__text);
      if (lookahead != 0 &&
          lookahead != '\t' &&
          lookahead != '\n' &&
          lookahead != '\r' &&
          lookahead != ' ') ADVANCE(12);
      END_STATE();
    default:
      return false;
  }
}

static const TSLexMode ts_lex_modes[STATE_COUNT] = {
  [0] = {.lex_state = 0},
  [1] = {.lex_state = 6},
  [2] = {.lex_state = 6},
  [3] = {.lex_state = 6},
  [4] = {.lex_state = 3},
  [5] = {.lex_state = 3},
  [6] = {.lex_state = 5},
  [7] = {.lex_state = 6},
  [8] = {.lex_state = 0},
};

static const uint16_t ts_parse_table[LARGE_STATE_COUNT][SYMBOL_COUNT] = {
  [0] = {
    [ts_builtin_sym_end] = ACTIONS(1),
    [anon_sym_] = ACTIONS(1),
    [anon_sym_LF] = ACTIONS(1),
    [anon_sym_BSLASH] = ACTIONS(1),
    [sym__text] = ACTIONS(1),
  },
  [1] = {
    [sym_document] = STATE(8),
    [sym__block] = STATE(2),
    [sym_paragraph] = STATE(2),
    [sym_inline] = STATE(6),
    [aux_sym_document_repeat1] = STATE(2),
    [aux_sym_inline_repeat1] = STATE(4),
    [ts_builtin_sym_end] = ACTIONS(3),
    [sym__text] = ACTIONS(5),
  },
  [2] = {
    [sym__block] = STATE(3),
    [sym_paragraph] = STATE(3),
    [sym_inline] = STATE(6),
    [aux_sym_document_repeat1] = STATE(3),
    [aux_sym_inline_repeat1] = STATE(4),
    [ts_builtin_sym_end] = ACTIONS(7),
    [sym__text] = ACTIONS(5),
  },
  [3] = {
    [sym__block] = STATE(3),
    [sym_paragraph] = STATE(3),
    [sym_inline] = STATE(6),
    [aux_sym_document_repeat1] = STATE(3),
    [aux_sym_inline_repeat1] = STATE(4),
    [ts_builtin_sym_end] = ACTIONS(9),
    [sym__text] = ACTIONS(11),
  },
};

static const uint16_t ts_small_parse_table[] = {
  [0] = 4,
    ACTIONS(16), 1,
      anon_sym_LF_LF,
    ACTIONS(18), 1,
      sym__text,
    STATE(5), 1,
      aux_sym_inline_repeat1,
    ACTIONS(14), 2,
      anon_sym_,
      anon_sym_LF,
  [14] = 4,
    ACTIONS(22), 1,
      anon_sym_LF_LF,
    ACTIONS(24), 1,
      sym__text,
    STATE(5), 1,
      aux_sym_inline_repeat1,
    ACTIONS(20), 2,
      anon_sym_,
      anon_sym_LF,
  [28] = 3,
    ACTIONS(29), 1,
      anon_sym_LF_LF,
    STATE(7), 1,
      sym__eof_or_blankline,
    ACTIONS(27), 2,
      anon_sym_,
      anon_sym_LF,
  [39] = 1,
    ACTIONS(31), 2,
      ts_builtin_sym_end,
      sym__text,
  [44] = 1,
    ACTIONS(33), 1,
      ts_builtin_sym_end,
};

static const uint32_t ts_small_parse_table_map[] = {
  [SMALL_STATE(4)] = 0,
  [SMALL_STATE(5)] = 14,
  [SMALL_STATE(6)] = 28,
  [SMALL_STATE(7)] = 39,
  [SMALL_STATE(8)] = 44,
};

static const TSParseActionEntry ts_parse_actions[] = {
  [0] = {.entry = {.count = 0, .reusable = false}},
  [1] = {.entry = {.count = 1, .reusable = false}}, RECOVER(),
  [3] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_document, 0),
  [5] = {.entry = {.count = 1, .reusable = true}}, SHIFT(4),
  [7] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_document, 1),
  [9] = {.entry = {.count = 1, .reusable = true}}, REDUCE(aux_sym_document_repeat1, 2),
  [11] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_document_repeat1, 2), SHIFT_REPEAT(4),
  [14] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_inline, 1),
  [16] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_inline, 1),
  [18] = {.entry = {.count = 1, .reusable = false}}, SHIFT(5),
  [20] = {.entry = {.count = 1, .reusable = false}}, REDUCE(aux_sym_inline_repeat1, 2),
  [22] = {.entry = {.count = 1, .reusable = true}}, REDUCE(aux_sym_inline_repeat1, 2),
  [24] = {.entry = {.count = 2, .reusable = false}}, REDUCE(aux_sym_inline_repeat1, 2), SHIFT_REPEAT(5),
  [27] = {.entry = {.count = 1, .reusable = false}}, SHIFT(7),
  [29] = {.entry = {.count = 1, .reusable = true}}, SHIFT(7),
  [31] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_paragraph, 2),
  [33] = {.entry = {.count = 1, .reusable = true}},  ACCEPT_INPUT(),
};

#ifdef __cplusplus
extern "C" {
#endif
#ifdef _WIN32
#define extern __declspec(dllexport)
#endif

extern const TSLanguage *tree_sitter_Djot(void) {
  static const TSLanguage language = {
    .version = LANGUAGE_VERSION,
    .symbol_count = SYMBOL_COUNT,
    .alias_count = ALIAS_COUNT,
    .token_count = TOKEN_COUNT,
    .external_token_count = EXTERNAL_TOKEN_COUNT,
    .state_count = STATE_COUNT,
    .large_state_count = LARGE_STATE_COUNT,
    .production_id_count = PRODUCTION_ID_COUNT,
    .field_count = FIELD_COUNT,
    .max_alias_sequence_length = MAX_ALIAS_SEQUENCE_LENGTH,
    .parse_table = &ts_parse_table[0][0],
    .small_parse_table = ts_small_parse_table,
    .small_parse_table_map = ts_small_parse_table_map,
    .parse_actions = ts_parse_actions,
    .symbol_names = ts_symbol_names,
    .symbol_metadata = ts_symbol_metadata,
    .public_symbol_map = ts_symbol_map,
    .alias_map = ts_non_terminal_alias_map,
    .alias_sequences = &ts_alias_sequences[0][0],
    .lex_modes = ts_lex_modes,
    .lex_fn = ts_lex,
    .primary_state_ids = ts_primary_state_ids,
  };
  return &language;
}
#ifdef __cplusplus
}
#endif
