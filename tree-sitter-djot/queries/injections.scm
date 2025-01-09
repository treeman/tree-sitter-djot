(code_block
  (language) @injection.language
  (code) @injection.content)

(raw_block
  (raw_block_info
    (language) @injection.language)
  (content) @injection.content)

(frontmatter
  (language) @injection.language
  (frontmatter_content) @injection.content)

((inline) @injection.content
  (#set! injection.language "djot_inline"))
