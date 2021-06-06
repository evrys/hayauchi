<template>
  <main v-if="!gameStarted">
    <h1>Kanaspeed</h1>

    <div class="settings">
      <!-- <section class="kanatypeSetting">
        <h6>Include words with</h6>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="" id="hiragana" v-model="options.hiragana">
          <label class="form-check-label" for="hiragana">
            Hiragana
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="" id="katakana" v-model="options.katakana">
          <label class="form-check-label" for="katakana">
            Katakana
          </label>
        </div>
      </section> -->

      <section class="wordsetSetting">
        <h6>Katakana</h6>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="loanwords" v-model="options.loanwords">
          <label class="form-check-label" for="loanwords">
            Loanwords
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="pokemon" v-model="options.pokemon">
          <label class="form-check-label" for="pokemon">
            Pokémon Names
          </label>
        </div>


      </section>

      <section>
        <h6>Hiragana</h6>
        
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="n5Hiragana" v-model="options.n5Hiragana">
          <label class="form-check-label" for="n5Hiragana">
            JLPT N5 Vocab
          </label>
        </div>
      </section>

      <section>
        <h6>Kanji</h6>

        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="n5Kanji" v-model="options.n5Kanji">
          <label class="form-check-label" for="n5Kanji">
            JLPT N5 Vocab
          </label>
        </div>
      </section>

      <section class="voiceSetting" v-if="voiceOptions.length > 0">
        <h6>Voice Synth</h6>
        <div class="form-check">
          <input class="form-check-input" type="radio" id="novoice" :value="null" v-model="options.voice">
          <label class="form-check-label" for="novoice">
            No voice
          </label>
        </div>
        <div class="form-check" v-for="voice in voiceOptions" :key="voice.name">
          <input class="form-check-input" type="radio" :id="voice.name" :value="voice.name" v-model="options.voice">
          <label class="form-check-label" :for="voice.name">
            {{voice.name}}
          </label>
        </div>
      </section>
    </div>

    <p>The game ends after 10 missed words.<br/> Type as many as you can to get the highest score!</p>
    <button class="btn btn-primary" @click.prevent="startGame" :disabled="!canStart">Start</button>
  </main>
  <Game v-else :options="options" :onlinePlayer="onlinePlayer" @exit="gameStarted = false"/>
</template>

<script lang="ts">
import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence, signInAnonymously } from "firebase/auth"

// Initialize Firebase
initializeApp({
  apiKey: "AIzaSyD1-kAgLtwuKjtU7mz-5hWdyHMrH4v2Ao8",
  authDomain: "kanaspeed-ae459.firebaseapp.com",
  projectId: "kanaspeed-ae459",
  storageBucket: "kanaspeed-ae459.appspot.com",
  messagingSenderId: "898305225736",
  appId: "1:898305225736:web:c99ce6922e4c5fde214dbd",
  measurementId: "G-B644ZEG6EQ"
})

import { Component, Vue } from "vue-property-decorator"
import _ from "lodash"
import Game from "./Game.vue"
import type { GameOptions, OnlinePlayer, ServerScoreData } from "./types"
import { doc, getDoc, getFirestore } from 'firebase/firestore'

@Component({
  components: {
    Game,
  },
})
export default class App extends Vue {
  gameStarted: boolean = false
  browserVoices: SpeechSynthesisVoice[] = []
  options: GameOptions = this.defaultGameOptions
  onlinePlayer: OnlinePlayer|null = null

  async created() {
    this.keydown = this.keydown.bind(this)
    window.addEventListener("keydown", this.keydown)

    // Sometimes browser takes a while to populate options
    speechSynthesis.addEventListener("voiceschanged", () => {
      this.browserVoices = speechSynthesis.getVoices()
      this.options.voice = this.defaultVoiceName
    })
    this.browserVoices = speechSynthesis.getVoices()

    // This auth will be used for the leaderboard later, let's sign in now
    const auth = getAuth()

    auth.onAuthStateChanged(user => {
      if (user) {
        this.fetchPlayerData(user.uid)
      }
    })

    await setPersistence(auth, browserLocalPersistence)
    signInAnonymously(auth)
  }

  async fetchPlayerData(userId: string) {
    const db = getFirestore()
    const prevScoreData = (await getDoc(doc(db, "scores", userId))).data() as ServerScoreData|null
   
    this.onlinePlayer = {
      userId: userId,
      prevScoreData: prevScoreData
    }
  }

  destroyed() {
    window.removeEventListener("keydown", this.keydown)
  }

  get voiceOptions() {
    return _.sortBy(this.browserVoices.filter(v => v.lang === "ja-JP"), v => v.name.startsWith("Google") ? -1 : 0)
  }

  keydown(ev: KeyboardEvent) {
    if (ev.key === "Enter" && !this.gameStarted) {
      this.startGame()
    }
  }

  mounted() {
    // this.startGame()
  }

  get canStart() {
    return this.options.pokemon || this.options.loanwords || this.options.n5Kanji || this.options.n5Hiragana
  }

  startGame() {
    if (!this.canStart) return
    this.gameStarted = true
  }

  get defaultGameOptions(): GameOptions {
    return {
      loanwords: true,
      pokemon: false,
      n5Kanji: false,
      n5Hiragana: false,
      voice: this.defaultVoiceName
    }
  }

  get defaultVoiceName(): string|null {
    const voicePrefs = _.sortBy(this.voiceOptions, (v) =>
      v.name.startsWith("Google") ? -1 : 0
    )

    return voicePrefs[0]?.name || null
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

main
  margin-top: -3rem
  padding: 1rem

h1
  margin-bottom: 3rem
  color: #eee
  font-size: 2rem

.form-check-input, .form-check-label
  cursor: pointer
  user-select: none

.settings
  display: flex
  margin-bottom: 1rem

  section
    margin-right: 2rem

</style>
