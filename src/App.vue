<template>
  <main class="container" v-if="!gameStarted">
    <h1>hayauchi</h1>
    <div v-if="!isAppropriateDevice" class="alert alert-warning">
      This game is intended to be played on a computer with a physical keyboard.
    </div>
    <div class="row">
      <div class="col col-sm-12 col-md-6 wordsets">
        <h6>Hiragana</h6>
        <ul>
          <li
            v-for="wordset in hiraganaWordsets"
            :class="{ selected: selectedWordset == wordset }"
            :key="wordset.id"
            @click="startGameWith(wordset)"
          >
            {{ wordset.name }}
          </li>
        </ul>

        <h6>Katakana</h6>
        <ul>
          <li
            v-for="wordset in katakanaWordsets"
            :class="{ selected: selectedWordset == wordset }"
            :key="wordset.id"
            @click="startGameWith(wordset)"
          >
            {{ wordset.name }}
          </li>
        </ul>

        <h6>Kanji</h6>
        <ul>
          <li
            v-for="wordset in kanjiWordsets"
            :class="{ selected: selectedWordset == wordset }"
            :key="wordset.id"
            @click="startGameWith(wordset)"
          >
            {{ wordset.name }}
          </li>
        </ul>
        <p>Use up/down/enter to choose a wordset.<br /></p>
      </div>
      <div class="col col-sm-12 col-md-6 right intro" v-if="page === 'intro'">
        <p>Practice your Japanese reading speed!</p>
        <p>A game ends after 10 missed words, or when you press ESC.</p>
        <p>Type the romaji reading for as many as you can, and see how you score on the leaderboard!</p>
        <footer>
          <button class="btn" key="about" @click="page = 'about'">About</button>
          <button class="btn" key="settings" @click="page = 'settings'">Settings</button>
        </footer>
      </div>
      <div class="col col-sm-12 col-md-6 right settings" v-else-if="page === 'settings'">
        <section class="voiceSetting" v-if="voiceOptions.length > 0">
          <h6>Voice Synth</h6>
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              id="novoice"
              :value="'none'"
              v-model="options.voice"
            />
            <label class="form-check-label" for="novoice"> No voice </label>
          </div>
          <div
            class="form-check"
            v-for="voice in voiceOptions"
            :key="voice.name"
          >
            <input
              class="form-check-input"
              type="radio"
              :id="voice.name"
              :value="voice.name"
              v-model="options.voice"
            />
            <label class="form-check-label" :for="voice.name">
              {{ voice.name }}
            </label>
          </div>
        </section>
        <footer>
          <button class="btn" @click="page = 'intro'">Back</button>
        </footer>
      </div>
      <div class="right col col-sm-12 col-md-6 about" v-else-if="page === 'about'">
        <p>
          We made this little game because we kept mixing up katakana and wanted
          a fun way to practice.
        </p>
        <p>
          Hayauchi is based on the classic Linux terminal game
          <a href="http://typespeed.sourceforge.net/">typespeed</a>.
        </p>
        <p>
          The wordsets come from
          <a
            href="https://en.wikipedia.org/wiki/List_of_gairaigo_and_wasei-eigo_terms"
            >Wikipedia</a
          >,
          <a
            href="https://nihongoichiban.com/2011/04/30/complete-list-of-vocabulary-for-the-jlpt-n5/"
            >Nihongo Ichiban</a
          >, and the
          <a href="https://www.npmjs.com/package/pokemon">Pokémon npm package</a
          >.
        </p>
        <p>
          Created by <a href="https://github.com/mispy">Mispy</a> &amp;
          <a href="https://github.com/two-kay">Twokay</a>
        </p>
        <a href="https://github.com/mispy/hayauchi"
          >https://github.com/mispy/hayauchi</a
        >
        <footer>
          <button class="btn" @click="page = 'intro'">Back</button>
        </footer>
      </div>
    </div>
  </main>
  <Game
    v-else
    :options="options"
    :onlinePlayer="onlinePlayer"
    @exit="gameStarted = false"
  />
</template>

<script lang="ts">
import { initializeApp } from "firebase/app"
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously,
} from "firebase/auth"

// Initialize Firebase
initializeApp({
  apiKey: "AIzaSyD1-kAgLtwuKjtU7mz-5hWdyHMrH4v2Ao8",
  authDomain: "kanaspeed-ae459.firebaseapp.com",
  projectId: "kanaspeed-ae459",
  storageBucket: "kanaspeed-ae459.appspot.com",
  messagingSenderId: "898305225736",
  appId: "1:898305225736:web:c99ce6922e4c5fde214dbd",
  measurementId: "G-B644ZEG6EQ",
})

import { Component, Vue, Watch } from "vue-property-decorator"
import _ from "lodash"
import Game from "./Game.vue"
import type { GameOptions, OnlinePlayer, ServerScoreData } from "./types"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore"
import { WordsetDescriptor, wordsets } from "./wordsets"

@Component({
  components: {
    Game,
  },
})
export default class App extends Vue {
  gameStarted: boolean = false
  browserVoices: SpeechSynthesisVoice[] = []
  onlinePlayer: OnlinePlayer | null = null
  page: "intro" | "about" | "settings" = "intro"

