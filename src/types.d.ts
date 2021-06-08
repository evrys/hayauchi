export type GameOptions = {
  wordsetIndex: number
  voice: string|null
}

/** What the high score entries look like in Firestore */
export type ServerScoreData = {
  id: string
  name?: string
  score: number
  wpm: number
  timestamp: number
}

/** Info we get after successfully connecting a player to Firebase */
export type OnlinePlayer = {
  userId: string
  prevScoreData: ServerScoreData|null
}