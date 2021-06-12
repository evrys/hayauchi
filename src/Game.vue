<template>
  <main>
    <div class="game">
      <div class="canvasContainer">
        <canvas width="800" height="600" />
        <Postgame v-if="gameOver" :onlinePlayer="onlinePlayer" :score="score" :kpm="kpm" :duration="timeTaken" :wordset="wordset" @exit="$emit('exit')"/>
      </div>
      <div class="under d-flex" v-if="!gameOver">
        <form @submit.prevent="submitAttempt">
          <span>&gt; </span>
          <input
            type="text"
            class="attemptInput"
            ref="attemptInput"
            v-model="attempt"
            autofocus
          />
        </form>
        <ul class="stats d-flex ms-auto">
          <li>Score: <span>{{ score }}</span></li>
          <li>KPM: <span>{{ kpm }}</span></li>
          <li>Misses: <span class="misses">{{ wordsMissed }}</span></li>
          <li>Hints: Hold <span>Shift</span></li>
        </ul>
      </div>
    </div>
  </main>
</template>

<script lang="ts">
import { Component, Prop, Ref, Vue, Watch } from "vue-property-decorator"
import _, { times } from "lodash"
import type { GameOptions, OnlinePlayer } from "./types"
import * as PIXI from "pixi.js"
import Postgame from './Postgame.vue'
import * as wordsets from './wordsets'
import { WordsetItem } from "./wordsets"
import { matchAttempt } from "./jputil"
import * as jputil from './jputil'

// For debugging
;import { containsKanji } from "hepburn"
(window as any).jputil = jputil
;(window as any).wordsets = wordsets

type Word = {
  wsi: WordsetItem
  romaji: string
  slot: number
  obj: PIXI.Container
  tokenParts: TokenDisplayPart[],
  alreadySpoken: boolean
  isSparkly: boolean
}

type TokenDisplayPart = {
  token: jputil.PhoneticToken
  tokenObj: PIXI.Container
  remainingText: PIXI.Text
  doneText: PIXI.Text
  hintObj: PIXI.Container
  hintText: PIXI.Text
  doneHintText: PIXI.Text
}

@Component({
  components: { Postgame },
})
export default class Game extends Vue {
  @Prop({ type: Object, required: true }) options!: GameOptions
  @Prop({ type: Object, default: null }) onlinePlayer!: OnlinePlayer|null
  @Ref() readonly attemptInput!: HTMLInputElement

  /** Words we can add to the game */
  potentialWords: WordsetItem[] = []
  /** Harder words we can use for sparkliness */
  potentialSparklies: WordsetItem[] = []

  /** Next word to add from the wordset */
  nextWordIndex: number = 0
  /** Next sparkly to add from the wordset */
  nextSparklyIndex: number = 0

  attempt: string = ""
  floatScore: number = 0
  kanaCompleted: number = 0
  wordsMissed: number = 0
  hintsActive: boolean = false

  gameOver: boolean = false

  startTime: number = Date.now()
  timestamp: number = Date.now()
  /** When we last added a sparkly word */
  lastSparklyTime: number = 0

  get timeTaken() {
    return this.timestamp - this.startTime
  }

  get score() {
    return Math.round(this.floatScore)
  }

  get wordset() {
    return wordsets.wordsets[this.options.wordsetIndex]
  }

  wordScale: number = 1

