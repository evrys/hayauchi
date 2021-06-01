
import csv
import re

# englines = open("./data/sm_eng_story.txt").readlines()
# jpnlines = open("./data/sm_jpn_kana_story.txt").readlines()

# def clean_string(s: str) -> str:
#   return s.strip().replace("\\c\\n", " ").replace("\\n", " ").replace("\\r", " ")


# seen = set()

# with open("./data/lines.tsv", "w") as tsvfile:
#   writer = csv.writer(tsvfile, delimiter="\t",
#                         quotechar='"', quoting=csv.QUOTE_MINIMAL)

#   writer.writerow(["English", "Japanese"])
#   for i in range(len(englines)):
#     eline = clean_string(englines[i])
#     jline = clean_string(jpnlines[i])

#     if "~~~" in eline or '[' in eline or "[" in jline or "Press" in eline or "press" in eline or "Hold" in eline or "hold" in eline:
#       continue

#     if not re.match(r'([\u3040-\u30ff]+)', jline):
#       continue # No kana

#     num_sentences = re.findall(r'[.!?]( |$)', eline)
#     if len(num_sentences) < 1:
#       continue

#     if eline in seen or jline in seen:
#       continue # Don't want duplicates
#     else:
#       seen.add(eline)
#       seen.add(jline)

#     writer.writerow([eline, jline])

# import untangle
# eng = untangle.parse(open("./platinum_eng.xml", encoding='utf-16-le').read())
# jpn = untangle.parse(open("./platinum_jpn.xml", encoding='utf-16-le').read())

# def clean_string(s: str) -> str:
#   return s.strip().replace("\\n", " ")

# i = 0
# j = 0



# for efile in eng.Poketext.file:
#   print(len(efile.text))
#   # for j, etext in enumerate(efile.text):


# jtexts = {}
# for i, file in enumerate(jpn.Poketext.file):
#   for j, text in enumerate(file.text):
#     key = (i, j)
#     jtexts[key] = clean_string(text.cdata)

# for i, file in enumerate(eng.Poketext.file):
#   for j, text in enumerate(file.text):
#     key = (i, j)
#     if key in jtexts:
#       print(clean_string(text.cdata), ":::", jtexts[key])

# for file in obj.Poketext.file:
#   for text in file.text:
#     print(text.cdata.strip())