<template>
  <main>
    <div class="canvasContainer">
      <canvas width="800" height="600" />
      <Postgame v-if="gameOver" :onlinePlayer="onlinePlayer" :score="score" :wpm="wpm" @exit="$emit('exit')"/>
    </div>
    <div class="under d-flex" v-if="!gameOver">
      <form @submit.prevent="checkAttempt">
        <span>&gt; </span>
        <input
          type="text"
          class="attemptInput"
          ref="attemptInput"
          v-model="attempt"
          autofocus
          :disabled="hintsActive"
        />
      </form>
      <ul class="stats d-flex ms-auto">
        <li>Score: <span>{{ score }}</span></li>
        <li>WPM: <span>{{ wpm }}</span></li>
        <li>Misses: <span class="misses">{{ wordsMissed }}</span></li>
        <li>Hints: Hold <span>Shift</span></li>
      </ul>
    </div>
  </main>
</template>

<script lang="ts">
import { Component, Prop, Ref, Vue } from "vue-property-decorator"
import _ from "lodash"
import type { GameOptions, OnlinePlayer } from "./types"
import * as PIXI from "pixi.js"
import Postgame from './Postgame.vue'
import * as wordsets from './wordsets'
import { WordsetItem } from "./wordsets"

type Word = {
  wsi: WordsetItem
  romaji: string
  slot: number
  obj: PIXI.Container
  doneText: PIXI.Text
  remainingText: PIXI.Text
  hintObj: PIXI.Container
  speed: number
  alreadySpoken: boolean
}

type LeaderboardEntry = { 
  rank: number
}

@Component({
  components: { Postgame },
})
export default class Game extends Vue {
  @Prop({ type: Object, required: true }) options!: GameOptions
  @Prop({ type: Object, default: null }) onlinePlayer!: OnlinePlayer|null
  @Ref() readonly attemptInput!: HTMLInputElement

  /** Combined wordset of all wordsets selected in game options */
  wordset: WordsetItem[] = []
  /** Next word to add from the wordset */
  nextWordIndex: number = 0

  attempt: string = ""
  floatScore: number = 0
  wordsCompleted: number = 0
  wordsMissed: number = 0
  hintsActive: boolean = false

  gameOver: boolean = false

  startTime: number = Date.now()
  timestamp: number = Date.now()

  get timeTaken() {
    return this.timestamp - this.startTime
  }

  get score() {
    return Math.round(this.floatScore)
  }

  wordScale: number = 1

  readonly wordStyle = new PIXI.TextStyle({
    fill: "#ffffff",
    fontSize: 26
  })
  readonly doneStyle = new PIXI.TextStyle({
    fill: "lightgreen",
    fontSize: 26
  })
  readonly warningStyle = new PIXI.TextStyle({
    fill: "#f1a52e",
    fontSize: 26
  })
  readonly hintStyle = new PIXI.TextStyle({
    fill: "#ffffff",
    fontSize: 16
  })

  readonly wordHeight: number = PIXI.TextMetrics.measureText("waffles", this.wordStyle).height
  readonly hintHeight: number = PIXI.TextMetrics.measureText("waffles", this.hintStyle).height
  
  width: number = 800 / window.devicePixelRatio
  height: number = 600 / window.devicePixelRatio

  pixi!: PIXI.Application
  words: Word[] = []

  translations = new PIXI.Container()

  /** How many words can potentially be in play at once */
  get totalSlots() {
    return 10
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
    ;(window as any).game = this

    if (this.options.pokemon) this.wordset.push(...wordsets.getPokenames())

    if (this.options.loanwords) this.wordset.push(...wordsets.getLoanwords())

    this.wordset = _.shuffle(this.wordset)
    // this.wordset = _.reverse(_.uniqBy(this.wordset, (w) => w[0]))
  }

