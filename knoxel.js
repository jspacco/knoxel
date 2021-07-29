function createMaterials() {
    let allMaterials = [];
    let materialLookup = {};

    let textures = require('./textures.json');
    for (const [name, filenames] of Object.entries(textures)) {
        allMaterials.push(filenames);
        materialLookup[name] = allMaterials.length;
    }
    // so that null maps to AIR
    // AIR should always be at index 0 in textures.json, but in case it's not
    // we will do a lookup
    materialLookup[null] = materialLookup['AIR'];
    return [allMaterials, materialLookup];
}

const [allMaterials, materialLookup] = createMaterials();

let createGame = require('voxel-engine');

// export for use in the HTML file
let game = createGame({
  generate: function(x, y, z) {
    return y === 0 ? materialLookup['GRASS'] : 0;
  },
  chunkDistance: 2,
  materials: allMaterials,
  materialFlatColor: false,
  texturePath: './textures/'
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
game.setBlock(new Array(-1, 0, 1), materialLookup['RED_WOOL']);
for (let x=0; x<=3; x++){
  game.setBlock(new Array(x, 0, 1), materialLookup['BLACK_WOOL']);
}
for (let z=0; z<=3; z++){
  game.setBlock(new Array(-1, 0, -z), materialLookup['BLUE_WOOL']);
}

let createPlayer = require('voxel-player')(game);
let player = createPlayer('./images/spacdog.png');
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
        // TODO: better error handling
        console.log("ERROR READING DRAWING FILE");
        console.log(err);
        throw err;
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
    // x is width
    for (let x = 0; x < blocks.length; x++) {
        // z is depth
        for (let z = 0; z < blocks[x].length; z++){
            // y is height
            for (let y = 0; y < blocks[x][z].length; y++){
                let block = blocks[x][z][y];
                console.log(`set block ${x}, ${z}, ${y}, coords (${x}, ${y+1}, ${-z}) to ${materialLookup[blocks[x][z][y]]} ${allMaterials[materialLookup[block]] }`);
                game.setBlock(new Array(x, y+1, -z), materialLookup[block]);
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
for (let material of Object.keys(materialLookup)) {
    module.exports[material.toLowerCase()] = material;
}
//module.exports.allMaterials = allMaterials;
//module.exports.materialLookup = materialLookup;