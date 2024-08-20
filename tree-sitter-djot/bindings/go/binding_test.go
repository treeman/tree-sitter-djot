package tree_sitter_djot_test

import (
	"testing"

	tree_sitter "github.com/smacker/go-tree-sitter"
	"github.com/tree-sitter/tree-sitter-djot"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_djot.Language())
	if language == nil {
		t.Errorf("Error loading Djot grammar")
	}
}
