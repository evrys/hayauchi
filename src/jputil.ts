import hepburn from 'hepburn'

;(window as any).hepburn = hepburn

const nonKanaRegex = /[^あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォーャョュェッっゃょゅぇ]/g
export function kanaOnly(s: string): string {
  s = s.replaceAll(/～/g, "ー")

  return s.replaceAll(nonKanaRegex, "")
}

export type PhoneticToken = {
  jp: string
  romaji: string
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

/**
 * Break some kana-only text into the smallest possible atoms
 * that are phonetically independent
 * 
 * e.g. チャージ => ["チャー", "ジ"]
 */
 export function phoneticKanaSplit(jp: string): string[] {
  const bits = []

  const beforeModifiers = ["ッ", "っ"]
  const afterModifiers = ["ー", "ャ", "ョ", "ュ", "ェ", "ゃ", "ょ", "ゅ", "ぇ", "ィ", "ァ"]

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
 * Break a Japanese word into the smallest possible atoms
 * that can be independently transliterated to romaji
 * 
 * e.g. チャージ => ["チャー", "ジ"]
 * TODO kanji handling
 */
export function tokenize(jp: string): PhoneticToken[] {
  return phoneticKanaSplit(jp).map(jp => ({
    jp,
    romaji: toRomaji(jp)
  }))
}

export function matchAttempt(attempt: string, kana: string) {
  const expectedRomaji = toRomaji(kana)

  let donePart = ""
  let remainingPart = kana


  let prevBitRomaji = ""
  for (let i = 0; i < kana.length; i++) {
    const bit = kana.slice(0, i+1)
    const bitRomaji = toRomaji(bit)
    if (!expectedRomaji.startsWith(bitRomaji)) {
      // Matching here would be misleading
      // e.g. ki shouldn't match any of キャ
      continue
    }

    if (i < kana.length-1 && bitRomaji.length <= prevBitRomaji.length) {
      // Avoid matching kya to all of キャッ
      continue
    }

    const attemptBit = attempt.slice(0, bitRomaji.length)
    if (bitRomaji === attemptBit || toHiragana(bitRomaji) === toHiragana(attemptBit)) {
      donePart = bit
      remainingPart = kana.slice(i+1)
    }

    prevBitRomaji = bitRomaji
  }

  return { donePart, remainingPart }
}