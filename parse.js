export const parse = (str) => {
  return toval(preproc(convertTree2(parseTop(str))))
}

const opener = '['
const closer = ']'
const escaper = '`'
const fencer = "'"

const advance = (str, state) => {
  const c = str[state.index]
  const pc = state.pc
  if (c === '\r' || (pc !== '\r' && c === '\n')) {
    state.line += 1
    state.column = 1
  }
  else {
    state.column += 1
  }
  state.pc = c
  state.index += 1
}
const location = (state) => {
  return `${state.line}:${state.column}`
}

// todo: max depth
const parseTop = (str) => {
  const state = {index: 0, line: 1, column: 1}
  const tree = parseTree(str, state)
  if (state.index !== str.length)    throw SyntaxError(
    `Expected end of input but got ${str[state.index]} at ${location(state)}!`
  )
  return tree
}

const parseTree = (str, state) => {
  const texts = []
  const trees = []
  for (;;) {
    texts.push(parseText(str, state))
    if (str[state.index] === closer || state.index === str.length) return {
      texts, trees
    }
    trees.push(parseSubtree(str, state))
  }
}
const parseSubtree = (str, state) => {
  if (str[state.index] !== opener)   throw SyntaxError(
    `Expected ${opener} but got ${str[state.index]} at ${location(state)}!`
  )
  advance(str, state)
  const tree = parseTree(str, state)
  if (state.index === str.length)    throw SyntaxError(
    `Expected ${closer} but got end of input!`
  )
  if (str[state.index] !== closer)   throw SyntaxError(
    `Expected ${closer} but got ${str[state.index]} at ${location(state)}!`
  )
  advance(str, state)
  return tree
}
const parseText = (str, state) => {
  const startindex = state.index
  let escapers
  let c = str[state.index]
  if (c === escaper) {
    const {escapers: es, text} = parseFence(str, state)
    if (es === undefined) return text
    escapers = es
  }
  else escapers = []
  for (; state.index < str.length; advance(str, state)) {
    c = str[state.index]
    if (c === opener || c === closer) {
      return {
        startindex, length: state.index - startindex, escapers, source: str
      }
    }
    else if (c === escaper) {
      escapers.push(parseEscaper(str, state))
    }
  }
  return {startindex, length: str.length - startindex, escapers, source: str}
}
const parseEscaper = (str, state) => {
  const escaperindex = state.index
  advance(str, state)
  if (state.index === str.length) throw SyntaxError(
    `Expected ${opener} or ${closer} or ${escaper} after ${
      escaper
    } but got end of input!`
  )
  const c = str[state.index]
  if ([opener, closer, escaper].includes(c)) return escaperindex
  throw SyntaxError(
    `Expected ${opener} or ${closer} or ${escaper} after ${
      escaper
    } but got ${c} at ${location(state)}!`
  )
}

const parseFence = (str, state) => {
  const startindex = state.index
  advance(str, state)
  const escapers = []
  for (; state.index < str.length; advance(str, state)) {
    const c = str[state.index]
    if (c !== escaper) {
      if (c === fencer) {
        const fencelen = state.index - startindex
        if (fencelen % 2 === 0) {
          // escapers + fencer
          for (let i = startindex; i < state.index; i += 2) {
            escapers.push(i)
          }
          advance(str, state)
          return {escapers}
        }
        else {
          // fenced text
          advance(str, state)
          return parseFenced(str, state, fencelen)
        }
      }
      else if (c === opener || c === closer) {
        for (let i = startindex; i < state.index; i += 2) {
          escapers.push(i)
        }
        const fencelen = state.index - startindex
        if (fencelen % 2 === 1) {
          // escapers + escaper + c
          advance(str, state)
        }
        return {escapers}
      }
      else {
        const fencelen = state.index - startindex
        if (fencelen % 2 === 0) {
          // escapers + c
          for (let i = startindex; i < state.index; i += 2) {
            escapers.push(i)
          }
          advance(str, state)
          return {escapers}
        }
        else {
          // ERROR
          throw SyntaxError(
            `Expected ${opener} or ${closer} or ${escaper} after ${
              escaper
            } but got ${c} at ${location(state)}!`
          )
        }
      }
    }
  }
  const fencelen = state.index - startindex
  if (fencelen % 2 === 0) {
    // escapers
    for (let i = startindex; i < state.index; i += 2) {
      escapers.push(i)
    }
    return {escapers}
  }
  else {
    // ERROR: unexpected end
    throw SyntaxError(
      `Expected ${opener} or ${closer} or ${escaper} after ${
        escaper
      } but got end of input!`
    )
  }
}

