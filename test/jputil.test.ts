import { toRomaji, phoneticKanaSplit, alignKanjiReading, toKatakana, matchAttempt, toHiragana, splitKanaBoundaries } from '../src/jputil'


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

  it('aligns kanji-containing vocab parts with their readings', async () => {
    expect(splitKanaBoundaries("お兄さん")).toEqual(["お", "兄", "さん"])
    expect(splitKanaBoundaries("可愛い")).toEqual(["可愛", "い"])


    expect(alignKanjiReading("お兄さん", "おにいさん")).toEqual([
      ['お', 'お'],
      ['兄', 'にい'],
      ['さん', 'さん']
    ])

    expect(alignKanjiReading("可愛い", "かわいい")).toEqual([
      ['可愛', 'かわい'],
      ['い', 'い']
    ])
  })

  // it('progressively and permissively matches romaji input to kana', async () => {
  //   // naraberu
  //   expect(matchAttempt("na", "並べる", "ならべる")).toEqual({
  //     doneKanji: "",
  //     doneKana: "な",
  //     remainingKanji: "並べる",
  //     remainingKana: "ならべる"
  //   })

  //   expect(matchAttempt("pa", "パー").doneKanji).toEqual("パ")
  //   expect(matchAttempt("pa", "パー").remainingKanji).toEqual("ー")
  //   expect(matchAttempt("paa", "パー").doneKanji).toEqual("パー")
  //   expect(matchAttempt("paa", "パー").remainingKanji).toEqual("")


  //   expect(matchAttempt("chiariidi", "チアリーディング").doneKanji).toEqual("チアリーディ")

  //   expect(matchAttempt("ky", "キャッチコピー").doneKanji).toEqual("")
  //   expect(matchAttempt("kya", "キャッチコピー").doneKanji).toEqual("キャ")
  //   expect(matchAttempt("kyac", "キャッチコピー").doneKanji).toEqual("キャ")
  //   expect(matchAttempt("kyacc", "キャッチコピー").doneKanji).toEqual("キャ")
  //   expect(matchAttempt("kyacch", "キャッチコピー").doneKanji).toEqual("キャ")
  //   expect(matchAttempt("kyacchi", "キャッチコピー").doneKanji).toEqual("キャッチ")
  //   expect(matchAttempt("kyacchik", "キャッチコピー").doneKanji).toEqual("キャッチ")
  //   expect(matchAttempt("kyacchiko", "キャッチコピー").doneKanji).toEqual("キャッチコ")
  //   expect(matchAttempt("kyacchikop", "キャッチコピー").doneKanji).toEqual("キャッチコ")
  //   expect(matchAttempt("kyacchikopi", "キャッチコピー").doneKanji).toEqual("キャッチコピ")
  //   expect(matchAttempt("kyacchikopii", "キャッチコピー").doneKanji).toEqual("キャッチコピー")

    
  // })
})