# sadzonka

A little serailization format based on a minimal syntax derived from Jevko (Jevko minus digraphs). Implemented in JavaScript.

Parsing happens in three steps:

1. Transform source text into a tree according to an extremely simple formal grammar.
2. Transform the tree obtained in the previous step into another tree, removing comments, trimming whitespace, and expanding escapes.
3. Finally, transform the tree obtained in the previous step into a JavaScript value: either a string, an array, or an object. Arrays and objects can have arbitrarily nested values of these three types.

Serializing works for strings, an arrays, and objects, where arrays and objects can have arbitrarily nested values of *only* these three types.

## Base grammar

We start with the following formal grammar (ABNF + RegExp):

```
tree = *sub text
sub  = text '[' tree ']'
text = /[^\[\]]*/
```

Meaning:

* a `tree` is zero or more `sub`s followed by `text`
* a `sub` is text followed by `tree` enclosed in square brackets
* `text` is zero or more characters which are not square brackets

## Preprocessing step

Instead of handling comments, whitespace, or escaping on the level of the formal grammar, we do that in a preprocessing step which transforms the parse tree obtained from parsing the above grammar into another tree which may contain square brackets in text.

### Removing comments

If a sub's text spans multiple lines, all lines except for the last one are discarded (treated as single-line comments) during preprocessing.

```
comment
text [text]
```

Also, all subs which have text that begins with `;` are discarded (treated as multi-line comments) during preprocessing.

```
;[comment]
```

### Trimming whitespace

```
  text [ text ]
```

becomes

```
text[ text ]
```

### Escaping

To supress removing comments, trimming whitespace, and to have square brackets as part of text we need some sort of an escape mechanism.

This is done as follows.

If we want to have a sub like `}{text with brackets}{[...]`, except with square brackets instead of curly brackets as part of the text we should write that like so:

```
\[[}][{]text with brackets[}][{]][...]
```

If we want square brackets in the text of a tree, e.g.:

```
sub1[...] sub2[...] }{text with brackets}{
```

we should write:

```
sub1[...] sub2[...] \[[}][{]text with brackets[}][{]]
```

## Development

### Testing

```
node --test
```



<!-- , according to the following rules:

```
\[...] T [...] -> expand()
```

* a sequence of subs of the form `\[...][...]` are transformed into one sub; the resulting sub's text is obtained by expanding the first sub (according to the rules below), and its tree is copied from the second sub; text from the two input subs is discarded; optional whitespace is allowed inbetween the subs (e.g. `\[...] [...]`), but nothing else
* if a tree contains only one sub of the form `\[...]`, the tree's text is overwritten by expanding that sub; in that case the tree can't have non-whitespace characters in the original text -->