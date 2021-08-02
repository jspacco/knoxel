const [allMaterials, materialLookup, reverseMaterialLookup, textureTable] = createMaterials();
let [width, depth, height] = [null, null, null];
let opts = {axesOn : true, debugOn: false};
let [game, waila] = makeGame();

function createMaterials() {
    let allMaterials = [];
    let materialLookup = {};
    let reverseMaterialLookup = {};

    let textures = require('./textures.json');
    for (const [name, filenames] of Object.entries(textures)) {
        allMaterials.push(filenames);
        materialLookup[name] = allMaterials.length;
        reverseMaterialLookup[allMaterials.length] = name;
    }
    // so that null maps to AIR
    // AIR should always be at index 0 in textures.json, but in case it's not
    // we will do a lookup
    //materialLookup[null] = materialLookup['AIR'];

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

    return [allMaterials, materialLookup, reverseMaterialLookup, textureTable];
}

function debug(msg) {
    if (opts.debugOn) console.log(msg);
}

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
        statsDisabled: true,
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

    //
    // create player
    //
    let createPlayer = require('voxel-player')(game);
    let player = createPlayer('./images/spacdog.png');
    player.possess();
    player.position.set(0,5,5);

    //
    // I believe I can fly!
    //
    let fly = require('voxel-fly');
    let makeFly = fly(game);
    makeFly(game.controls.target());

    //
    // highlight blocks when you look at them
    //
    let highlight = require('voxel-highlight')
    let highlightPos;
    var hl = game.highlighter = highlight(game, { color: 0xffffff , wireframeLinewidth: 20})
    hl.on('highlight', function (voxelPos) { highlightPos = voxelPos })
    hl.on('remove', function (voxelPos) { highlightPos = null })

    //
    // hacking in my own version of Deathcap's voxel-voila
    // https://github.com/voxel/voxel-voila/blob/master/voila.js
    //
    let node = document.createElement('span');
    // waila set in css/style.css
    node.className = 'waila';

    function setWaila(msg) {
        node.innerHTML = msg;
    }

    const container = document.createElement('div');
    container.className = "overlay";
    container.appendChild(node);

    // 
    // click handlers for mine/use (left/right click)
    // these should update the html span node we just created
    // 
    let createReach = require('voxel-reach');
    let reach = createReach(game, {reachDistance: 8});

    reach.on('use', function(target) {
        // right-click
        if (target){
            let x = target.voxel[0];
            let y = target.voxel[1];
            let z = target.voxel[2];
            debug(`use x,y,z = (${x}, ${y}, ${z})`);
            //debug(allMaterials);
            //debug(materialLookup);
            // do nothing on use; this is just here in case we want to add a handler for this
        }
    });

    reach.on('mining', function(target) {
        // left-click
        if (target){
            let x = target.voxel[0];
            let y = target.voxel[1];
            let z = target.voxel[2];
            
            // GODDAMMIT! blocks in the game are apparently indexed starting at 1 rather than 0
            let blockIndex = game.getBlock(target.voxel);
            let blockType = reverseMaterialLookup[blockIndex];

            let msg = blockType.toLowerCase();
            let [w, d, h] = game2CodeCoords(x, y, z);

            if (width != null && depth != null && height != null && 
                w >= 0 && w < width &&
                d >= 0 && d < depth &&
                h >= 0 && h < height)
            {
                // if we are in range of our drawing, clicking shows the coords in code-space
                msg += `<br>blocks[${w}][${d}][${h}]`;
            }
            debug(`mine x,y,z = (${x}, ${y}, ${z}) blockIndex = ${blockIndex}, blockType = ${blockType}, waila width=${width}, depth=${depth}, height=${height}`);
            setWaila(msg);
            node.style.setProperty('visibility', 'visible', 'important');
        }
    });

    // return the voxel game object we created
    return [game, container];
}

//
// load a JSON drawing file
//
async function loadDrawing(evt) {
    debug("Loading drawing!");
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

    try {
        updateDrawing(text);
    } catch (error) {
        debug(`error with updateDrawing: ${error}, ${typeof error}`);
        throw error;
    }
}
  
