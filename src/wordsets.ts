
import * as wanakana from 'wanakana'

// @ts-ignore
import loanwordRows from '../data/loanwords.tsv'
export function getLoanwords(): WordsetItem[] {
  return loanwordRows.map((r: [string, string]) => ({
    jp: r[0],
    en: r[1],
    tokens: tokenize(kanaOnly(r[0]))
  }))
}

// @ts-ignore
import pokenameRows from '../data/pokenames'
export function getPokenames(): WordsetItem[] {
  return pokenameRows.map((r: [string, string]) => ({
    jp: r[0],
    en: r[1],
    tokens: tokenize(kanaOnly(r[0]))
  }))
}

export type WordsetToken = {
  jp: string
  romaji: string
}

export type WordsetItem = {
  jp: string
  en: string
  tokens: WordsetToken[]
}

const nonKanaRegex = /[^あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォーャョュェッっゃょゅぇ]/g
function kanaOnly(s: string): string {
  s = s.replaceAll(/～/g, "ー")

  return s.replaceAll(nonKanaRegex, "")
}

/**
 * Break a Japanese word into the smallest possible atoms
 * that can be independently transliterated to romaji
 * 
 * e.g. チャージ => ["チャー", "ジ"]
 * 
 * TODO kanji handling
 */
 function tokenize(jp: string): WordsetToken[] {
  const bits = []

  const beforeModifiers = ["ッ", "っ"]
  const afterModifiers = ["ー", "ャ", "ョ", "ュ", "ェ", "ゃ", "ょ", "ゅ", "ぇ"]

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

  return bits.map(jp => ({
    jp,
    romaji: wanakana.toRomaji(jp)
  }))
}