#!/bin/bash

# where to copy our source files?
# make sure directory exists
dst=../jspacco.github.io/knoxel
mkdir $dst

# browserify knoxel code into the knoxel package for import by the browser
browserify knoxel.js --s knoxel -o knoxel-bundle.js

# resources to copy recursively
tocopy="index.html knoxel-bundle.js textures css pykc images"

# necessary because we want only these 2 files, 
# but we also want the directory structure
acecode="ace-builds/src-min-noconflict/ace.js ace-builds/src-min-noconflict/theme-twilight.js ace-builds/src-min-noconflict/mode-javascript.js ace-builds/src-min-noconflict/mode-python.js ace-builds/src-min-noconflict/mode-java.js"

echo $tocopy
cp -r $tocopy $dst

echo $acecode
rsync -R $acecode $dst