<template>
  <main>
    <div class="canvasContainer">
      <canvas width="800" height="600" />
      <div v-if="gameOver" class="postgame">
        <div v-if="!showingLeaderboard">
          <h3>Game complete!</h3>
          <p>You achieved:</p>

          <table>
            <tr>
              <td>Score:</td>
              <td>{{ score }}</td>
            </tr>
            <tr>
              <td>WPM:</td>
              <td>{{ wpm }}</td>
            </tr>
          </table>

          <form @submit.prevent="showLeaderboard">
            <input
              type="text"
              class="nameInput"
              placeholder="Name for leaderboard"
              v-model="nameForLeaderboard"
              autofocus
            />
            <div class="d-flex">
              <button type="submit" class="btn btn-primary">
                Record Score
              </button>
              <button class="btn btn-sm ms-auto" @click.prevent="$emit('exit')">
                Exit to Menu
              </button>
            </div>
          </form>
        </div>
        <div class="leaderboard" v-else>
          <h3>High Scores</h3>
          <table class="table">
            <thead>
              <tr>
                <th v-if="leaderboard.length && leaderboard[0].rank">Rank</th>
                <th>Name</th>
                <th>Score</th>
                <th>WPM</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in leaderboard"
                :key="entry.id"
                :class="{ mine: entry.mine }"
              >
                <td v-if="entry.rank">{{ entry.rank }}.</td>
                <td v-if="entry.mine">{{ nameForLeaderboard }}</td>
                <td v-else>{{ entry.name }}</td>
                <td>{{ entry.score }}</td>
                <td>{{ entry.wpm }}</td>
              </tr>
            </tbody>
          </table>
          <button class="btn btn-sm ms-auto" @click.prevent="$emit('exit')">
            Exit to Menu
          </button>
        </div>
      </div>
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
        />
      </form>
      <div class="stats ms-auto">
        Score: <span>{{ score }}</span> WPM: <span>{{ wpm }}</span> Misses:
        <span class="misses">{{ wordsMissed }}</span> Missed word:
        <span>{{ missedWord }}</span>
      </div>
    </div>
  </main>
</template>

<script lang="ts">
import { Component, Prop, Ref, Vue, Watch } from "vue-property-decorator"
import _ from "lodash"
import * as wanakana from "wanakana"
import type { GameOptions } from "./types"
import * as PIXI from "pixi.js"
// @ts-ignore
import pokenames from "../data/pokenames.json"
import loanwords from "./loanwords"
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore"

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
  romaji: string
  english: string
  slot: number
  obj: PIXI.Container
  doneText: PIXI.Text
  remainingText: PIXI.Text
  speed: number
  alreadySpoken: boolean
}

type LeaderboardEntry = {
  rank: number
  score: number
  wpm: number
  timestamp: number
} & (
  | {
      id: string
      name: string
    }
  | {
      id: "mine"
      mine: true
    }
)

@Component({
  components: {},
})
export default class App extends Vue {
  @Prop({ type: Object, required: true }) options!: GameOptions
  @Ref() readonly attemptInput!: HTMLInputElement

  attempt: string = ""
  score: number = 0
  wordsCompleted: number = 0
  wordsMissed: number = 0
  missedWord: string = ""

  gameOver: boolean = false
  nameForLeaderboard: string = ""
  showingLeaderboard: boolean = false

  /** Up to 10 scores, including ours, centered on us */
  leaderboard: LeaderboardEntry[] = []

  startTime: number = Date.now()
  timestamp: number = Date.now()

  get timeTaken() {
    return this.timestamp - this.startTime
  }

  wordScale: number = 1

  wordStyle = new PIXI.TextStyle({
    fill: "#ffffff",
  })
  doneStyle = new PIXI.TextStyle({
    fill: "lightgreen",
  })
  warningStyle = new PIXI.TextStyle({
    fill: "#f1a52e",
  })

