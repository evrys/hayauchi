
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
    jp: r[0],
    en: r[1],
    tokens: tokenize(kanaOnly(r[0]))
  }))
}

// @ts-ignore
import pokenameRows from '../data/pokenames'
export function getPokenames(): WordsetItem[] {
  const rows = pokenameRows as [string, string][]
  return rows.map(r => ({
    jp: r[0],
    en: r[1],
    tokens: tokenize(kanaOnly(r[0]))
  }))
}

// @ts-ignore
import n5Rows from '../data/JLPT5_Kanji.tsv'
export function getN5Vocab(): WordsetItem[] {
  const rows = n5Rows as [string, string, string][]
  return rows.map(r => ({
    jp: r[0],
    en: r[2],
    tokens: [{ jp: r[0], romaji: r[1] }]
  }))
}