  readonly wordStyle = new PIXI.TextStyle({
    fill: "#ffffff",
    fontSize: 26
  })
  readonly sparklyWordStyle = new PIXI.TextStyle({
    fill: "#fff922",
    fontSize: 26,
    dropShadow: true,
    dropShadowColor: '#fff922',
    dropShadowBlur: 10,
    dropShadowAngle: 2*Math.PI,
    dropShadowDistance: 0
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
  readonly hintDoneStyle = new PIXI.TextStyle({
    fill: "lightgreen",
    fontSize: 16
  })

  readonly wordHeight: number = PIXI.TextMetrics.measureText("waffles", this.wordStyle).height
  readonly hintHeight: number = PIXI.TextMetrics.measureText("waffles", this.hintStyle).height
  
  width: number = 800 / window.devicePixelRatio
  height: number = 600 / window.devicePixelRatio
  windowWidth: number = window.innerWidth

  pixi!: PIXI.Application
  words: Word[] = []

  translations = new PIXI.Container()

  /** How many words can potentially be in play at once */
  get totalSlots() {
    return 12
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

  created() {
    ;(window as any).game = this

    const allWords = wordsets.getWords(this.wordset.id)
    const wordsByLength = _.sortBy(allWords, wsi => -(wsi.kana||wsi.jp).length)
    const numPotentialSparklies = Math.round(allWords.length/10) // A tenth of the wordset
    this.potentialSparklies = _.shuffle(wordsByLength.slice(0, numPotentialSparklies))
    this.potentialWords = _.shuffle(wordsByLength.slice(numPotentialSparklies))
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

    window.addEventListener("resize", this.onResize)
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
    this.windowWidth = window.innerWidth
  }

  /** Get the total number of romaji that need to be typed for the current screen */
  get lengthOnScreen() {
    return this.words.map((w) => w.romaji).join("").length
  }

  addNextWord() {
    const { freeSlots } = this

    const slot = _.sample(freeSlots)
    if (slot == null) return

    const timeSinceSparkly = this.timestamp - this.lastSparklyTime
    const isSparkly = timeSinceSparkly > 30000 && Math.random() > 0.95
    if (isSparkly) {
      this.lastSparklyTime = this.timestamp
    }

    // Pick the next word to show
    const wsi = isSparkly ? this.potentialSparklies[this.nextSparklyIndex] : this.potentialWords[this.nextWordIndex]
    if (isSparkly) {
      this.nextSparklyIndex += 1
      if (this.nextSparklyIndex >= this.potentialSparklies.length) {
        this.nextSparklyIndex = 0
      }
    } else {
      this.nextWordIndex += 1
      if (this.nextWordIndex >= this.potentialWords.length) {
        this.nextWordIndex = 0
      }
    }

    // This will contain the word and hint text components, so they
    // can be scaled and moved along the screen as a group
    const wordObj = new PIXI.Container()
    wordObj.x = 0
    wordObj.y = slot * this.rowHeight
    wordObj.scale.x = this.wordScale
    wordObj.scale.y = this.wordScale
    this.pixi.stage.addChild(wordObj)


    const kanjiMode = containsKanji(wsi.jp)

    // wordObj.filters = [new GlowFilter({
    //   color: 0xfff922,
    //   distance: 20,
    //   outerStrength: 2,
    //   quality: 0.1
    // })];


    let lastTokenX = 0
    const tokenParts: TokenDisplayPart[] = []
    for (const token of wsi.tokens) {
      const tokenObj = new PIXI.Container()
      tokenObj.position.x = lastTokenX
      wordObj.addChild(tokenObj)


      // Each token is composed of two pixi parts. doneText
      // will become the green highlighted part that matches the romaji input
      const remainingText = new PIXI.Text(token.jp, isSparkly ? this.sparklyWordStyle : this.wordStyle)
      const doneText = new PIXI.Text("", this.doneStyle)
      doneText.position.y = this.hintHeight
      remainingText.position.y = this.hintHeight
      tokenObj.addChild(remainingText)
      tokenObj.addChild(doneText)

      // Each token also has some hint text above it.
      // In kanji mode this is furigana-style reading kana; in kana mode it's romaji
      const hintObj = new PIXI.Container()
      tokenObj.addChild(hintObj)
  
      const hintText = new PIXI.Text(kanjiMode ? token.kana : token.romaji, this.hintStyle)
      hintText.alpha = 0.0
      hintObj.addChild(hintText)

      // Only used in kanji mode
      const doneHintText = new PIXI.Text("", this.hintDoneStyle)
      hintObj.addChild(doneHintText)
      
      // Center the hint text
      hintObj.x = remainingText.width/2 - hintText.width/2

      tokenParts.push({ token, tokenObj, remainingText, doneText, hintObj, hintText, doneHintText })
      lastTokenX += remainingText.width
    }

    const romaji = wsi.tokens.map(t => t.romaji).join("")
    this.words.push({
      wsi: wsi,
      romaji: romaji,
      slot: slot,
      obj: wordObj,
      tokenParts: tokenParts,
      alreadySpoken: false,
      isSparkly: isSparkly
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
  
      return
    }

    // This adaptive difficulty logic comes from https://github.com/mikeizbicki/typespeed/blob/master/game/src/typespeed.c
    if (this.lengthOnScreen < this.score / 4 + 1 || this.words.length < 1)
      this.addNextWord()

    const minspeed = 3
    const step = 175
    let rate = minspeed + this.score / step

    // Start ramping up difficulty faster
    if (this.score > 100) {
      rate += (this.score-100)**1.1 / step
    }



    // Drain score while using hints
    if (this.hintsActive) {
      this.floatScore -= deltaTime/30
      if (this.floatScore <= 0)
        this.floatScore = 0
    }

    const missedWords: Word[] = []
    for (const word of this.words) {
      word.obj.x += (deltaTime * rate * (word.isSparkly ? 3 : 1)) / 30

      if (word.obj.x > this.width) {
        missedWords.push(word)
        continue
      }

      // Change to warning color for words which are nearing a miss
      if (!word.isSparkly && word.obj.x > this.width / 2) {
        for (const part of word.tokenParts) {
          part.remainingText.style = this.warningStyle          
        }
      }

      // Update hint visibility if needed      
      for (const part of word.tokenParts) {
        part.hintText.alpha = this.hintsActive ? 1.0 : 0.0
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

  @Watch("attempt")
  onAttemptChange() {
    for (const word of this.words) {
      const tokenCompletion = jputil.matchAttemptToTokens(this.attempt, word.wsi.tokens)
      
      for (let i = 0; i < tokenCompletion.length; i++) {
        const tc = tokenCompletion[i]
        const part = word.tokenParts[i]

        if (word.wsi.tokens.every(t => t.isKanaOnly)) {
          part.doneText.text = tc.doneKana
          part.remainingText.text = tc.remainingKana
          part.remainingText.x = tc.doneKana.length ? part.doneText.width : 0
        } else {
          part.doneHintText.text = tc.doneKana
          part.hintText.text = tc.remainingKana
          part.hintText.x = tc.doneKana.length ? part.doneHintText.width : 0

          if (tc.remainingKana.length === 0) {
            part.doneText.text = part.token.jp
            part.remainingText.text = ""
          } else {
            part.doneText.text = ""
            part.remainingText.text = part.token.jp
          }
        }
      }

      // Speak and complete word as soon as the player has the right input for it
      if (!word.alreadySpoken && tokenCompletion[tokenCompletion.length-1].remainingKana === "") {
        this.speak(word.wsi.kana||word.wsi.jp)
        word.alreadySpoken = true
        this.submitAttempt()
      }
    }



      // const { donePart, remainingPart } = this.matchAttemptTo(word.wsi)
      // word.doneText.text = donePart
      // word.remainingText.text = remainingPart
      // word.remainingText.x = donePart.length > 0 ? word.doneText.width : 0
  }

  removeWord(word: Word) {
    this.pixi.stage.removeChild(word.obj)
    this.words.splice(this.words.indexOf(word), 1)
  }

  submitAttempt() {
    const completedWords = []

    let sparklyClear = false
    for (const word of this.words) {
      const tokenCompletion = jputil.matchAttemptToTokens(this.attempt, word.wsi.tokens)
      if (tokenCompletion.every(t => t.remainingKana.length === 0)) {
        if (word.isSparkly) {
          completedWords.push(...this.words)
          sparklyClear = true
          break
        } else {
          completedWords.push(word)
        }
      }
    }

    for (const word of completedWords) {
      if (!sparklyClear || word.isSparkly) {
        this.floatScore += word.romaji.length * (word.isSparkly ? 2 : 1)
        this.kanaCompleted += (word.wsi.kana||word.wsi.jp).length
        const text = new PIXI.Text(word.wsi.en)
        text.style = word.isSparkly ? this.sparklyWordStyle : this.wordStyle
        text.scale.x = this.wordScale
        text.scale.y = this.wordScale
        text.x = word.obj.x
        text.y = word.obj.y
        this.translations.addChild(text)
      }

      this.removeWord(word)
    }

    this.attempt = ""
  }

  get voice(): SpeechSynthesisVoice | null {
    const { options } = this
    if (options.voice === 'none') return null

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

  get kpm() {
    const kpm = Math.round(this.kanaCompleted / (this.timeTaken / (1000 * 60)))
    if (isNaN(kpm)) {
      return 0
    }
    return kpm
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
main
  margin: auto
  max-width: calc(100vw - 3rem)

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