  width: number = 800 / window.devicePixelRatio
  height: number = 600 / window.devicePixelRatio

  pixi!: PIXI.Application
  words: Word[] = []
  wordset: [string, string][] = []

  translations = new PIXI.Container()

  /** How many words can potentially be in play at once */
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

    if (this.options.pokemon) this.wordset.push(...pokenames)

    if (this.options.loanwords) this.wordset.push(...loanwords)

    this.wordset = _.shuffle(_.uniqBy(this.wordset, (w) => w[0]))
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
    const height = PIXI.TextMetrics.measureText("waffles", this.wordStyle)
      .height
    this.wordScale = this.rowHeight / height

    this.frame = this.frame.bind(this)
    this.pixi.ticker.add(this.frame)
    this.attemptInput.focus()
    this.onResize()

    this.keydown = this.keydown.bind(this)
    window.addEventListener("keydown", this.keydown)

    this.addNextWord()
  }

  destroyed() {
    window.removeEventListener("keydown", this.keydown)
  }

  keydown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      if (!this.gameOver) {
        // End game
        this.wordsMissed = 10
      } else {
        this.$emit("exit")
      }
    }

    if (ev.key === "Enter") {
      if (this.showingLeaderboard) {
        this.$emit("exit")
      }
    }
  }

  onResize() {
    // TODO
  }

  /** Get the total number of romaji that need to be typed for the current screen */
  get lengthOnScreen() {
    return this.words.map(w => w.romaji).join("").length
  }

  addNextWord() {
    const { freeSlots } = this

    const slot = _.sample(freeSlots)
    if (slot == null) return

    const [jp, eng] = this.wordset.pop()!

    const doneText = new PIXI.Text("", this.doneStyle)
    const remainingText = new PIXI.Text(jp, this.wordStyle)

    const obj = new PIXI.Container()
    obj.x = 0
    obj.y = slot * this.rowHeight
    obj.scale.x = this.wordScale
    obj.scale.y = this.wordScale
    obj.addChild(doneText)
    obj.addChild(remainingText)
    this.pixi.stage.addChild(obj)

    this.words.push({
      japanese: jp,
      romaji: wanakana.toRomaji(kanaOnly(jp)),
      english: eng,
      slot: slot,
      obj: obj,
      doneText: doneText,
      remainingText: remainingText,
      speed: 0.2 * (5/jp.length),
      alreadySpoken: false,
    })
  }

  frame(deltaTime: number) {
    const timestamp = Date.now()
    const timePassed = timestamp - this.timestamp
    this.timestamp = Date.now()

    if (this.wordsMissed >= 10) {
      this.gameOver = true
      this.pixi.ticker.remove(this.frame)

      if (this.score === 0) {
        // Just go straight back to the menu
        this.$emit("exit")
        return
      }

      this.fetchLeaderboard()
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

    const missedWords: Word[] = []
    for (const word of this.words) {
      word.obj.x += deltaTime * rate/30

      const { donePart, remainingPart } = this.matchAttemptTo(word.japanese)
      word.doneText.text = donePart
      word.remainingText.text = remainingPart
      word.remainingText.x = donePart.length > 0 ? word.doneText.width : 0

      if (remainingPart.length === 0 && !word.alreadySpoken) {
        this.speak(word.japanese)
        word.alreadySpoken = true
      }

      if (word.obj.x > this.width / 2) {
        word.remainingText.style = this.warningStyle
      }

      if (word.obj.x > this.width) {
        this.missedWord = word.japanese + " - " + wanakana.toRomaji(word.japanese)
        missedWords.push(word)
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
      if (this.matchAttemptTo(word.japanese).remainingPart.length === 0) {
        completedWords.push(word)
      }
    }

    for (const word of completedWords) {
      this.score += word.romaji.length
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

  async fetchLeaderboard() {
    const db = getFirestore()
    const leaderboardRef = collection(db, "leaderboard")

    const top50q = query(
      leaderboardRef,
      orderBy("score", "desc"),
      orderBy("wpm", "desc"),
      orderBy("timestamp", "asc"),
      limit(50)
    )
    const q1 = query(
      leaderboardRef,
      where("score", ">", this.score),
      orderBy("score", "desc"),
      orderBy("wpm", "desc"),
      orderBy("timestamp", "asc"),
      limit(10)
    )
    const q2 = query(
      leaderboardRef,
      where("score", "<=", this.score),
      orderBy("score", "desc"),
      orderBy("wpm", "desc"),
      orderBy("timestamp", "asc"),
      limit(10)
    )

    const [top50r, q1r, q2r] = await Promise.all([
      getDocs(top50q),
      getDocs(q1),
      getDocs(q2),
    ])

    const top50Scores = top50r.docs.map((d) => d.data())
    const higherScores = q1r.docs.map((d) => d.data())
    const lowerScores = q2r.docs.map((d) => d.data())

    // Check if we're in the top 50; if so, we get ranked numerically
    let rank: number|null = null
    for (let i = 0; i < top50Scores.length; i++) {
      const entry = top50Scores[i]
      if (this.score > entry.score || (this.score === entry.score && this.wpm > entry.wpm)) {
        rank = 1+i
        break
      }
    }

    const mine = {
      id: "mine",
      rank: rank,
      score: this.score,
      wpm: this.wpm,
      timestamp: Infinity,
      mine: true,
    }

    let nearbyScores = higherScores
      .concat([mine])
      .concat(lowerScores) as LeaderboardEntry[]

    // We need to recalc the ordering to make sure our score goes in the right place
    nearbyScores = _.orderBy(nearbyScores, [
      (d) => -d.score,
      (d) => -d.wpm,
      (d) => d.timestamp,
    ])

    // If we're numerically ranked, calculate rank for nearby scores based on ours
    const localIndex = nearbyScores.indexOf(mine as LeaderboardEntry)
    if (rank) {
      for (let i = 0; i < nearbyScores.length; i++) {
        nearbyScores[i].rank = rank + (i - localIndex)
      }
    }

    // Now extract the 10 we actually want to show
    const toShow: LeaderboardEntry[] = [mine as LeaderboardEntry]
    let i = localIndex - 1
    let j = localIndex + 1
    while (toShow.length < 10) {
      const higher = nearbyScores[i]
      const lower = nearbyScores[j]

      if (!higher && !lower) break

      if (higher) {
        toShow.unshift(higher)
        i -= 1
      }

      if (lower) {
        toShow.push(lower)
        j += 1
      }
    }

    this.leaderboard = toShow
  }

  async showLeaderboard() {
    const name = this.nameForLeaderboard.trim()
    if (!name) return

    this.showingLeaderboard = true

    // Record our score. We don't need to wait for this to finish before showing it to player
    const db = getFirestore()
    const leaderboardRef = collection(db, "leaderboard")
    await addDoc(leaderboardRef, {
      name: name,
      score: this.score,
      wpm: this.wpm,
      timestamp: serverTimestamp(),
    })
  }
}
</script>

<style lang="sass">
.canvasContainer
  position: relative

.postgame
  background-color: rgba(34, 34, 34, 0.9)
  position: absolute
  left: 0
  top: 0
  width: 100%
  height: 100%
  display: flex
  align-items: center
  justify-content: center

  .nameInput
    padding: 1rem
    background: none
    border: 1px solid #ccc
    display: block
    min-width: 300px
    margin-top: 1rem
    margin-bottom: 1rem
    color: white
    outline: none

  .btn-sm
    color: #999

  .leaderboard
    tr.mine td
      background-color: #257d00

.under
  padding-top: 1rem
  border-top: 1px solid violet
  color: violet

.attemptInput
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

.controls
  margin-top: 2rem
  float: right

  .btn
    color: #999
</style>
