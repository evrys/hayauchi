import re
import csv

def alignmentScoreMatrix(Vocab=None, HiraganaOnly=None):
    '''
    Function to calculate the scoring matrix
    using a mirrored Needleman-Wunsch algorithmn.

    Inputs:
    Vocab -> Japanese vocabulary containing Hiragana and Kanji writing (must not be longer than HiraganaOnly).
    HiraganaOnly -> The vocab word with its Kanji letters converted into Hiragana letters.

    Return: Two dimensional field which depicts the scoring matrix.
    '''

    AlignmentMatrix = [[]]
    AlignmentMatrix[0].append('#')
    i = 1
    while(i <= len(Vocab)):
        AlignmentMatrix[0].append(Vocab[i-1])
        i += 1
    AlignmentMatrix[0].append('#')

    j = 1
    while (j <= len(HiraganaOnly)):
        AlignmentMatrix.append([HiraganaOnly[j-1]])
        j += 1
    AlignmentMatrix.append(['#'])


    for i in range(len(Vocab)):
        AlignmentMatrix[len(AlignmentMatrix) - 1].append(-(len(Vocab) - i))
    AlignmentMatrix[len(AlignmentMatrix) - 1].append(0)

    j = 1
    while(j <= len(HiraganaOnly)):
        i = 1
        while(i <= len(Vocab)):
            AlignmentMatrix[j].append("#")
            i += 1
        j += 1
    
    for j in range(len(HiraganaOnly)):
        AlignmentMatrix[j+1].append(-(len(HiraganaOnly) - j))

    i = len(Vocab)
    while(i > 0):
        j = len(HiraganaOnly)
        while(j > 0):
            score = 0
            if(Vocab[i-1] == HiraganaOnly[j-1]):
                score = 2
            AlignmentMatrix[j][i] = max(AlignmentMatrix[j+1][i+1]+ score,
                                          AlignmentMatrix[j][i+1] -1,
                                          AlignmentMatrix[j+1][i] -1)
            j -= 1
        i -= 1

    return AlignmentMatrix



def kanjiPath(alignmentMatrix):
    '''
    Function to calculate the path in the scoring matrix which correspends to the correct assignment of Hiragana characters to Kanji characters.
    Uses a modified Needleman-Wunsch variant in which the scores are ignored if the current Hiragana character corresponds to the checked character.

    Input: The alignment Matrix between a vocab word and a Hiragana-only version of it.

    Return: A two dimensional field of the vocab and Hiragana-only strings where each adjacent set of Kanji characters are taken together with their corresponding Hiragana part.
    '''

    output = None
    wordIndex = 1
    row = 1
    column = 1
    while wordIndex < len(alignmentMatrix)-1:
        if(alignmentMatrix[0][row] == alignmentMatrix[column][0]):
            if (output == None):
                output = [[alignmentMatrix[0][row], alignmentMatrix[column][0]]]
            else:
                output.append([alignmentMatrix[0][row], alignmentMatrix[column][0]])
            row += 1
            column += 1
        else:
            if(alignmentMatrix[column+1][row] > max(alignmentMatrix[column][row+1], alignmentMatrix[column+1][row+1])):
                if (output == None):
                    output = [[alignmentMatrix[0][row], alignmentMatrix[column][0]]]
                else:
                    output.append([alignmentMatrix[0][row], alignmentMatrix[column][0]])
                column += 1
            elif(alignmentMatrix[column][row+1] > alignmentMatrix[column+1][row+1]):
                if (output == None):
                    output = [[alignmentMatrix[0][row], alignmentMatrix[column][0]]]
                else:
                    output.append([alignmentMatrix[0][row], alignmentMatrix[column][0]])
                row += 1
            else:
                if (output == None):
                    output = [[alignmentMatrix[0][row], alignmentMatrix[column][0]]]
                else:
                    output.append([alignmentMatrix[0][row], alignmentMatrix[column][0]])
                row += 1
                column += 1
        wordIndex += 1

    pattern = '^[あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉ]+$'
    firstOutput = []
    secondOutput = []
    i = 0

    while i < len(output):
        first = None
        second = None
        hasKanji = False
        while (i < len(output) and re.match(pattern, output[i][0]) == None):
            hasKanji = True
            if (first == None):
                first = output[i][0]
                second = output[i][1]
            else:
                if (first[len(first)-1] != output[i][0]):
                    first += output[i][0]
                second += output[i][1]
            i += 1
        if(hasKanji == True):
            firstOutput.append(first)
            secondOutput.append(second)
        if(i< len(output)):
            first = output[i][0]
            second = output[i][1]      
            firstOutput.append(first)
            secondOutput.append(second)
            i += 1

    ret = []
    for i in range(len(firstOutput)):
        ret.append([firstOutput[i], secondOutput[i]])
    return ret

#Reading and writing formatted tsv using alignment functions above, switch out file names to take use of it.

kanji = []
furigana = []
romaji = []
meaning = []
with open('JLPT5_Vocab.tsv', encoding="utf-8") as file:
    data = csv.reader(file, delimiter='\t')
    
    next(data)
    
    for row in data:
        kanji.append(str((row[0])))
        furigana.append(str(row[1]))
        romaji.append(str(row[2]))
        meaning.append(str((row[3])))

dataset = []

for i in range(len(kanji)):
    matrix = (alignmentScoreMatrix(kanji[i], furigana[i]))
    dataset.append(kanjiPath(matrix))

kanj = []
hira = []

for i in range(len(dataset)):
    x = ""
    y = ""
    for j in range(len(dataset[i])):
        x += dataset[i][j][0]
        y += dataset[i][j][1]
        if(j+1 != len(dataset[i])):
            x += " "
            y += " "
    kanj.append(x)
    hira.append(y)

kanji = kanj
furigana = hira

with open('JLPT5_Alignment.tsv', 'w', encoding="utf-8", newline='') as file:
    writer = csv.writer(file, delimiter='\t')
    writer.writerow(["Kanji", "Furigana", "Romaji", "Meaning"])
    for i in range(len(kanji)):
        writer.writerow([kanji[i], furigana[i], romaji[i], meaning[i]])