  mounted() {
    const canvas = document.getElementsByTagName("canvas")[0]
    this.pixi = new PIXI.Application({
      width: this.width,
      height: this.height,
      antialias: true,
      backgroundAlpha: 0,
      view: canvas,
      resolution: window.devicePixelRatio,
    })
    this.pixi.stage.addChild(this.translations)

    // Calculate how much we need to scale words by to have them fill the row
    // Leaving room for the romaji hint text above
    this.wordScale = this.rowHeight / (this.wordHeight+this.hintHeight)

    this.pixi.ticker.add(this.frame)
    this.attemptInput.focus()
    this.onResize()

    window.addEventListener("keydown", this.keydown)
    window.addEventListener("keyup", this.keyup)
    window.addEventListener("click", this.windowclick)

    // while (this.freeSlots.length > 0)
    this.addNextWord()
  }

  destroyed() {
    window.removeEventListener("keydown", this.keydown)
    window.removeEventListener("keyup", this.keyup)
    window.removeEventListener("click", this.windowclick)
  }

  keydown(ev: KeyboardEvent) {
    if (this.gameOver) return

    if (ev.key === "Escape") {
      // End game
      this.wordsMissed = 10
    }

    if (ev.key === "Shift") {
      this.activateHints()
    }
  }

  keyup(ev: KeyboardEvent) {
    if (ev.key === "Shift") {
      this.deactivateHints()
    }
  }

  windowclick(ev: MouseEvent) {
    if (!this.gameOver) {
      this.attemptInput.focus()
    }
  }

  activateHints() {
    this.hintsActive = true
  }

  deactivateHints() {
    this.hintsActive = false
    if (!this.gameOver)
      this.$nextTick(() => this.attemptInput.focus())
  }

  onResize() {
    // TODO
  }

  /** Get the total number of romaji that need to be typed for the current screen */
  get lengthOnScreen() {
    return this.words.map((w) => w.romaji).join("").length
  }

  addNextWord() {
    const { freeSlots } = this

    const slot = _.sample(freeSlots)
    if (slot == null) return

    // Pick the next word to show
    const wsi = this.wordset[this.nextWordIndex]!
    this.nextWordIndex += 1
    if (this.nextWordIndex >= this.wordset.length) {
      this.nextWordIndex = 0
    }

    // This will contain the word and hint text components, so they
    // can be scaled and moved along the screen as a group
    const wordObj = new PIXI.Container()
    wordObj.x = 0
    wordObj.y = slot * this.rowHeight
    wordObj.scale.x = this.wordScale
    wordObj.scale.y = this.wordScale
    this.pixi.stage.addChild(wordObj)

    // Each word is composed of two pixi parts. doneText
    // will become the green highlighted part that matches the romaji input
    const doneText = new PIXI.Text("", this.doneStyle)
    const remainingText = new PIXI.Text(wsi.jp, this.wordStyle)
    doneText.position.y = this.hintHeight
    remainingText.position.y = this.hintHeight
    wordObj.addChild(doneText)
    wordObj.addChild(remainingText)

    // The romaji hint is broken into a bunch of pixi parts so they
    // can be positioned to match the corresponding tokens
    const hintObj = new PIXI.Container()
    hintObj.alpha = 0.0
    let hintOffset = 0
    for (const token of wsi.tokens) {
      const tokenWidth = PIXI.TextMetrics.measureText(token.jp, this.wordStyle).width
      const hintText = new PIXI.Text(token.romaji, this.hintStyle)
      hintText.x = hintOffset + tokenWidth/2
      hintText.anchor.x = 0.5
      hintObj.addChild(hintText)
      hintOffset += tokenWidth
    }
    wordObj.addChild(hintObj)


    const romaji = wsi.tokens.map(t => t.romaji).join("")
    this.words.push({
      wsi: wsi,
      romaji: romaji,
      slot: slot,
      obj: wordObj,
      doneText: doneText,
      remainingText: remainingText,
      hintObj: hintObj,
      speed: 0.2 * (5 / romaji.length),
      alreadySpoken: false,
    })
  }

