<template>
  <main>
    <canvas width="800" height="600" />
    <div class="under d-flex">
      <form @submit.prevent="checkAttempt">
        <span>&gt; </span>
        <input type="text" v-model="attempt" autofocus />
      </form>
      <div class="stats ms-auto">
        Score: <span>{{score}}</span>
        WPM: <span>{{wpm}}</span>
        Misses: <span class="misses">{{wordsMissed}}</span>
      </div>
    </div>
  </main>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator"
import _ from "lodash"
import * as wanakana from "wanakana"
import type { GameOptions } from "./types"
import * as PIXI from "pixi.js"
declare const window: any
window.wanakana = wanakana
// @ts-ignore
import pokenames from '../data/pokenames.json'
import loanwords from './loanwords'

const nonKanaRegex = /[^あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォーャョュェッっゃょゅぇ]/g
function kanaOnly(s: string): string {
  s = s.replaceAll(/～/g, "ー")

  return s.replaceAll(nonKanaRegex, "")
}

function splitKana(jp: string): string[] {
  const kana = []

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
      kana.push(jp.slice(i, j + 1))
      i = j
    } else {
      kana.push(jp.slice(i, i + 1))
    }
  }

  return kana
}

function tokenize(jp: string): string[] {
  jp = kanaOnly(jp)

  if (jp.includes("ー")) {
    jp = wanakana.toKatakana(jp)
  }

  return splitKana(wanakana.toHiragana(wanakana.toRomaji(jp)))
}

type Word = {
  japanese: string
  english: string
  slot: number
  obj: PIXI.Container
  doneText: PIXI.Text
  remainingText: PIXI.Text
  speed: number
  alreadySpoken: boolean
}

@Component({
  components: {},
})
export default class App extends Vue {
  @Prop({ type: Object, required: true }) options!: GameOptions

  attempt: string = ""
  prevAttempt: string = ""
  attemptBackspaces: number = 0
  playedVoiceAlready: boolean = false
  startTime: number = Date.now()
  prevTime: number = Date.now()
  wordScale: number = 1

  wordStyle = new PIXI.TextStyle({
    fill: "#ffffff",
  })
  doneStyle = new PIXI.TextStyle({
    fill: "lightgreen",
  })
  warningStyle = new PIXI.TextStyle({
    fill: '#f1a52e'
  })

  score: number = 0
  wordsCompleted: number = 0
  wordsMissed: number = 0
  timeTaken: number = 1

  width: number = 800 / window.devicePixelRatio
  height: number = 600 / window.devicePixelRatio


  lastWordAddedAt: number = Date.now()

  pixi!: PIXI.Application
  words: Word[] = []
  wordset: [string, string][] = []

  translations = new PIXI.Container()

  get totalSlots() {
    return 15
  }

  get rowHeight() {
    return this.height / this.totalSlots
  }

  get freeSlots() {
    const freeSlots = new Set<number>()
    for (let i = 0; i < this.totalSlots; i++) {
      freeSlots.add(i)
    }
    for (const word of this.words) {
      freeSlots.delete(word.slot)
    }
    return Array.from(freeSlots)
  }

  get gameOver() {
    return this.wordsMissed >= 10
  }

  // canUseWord(jp: string) {
  //   const hiraganaRegex = /[あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉっゃょゅぇ]/
  //   if (!this.options.hiragana && jp.match(hiraganaRegex))
  //     return false
    
  //   const katakanaRegex = /[アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォーャョュェッ]/g
  //   if (!this.options.katakana && jp.match(katakanaRegex))
  //     return false

  //   return true
  // }

  created() {
    window.game = this

    if (this.options.pokemon)
      this.wordset.push(...pokenames)

    if (this.options.loanwords)
      this.wordset.push(...loanwords)

    // this.wordset = _.shuffle(_.uniqBy(this.wordset, w => w[0]))
    this.wordset = _.reverse(_.uniqBy(this.wordset, w => w[0]))
  }

  mounted() {
    const canvas = document.getElementsByTagName("canvas")[0]
    this.pixi = new PIXI.Application({
      width: this.width,
      height: this.height,
      antialias: true,
      backgroundAlpha: 0,
      view: canvas,
      resolution: window.devicePixelRatio
    })
    this.pixi.stage.addChild(this.translations)

    // Calculate how much we need to scale words by to have them fill the row
    const height = PIXI.TextMetrics.measureText(
      "foo",
      this.wordStyle
    ).height
    this.wordScale = this.rowHeight / height


    this.frame = this.frame.bind(this)
    this.pixi.ticker.add(this.frame)
    document.getElementsByTagName("input")[0].focus()
    this.onResize()
    while (this.freeSlots.length)
      this.addRandomWord()
  }

  onResize() {}

  addRandomWord() {
    const { freeSlots } = this

    const slot = _.sample(freeSlots)
    console.log(slot)
    if (slot == null) return

    const [jp, eng] = this.wordset.pop()!

    const doneText = new PIXI.Text("", this.doneStyle)
    const remainingText = new PIXI.Text(jp!, this.wordStyle)

    const obj = new PIXI.Container()
    obj.x = 0
    obj.y = slot * this.rowHeight
    obj.scale.x = this.wordScale
    obj.scale.y = this.wordScale
    obj.addChild(doneText)
    obj.addChild(remainingText)
    this.pixi.stage.addChild(obj)

    this.words.push({
      japanese: jp!,
      english: eng,
      slot: slot,
      obj: obj,
      doneText: doneText,
      remainingText: remainingText,
      speed: 0.2 + (this.wpm**1.2)/100,
      alreadySpoken: false,
    })
  }