  options: GameOptions = this.defaultGameOptions
  prevOptions: any = {}

  get isAppropriateDevice() {
    return !('ontouchstart' in document.documentElement)
  }

  async created() {
    this.keydown = this.keydown.bind(this)
    window.addEventListener("keydown", this.keydown)

    // Load previous options, if saved
    try {
      this.prevOptions = JSON.parse(localStorage.getItem("options") as string)
      for (const key in this.prevOptions) {
        if (key in this.options) {
          ;(this.options as any)[key] = this.prevOptions[key]
        }
      }
    } catch (err) {}

    // Sometimes browser takes a while to populate options
    if (speechSynthesis.addEventListener) {
      speechSynthesis.addEventListener("voiceschanged", () => {
        this.browserVoices = speechSynthesis.getVoices()
      })
    }
    this.browserVoices = speechSynthesis.getVoices()

    // This auth will be used for the leaderboard later, let's sign in now
    const auth = getAuth()

    auth.onAuthStateChanged((user) => {
      if (user) {
        this.fetchPlayerData(user.uid)
      }
    })

    await setPersistence(auth, browserLocalPersistence)
    signInAnonymously(auth)
  }

  get jsonOptions() {
    return JSON.stringify(this.options)
  }

  @Watch("jsonOptions")
  saveOptions() {
    localStorage.setItem("options", this.jsonOptions)
  }

  get selectedWordset() {
    return wordsets[this.options.wordsetIndex]
  }

  get hiraganaWordsets() {
    return wordsets.filter((w) => w.type === "hiragana")
  }

  get katakanaWordsets() {
    return wordsets.filter((w) => w.type === "katakana")
  }

  get kanjiWordsets() {
    return wordsets.filter((w) => w.type === "kanji")
  }

  async fetchPlayerData(userId: string) {
    const db = getFirestore()

    const prevScores = (
      await getDocs(
        query(collection(db, "scores"), where("userId", "==", userId))
      )
    ).docs.map(d => d.data()) as ServerScoreData[]

    this.onlinePlayer = {
      userId: userId,
      prevScores: _.keyBy(prevScores, d => d.wordsetId),
    }
  }

  destroyed() {
    window.removeEventListener("keydown", this.keydown)
  }

  get voiceOptions() {
    return _.sortBy(
      this.browserVoices.filter((v) => v.lang === "ja-JP"),
      (v) => (v.name.startsWith("Google") ? -1 : 0)
    )
  }

  keydown(ev: KeyboardEvent) {
    if (this.gameStarted) return

    if (ev.key === "ArrowDown" || ev.key === "s") {
      this.options.wordsetIndex += 1
      if (this.options.wordsetIndex >= wordsets.length) {
        this.options.wordsetIndex = 0
      }
    } else if (ev.key === "ArrowUp" || ev.key === "w") {
      this.options.wordsetIndex -= 1
      if (this.options.wordsetIndex < 0) {
        this.options.wordsetIndex = wordsets.length - 1
      }
    }

    if (ev.key === "Enter") {
      this.startGame()
    }
  }

  mounted() {
    // this.startGame()
  }

  startGameWith(wordset: WordsetDescriptor) {
    this.options.wordsetIndex = wordsets.indexOf(wordset)
    this.startGame()
  }

  startGame() {
    this.gameStarted = true
  }

  get defaultGameOptions(): GameOptions {
    return {
      wordsetIndex: 0,
      voice: null
    }
  }

  @Watch("voiceOptions", { immediate: true })
  pickDefaultVoice() {
    if (this.options.voice !== null || !this.voiceOptions.length) return

    const voicePrefs = _.sortBy(this.voiceOptions, (v) =>
      v.name.startsWith("Google") ? -1 : 0
    )

    this.options.voice = voicePrefs[0].name
  }
}
</script>

<style lang="sass">
@import "node_modules/bootswatch/dist/darkly/_variables"
@import "node_modules/bootstrap/scss/bootstrap"
@import "node_modules/bootswatch/dist/darkly/_bootswatch"

html, body
  height: 100%

body
  display: flex
  align-items: center
  justify-content: center

main.container
  max-width: 600px
  min-height: 500px
  padding: 1rem

h1
  margin-bottom: 3rem
  color: #eee
  font-size: 2rem


.wordsets h6
  color: lightgreen
  margin-top: 1rem

  &:first-child
    margin-top: 0

.wordsets ul
  margin: 0
  padding: 0
  margin-bottom: 2rem

  li
    list-style-type: none
    cursor: pointer
    padding: 0.2rem

  li.selected
    color: cyan
    position: relative

    &::before
      content: ">"
      position: absolute
      left: -15px

  li:hover
    color: cyan

.right
  display: flex
  flex-direction: column
  max-width: 300px

  footer
    text-align: right
    padding: 1rem
    // margin-top: auto

@include media-breakpoint-down(md)
  .right
    padding-top: 1rem
    border-top: 1px solid #ccc
    margin-top: 1rem
    max-width: 300px

</style>
