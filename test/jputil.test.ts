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

  // it('progressively and permissively matches romaji input to kana', async () => {
    // // naraberu
    // expect(matchAttempt("na", "並べる", "ならべる")).toEqual({
    //   doneKanji: "",
    //   doneKana: "な",
    //   remainingKana: "並べる",
    //   remainingKana: "ならべる"
    // })

    expect(matchAttempt("pa", "パー").doneKana).toEqual("パ")
    expect(matchAttempt("pa", "パー").remainingKana).toEqual("ー")
    expect(matchAttempt("paa", "パー").doneKana).toEqual("パー")
    expect(matchAttempt("paa", "パー").remainingKana).toEqual("")


    expect(matchAttempt("chiariidi", "チアリーディング").doneKana).toEqual("チアリーディ")

    expect(matchAttempt("ky", "キャッチコピー").doneKana).toEqual("")
    expect(matchAttempt("kya", "キャッチコピー").doneKana).toEqual("キャ")
    expect(matchAttempt("kyac", "キャッチコピー").doneKana).toEqual("キャ")
    expect(matchAttempt("kyacc", "キャッチコピー").doneKana).toEqual("キャ")
    expect(matchAttempt("kyacch", "キャッチコピー").doneKana).toEqual("キャ")
    expect(matchAttempt("kyacchi", "キャッチコピー").doneKana).toEqual("キャッチ")
    expect(matchAttempt("kyacchik", "キャッチコピー").doneKana).toEqual("キャッチ")
    expect(matchAttempt("kyacchiko", "キャッチコピー").doneKana).toEqual("キャッチコ")
    expect(matchAttempt("kyacchikop", "キャッチコピー").doneKana).toEqual("キャッチコ")
    expect(matchAttempt("kyacchikopi", "キャッチコピー").doneKana).toEqual("キャッチコピ")
    expect(matchAttempt("kyacchikopii", "キャッチコピー").doneKana).toEqual("キャッチコピー")

    expect(matchAttempt("tuitaa", "ツイター").doneKana).toEqual("ツイター")

    
  // })
})