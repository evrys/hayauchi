import hepburn from 'hepburn'

;(window as any).hepburn = hepburn

const HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉ"
const KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォーャョュェッっゃょゅぇ"
const KANA = HIRAGANA + KATAKANA
const nonKanaRegex = new RegExp(`[^${HIRAGANA}${KATAKANA}]`)

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
 * Given a Japanese word and its kana reading, break it into
 * the smallest independent phonetic atoms
 * 
 * e.g. 
 */
export function phoneticTokenize(jp: string, furigana: string) {

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

const KANA_BOUNDARY = new RegExp(`(?<=[${KANA}])(?=[^${KANA}])|(?<=[^${KANA}])(?=[${KANA}])`)
/**
 * Split some Japanese text into parts that are pure kana and parts that aren't,
 * preserving the order of the elements
 * e.g. お兄さん => ["お", "兄", "さん"]
 */
export function splitKanaBoundaries(jp: string): string[] {
  return jp.split(KANA_BOUNDARY)
}

/**
 * Given some jp text and a pure kana reading of that text, align the elements
 * of the text to their corresponding reading
 * 
 * e.g. 
 * 可愛い, かわいい => [["可愛", "かわい"], ["い", "い"]]
 * お兄さん, おにいさん => [["お", "お"], ["兄", "兄"], ["さん", "さん"]]
 * 
 * This is only heuristic; to do an ideal job here would require a 
 * proper sequence alignment algorithm.
 */
export function alignKanjiReading(jp: string, kana: string) {
  const spl = splitKanaBoundaries(jp)
  const readings: [string, string][] = []

  let kanaIndex = 0
  for (let i = 0; i < spl.length; i++) {
    const bit = spl[i]
    const nextBit = spl[i+1]
    const isKanaBit = containsKana(bit)

    let reading = ""
    for (let j = kanaIndex; j < kana.length; j++) {
      if (reading.length >= bit.length) {
        if (isKanaBit) {
          kanaIndex = j
          break
        } else if (nextBit && nextBit[0] === kana[j]) {
          kanaIndex = j
          break
        }
      } 

      reading += kana[j]
    }
    readings.push([bit, reading])
  }

  console.log(readings)
  return readings
}

export function matchAttempt(attempt: string, kanji: string, kana?: string) {
  if (!kana) {
    kana = kanji
  }

  const expectedRomaji = toRomaji(kana)

  let prevRomajiBit = ""
  let kanaIndex = 0
  let kanjiSlice = 0
  let bestKanaSlice = 0
  let bestKanjiSlice = 0
  while (kanaIndex < kana.length) {
    const kanaBit = kana.slice(0, kanaIndex+1)
    const romajiBit = toRomaji(kanaBit)

    // This check ensures we don't cut a misleading match in the middle of a phonetic atom
    // e.g. ki shouldn't match any of キャ
    const isAtomic = expectedRomaji.startsWith(romajiBit)
     
    // This check ensures we don't match kya to all of キャッ
    const isComplete = romajiBit !== prevRomajiBit || kanaIndex === kana.length-1

    if (isAtomic && isComplete) {
      const attemptBit = attempt.slice(0, romajiBit.length)
      if (romajiBit === attemptBit || toHiragana(romajiBit) === toHiragana(attemptBit)) {
        bestKanaSlice = kanaIndex+1
        bestKanjiSlice = kanjiSlice
      }
    }

    kanaIndex += 1
    prevRomajiBit = romajiBit
    for (let i = kanjiSlice; i < kanji.length; i++) {
      if (kana[kanaIndex] === kanji[i]) {
        // kanjiIndex = i
        break
      } else if (containsKana(kanji[i])) {
        break
      }
    }
  }

  const doneKana = kana.slice(0, bestKanaSlice)
  const doneKanji = kanji.slice(0, bestKanjiSlice)
  const remainingKana = kana.slice(bestKanaSlice)
  const remainingKanji = kanji.slice(bestKanjiSlice)

  return { doneKana, doneKanji, remainingKana, remainingKanji }

  // let prevBitRomaji = ""
  // for (let i = 0; i < kana.length; i++) {
  //   const bit = kana.slice(0, i+1)
  //   const bitRomaji = toRomaji(bit)
  //   if (!expectedRomaji.startsWith(bitRomaji)) {
  //     // Matching here would be misleading
  //     // e.g. ki shouldn't match any of キャ
  //     continue
  //   }

  //   if (i < kana.length-1 && bitRomaji.length <= prevBitRomaji.length) {
  //     // Avoid matching kya to all of キャッ
  //     continue
  //   }

  //   const attemptBit = attempt.slice(0, bitRomaji.length)
  //   if (bitRomaji === attemptBit || toHiragana(bitRomaji) === toHiragana(attemptBit)) {
  //     donePart = bit
  //     remainingPart = kana.slice(i+1)
  //   }

  //   prevBitRomaji = bitRomaji
  // }

  // return { donePart, remainingPart }
}