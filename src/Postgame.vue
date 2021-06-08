<template>
  <div class="postgame">
    <div v-if="!showingLeaderboard">
      <h3>Game complete!</h3>
      <p>{{wordset.name}}</p>

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

      <form v-if="isNewHighScore" @submit.prevent="showLeaderboard">
        <br />
        <div>
          <strong>New record!</strong> ✨ Your high score increased by
          <strong>{{ score-previousScore }}</strong> points!
        </div>
        <input
          type="text"
          class="nameInput"
          placeholder="Name for leaderboard"
          v-model="nameForLeaderboard"
        />
        <div class="d-flex">
          <button type="submit" class="btn btn-primary">Record Score</button>
          <button class="btn btn-sm ms-auto" @click.prevent="$emit('exit')">
            Exit to Menu
          </button>
        </div>
      </form>
      <div v-else>
        <br />
        <div v-if="onlinePlayer">
          You need <strong>{{ 1 + previousScore-score }}</strong> more
          points to beat your previous high score.
        </div>
        <br />
        <div class="d-flex">
          <button v-if="onlinePlayer" class="btn bnt-primary" @click.prevent="showLeaderboard">
            Show Scores
          </button>
          <button class="btn btn-sm ms-auto" @click.prevent="$emit('exit')">
            Exit to Menu
          </button>
        </div>
      </div>
    </div>
    <div class="leaderboard" v-else-if="showingLeaderboard">
      <h3>High Scores</h3>
      <p>{{wordset.name}}</p>
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
          <tr v-if="!leaderboard.length">
            <td>Loading...</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr
            v-for="entry in leaderboard"
            :key="entry.id"
            :class="{ mine: entry.id === onlinePlayer.userId }"
          >
            <td v-if="entry.rank">{{ entry.rank }}.</td>
            <td v-if="nameForLeaderboard && entry.userId === onlinePlayer.userId">
              {{ nameForLeaderboard }}
            </td>
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
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator"
import _ from "lodash"
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  doc,
  where
} from "firebase/firestore"
import { OnlinePlayer, ServerScoreData } from "./types"
import Filter from 'bad-words'
import { WordsetDescriptor } from "./wordsets"

type LeaderboardEntry = { rank: number } & ServerScoreData

@Component
export default class Postgame extends Vue {
  @Prop({ type: Object, default: null }) onlinePlayer!: OnlinePlayer | null
  @Prop({ type: Object, default: null }) wordset!: WordsetDescriptor
  @Prop({ type: Number, required: true }) score!: number
  @Prop({ type: Number, required: true }) wpm!: number


  get prevScoreData(): ServerScoreData|undefined {
    return this.onlinePlayer?.prevScores[this.wordset.id]
  }

  /** Up to 10 scores, including ours, centered on us */
  leaderboard: LeaderboardEntry[] = []
  nameForLeaderboard: string = this.prevScoreData?.name || ""
  showingLeaderboard: boolean = false

  get previousScore() {
    if (!this.onlinePlayer)
      return 0

    const { prevScoreData } = this
    return prevScoreData ? prevScoreData.score : 0
  }
  
  get isNewHighScore() {
    if (!this.onlinePlayer)
      return false

    const { prevScoreData } = this
    return prevScoreData ? this.score > prevScoreData.score : true
  }

  created() {
    if (this.onlinePlayer)
      this.syncLeaderboard()

    window.addEventListener("keydown", this.keydown)
  }

  destroyed() {
    window.removeEventListener("keydown", this.keydown)
  }

  keydown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      this.$emit("exit")
    }

    if (ev.key === "Enter") {
      if (this.showingLeaderboard) {
        this.$emit("exit")
      }
    }
  }

  /** Find where we are in the leaderboard */
  async syncLeaderboard() {
    const db = getFirestore()
    const scoresRef = collection(db, "scores")
    const { onlinePlayer, isNewHighScore } = this
    if (!onlinePlayer) return

    if (isNewHighScore) {
      // Record our score, anonymously at first (we'll update the name later)
      await setDoc(
        doc(db, "scores", `${onlinePlayer.userId}-${this.wordset.id}`),
        {
          userId: onlinePlayer.userId,
          wordsetId: this.wordset.id,
          score: this.score,
          wpm: this.wpm,
          timestamp: serverTimestamp(),
        },
        { merge: true }
      )
    }

    // Now fetch all scores
    // TODO this approach won't scale to a large number of players
    let allScores = (
      await getDocs(
        query(
          scoresRef,
          where("wordsetId", "==", this.wordset.id),
          orderBy("score", "desc"),
          orderBy("wpm", "desc"),
          orderBy("timestamp", "asc")
        )
      )
    ).docs.map((d) => d.data()) as ServerScoreData[]

    // Filter out any other nameless scores
    allScores = allScores.filter(s => s.name || s.userId === onlinePlayer.userId)

    // Calculate rank
    const rankedScores = allScores as LeaderboardEntry[]
    for (let i = 0; i < allScores.length; i++) {
      rankedScores[i].rank = i + 1
    }

    // Find where we are in the leaderboard
    const myScore = rankedScores.find((s) => s.userId === onlinePlayer.userId)!
    const myScoreIndex = rankedScores.indexOf(myScore)

    // Now extract the 10 we actually want to show
    const toShow: LeaderboardEntry[] = [myScore as LeaderboardEntry]
    let i = myScoreIndex - 1
    let j = myScoreIndex + 1
    while (toShow.length < 10) {
      const higher = rankedScores[i]
      const lower = rankedScores[j]

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
    this.showingLeaderboard = true

    let name = this.nameForLeaderboard?.trim()

    // Everyone loves 🧇
    const filter = new Filter()
    name = filter.clean(name).replace(/\*+/g, 'waffles')
    if (name) {
      // Record name for high score!
      const db = getFirestore()
      await setDoc(doc(db, "scores", `${this.onlinePlayer!.userId}-${this.wordset.id}`), {
        name: name
      }, { merge: true })
    }
  }
}
</script>

<style lang="sass">
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
</style>