function updateDrawing(result) {
    let obj = JSON.parse(result);
    depth = parseInt(obj.depth);
    width = parseInt(obj.width);
    height = parseInt(obj.height);
    //debug(`upload drawing with width = ${obj.width}, depth=${depth}, height=${height}`);
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

function code2GameCoords(w, d, h) {
    // map from x,z,y in 3D array coords to x,y+1,-z in game coords
    // this is just x, y+1, -z
    return [w, -d, h+1];
}

function game2CodeCoords(x, y, z) {
    return [x, -z, y-1];
}

// TODO: pick up here! set up the axes
function makeAxes() {
    function getNum(val) {
        return `num${val}`;
    }

    if (width == null || depth == null || height == null) return;
    
    // x labels
    for (let x=0; x<width; x++) {
        if (x > 99) {
            // 100 to 999
            let digit3 = Math.floor(x / 100);
            game.setBlock([x, 0, 1], getNum(digit3));
            let digit2 = Math.floor(x / 10) % 10;
            game.setBlock([x, 0, 2], getNum(digit2));
            let digit1 = x % 10;
            game.setBlock([x, 0, 3], getNum(digit1));
        } else if (x > 9) {
            // 10 to 99
            let digit2 = Math.floor(x / 10);
            game.setBlock([x, 0, 1], getNum(digit2));
            let digit1 = x % 10;
            game.setBlock([x, 0, 2], getNum(digit1));
        } else {
            // x from 0 to 9
            game.setBlock([x, 0, 1], getNum(x));
        }
    }

    // z labels
    for (let z=0; z<depth; z++) {
        if (z > 99) {
            // 100 to 999
            let digit3 = Math.floor(z / 100);
            game.setBlock([-1, 0, -z], getNum(digit3));
            let digit2 = Math.floor(z / 10) % 10;
            game.setBlock([-2, 0, -z], getNum(digit2));
            let digit1 = z % 10;
            game.setBlock([-3, 0, -z], getNum(digit1));
        } else if (z > 9) {
            // 10 to 99
            let digit2 = Math.floor(z / 10) % 10;
            game.setBlock([-1, 0, -z], getNum(digit2));
            let digit1 = z % 10;
            game.setBlock([-2, 0, -z], getNum(digit1));
        } else {
            // x from 0 to 9
            game.setBlock([-1, 0, -z], getNum(z));
        }
    }

    // y labels
    for (let y=0; y<height; y++) {
        if (y > 99) {
            // 100 to 999
            let digit3 = Math.floor(y / 100);
            game.setBlock([-1, y+1, 1], getNum(digit3));
            let digit2 = Math.floor(y / 10) % 10;
            game.setBlock([0, y+1, 1], getNum(digit2));
            let digit1 = y % 10;
            game.setBlock([1, y+1, 1], getNum(digit1));
        } else if (y > 9) {
            // 10 to 99
            let digit2 = Math.floor(y / 10) % 10;
            game.setBlock([-1, y+1, 1], getNum(digit2));
            let digit1 = y % 10;
            game.setBlock([0, y+1, 1], getNum(digit1));
        } else {
            // 0 to 9
            game.setBlock([-1, y+1, 1], getNum(y));
        }
    }
}

const drawBlocks = function(blocks) {
    width = blocks.length;
    depth = blocks[0].length;
    height = blocks[0][0].length;
    // x is width
    for (let x = 0; x < blocks.length; x++) {
        // z is depth
        for (let z = 0; z < blocks[x].length; z++){
            // y is height
            for (let y = 0; y < blocks[x][z].length; y++){
                let block = blocks[x][z][y];
                if (block == null) {
                    // map null to AIR
                    block = 0;
                }
                debug(`set block ${x}, ${z}, ${y}, coords (${x}, ${y+1}, ${-z}) to ${materialLookup[blocks[x][z][y]]} ${allMaterials[materialLookup[block]] }`);
                game.setBlock([x, y+1, -z], materialLookup[block]);
            }
        }
    }
    // should we draw axes?
    if (opts.axesOn) makeAxes();
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
module.exports.opts = opts;
//module.exports.allMaterials = allMaterials;
//module.exports.materialLookup = materialLookup;