
// @ts-ignore
import rows from '../data/loanwords.tsv'

const loanwords: [string, string][] = []

for (const row of rows) {
  row[0] = row[0].split(/\s+/)[0]
  row[1] = row[1].split(", ")[0]
  if (row[1].split(" ").length > 2)
    continue

  loanwords.push(row)
}

export default loanwords