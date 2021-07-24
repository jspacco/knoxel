let allMaterials = [];
let materialNames = {};
materialNames['AIR'] = 0;
materialNames[null] = 0;

createMaterials();

let createGame = require('voxel-engine');

// export for use in the HTML file
let game = createGame({
  generate: function(x, y, z) {
    return y === 0 ? materialNames['GRASS'] : 0;
  },
  chunkDistance: 2,
  materials: allMaterials,
  materialFlatColor: false,
  texturePath: '/textures/'
});

// function displayBlockLocation(x, y, z){
//   document.getElementById('x').innerHTML = x;
//   document.getElementById('y').innerHTML = y;
//   document.getElementById('z').innerHTML = z;
// }

// Try to set up click handlers
let createReach = require('voxel-reach');
reach = createReach(game, {reachDistance: 8});

reach.on('use', function(target) {
  // right-click
  if (target){
    let x = target.voxel[0];
    let y = target.voxel[1];
    let z = target.voxel[2];
    console.log("raw x,y,z = ("+x+","+y+","+z+")");
  }
});

reach.on('mining', function(target) {
    // left-click
    if (target){
        //console.log(target);

      // only update the x,y,z table if we click a block
      // that is part of the landscape, i.e. is inside our
      // length,width,height range
    //   let minx = 0;
    //   let maxx = parseInt(document.getElementById("width").innerHTML);
    //   let miny = 1;
    //   let maxy = parseInt(document.getElementById("height").innerHTML) + 1;
    //   // z coords are reversed because we are looking in the -z direction
    //   let minz = -1 * parseInt(document.getElementById("length").innerHTML);
    //   let maxz = 0;
  
      let x = target.voxel[0];
      let y = target.voxel[1];
      let z = target.voxel[2];
      console.log("raw x,y,z = ("+x+","+y+","+z+")");
    //   if (minx <= x && x < maxx &&
    //     miny <= y && y < maxy &&
    //     // again, z coords are reversed
    //     minz < z && z <= maxz)
    //   {
    //       displayBlockLocation(x, y-1, -z);
    //       console.log("x = "+x+", between "+minx+","+maxx+
    //         "\ny = "+y+", between "+miny+","+maxy+
    //         "\nz = "+z+", between "+minz+","+maxz);
    //   }
    }
});

// Set origin to RED_WOOL
// Put an L shape with black wool on the X axis
// and blue wool on the Z axis, so that we know where
// the origin is, and what direction shapes will go in.
game.setBlock(new Array(-1, 0, 1), materialNames['RED_WOOL']);
for (let x=0; x<=3; x++){
  game.setBlock(new Array(x, 0, 1), materialNames['BLACK_WOOL']);
}
for (let z=0; z<=3; z++){
  game.setBlock(new Array(-1, 0, -z), materialNames['BLUE_WOOL']);
}

let createPlayer = require('voxel-player')(game);
let player = createPlayer('spacdog.png');
player.possess();
player.position.set(0,5,5);

// I believe I can fly!
let fly = require('voxel-fly');
let makeFly = fly(game);
makeFly(game.controls.target());

// highlight blocks when you look at them
let highlight = require('voxel-highlight')
let highlightPos;
var hl = game.highlighter = highlight(game, { color: 0xffffff })
hl.on('highlight', function (voxelPos) { highlightPos = voxelPos })
hl.on('remove', function (voxelPos) { highlightPos = null })



