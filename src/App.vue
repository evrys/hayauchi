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
        <h6>Wordsets</h6>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="" id="loanwords" v-model="options.loanwords">
          <label class="form-check-label" for="loanwords">
            Loanwords
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="" id="pokemon" v-model="options.pokemon" :disabled="!options.katakana">
          <label class="form-check-label" for="pokemon">
            Pokémon Names
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
  <Game v-else :options="options" />
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator"
import _ from "lodash"
import * as wanakana from "wanakana"
import Game from "./Game.vue"
declare const window: any
window.wanakana = wanakana
// @ts-ignore
import _sentences from "../data/lines.tsv"
import { GameOptions } from "./types"

type Kanatype = 'hiragana'|'katakana'|'both'

@Component({
  components: {
    Game,
  },
})
export default class App extends Vue {
  gameStarted: boolean = false
  browserVoices: SpeechSynthesisVoice[] = []
  options: GameOptions = this.defaultGameOptions

  created() {
    // Sometimes browser takes a while to populate options
    speechSynthesis.addEventListener("voiceschanged", () => {
      this.browserVoices = speechSynthesis.getVoices()
      this.options.voice = this.defaultVoiceName
    })
    this.browserVoices = speechSynthesis.getVoices()
  }

  get voiceOptions() {
    return _.sortBy(this.browserVoices.filter(v => v.lang === "ja-JP"), v => v.name.startsWith("Google") ? -1 : 0)
  }

  mounted() {
    // this.startGame()
  }

  get canStart() {
    return this.options.pokemon || this.options.loanwords
  }

  startGame() {
    this.gameStarted = true
  }

  get defaultGameOptions(): GameOptions {
    return {
      pokemon: true,
      loanwords: true,
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
