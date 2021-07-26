
import { containsKanji, containsKatakana, kanaOnly, PhoneticToken, toKatakana, tokenizeKana, toRomaji } from './jputil'

export type WordsetItem = {
  jp: string
  kana?: string
  en: string
  tokens: PhoneticToken[]
}

export type WordsetId = 'n5common'|'n4common'|'loanwords'|'pokemon'|'n5vocab'|'n4vocab'

export type WordsetDescriptor = {
  type: 'hiragana'|'katakana'|'kanji'
  id: WordsetId
  name: string
}

export const wordsets = [
  { type: "hiragana", id: "n5common", name: "N5 Vocab (Hiragana Only)" },
  { type: "hiragana", id: "n4common", name: "N4 Vocab (Hiragana Only)" },
  { type: "katakana", id: "loanwords", name: "Loanwords" },
  { type: "katakana", id: "pokemon", name: "Pokémon Names" },
  { type: "kanji", id: "n5vocab", name: "N5 Vocab" },
  { type: "kanji", id: "n4vocab", name: "N4 Vocab" }
] as WordsetDescriptor[]

export function getWords(id: WordsetId): WordsetItem[] {
  if (id === 'n5common')
    return getCommonHiraganaVocab(5)
  else if (id === 'n4common')
  return getCommonHiraganaVocab(4)
  else if (id === 'loanwords')
    return getLoanwords()
  else if (id === 'pokemon')
    return getPokenames()
  else if (id === 'n5vocab')
    return getKanjiVocab(5)
  else if (id === 'n4vocab')
    return getKanjiVocab(4)
  else
    throw new Error(`Unknown wordset id ${id}`)
}

// @ts-ignore
import n5HiraganaRows from '../data/JLPT5_Hiragana.tsv'
// @ts-ignore
import n4HiraganaRows from '../data/JLPT4_Hiragana.tsv'
export function getCommonHiraganaVocab(level): WordsetItem[] {
  let rows = null
  switch (level) {
    case 5:
      rows = n5HiraganaRows as [string, string][]
      break;
    case 4:
      rows = n4HiraganaRows as [string, string][]
      break;
  }
  return rows.slice(1).map(r => ({
    jp: r[0],
    en: r[1],
    tokens: tokenizeKana(r[0])
  }))
}

// @ts-ignore
import pokenameRows from '../data/pokenames.json'
export function getPokenames(): WordsetItem[] {
  const rows = pokenameRows as [string, string][]
  return rows.map(r => ({
    jp: r[0],
    en: r[1],
    tokens: tokenizeKana(r[0])
  }))
}

// @ts-ignore
import loanwordRows from '../data/loanwords.tsv'
export function getLoanwords(): WordsetItem[] {
  const rows = loanwordRows as [string, string]
  return rows.slice(1).map(r => ({
    jp: r[0],
    en: r[1],
    tokens: tokenizeKana(r[0])
  }))
}

// @ts-ignore
import n5KanjiRows from '../data/JLPT5_Alignment.tsv'
// @ts-ignore
import n4KanjiRows from '../data/JLPT4_Alignment.tsv'
export function getKanjiVocab(level): WordsetItem[] {
  let rows = null
  switch (level) {
    case 5:
      rows = n5KanjiRows as [string, string, string, string][]
      break;
    case 4:
      rows = n4KanjiRows as [string, string, string, string][]
      break;
  }
  return rows.slice(1).map(r => {
    const jpBits = r[0].split(" ")
    const kanaBits = r[1].split(" ")
    const en = r[3]

    const tokens: PhoneticToken[] = []
    for (let i = 0; i < jpBits.length; i++) {
      tokens.push({
        jp: jpBits[i],
        kana: kanaBits[i],
        romaji: toRomaji(kanaBits[i]),
        isKanaOnly: jpBits[i] === kanaBits[i]
      })
    }

    return { 
      jp: jpBits.join(""),
      kana: kanaBits.join(""),
      en,
      tokens
    }
  })
}

// // @ts-ignore
// import jlptrows from '../data/JLPT5_Vocab.tsv'
// export function getJLPTVocab() {
//   const rows = jlptrows.slice(1) as [string, string]

//   const output = []
//   for (const row of rows) {
//     const [kanji, furigana, romaji, meaning] = row
//     if (containsKanji(kanji) && !kanji.includes("〜")) {
//       output.push([kanji, furigana, romaji, meaning])
//     }
//   }

//   return output.map(r => r.join("\t")).join("\n")
// }
