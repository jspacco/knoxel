import json
import sys

textures_file = 'textures.json'
if len(sys.argv) > 1:
    textures_file = sys.argv[1]

textures = json.loads(open(textures_file).read())


blocktype = "public enum BlockType {\n"

for name in textures.keys():
    blocktype += f'    {name},\n'

blocktype += '}'
print(blocktype)