package tree_sitter_YOUR_LANGUAGE_NAME_test

import (
	"testing"

	tree_sitter "github.com/smacker/go-tree-sitter"
	"github.com/tree-sitter/tree-sitter-YOUR_LANGUAGE_NAME"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_YOUR_LANGUAGE_NAME.Language())
	if language == nil {
		t.Errorf("Error loading YourLanguageName grammar")
	}
}