function createMaterials() {
    // Registers a material
    function addMat(name, filename) {
        // Attaches the new filename to the end of the allMaterials array
        allMaterials.push(filename);
        // Note that the first index in the materials array is actually
        // item '1' (air is 0).
        materialNames[name] = allMaterials.length;
    }
    // TODO Add the following:
    /*
    * OAK_SAPLING
    * SPRUCE_SAPLING
    * BIRCH_SAPLING
    * JUNGLE_SAPLING
    * ACACIA_SAPLING
    * DARK_OAK_SAPLING
    * FLOWING_WATER
    * STILL_WATER
    * FLOWING_LAVA
    * STILL_LAVA
    */

    addMat("STONE", "stone");
    addMat("GRANITE", "stone_granite");
    addMat("POLISHED_GRANITE", "stone_granite_smooth");
    addMat("DIORITE", "stone_diorite");
    addMat("POLISHED_DIORITE", "stone_diorite_smooth");
    addMat("ANDESITE", "stone_andesite");
    addMat("POLISHED_ANDESITE", "stone_andesite_smooth");
    addMat("GRASS", ["grass_side", "grass_side", "grass_top", "dirt", "grass_side", "grass_side"]);
    addMat("DIRT", "dirt");
    addMat("COARSE_DIRT", "coarse_dirt");
    addMat("PODZOL", ["dirt_podzol_top", "dirt_podzol_side"]);
    addMat("COBBLESTONE", "cobblestone");
    addMat("OAK_WOOD_PLANK", "planks_oak");
    addMat("SPRUCE_WOOD_PLANK", "planks_spruce");
    addMat("BIRCH_WOOD_PLANK", "planks_birch");
    addMat("JUNGLE_WOOD_PLANK", "planks_jungle");
    addMat("ACACIA_WOOD_PLANK", "planks_acacia");
    addMat("DARK_OAK_WOOD_PLANK", "planks_big_oak");
    addMat("BEDROCK", "bedrock");
    addMat("SAND", "sand");
    addMat("RED_SAND", "red_sand");
    addMat("GRAVEL", "gravel");

    addMat("OAK_WOOD", ["log_oak", "log_oak", "log_oak_top", "log_oak", "log_oak", "log_oak_top"]);
    addMat("SPRUCE_WOOD", ["log_spruce", "log_spruce", "log_spruce_top", "log_spruce", "log_spruce", "log_spruce_top"]);
    addMat("BIRCH_WOOD", ["log_birch", "log_birch", "log_birch_top", "log_birch", "log_birch", "log_birch_top"]);
    addMat("JUNGLE_WOOD", ["log_jungle", "log_jungle", "log_jungle_top", "log_jungle", "log_jungle", "log_jungle_top"]);

    addMat("SPONGE", "sponge");
    addMat("WET_SPONGE", "sponge_wet");


    addMat("SANDSTONE", ["sandstone_normal", "sandstone_normal", "sandstone_top", "sandstone_bottom", "sandstone_normal", "sandstone_normal"]);
    addMat("CHISELED_SANDSTONE", ["sandstone_carved", "sandstone_carved", "sandstone_top", "sandstone_bottom", "sandstone_carved", "sandstone_carved"]);
    addMat("SMOOTH_SANDSTONE", ["sandstone_smooth", "sandstone_smooth", "sandstone_top", "sandstone_bottom", "sandstone_smooth", "sandstone_smooth"]);

    addMat("WHITE_WOOL", "wool_colored_white");
    addMat("ORANGE_WOOL", "wool_colored_orange");
    addMat("MAGENTA_WOOL", "wool_colored_magenta");
    addMat("LIGHT_BLUE_WOOL", "wool_colored_light_blue");
    addMat("YELLOW_WOOL", "wool_colored_yellow");
    addMat("LIME_WOOL", "wool_colored_lime");
    addMat("PINK_WOOL", "wool_colored_pink");
    addMat("GRAY_WOOL", "wool_colored_gray");
    addMat("LIGHT_GRAY_WOOL", "wool_colored_silver");
    addMat("CYAN_WOOL", "wool_colored_cyan");
    addMat("PURPLE_WOOL", "wool_colored_purple");
    addMat("BLUE_WOOL", "wool_colored_blue");
    addMat("BROWN_WOOL", "wool_colored_brown");
    addMat("GREEN_WOOL", "wool_colored_green");
    addMat("RED_WOOL", "wool_colored_red");
    addMat("BLACK_WOOL", "wool_colored_black");

    addMat("GOLD_BLOCK", "gold_block");
    addMat("IRON_BLOCK", "iron_block");
    addMat("EMERALD_BLOCK", "emerald_block");
    addMat("DIAMOND_BLOCK", "diamond_block");
    addMat("LAPIS_LAZULI_BLOCK", "lapis_block");


    addMat("BRICKS", "brick");
    addMat("TNT", ["tnt_side", "tnt_side", "tnt_top", "tnt_bottom", "tnt_side", "tnt_side"]);
    addMat("BOOKSHELF", "bookshelf");

    addMat("MOSS_STONE", "cobblestone_mossy");
    addMat("OBSIDIAN", "obsidian");

    addMat("DIAMOND_ORE", "diamond_ore");
    addMat("EMERALD_ORE", "emerald_ore");
    addMat("GOLD_ORE", "gold_ore");
    addMat("IRON_ORE", "iron_ore");
    addMat("COAL_ORE", "coal_ore");
    addMat("LAPIS_LAZULI_ORE", "lapis_ore");
    addMat("QUARTZ_BLOCK", ["quartz_block_side", "quartz_block_side", "quartz_block_top", "quartz_block_bottom", "quartz_block_side", "quartz_block_side"]);

    addMat("MONSTER_SPAWNER", "mob_spawner");
    addMat("CRAFTING_TABLE", ["crafting_table_side", "crafting_table_side", "crafting_table_top", "crafting_table_top", "crafting_table_side", "crafting_table_side"]);
    addMat("FARMLAND", "farmland_dry");

    addMat("SNOW", ["grass_side_snowed", "grass_side_snowed", "snow", "dirt", "grass_side_snowed", "grass_side_snowed"]);
    addMat("ICE", "ice_packed");
    addMat("SNOW_BLOCK", "snow");
    addMat("CACTUS", ["cactus_side", "cactus_side", "cactus_top", "cactus_top", "cactus_side", "cactus_side"]);
    addMat("CLAY", "clay");

    addMat("GLASS", "glass");
    addMat("STILL_LAVA", "lava_still");
    addMat("STILL_WATER", "water_still");
    addMat("FLOWING_LAVA", "lava_flow");
    addMat("FLOWING_WATER", "water_flow");

}


