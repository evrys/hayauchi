import { toRomaji, phoneticKanaSplit, toKatakana, matchAttempt, toHiragana } from '../src/jputil'


describe('jputil', () => {
  it('transliterates between kana and romaji consistently', async () => {
    expect(toRomaji("バッティング")).toEqual("battingu")
    expect(toKatakana("battingu")).toEqual("バッティング")

    expect(toRomaji("チアリーディング")).toEqual("chiariidingu")

    expect(toRomaji("スナバァ")).toEqual("sunaba")
    expect(toRomaji("ゴールデンウィーク")).toEqual("goorudenwiiku")
    // リフォーム
    // expect(toKatakana("kyacchikopii")).toEqual("キャッチコピー")
    // expect(toRomaji("キャッチコピー")).toEqual("kyacchikopii")
    // expect(toHiragana("キャッチコピー")).toEqual("キャッチこぴい")
    // expect(toHiragana("kyatchikopī")).toEqual("キャッチこぴい")
  })

  it('splits kana into phonetic tokens', async () => {
    expect(phoneticKanaSplit("バッティング")).toEqual(["バ", "ッティ", "ン", "グ"])
    expect(phoneticKanaSplit("キャッチコピー")).toEqual(["キャ", "ッチ", "コ", "ピー"])
    expect(phoneticKanaSplit("チアリーディング")).toEqual(["チ", "ア", "リー", "ディ", "ン", "グ"])
    expect(phoneticKanaSplit("ゴールデンウィーク")).toEqual(["ゴー", "ル", "デ", "ン", "ウィー", "ク"])
  })

  it('progressively and permissively matches romaji input to kana', async () => {
    expect(matchAttempt("pa", "パー").donePart).toEqual("パ")
    expect(matchAttempt("pa", "パー").remainingPart).toEqual("ー")
    expect(matchAttempt("paa", "パー").donePart).toEqual("パー")
    expect(matchAttempt("paa", "パー").remainingPart).toEqual("")


    expect(matchAttempt("chiariidi", "チアリーディング").donePart).toEqual("チアリーディ")

    expect(matchAttempt("ky", "キャッチコピー").donePart).toEqual("")
    expect(matchAttempt("kya", "キャッチコピー").donePart).toEqual("キャ")
    expect(matchAttempt("kyac", "キャッチコピー").donePart).toEqual("キャ")
    expect(matchAttempt("kyacc", "キャッチコピー").donePart).toEqual("キャ")
    expect(matchAttempt("kyacch", "キャッチコピー").donePart).toEqual("キャ")
    expect(matchAttempt("kyacchi", "キャッチコピー").donePart).toEqual("キャッチ")
    expect(matchAttempt("kyacchik", "キャッチコピー").donePart).toEqual("キャッチ")
    expect(matchAttempt("kyacchiko", "キャッチコピー").donePart).toEqual("キャッチコ")
    expect(matchAttempt("kyacchikop", "キャッチコピー").donePart).toEqual("キャッチコ")
    expect(matchAttempt("kyacchikopi", "キャッチコピー").donePart).toEqual("キャッチコピ")
    expect(matchAttempt("kyacchikopii", "キャッチコピー").donePart).toEqual("キャッチコピー")

    
  })
})