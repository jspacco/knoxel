import json
import sys

textures_file = 'textures.json'
if len(sys.argv) > 1:
    textures_file = sys.argv[1]

textures = json.loads(open(textures_file).read())

pykcbase = """'''
Base code of Pykc that doesn't require any imports
'''


def makeGrid(width, depth, height):
    return [[[None for k in xrange(height)] for j in xrange(depth)] for i in xrange(width)]


class BlockType:
    '''Sort of like an enum, but we literally want the string values and we don't
need any of the features we get from extending a Python Enum. This allows us to do 
things like this:

blocks[x][z][y] = bt.dirt
'''
"""

for name in textures.keys():
    pykcbase += f'    {name.lower()} = "{name}"\n'

pykcbase += '\n\nbt = BlockType'
print(pykcbase)