  frame(deltaTime: number) {
    this.timestamp = Date.now()

    if (this.wordsMissed >= 10) {
      this.gameOver = true
      this.pixi.ticker.remove(this.frame)

      if (this.score === 0) {
        // Just go straight back to the menu
        this.$emit("exit")
        return
      }

      this.$nextTick(() =>
        (document.getElementsByClassName(
          "nameInput"
        )[0]! as HTMLInputElement)?.focus()
      )
      return
    }

    // This adaptive difficulty logic comes from https://github.com/mikeizbicki/typespeed/blob/master/game/src/typespeed.c
    if (this.lengthOnScreen < this.score / 4 + 1 || this.words.length < 1)
      this.addNextWord()

    const minspeed = 3
    const step = 175
    const rate = minspeed + this.score / step


    // Drain score while using hints
    if (this.hintsActive) {
      this.floatScore -= deltaTime/60
    }

    const missedWords: Word[] = []
    for (const word of this.words) {
      word.obj.x += (deltaTime * rate) / 30

      if (word.obj.x > this.width) {
        missedWords.push(word)
        continue
      }

      const { donePart, remainingPart } = this.matchAttemptTo(word.wsi)
      word.doneText.text = donePart
      word.remainingText.text = remainingPart
      word.remainingText.x = donePart.length > 0 ? word.doneText.width : 0

      if (remainingPart.length === 0 && !word.alreadySpoken) {
        this.speak(word.wsi.jp)
        word.alreadySpoken = true
      }

      if (word.obj.x > this.width / 2) {
        word.remainingText.style = this.warningStyle
      }

      if (this.hintsActive) {
        word.hintObj.alpha = 1.0
      } else {
        word.hintObj.alpha = 0.0
      }
    }

    for (const text of this.translations.children) {
      text.y -= deltaTime * 0.5
      text.alpha -= deltaTime * 0.02
      if (text.alpha <= 0) this.translations.removeChild(text)
    }

    for (const word of missedWords) {
      this.removeWord(word)
      this.wordsMissed += 1
    }
  }

  removeWord(word: Word) {
    this.pixi.stage.removeChild(word.obj)
    this.words.splice(this.words.indexOf(word), 1)
  }

  checkAttempt() {
    const completedWords = []

    for (const word of this.words) {
      if (this.matchAttemptTo(word.wsi).remainingPart.length === 0) {
        completedWords.push(word)
      }
    }

    for (const word of completedWords) {
      this.floatScore += word.romaji.length
      this.wordsCompleted += 1

      const text = new PIXI.Text(word.wsi.en)
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

  matchAttemptTo(wsi: WordsetItem) {
    const tokens = _.clone(wsi.tokens).reverse()
    const doneTokens: WordsetItem['tokens'] = []

    while (tokens.length > 0) {
      const expectedAttempt = doneTokens.map(t => t.romaji).join("") + tokens[tokens.length-1].romaji
      if (this.attempt.startsWith(expectedAttempt))
        doneTokens.push(tokens.pop()!)
      else
        break
    }

    const donePart = doneTokens.map(t => t.jp).join("")
    const remainingPart = tokens.map(t => t.jp).reverse().join("")

    return { donePart, remainingPart }
  }

  get voice(): SpeechSynthesisVoice | null {
    const { options } = this
    if (options.voice === null) return null

    const jpvoices = speechSynthesis
      .getVoices()
      .filter((v) => v.lang === "ja-JP")

    const voice = jpvoices.find((v) => v.name === options.voice)
    if (voice) return voice

    const voicePrefs = _.sortBy(jpvoices, (v) =>
      v.name.startsWith("Google") ? -1 : 0
    )
    return voicePrefs[0] || null
  }

  get wpm() {
    const wpm = Math.round(this.wordsCompleted / (this.timeTaken / (1000 * 60)))
    if (isNaN(wpm)) {
      return 0
    }
    return wpm
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
.canvasContainer
  position: relative

.under
  padding-top: 1rem
  border-top: 1px solid violet
  color: violet

  .attemptInput
    border: none
    background: none
    color: white
    outline: none

  .stats
    margin: 0
    opacity: 0.9
    color: #00bc8c

    li
      list-style-type: none

    span
      display: inline-block
      min-width: 2rem
      color: #3498db
</style>
