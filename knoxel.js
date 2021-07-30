const [allMaterials, materialLookup] = createMaterials();
let game = makeGame();

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



// TODO: finish this refactoring
function makeGame() {
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

    // Try to set up click handlers
    let createReach = require('voxel-reach');
    let reach = createReach(game, {reachDistance: 8});

    reach.on('use', function(target) {
        // right-click
        if (target){
            let x = target.voxel[0];
            let y = target.voxel[1];
            let z = target.voxel[2];
            console.log("use x,y,z = ("+x+","+y+","+z+")");
        }
    });

    reach.on('mining', function(target) {
        // left-click
        if (target){
            let x = target.voxel[0];
            let y = target.voxel[1];
            let z = target.voxel[2];
            console.log("mine x,y,z = ("+x+","+y+","+z+")");
        }
    });

    // TODO: numbered axes with x, y, z
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

    // return the voxel game object we created
    return game;
}

//
// load a JSON drawing file
//
async function loadDrawing(evt) {
    console.log("Loading drawing!");
    // Incredibly complicated and convoluated way to read a file in JS, ugh
    let file = evt.target.files[0];
    function readFile() {
        let reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onerror = () => {
                reader.abort();
                reject(reader.error);
            };
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.readAsText(evt.target.files[0]);
        });
    }

    // await needs to be enclosed in an async function, which is why
    // the function containing this is marked async
    let text = await readFile();
    
    console.log(text);
    try {
        updateDrawing(text);
    } catch (error) {
        console.log(`fartufcker ${error}`);
        throw error;
    }
}

  
function updateDrawing(result) {
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
    return 0;
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