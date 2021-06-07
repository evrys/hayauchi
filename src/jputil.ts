import hepburn from 'hepburn'

  ; (window as any).hepburn = hepburn

const HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉ"
const KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォーャョュェッっゃょゅぇ"
const KANA = HIRAGANA + KATAKANA

const NON_KANA_REGEX = new RegExp(`[^${KANA}]`, 'g')
export function kanaOnly(s: string): string {
  s = s.replaceAll(/～/g, "ー")

  return s.replaceAll(NON_KANA_REGEX, "")
}

export type PhoneticToken = {
  jp: string
  kana: string
  romaji: string
  isKanaOnly: boolean
}

function expandMacrons(romaji: string): string {
  return romaji.replace(/ā/g, 'aa').replace(/ē/g, 'ee').replace(/ī/g, 'ii').replace(/ō/g, 'oo').replace(/ū/g, 'uu')
}

export function toRomaji(kana: string): string {
  return expandMacrons(hepburn.fromKana(kana).toLowerCase()).replace(/[^a-z]/, '')
}

export function toKatakana(romaji: string): string {
  return hepburn.toKatakana(romaji.toUpperCase())
}

export function toHiragana(romaji: string): string {
  return hepburn.toHiragana(romaji.toUpperCase())
}

export function containsKanji(s: string): boolean {
  return hepburn.containsKanji(s)
}

export function containsKatakana(s: string): boolean {
  return hepburn.containsKatakana(s)
}

export function containsHiragana(s: string): boolean {
  return hepburn.containsHiragana(s)
}

export function containsKana(s: string): boolean {
  return hepburn.containsKana(s)
}

/**
 * Break some kana-only text into the smallest possible atoms
 * that are phonetically independent
 * 
 * e.g. チャージ => ["チャー", "ジ"]
 */
export function phoneticKanaSplit(jp: string): string[] {
  const bits = []

  const beforeModifiers = ["ッ", "っ"]
  const afterModifiers = ["ー", "ャ", "ョ", "ュ", "ェ", "ゃ", "ょ", "ゅ", "ぇ", "ィ", "ァ", "ォ"]

  for (let i = 0; i < jp.length; i++) {
    let j = i
    while (beforeModifiers.indexOf(jp[j]) !== -1) {
      j += 1
    }
    while (afterModifiers.indexOf(jp[j + 1]) !== -1) {
      j += 1
    }

    if (j > i) {
      bits.push(jp.slice(i, j + 1))
      i = j
    } else {
      bits.push(jp.slice(i, i + 1))
    }
  }

  return bits
}


/**
 * Break a kana-only word into the smallest possible atoms
 * that can be independently transliterated to romaji
 * 
 * e.g. チャージ => ["チャー", "ジ"]
 */
export function tokenizeKana(jp: string): PhoneticToken[] {
  return phoneticKanaSplit(kanaOnly(jp)).map(kana => ({
    jp: kana,
    kana: kana,
    romaji: toRomaji(kana),
    isKanaOnly: true
  }))
}

const KANA_BOUNDARY = new RegExp(`(?<=[${KANA}])(?=[^${KANA}])|(?<=[^${KANA}])(?=[${KANA}])`)
/**
 * Split some Japanese text into parts that are pure kana and parts that aren't,
 * preserving the order of the elements
 * e.g. お兄さん => ["お", "兄", "さん"]
 */
export function splitKanaBoundaries(jp: string): string[] {
  return jp.split(KANA_BOUNDARY)
}

export type TokenCompletion = {
  doneKana: string
  remainingKana: string
}

export function matchAttemptToTokens(attempt: string, tokens: PhoneticToken[]): TokenCompletion[] {
  const fullKana = tokens.map(t => t.kana).join("")
  const { doneKana, remainingKana } = matchAttempt(attempt, fullKana)

  const tokenCompletion: TokenCompletion[] = tokens.map(t => {
    return {
      doneKana: "",
      remainingKana: t.kana
    }
  })

  let kanaIndex = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const completion = tokenCompletion[i]
    if (kanaIndex + token.kana.length <= doneKana.length) {
      // Fully completed this token
      completion.doneKana = token.kana
      completion.remainingKana = ""
    } else {
      completion.doneKana = token.kana.slice(0, doneKana.length-kanaIndex)
      completion.remainingKana = token.kana.slice(doneKana.length-kanaIndex)
      break
    }
    kanaIndex += token.kana.length
  }

  return tokenCompletion
}

export function matchAttempt(attempt: string, kana: string) {
  const expectedRomaji = toRomaji(kana)
  let bestSlice = 0
  let prevBitRomaji = ""
  for (let i = 0; i < kana.length; i++) {
    const bit = kana.slice(0, i + 1)
    const bitRomaji = toRomaji(bit)
    if (!expectedRomaji.startsWith(bitRomaji)) {
      // Matching here would be misleading
      // e.g. ki shouldn't match any of キャ
      continue
    }

    if (i < kana.length - 1 && bitRomaji === prevBitRomaji) {
      // Avoid matching kya to all of キャッ
      continue
    }

    const attemptBit = attempt.slice(0, bitRomaji.length)
    if (bitRomaji === attemptBit || toHiragana(bitRomaji) === toHiragana(attemptBit)) {
      // Found a match!
      bestSlice = i + 1
    }

    prevBitRomaji = bitRomaji
  }

  const doneKana = kana.slice(0, bestSlice)
  const remainingKana = kana.slice(bestSlice)
  return { doneKana, remainingKana }
}