// Upload landscape files
// These are JSON files that describe a landscape
// They can be produced from 3D arrays in various programming languages
function loadDrawing(evt) {
    console.log("Loading drawing!");
    readFile(evt.target.files[0], updateDrawing);
}

//
// reads a file as text
//
function readFile(file, onLoadCallback){
    var reader = new FileReader();
    reader.onload = onLoadCallback;
    reader.readAsText(file);
}
  
function updateDrawing(e) {
    try {
        let result = e.target.result;
        let obj = JSON.parse(result);

        let depth = parseInt(obj.depth);
        let width = parseInt(obj.width);
        let height = parseInt(obj.height);
        console.log("width = "+obj.width);
        console.log("depth = "+obj.depth);
        console.log("height = "+obj.height);
        // document.getElementById('length').innerHTML = obj.length;
        // document.getElementById('width').innerHTML = obj.width;
        // document.getElementById('height').innerHTML = obj.height;
        // var blocks = obj.blocks;
        //for (var x = 0; x < blocks.length; x++) {
        //for (var z = 0; z < blocks[z].length; z++){
        drawBlocks(obj.blocks);
    } catch(err){
        console.log("ERROR READING DRAWING FILE");
        console.log(err);
    }
}

const makeGrid = function(width, depth, height) {
    let result = [];
    for (let w=0; w<width; w++){
        let row = [];
        for (let d=0; d<depth; d++){
            let col = [];
            for (let h=0; h<height; h++){
                col.push(null);
            }
            row.push(col);
        }
        result.push(row);
    }
    return result;
}

const blockify = function(grid) {
    // TODO: make sure these are regular 3d shapes
    const width = grid.length;
    const depth = grid[0].length;
    const height = grid[0][0].length;
    return {
        width: width,
        depth: depth,
        height: height,
        blocks: grid
    }
}

const drawBlocks = function(blocks) {
    const width = blocks.length;
    const depth = blocks[0].length;
    const height = blocks[0][0].height;
    for (let x = 0; x < blocks.length; x++) {
        for (let z = 0; z < blocks[x].length; z++){
            for (let y = 0; y < blocks[x][z].length; y++){
                game.setBlock(new Array(x, y+1, -z), materialNames[blocks[x][z][y]]);
            }
        }
    }
}


// finally, export the game object so browserify can make it available
module.exports.game = game;
module.exports.loadDrawing = loadDrawing;
module.exports.drawBlocks = drawBlocks;
module.exports.makeGrid = makeGrid;
module.exports.blockify = blockify;
// so we can do knoxel.dirt, or knoxel.cobblestone, etc
for (let material of Object.keys(materialNames)) {
    module.exports[material.toLowerCase()] = material;
}
//module.exports.allMaterials = allMaterials;
//module.exports.materialNames = materialNames;