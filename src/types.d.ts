export type GameOptions = {
  wordsetIndex: number
  // null means default
  voice: 'none'|string|null
}

/** What the high score entries look like in Firestore */
export type ServerScoreData = {
  userId: string
  wordsetId: string
  name?: string
  score: number
  kpm: number
  timestamp: number
}

/** Info we get after successfully connecting a player to Firebase */
export type OnlinePlayer = {
  userId: string
  prevScores: {[wordsetId: string]: ServerScoreData|undefined}
}