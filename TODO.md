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
* Ruby support using (Opal)[https://github.com/opal/opal], probably using (Opal-CDN)[https://github.com/opal/opal-cdn]
* What would Clojure support look like using ClojureScript?

## Stretch Goals
* Java to Javascript transpiler for this project
    * What Java features do we need?
        * arrays
        * Map
        * ArrayList / LinkedList (anything from the List interface)
    * 