  get timeBetweenWords() {
    return 5 * 1000 - this.wpm**1.5 - this.score*5
  }

  frame(deltaTime: number) {
    if (this.gameOver) {
      
    }

    const timestamp = Date.now()
    if (timestamp - this.lastWordAddedAt >= this.timeBetweenWords) {
      this.addRandomWord()
      this.lastWordAddedAt = timestamp
    }
    this.timeTaken = timestamp - this.startTime

    const missedWords: Word[] = []
    for (const word of this.words) {
      word.obj.x += deltaTime * word.speed

      const { donePart, remainingPart } = this.matchAttemptTo(word.japanese)
      word.doneText.text = donePart
      word.remainingText.text = remainingPart
      word.remainingText.x = donePart.length > 0 ? word.doneText.width : 0

      if (remainingPart.length === 0 && !word.alreadySpoken) {
        this.speak(word.japanese)
        word.alreadySpoken = true
      }

      if (word.obj.x > this.width/2) {
        word.remainingText.style = this.warningStyle
      }

      if (word.obj.x > this.width) {
        missedWords.push(word)
      }
    }

    for (const text of this.translations.children) {
      text.y -= deltaTime * 0.5
      text.alpha -= deltaTime * 0.02
      if (text.alpha <= 0)
        this.translations.removeChild(text)
    }

    for (const word of missedWords) {
      this.removeWord(word)
      this.wordsMissed += 1
    }
  }

  removeWord(word: Word) {
    this.pixi.stage.removeChild(word.obj)
    this.words.splice(this.words.indexOf(word), 1)

    // Make sure player always has a word
    if (this.words.length === 0) {
      this.addRandomWord()
    }
  }

  checkAttempt() {
    const completedWords = []

    for (const word of this.words) {
      if (this.matchAttemptTo(word.japanese).remainingPart.length === 0) {
        completedWords.push(word)
      }
    }

    for (const word of completedWords) {
      this.score += kanaOnly(word.japanese).length
      this.wordsCompleted += 1

      const text = new PIXI.Text(word.english)
      text.style = this.wordStyle
      text.scale.x = this.wordScale
      text.scale.y = this.wordScale
      text.x = word.obj.x
      text.y = word.obj.y
      this.translations.addChild(text)

      this.removeWord(word)
    }

    this.attempt = ""
  }

  get attemptTokens() {
    return tokenize(wanakana.toHiragana(this.attempt))
  }

  matchAttemptTo(jp: string) {
    const { attemptTokens } = this

    let donePart = ""
    let remainingPart = jp
    let prevPartTokens: string[] = []
    for (let i = 0; i < jp.length; i++) {
      const part = jp.slice(0, i + 1)
      const partTokens = tokenize(part)
      // console.log(i, kanaOnly(part), partHiragana, splitKana(attemptHiragana.slice(0, partHiragana.length))

      if (
        !_.isEqual(prevPartTokens, partTokens) &&
        _.isEqual(partTokens, attemptTokens.slice(0, partTokens.length))
      ) {
        donePart = jp.slice(0, i + 1)
        remainingPart = jp.slice(i + 1)
      }

      prevPartTokens = partTokens
    }

    if (wanakana.toRomaji(kanaOnly(remainingPart)).length === 0) {
      donePart = jp
      remainingPart = ""
    }

    return { donePart, remainingPart }
  }

  get maxLength() {
    return 5 + Math.floor(this.score / 20)
  }

  get voice(): SpeechSynthesisVoice | null {
    const { options } = this
    if (options.voice === null)
      return null

    const jpvoices = speechSynthesis
      .getVoices()
      .filter((v) => v.lang === "ja-JP")

    const voice = jpvoices.find(v => v.name === options.voice)
    if (voice)
      return voice

    const voicePrefs = _.sortBy(jpvoices, (v) =>
      v.name.startsWith("Google") ? -1 : 0
    )
    return voicePrefs[0] || null
  }

  get wpm() {
    return Math.round(this.wordsCompleted / (this.timeTaken/(1000*60)))
  }

  speak(s: string) {
    if (!this.voice) return
    const utter = new SpeechSynthesisUtterance(s.replaceAll(/\s/g, ""))
    utter.lang = "ja"
    utter.voice = this.voice
    utter.rate = _.random(0.9, 1.1, true)
    utter.pitch = _.random(0.9, 1.1, true)
    speechSynthesis.speak(utter)
  }

}
</script>

<style lang="sass">
canvas
  padding-bottom: 1rem
  border-bottom: 1px solid violet

.under
  color: violet

input
  border: none
  background: none
  color: white
  outline: none

.japanese
  font-size: 1.6rem

.donepart
  color: lightgreen

.stats
  opacity: 0.9
  color: #00bc8c	

  span
    display: inline-block
    min-width: 2rem
    color: #3498db 	

  // span.misses
  //   color: #e74c3c

.controls
  margin-top: 2rem
  float: right

  .btn
    color: #999
</style>
