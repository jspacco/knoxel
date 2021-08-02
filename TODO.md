# Knoxel JS: A Voxel-based browser coding experience

## TODO
* Instructions
    * demo what it does with pictures
    * FAQ
    * BlueJ/JGrasp support
        * download of a sample BlueJ project
* # style for the textures listing
* Textures!
    * can only render 256 blocks away from the player due to how chunk loading works
    * Add textures of various colors that we can just kind of drop in
        * https://www.pixilart.com/draw/16x16-b3bc604165f0096
        * my red, pink are probably wrong?
        * can we enable both flat colors and also textures?
* voila / waila
    * turn on/off with use handler
* grid outline of the whole thing that we just dropped into place as debugging
    * hard to do, possibly not worth doing, would require treating some textures the same as air
* figure out the translucent mod from deathcap
    * requires voxel-regsitry, but I think you just say transparent:true in the props
* generate links to programs using the URL somehow
* Turn on Google analytics!
* get rid of the little status thing, it's annoying
* fix webgl errors
* Workflow for installing and using Deathcap's fork of voxel-engine
    * separate `deathcap` branch for this
    * requires both voxel-registry and voxel-plugins, which I could not find easy examples to use
* Javascript line number errors
    * parsing the text of the message, since the ReferenceError and SyntaxError types returned by eval() are not consistent between browsers
* BlueJ/JGrasp Java support

## Stretch Goals
* Java to Javascript transpiler for this project
    * What Java features do we need?
        * arrays
        * Map
        * ArrayList / LinkedList (anything from the List interface)
        * 