const parseFenced = (str, state, fencelen) => {
  // todo
  const startindex = state.index
  let endindex = -1
  for (; state.index < str.length; advance(str, state)) {
    const c = str[state.index]
    if (c === fencer) {
      endindex = state.index
    }
    else if (endindex !== -1 && c !== escaper) {
      const mfenlen = state.index - endindex - 1
      // console.log('>>>', c, mfenlen, fencelen, state.index, endindex)
      if (c === opener && fencelen === mfenlen) {
        const text = {
          startindex, 
          length: endindex - startindex, 
          escapers: [], 
          fencelen, 
          source: str,
        }
        return {text}
      }
      else if (c === closer && fencelen === mfenlen) {
        const text = {
          startindex, 
          length: endindex - startindex, 
          escapers: [], 
          fencelen, 
          source: str
        }
        return {text}
      }
      endindex = -1
    }
  }
  if (endindex !== -1 && fencelen === str.length - endindex) {
    const text = {
      startindex, 
      length: endindex - startindex, 
      escapers: [], 
      fencelen, 
      source: str,
    }
    return {text}
  }
  console.error(endindex, fencelen, str.length - endindex)
  throw SyntaxError(`Expected fenced text to be closed but got end of input!`)
}

export const preproc = (tree) => {
  const {subs, text} = tree
  const nsubs = []
  let escaped
  for (const {text, tree} of subs) {
    let tx
    if (escaped === undefined) {
      tx = text.split('\n').at(-1).trim()
      if (tx.startsWith(';')) continue
      else if (tx === '\\') {
        escaped = esc(tree)
        continue
      } 
    } else {
      if (text.trim() !== '') throw SyntaxError(
        `Unexpected text after escaped prefix: |${text}|`
      )
      tx = escaped
      escaped = undefined
    }
    nsubs.push({text: tx, tree: preproc(tree)})
  }
  if (nsubs.length > 0) {
    if (escaped !== undefined) throw SyntaxError(
      `Unexpected escaped text after subs: |${text}|`
    )
    // note: ignoring original text
    return {subs: nsubs, text: ''}
  }
  if (escaped !== undefined) {
    // note: could also allow text after escaped suffix (would be ignored)
    if (text.trim() !== '') throw SyntaxError(
      `Unexpected text after escaped suffix: |${text}|`
    )
    return {subs: [], text: escaped}
  }
  // note: could alternatively do text.split('\n').at(-1).trim()
  return {subs: [], text}
}

export const esc = (tree) => {
  let ret = ''
  const {subs, text} = tree
  for (const {text, tree} of subs) {
    ret += text
    if (tree.subs.length > 0) throw SyntaxError(`Unexpected nesting in escape!`)
    const {text: t} = tree
    if (t === '{') ret += opener
    else if (t === '}') ret += closer
    else if (t === '~') ret += escaper
    else throw SyntaxError(`Unexpected escape: |${t}|`)
  }
  return ret + text
}

export const toval = (tree) => {
  const {subs} = tree
  if (subs.length === 0) return tree.text
  if (subs[0].text === '') {
    // to array
    const ret = []
    for (const {text, tree} of subs) {
      if (text !== '') throw TypeError(`Unexpected text in array: |${text}|`)
      ret.push(toval(tree))
    }
    return ret
  }
  // to object
  const ret = {}
  for (const {text, tree} of subs) {
    if (Object.hasOwn(ret, text)) throw TypeError(`Duplicate key: |${text}|`)
    ret[text] = toval(tree)
  }
  return ret
}

// todo: perhaps cache the result in text
// also at the beginning check if text contains cached result; if so then return that
const textToStr = (text) => {
  const {source, startindex} = text
  let i = startindex
  let ret = ''
  for (const ei of text.escapers) {
    // console.log(ei)
    ret += source.slice(i, ei)
    i = ei + 1
  }
  return ret + source.slice(i, startindex + text.length)
  // return text.source.slice(text.startindex, text.startindex + text.length)
}

const convertTree = (tree) => {
  const {texts, trees} = tree
  const texts2 = [], trees2 = []
  for (const text of texts) {
    texts2.push(textToStr(text))
  }
  for (const tree of trees) {
    trees2.push(convertTree(tree))
  }
  return {texts: texts2, trees: trees2}
}

const convertTree2 = (tree) => {
  const {texts, trees} = tree
  const subs = []
  let i = 0
  for (const tree of trees) {
    subs.push({text: textToStr(texts[i]), tree: convertTree2(tree)})
    i += 1
  }
  return {subs, text: textToStr(texts.at(-1))}
}
