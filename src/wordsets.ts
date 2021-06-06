
import { kanaOnly, PhoneticToken, tokenize } from './jputil'

export type WordsetItem = {
  jp: string
  en: string
  tokens: PhoneticToken[]
}

// @ts-ignore
import loanwordRows from '../data/loanwords.tsv'
export function getLoanwords(): WordsetItem[] {
  const rows = loanwordRows as [string, string]
  return rows.map(r => ({
    jp: kanaOnly(r[0]),
    en: r[1],
    tokens: tokenize(kanaOnly(r[0]))
  }))
}

// @ts-ignore
import pokenameRows from '../data/pokenames'
export function getPokenames(): WordsetItem[] {
  const rows = pokenameRows as [string, string][]
  return rows.map(r => ({
    jp: kanaOnly(r[0]),
    en: r[1],
    tokens: tokenize(kanaOnly(r[0]))
  }))
}

// @ts-ignore
import n5KanjiRows from '../data/JLPT5_Kanji.tsv'
export function getN5KanjiVocab(): WordsetItem[] {
  const rows = n5KanjiRows as [string, string, string][]
  return rows.map(r => ({
    jp: r[0],
    en: r[2],
    tokens: [{ jp: r[0], romaji: r[1] }]
  }))
}

// @ts-ignore
import n5HiraganaRows from '../data/JLPT5_Hiragana.tsv'
export function getN5HiraganaVocab(): WordsetItem[] {
  const rows = n5HiraganaRows as [string, string][]
  return rows.map(r => ({
    jp: r[0],
    en: r[1],
    tokens: tokenize(r[0])
  }))
}