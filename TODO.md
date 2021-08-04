# Knoxel JS: A Voxel-based browser coding experience

## TODO
* Nifty assignment submission
* Help section
    * Sample BlueJ project as a zipfile
    * Better explanation of how to upload drawing.json files
    * Probably some video
    * explain that we can only render 256 blocks away from the player due to how chunk loading works
* Textures!
    * better style for the textures listing
    * Improve textures of various colors that we can just kind of drop in
        * https://www.pixilart.com/draw/16x16-b3bc604165f0096
* ACE
    * highlighting line numbers requires clicking editor window to trigger the update
* stdout panel for any prints coming from student code
    * best way to intercept?


## Future Work
* turn off voila / waila
* change texture packs, once I download some new textures
* grid outline of the whole thing that we just dropped into place as debugging
* figure out the translucent mod from deathcap
    * requires voxel-regsitry, but I think you just say transparent:true in the block props
* generate links to programs using the URL somehow
* fix webgl errors
* Workflow for installing and using Deathcap's fork of voxel-engine
    * separate `deathcap` branch for this
    * requires both `voxel-registry` and `voxel-plugins`, which I could not find examples online
* Javascript line number errors
    * parsing the text of the message, since the `ReferenceError` and `SyntaxError` types returned by eval() are not consistent between browsers
* Python 3 support in Skulpt
* Ruby support is on branch `ruby`, not yet merged into main branch
    * create a ruby (enum for the blocktypes)[https://stackoverflow.com/questions/75759/how-to-implement-enums-in-ruby]
    * better error handling for Ruby
    * Opal does not handle nested `for in` loops, though nested `each do` loops work
* Support 2D arrays, where we throw out the Y coordinate and can look at it from above
* Increase speed of player
* ticks/deltas for things that change appearance, like still water and still lava
* test OOB errors from Python and JS
* Sample programs in Python/JS for stairs, skyscraper, pyramid
* Single editor, multiple languages

## Stretch Goals
* Java to Javascript transpiler for this project
    * What Java features do we need?
        * arrays
        * Map
        * ArrayList / LinkedList (anything from the List interface)
* Blockly support
    * Probably a block to create a 3D volume by width, depth, height?
    * Probably a block to set a texture to a w,d,h location within our volume?
    * Good examples of how to handle the nested loops with counters
    * Textures as a block with drop-downs or something like that?
        * update blocks/textures if we add more block types
* What would Clojure support look like using ClojureScript?
    * probably mapping functions onto a 3D volume somehow I guess?
* Combine textures with flat colors using voxel-textures
    * Basically, if it starts with a # then treat it as a color, else find the texture.
    * breaks npm support, requires `npm link` to get working
    * put on separate branch at first?
