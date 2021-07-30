#!/bin/bash

# This has basically become a Makefile, ugh

# where to copy our source files?
# make sure directory exists
dst=../jspacco.github.io/knoxel
mkdir $dst

# target for the pykcbase file
pykcbase=pykc/pykcbase.py

# Java BlockType enum filename
javablocktype=java/BlockType.java

# create the pykc enum for Python code
python3 makepykc.py > $pykcbase

# Create BlockType file for Java
# TODO: also create a BlueJ project, and copy it over
python3 makejava.py > $javablocktype

# browserify knoxel code into the knoxel package for import by the browser
browserify knoxel.js --s knoxel -o knoxel-bundle.js

# resources to copy recursively
tocopy="index.html knoxel-bundle.js textures css pykc images"

# necessary because we want only these 2 files, 
# but we also want the directory structure
acepath=ace-builds/src-min-noconflict
acecode="$acepath/ace.js $acepath/theme-twilight.js $acepath/mode-javascript.js $acepath/mode-python.js $acepath/mode-java.js $acepath/worker-javascript.js"

echo $tocopy
cp -r $tocopy $dst

echo $acecode
rsync -R $acecode $dst