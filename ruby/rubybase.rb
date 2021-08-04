require 'native'

blocktype = Native(`knoxel`)

#
# create a 3D volume of size width * depth * height
#
def make_grid(width, depth, height)
    return [[[nil] * height] * depth] * width
end

#_draw_blocks_method = Native(`knoxel.drawBlocks`)
def draw_blocks(blocks)
    _draw_blocks_method = Native(`knoxel.drawBlocks`)
    # call into our native Javascript code
    return _draw_blocks_method.call(blocks)
end