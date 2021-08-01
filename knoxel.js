const [allMaterials, materialLookup, textureTable] = createMaterials();
let [game, waila] = makeGame();

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

    function td(parent, text) {
        let tmp = document.createElement("td");
        tmp.innerHTML = text;
        parent.appendChild(tmp);
    }

    function th(parent, text) {
        let tmp = document.createElement("th");
        tmp.innerHTML = text;
        parent.appendChild(tmp);
    }

    let textureTable = document.createElement("table");
    let head = document.createElement("tr");
    
    th(head, "Texture");
    //let tex = document.createElement("th");
    //tex.innerHTML = "Texture";
    //head.appendChild(tex);

    th(head, "Javascript");
    th(head, "Python");
    th(head, "Java");

    textureTable.appendChild(head);

    for (const [name, image] of Object.entries(textures)) {
        let row = document.createElement("tr");
        
        if (Array.isArray(image)) {
            let div = document.createElement("div");
            for (let img1 of image) {
                let img = document.createElement("img");
                img.src = `./textures/${img1.toLowerCase()}.png`;
                img.style.width = '64px';
                img.style.height = '64px';
                div.appendChild(img);
            }
            let td1 = document.createElement("td");
            td1.appendChild(div);
            row.appendChild(td1);
        } else {
            let img = document.createElement("img");
            img.src = `./textures/${image.toLowerCase()}.png`;
            img.style.width = '64px';
            img.style.height = '64px';
            let td1 = document.createElement("td");
            td1.appendChild(img);
            row.appendChild(td1);
        }
        
        

        // Javascript
        td(row, `knoxel.${name.toLowerCase()}`);
        // Python
        td(row, `bt.${name.toLowerCase()}`);
        // Java
        td(row, `BlockType.${name}`);

        textureTable.appendChild(row);
    }
    

    return [allMaterials, materialLookup, textureTable];
}



// TODO: finish this refactoring
function makeGame() {
    let createGame = require('voxel-engine');

    // export for use in the HTML file
    let game = createGame({
        generate: function(x, y, z) {
            return y === 0 ? materialLookup['GRASS'] : 0;
        },
        chunkDistance: 4,
        materials: allMaterials,
        materialFlatColor: false,
        texturePath: './textures/'
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

    // hacking in my own version of Deathcap's voxel-voila
    // https://github.com/voxel/voxel-voila/blob/master/voila.js
    let node = document.createElement('span');
    node.setAttribute('id', 'waila');
    node.setAttribute('style', `
background-image: linear-gradient(rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.6) 100%);
visibility: hidden;
color: white;
font-size: 18pt;
`);

    node.textContent = '';

    const container = document.createElement('div');
    container.setAttribute('style', `
position: absolute;
top: 0px;
width: 100%;
text-align: center;
`);

    container.appendChild(node);
    //document.body.appendChild(container);

    // Try to set up click handlers
    // these should update the node we just created
    let createReach = require('voxel-reach');
    let reach = createReach(game, {reachDistance: 8});

    reach.on('use', function(target) {
        // right-click
        if (target){
            let x = target.voxel[0];
            let y = target.voxel[1];
            let z = target.voxel[2];
            
        }
    });

    reach.on('mining', function(target) {
        // left-click
        if (target){
            let x = target.voxel[0];
            let y = target.voxel[1];
            let z = target.voxel[2];
            console.log("mine x,y,z = ("+x+","+y+","+z+")");
            //console.log("use x,y,z = ("+x+","+y+","+z+")");
            let blockIndex = game.getBlock(target.voxel);
            let texture = allMaterials[blockIndex];
            console.log(`blockIndex = ${blockIndex}, texture = ${texture}`);
            node.textContent = texture;
            node.style.visibility = '';
        }
    });

    // return the voxel game object we created
    return [game, container];
}

//
// load a JSON drawing file
//
async function loadDrawing(evt) {
    console.log("Loading drawing!");
    // Incredibly complicated and convoluated way to read a file in JS, ugh
    let file = evt.target.files[0];

    function readFileHelp() {
        let reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onerror = () => {
                reader.abort();
                reject(reader.error);
            };
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.readAsText(file);
        });
    }

    // await needs to be enclosed in an async function, which is why
    // the function containing this is marked async
    let text = await readFileHelp();

    console.log(text);
    try {
        updateDrawing(text);
    } catch (error) {
        console.log(`error with updateDrawing: ${error}, ${typeof error}`);
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
    drawBlocks(obj.blocks);
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
module.exports.textureTable = textureTable;
// so we can do knoxel.dirt, or knoxel.cobblestone, etc
for (let material of Object.keys(materialLookup)) {
    module.exports[material.toLowerCase()] = material;
}
module.exports.waila = waila;
//module.exports.allMaterials = allMaterials;
//module.exports.materialLookup = materialLookup;