export const parse = (str) => {
  return toval(preproc(convertTree2(parseTop(str))))
}

// todo: max depth
const parseTop = (str) => {
  const state = {index: 0}
  const tree = parseTree(str, state)
  if (state.index !== str.length) throw SyntaxError(
    `Expected end of input, got ${str[state.index]} at ${state.index}!`
  )
  return tree
}

const parseTree = (str, state) => {
  const texts = []
  const trees = []
  for (;;) {
    const {text, tree} = parseSubtree(str, state)
    texts.push(text)
    if (tree === undefined) return {texts, trees}
    else trees.push(tree)
  }
}
const parseSubtree = (str, state) => {
  const text = parseText(str, state)
  if (state.index === str.length || str[state.index] === ']') return {text}
  if (str[state.index] !== '[')   throw SyntaxError(`Expected [, got ${str[state.index]} at ${state.index}!`)
  else state.index += 1
  const tree = parseTree(str, state)
  if (state.index === str.length) throw SyntaxError(`Unexpected end. Expected ].`)
  if (str[state.index] !== ']')   throw SyntaxError(`Expected ], got ${str[state.index]} at ${state.index}!`)
  else state.index += 1
  return {text, tree}
}
const parseText = (str, state) => {
  const startindex = state.index
  let escapers = []
  let c = str[state.index]
  if (c === '`') {
    const {escapers: es, text} = parseFence(str, state)
    if (es === undefined) return text
    escapers = es
  }
  for (; state.index < str.length; ++state.index) {
    c = str[state.index]
    if (c === '[' || c === ']') {
      return {startindex, length: state.index - startindex, escapers, source: str}
    }
    else if (c === '`') {
      escapers.push(parseEscaper(str, state))
    }
  }
  return {startindex, length: str.length - startindex, escapers, source: str}
}
const parseEscaper = (str, state) => {
  const escaperindex = state.index
  state.index += 1
  if (state.index === str.length) throw SyntaxError('oops')
  const c = str[state.index]
  if ('[]`'.includes(c)) return escaperindex
  throw SyntaxError('oops')
}

const parseFence = (str, state) => {
  const startindex = state.index
  state.index += 1
  const escapers = []
  for (; state.index < str.length; ++state.index) {
    const c = str[state.index]
    if (c === '`') ;//fencelen += 1 // or do nothing
    else if (c === `'`) {
      const fencelen = state.index - startindex
      if (fencelen % 2 === 0) {
        // escapers + "'"
        for (let i = startindex; i < state.index; i += 2) {
          // or push directly into provided escapers
          escapers.push(i)
        }
        state.index += 1
        return {escapers}
      }
      else {
        // fenced text
        state.index += 1
        return parseFenced(str, state, fencelen)
      }
    }
    else if (c === '[' || c === ']') {
      for (let i = startindex; i < state.index; i += 2) {
        // or push directly into provided escapers
        escapers.push(i)
      }
      const fencelen = state.index - startindex
      if (fencelen % 2 === 1) {
        // escapers + '`' + c
        state.index += 1
      }
      return {escapers}
    }
    else {
      const fencelen = state.index - startindex
      if (fencelen % 2 === 0) {
        // escapers + c
        for (let i = startindex; i < state.index; i += 2) {
          // or push directly into provided escapers
          escapers.push(i)
        }
        state.index += 1
        return {escapers}
      }
      else {
        // ERROR
        throw SyntaxError('oops')
      }
    }
  }
  const fencelen = state.index - startindex
  if (fencelen % 2 === 0) {
    // escapers
    for (let i = startindex; i < state.index; i += 2) {
      // or push directly into provided escapers
      escapers.push(i)
    }
    return {escapers}
  }
  else {
    // ERROR: unexpected end
    throw SyntaxError('oops')
  }
}

const parseFenced = (str, state, fencelen) => {
  // todo
  const startindex = state.index
  let endindex = -1
  for (; state.index < str.length; ++state.index) {
    const c = str[state.index]
    if (c === "'") {
      endindex = state.index
    }
    else if (endindex !== -1 && c !== '`') {
      const mfenlen = state.index - endindex - 1
      console.log('>>>', c, mfenlen, fencelen, state.index, endindex)
      if (c === '[' && fencelen === mfenlen) {
        const text = {startindex, length: endindex - startindex, escapers: [], fencelen, source: str}
        return {text}
      }
      else if (c === ']' && fencelen === mfenlen) {
        const text = {startindex, length: endindex - startindex, escapers: [], fencelen, source: str}
        return {text}
      }
      endindex = -1
    }
  }
  if (endindex !== -1 && fencelen === str.length - endindex) {
    const text = {startindex, length: endindex - startindex, escapers: [], fencelen, source: str}
    return {text}
  }
  console.error(endindex, fencelen, str.length - endindex)
  throw SyntaxError('oops')
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
      if (text.trim() !== '') throw SyntaxError(`Unexpected text after escaped prefix: |${text}|`)
      tx = escaped
      escaped = undefined
    }
    nsubs.push({text: tx, tree: preproc(tree)})
  }
  if (nsubs.length > 0) {
    if (escaped !== undefined) throw SyntaxError(`Unexpected escaped text after subs: |${text}|`)
    // note: ignoring original text
    return {subs: nsubs, text: ''}
  }
  if (escaped !== undefined) {
    // note: could also allow text after escaped suffix (would be ignored)
    if (text.trim() !== '') throw SyntaxError(`Unexpected text after escaped suffix: |${text}|`)
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
    if (t === '{') ret += '['
    else if (t === '}') ret += ']'
    else if (t === '~') ret += '`'
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


const textToStr = (text) => {
  const {source, startindex} = text
  let i = startindex
  let ret = ''
  for (const ei of text.escapers) {
    console.log(ei)
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

const parsed = parseTop(`abc[def]\`\`\`'ghi'\`\`\`[\`[jkl\`]]mno\`\`[a\`\`b]xy[\`\`zw]lm`)
const converted = convertTree(parsed)
const val = parse(`abc[def]\`\`\`'ghi'\`\`\`[\`[jkl\`]]mno\`\`[a\`\`b]xy[\`\`zw]lm`)

console.log(JSON.stringify(parsed, null, 2))
console.log(JSON.stringify(converted, null, 2))
console.log(JSON.stringify(val, null, 2))