#!/usr/bin/env node
/**
 * build-atlas.js
 *
 * Generates atlas.png and atlas.ts from Faithful 32x block textures.
 *
 * Usage:
 *   node scripts/build-atlas.js <path-to-faithful-block-textures>
 *
 * Example:
 *   node scripts/build-atlas.js ~/Downloads/Faithful-32x-1.21.8/assets/minecraft/textures/block
 *
 * Outputs:
 *   client/public/textures/atlas.png   — 1024x1024 texture atlas
 *   client/src/lib/atlas.ts            — TypeScript block → atlas index map
 *
 * Dependencies:
 *   npm install sharp   (run once in project root)
 *
 * The Faithful 32x repository for 1.21.8 is at:
 *   https://github.com/Faithful-Resource-Pack/Faithful-32x-Java
 *   git checkout 1.21.8
 *   Block textures are in: assets/minecraft/textures/block/
 *
 * ADDING NEW BLOCKS:
 *   1. Add the minecraft: ID to ALLOW_LIST below
 *   2. If the block has different top/side/bottom textures, add it to MULTI_FACE_BLOCKS
 *   3. Re-run this script
 *   4. Commit the updated atlas.png and atlas.ts
 *
 * UPDATING TO A NEW MC VERSION:
 *   1. git checkout <new-version> in the Faithful repo
 *   2. Re-run this script pointing at the new textures folder
 *   3. Commit the updated atlas.png and atlas.ts
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// ─────────────────────────────────────────────────────────────────────────────
// ATLAS DIMENSIONS
// 32 columns × 32 rows = 1024 slots, each 32×32px → 1024×1024 PNG
// ─────────────────────────────────────────────────────────────────────────────
const TILE_PX   = 32
const ATLAS_COLS = 32
const ATLAS_ROWS = 32
const ATLAS_PX   = TILE_PX * ATLAS_COLS  // 1024

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-FACE BLOCKS
// Blocks where top, side, and bottom use different texture files.
// Key is the minecraft: block ID.
// Values are filenames (without .png) relative to the block texture folder.
// Most blocks just use one texture on all faces and don't need to be listed here.
// ─────────────────────────────────────────────────────────────────────────────
const MULTI_FACE_BLOCKS = {
  'minecraft:grass_block':          { top: 'grass_block_top',          side: 'grass_block_side',          bottom: 'dirt' },
  'minecraft:mycelium':             { top: 'mycelium_top',             side: 'mycelium_side',             bottom: 'dirt' },
  'minecraft:podzol':               { top: 'podzol_top',               side: 'podzol_side',               bottom: 'dirt' },
  'minecraft:crimson_nylium':       { top: 'crimson_nylium',           side: 'netherrack',                bottom: 'netherrack' },
  'minecraft:warped_nylium':        { top: 'warped_nylium',            side: 'netherrack',                bottom: 'netherrack' },
  'minecraft:oak_log':              { top: 'oak_log_top',              side: 'oak_log',                   bottom: 'oak_log_top' },
  'minecraft:birch_log':            { top: 'birch_log_top',            side: 'birch_log',                 bottom: 'birch_log_top' },
  'minecraft:spruce_log':           { top: 'spruce_log_top',           side: 'spruce_log',                bottom: 'spruce_log_top' },
  'minecraft:jungle_log':           { top: 'jungle_log_top',           side: 'jungle_log',                bottom: 'jungle_log_top' },
  'minecraft:acacia_log':           { top: 'acacia_log_top',           side: 'acacia_log',                bottom: 'acacia_log_top' },
  'minecraft:dark_oak_log':         { top: 'dark_oak_log_top',         side: 'dark_oak_log',              bottom: 'dark_oak_log_top' },
  'minecraft:mangrove_log':         { top: 'mangrove_log_top',         side: 'mangrove_log',              bottom: 'mangrove_log_top' },
  'minecraft:cherry_log':           { top: 'cherry_log_top',           side: 'cherry_log',                bottom: 'cherry_log_top' },
  'minecraft:pale_oak_log':         { top: 'pale_oak_log_top',         side: 'pale_oak_log',              bottom: 'pale_oak_log_top' },
  'minecraft:stripped_oak_log':     { top: 'stripped_oak_log_top',     side: 'stripped_oak_log',          bottom: 'stripped_oak_log_top' },
  'minecraft:stripped_birch_log':   { top: 'stripped_birch_log_top',   side: 'stripped_birch_log',        bottom: 'stripped_birch_log_top' },
  'minecraft:stripped_spruce_log':  { top: 'stripped_spruce_log_top',  side: 'stripped_spruce_log',       bottom: 'stripped_spruce_log_top' },
  'minecraft:stripped_jungle_log':  { top: 'stripped_jungle_log_top',  side: 'stripped_jungle_log',       bottom: 'stripped_jungle_log_top' },
  'minecraft:stripped_acacia_log':  { top: 'stripped_acacia_log_top',  side: 'stripped_acacia_log',       bottom: 'stripped_acacia_log_top' },
  'minecraft:stripped_dark_oak_log':{ top: 'stripped_dark_oak_log_top',side: 'stripped_dark_oak_log',     bottom: 'stripped_dark_oak_log_top' },
  'minecraft:stripped_mangrove_log':{ top: 'stripped_mangrove_log_top',side: 'stripped_mangrove_log',     bottom: 'stripped_mangrove_log_top' },
  'minecraft:stripped_cherry_log':  { top: 'stripped_cherry_log_top',  side: 'stripped_cherry_log',       bottom: 'stripped_cherry_log_top' },
  'minecraft:stripped_pale_oak_log':{ top: 'stripped_pale_oak_log_top',side: 'stripped_pale_oak_log',     bottom: 'stripped_pale_oak_log_top' },
  'minecraft:crimson_stem':         { top: 'crimson_stem_top',         side: 'crimson_stem',              bottom: 'crimson_stem_top' },
  'minecraft:warped_stem':          { top: 'warped_stem_top',          side: 'warped_stem',               bottom: 'warped_stem_top' },
  'minecraft:bamboo_block':         { top: 'bamboo_block_top',         side: 'bamboo_block',              bottom: 'bamboo_block_top' },
  'minecraft:hay_block':            { top: 'hay_block_top',            side: 'hay_block_side',            bottom: 'hay_block_top' },
  'minecraft:bone_block':           { top: 'bone_block_top',           side: 'bone_block_side',           bottom: 'bone_block_top' },
  'minecraft:quartz_pillar':        { top: 'quartz_pillar_top',        side: 'quartz_pillar',             bottom: 'quartz_pillar_top' },
  'minecraft:purpur_pillar':        { top: 'purpur_pillar_top',        side: 'purpur_pillar',             bottom: 'purpur_pillar_top' },
  'minecraft:polished_basalt':      { top: 'polished_basalt_top',      side: 'polished_basalt_side',      bottom: 'polished_basalt_top' },
  'minecraft:basalt':               { top: 'basalt_top',               side: 'basalt_side',               bottom: 'basalt_top' },
  'minecraft:deepslate':            { top: 'deepslate_top',            side: 'deepslate',                 bottom: 'deepslate_top' },
  'minecraft:chiseled_quartz_block':{ top: 'chiseled_quartz_block_top',side: 'chiseled_quartz_block',     bottom: 'chiseled_quartz_block_top' },
  'minecraft:sandstone':            { top: 'sandstone_top',            side: 'sandstone',                 bottom: 'sandstone_bottom' },
  'minecraft:red_sandstone':        { top: 'red_sandstone_top',        side: 'red_sandstone',             bottom: 'red_sandstone_bottom' },
  'minecraft:smooth_sandstone':     { top: 'sandstone_top',            side: 'smooth_sandstone',          bottom: 'sandstone_bottom' },
  'minecraft:smooth_red_sandstone': { top: 'red_sandstone_top',        side: 'smooth_red_sandstone',      bottom: 'red_sandstone_bottom' },
  'minecraft:observer':             { top: 'observer_top',             side: 'observer_side',             bottom: 'observer_back' },
  'minecraft:piston':               { top: 'piston_top_normal',        side: 'piston_side',               bottom: 'piston_bottom' },
  'minecraft:sticky_piston':        { top: 'piston_top_sticky',        side: 'piston_side',               bottom: 'piston_bottom' },
  'minecraft:dispenser':            { top: 'furnace_top',              side: 'dispenser_front_horizontal', bottom: 'furnace_top' },
  'minecraft:dropper':              { top: 'furnace_top',              side: 'dropper_front_horizontal',   bottom: 'furnace_top' },
  'minecraft:furnace':              { top: 'furnace_top',              side: 'furnace_front_off',          bottom: 'furnace_top' },
  'minecraft:blast_furnace':        { top: 'blast_furnace_top',        side: 'blast_furnace_front_off',    bottom: 'blast_furnace_top' },
  'minecraft:smoker':               { top: 'smoker_top',               side: 'smoker_front_off',           bottom: 'smoker_bottom' },
  'minecraft:crafting_table':       { top: 'crafting_table_top',       side: 'crafting_table_side',        bottom: 'oak_planks' },
  'minecraft:loom':                 { top: 'loom_top',                 side: 'loom_side',                  bottom: 'loom_bottom' },
  'minecraft:cartography_table':    { top: 'cartography_table_top',    side: 'cartography_table_side1',    bottom: 'dark_oak_planks' },
  'minecraft:fletching_table':      { top: 'fletching_table_top',      side: 'fletching_table_front',      bottom: 'birch_planks' },
  'minecraft:smithing_table':       { top: 'smithing_table_top',       side: 'smithing_table_front',       bottom: 'smithing_table_bottom' },
  'minecraft:jukebox':              { top: 'jukebox_top',              side: 'jukebox_side',               bottom: 'jukebox_side' },
  'minecraft:note_block':           { top: 'note_block',               side: 'note_block',                 bottom: 'note_block' },
  'minecraft:bookshelf':            { top: 'oak_planks',               side: 'bookshelf',                  bottom: 'oak_planks' },
  'minecraft:chiseled_bookshelf':   { top: 'chiseled_bookshelf_top',   side: 'chiseled_bookshelf',         bottom: 'chiseled_bookshelf_top' },
  'minecraft:lectern':              { top: 'lectern_top',              side: 'lectern_sides',              bottom: 'lectern_base' },
  'minecraft:beacon':               { top: 'beacon',                   side: 'beacon',                     bottom: 'obsidian' },
  'minecraft:jack_o_lantern':       { top: 'pumpkin_top',              side: 'jack_o_lantern',             bottom: 'pumpkin_bottom' },
  'minecraft:pumpkin':              { top: 'pumpkin_top',              side: 'pumpkin_side',               bottom: 'pumpkin_bottom' },
  'minecraft:melon':                { top: 'melon_top',                side: 'melon_side',                 bottom: 'melon_top' },
  'minecraft:barrel':               { top: 'barrel_top',               side: 'barrel_side',                bottom: 'barrel_bottom' },
  'minecraft:chest':                { top: 'chest_top',                side: 'chest_front',                bottom: 'chest_bottom' },
  'minecraft:ender_chest':          { top: 'ender_chest_top',          side: 'ender_chest_front',          bottom: 'ender_chest_bottom' },
  'minecraft:tnt':                  { top: 'tnt_top',                  side: 'tnt_side',                   bottom: 'tnt_bottom' },
  'minecraft:sponge':               { top: 'sponge',                   side: 'sponge',                     bottom: 'sponge' },
  'minecraft:wet_sponge':           { top: 'wet_sponge',               side: 'wet_sponge',                 bottom: 'wet_sponge' },
  'minecraft:dried_kelp_block':     { top: 'dried_kelp_top',           side: 'dried_kelp_side',            bottom: 'dried_kelp_bottom' },
  'minecraft:chiseled_sandstone':   { top: 'sandstone_top',            side: 'chiseled_sandstone',         bottom: 'sandstone_bottom' },
  'minecraft:cut_sandstone':        { top: 'sandstone_top',            side: 'cut_sandstone',              bottom: 'sandstone_bottom' },
  'minecraft:chiseled_red_sandstone':{ top: 'red_sandstone_top',       side: 'chiseled_red_sandstone',     bottom: 'red_sandstone_bottom' },
  'minecraft:cut_red_sandstone':    { top: 'red_sandstone_top',        side: 'cut_red_sandstone',          bottom: 'red_sandstone_bottom' },
  // Skulls/heads — use most recognizable face on all sides
  'minecraft:skeleton_skull':       { top: 'skeleton_skull',           side: 'skeleton_skull',             bottom: 'skeleton_skull' },
  'minecraft:wither_skeleton_skull':{ top: 'wither_skeleton_skull',    side: 'wither_skeleton_skull',      bottom: 'wither_skeleton_skull' },
  'minecraft:zombie_head':          { top: 'zombie_head',              side: 'zombie_head',                bottom: 'zombie_head' },
  'minecraft:creeper_head':         { top: 'creeper_head',             side: 'creeper_head',               bottom: 'creeper_head' },
  'minecraft:piglin_head':          { top: 'piglin_head',              side: 'piglin_head',                bottom: 'piglin_head' },
  'minecraft:player_head':          { top: 'player_head',              side: 'player_head',                bottom: 'player_head' },
  'minecraft:dragon_head':          { top: 'dragon_head',              side: 'dragon_head',                bottom: 'dragon_head' },
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLOW LIST
// The set of blocks that make sense as voxels in Knoxel.
// Excludes: torches, flowers, saplings, rails, ladders, doors, beds,
//           banners, signs, pressure plates, buttons, and other non-solid blocks.
// Edit this list to add/remove blocks. Re-run the script after changes.
// Blocks are assigned atlas indices in the order they appear here.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOW_LIST = [
  // ── STONE & ROCK ──────────────────────────────────────────────────────────
  'minecraft:stone',
  'minecraft:smooth_stone',
  'minecraft:cobblestone',
  'minecraft:mossy_cobblestone',
  'minecraft:stone_bricks',
  'minecraft:mossy_stone_bricks',
  'minecraft:cracked_stone_bricks',
  'minecraft:chiseled_stone_bricks',
  'minecraft:granite',
  'minecraft:polished_granite',
  'minecraft:diorite',
  'minecraft:polished_diorite',
  'minecraft:andesite',
  'minecraft:polished_andesite',
  'minecraft:calcite',
  'minecraft:tuff',
  'minecraft:tuff_bricks',
  'minecraft:chiseled_tuff',
  'minecraft:chiseled_tuff_bricks',
  'minecraft:polished_tuff',

  // ── DIRT & GROUND ─────────────────────────────────────────────────────────
  'minecraft:dirt',
  'minecraft:coarse_dirt',
  'minecraft:rooted_dirt',
  'minecraft:grass_block',
  'minecraft:podzol',
  'minecraft:mycelium',
  'minecraft:mud',
  'minecraft:packed_mud',
  'minecraft:mud_bricks',
  'minecraft:gravel',
  'minecraft:clay',

  // ── SAND ──────────────────────────────────────────────────────────────────
  'minecraft:sand',
  'minecraft:red_sand',
  'minecraft:sandstone',
  'minecraft:chiseled_sandstone',
  'minecraft:cut_sandstone',
  'minecraft:smooth_sandstone',
  'minecraft:red_sandstone',
  'minecraft:chiseled_red_sandstone',
  'minecraft:cut_red_sandstone',
  'minecraft:smooth_red_sandstone',

  // ── WOOD (OAK) ────────────────────────────────────────────────────────────
  'minecraft:oak_planks',
  'minecraft:oak_log',
  'minecraft:oak_wood',
  'minecraft:stripped_oak_log',
  'minecraft:stripped_oak_wood',
  'minecraft:oak_leaves',

  // ── WOOD (BIRCH) ──────────────────────────────────────────────────────────
  'minecraft:birch_planks',
  'minecraft:birch_log',
  'minecraft:birch_wood',
  'minecraft:stripped_birch_log',
  'minecraft:stripped_birch_wood',
  'minecraft:birch_leaves',

  // ── WOOD (SPRUCE) ─────────────────────────────────────────────────────────
  'minecraft:spruce_planks',
  'minecraft:spruce_log',
  'minecraft:spruce_wood',
  'minecraft:stripped_spruce_log',
  'minecraft:stripped_spruce_wood',
  'minecraft:spruce_leaves',

  // ── WOOD (JUNGLE) ─────────────────────────────────────────────────────────
  'minecraft:jungle_planks',
  'minecraft:jungle_log',
  'minecraft:jungle_wood',
  'minecraft:stripped_jungle_log',
  'minecraft:stripped_jungle_wood',
  'minecraft:jungle_leaves',

  // ── WOOD (ACACIA) ─────────────────────────────────────────────────────────
  'minecraft:acacia_planks',
  'minecraft:acacia_log',
  'minecraft:acacia_wood',
  'minecraft:stripped_acacia_log',
  'minecraft:stripped_acacia_wood',
  'minecraft:acacia_leaves',

  // ── WOOD (DARK OAK) ───────────────────────────────────────────────────────
  'minecraft:dark_oak_planks',
  'minecraft:dark_oak_log',
  'minecraft:dark_oak_wood',
  'minecraft:stripped_dark_oak_log',
  'minecraft:stripped_dark_oak_wood',
  'minecraft:dark_oak_leaves',

  // ── WOOD (MANGROVE) ───────────────────────────────────────────────────────
  'minecraft:mangrove_planks',
  'minecraft:mangrove_log',
  'minecraft:mangrove_wood',
  'minecraft:stripped_mangrove_log',
  'minecraft:stripped_mangrove_wood',
  'minecraft:mangrove_leaves',

  // ── WOOD (CHERRY) ─────────────────────────────────────────────────────────
  'minecraft:cherry_planks',
  'minecraft:cherry_log',
  'minecraft:cherry_wood',
  'minecraft:stripped_cherry_log',
  'minecraft:stripped_cherry_wood',
  'minecraft:cherry_leaves',

  // ── WOOD (PALE OAK) ───────────────────────────────────────────────────────
  'minecraft:pale_oak_planks',
  'minecraft:pale_oak_log',
  'minecraft:pale_oak_wood',
  'minecraft:stripped_pale_oak_log',
  'minecraft:stripped_pale_oak_wood',
  'minecraft:pale_oak_leaves',
  'minecraft:pale_moss_block',

  // ── WOOD (BAMBOO) ─────────────────────────────────────────────────────────
  'minecraft:bamboo_planks',
  'minecraft:bamboo_mosaic',
  'minecraft:bamboo_block',
  'minecraft:stripped_bamboo_block',

  // ── NETHER WOOD ───────────────────────────────────────────────────────────
  'minecraft:crimson_planks',
  'minecraft:crimson_stem',
  'minecraft:crimson_hyphae',
  'minecraft:stripped_crimson_stem',
  'minecraft:stripped_crimson_hyphae',
  'minecraft:crimson_nylium',
  'minecraft:warped_planks',
  'minecraft:warped_stem',
  'minecraft:warped_hyphae',
  'minecraft:stripped_warped_stem',
  'minecraft:stripped_warped_hyphae',
  'minecraft:warped_nylium',
  'minecraft:nether_wart_block',
  'minecraft:shroomlight',

  // ── GLASS ─────────────────────────────────────────────────────────────────
  'minecraft:glass',
  'minecraft:tinted_glass',
  'minecraft:white_stained_glass',
  'minecraft:orange_stained_glass',
  'minecraft:magenta_stained_glass',
  'minecraft:light_blue_stained_glass',
  'minecraft:yellow_stained_glass',
  'minecraft:lime_stained_glass',
  'minecraft:pink_stained_glass',
  'minecraft:gray_stained_glass',
  'minecraft:light_gray_stained_glass',
  'minecraft:cyan_stained_glass',
  'minecraft:purple_stained_glass',
  'minecraft:blue_stained_glass',
  'minecraft:brown_stained_glass',
  'minecraft:green_stained_glass',
  'minecraft:red_stained_glass',
  'minecraft:black_stained_glass',

  // ── WOOL ──────────────────────────────────────────────────────────────────
  'minecraft:white_wool',
  'minecraft:orange_wool',
  'minecraft:magenta_wool',
  'minecraft:light_blue_wool',
  'minecraft:yellow_wool',
  'minecraft:lime_wool',
  'minecraft:pink_wool',
  'minecraft:gray_wool',
  'minecraft:light_gray_wool',
  'minecraft:cyan_wool',
  'minecraft:purple_wool',
  'minecraft:blue_wool',
  'minecraft:brown_wool',
  'minecraft:green_wool',
  'minecraft:red_wool',
  'minecraft:black_wool',

  // ── CONCRETE ──────────────────────────────────────────────────────────────
  'minecraft:white_concrete',
  'minecraft:orange_concrete',
  'minecraft:magenta_concrete',
  'minecraft:light_blue_concrete',
  'minecraft:yellow_concrete',
  'minecraft:lime_concrete',
  'minecraft:pink_concrete',
  'minecraft:gray_concrete',
  'minecraft:light_gray_concrete',
  'minecraft:cyan_concrete',
  'minecraft:purple_concrete',
  'minecraft:blue_concrete',
  'minecraft:brown_concrete',
  'minecraft:green_concrete',
  'minecraft:red_concrete',
  'minecraft:black_concrete',

  // ── CONCRETE POWDER ───────────────────────────────────────────────────────
  'minecraft:white_concrete_powder',
  'minecraft:orange_concrete_powder',
  'minecraft:magenta_concrete_powder',
  'minecraft:light_blue_concrete_powder',
  'minecraft:yellow_concrete_powder',
  'minecraft:lime_concrete_powder',
  'minecraft:pink_concrete_powder',
  'minecraft:gray_concrete_powder',
  'minecraft:light_gray_concrete_powder',
  'minecraft:cyan_concrete_powder',
  'minecraft:purple_concrete_powder',
  'minecraft:blue_concrete_powder',
  'minecraft:brown_concrete_powder',
  'minecraft:green_concrete_powder',
  'minecraft:red_concrete_powder',
  'minecraft:black_concrete_powder',

  // ── TERRACOTTA (plain) ────────────────────────────────────────────────────
  'minecraft:terracotta',
  'minecraft:white_terracotta',
  'minecraft:orange_terracotta',
  'minecraft:magenta_terracotta',
  'minecraft:light_blue_terracotta',
  'minecraft:yellow_terracotta',
  'minecraft:lime_terracotta',
  'minecraft:pink_terracotta',
  'minecraft:gray_terracotta',
  'minecraft:light_gray_terracotta',
  'minecraft:cyan_terracotta',
  'minecraft:purple_terracotta',
  'minecraft:blue_terracotta',
  'minecraft:brown_terracotta',
  'minecraft:green_terracotta',
  'minecraft:red_terracotta',
  'minecraft:black_terracotta',

  // ── GLAZED TERRACOTTA ─────────────────────────────────────────────────────
  'minecraft:white_glazed_terracotta',
  'minecraft:orange_glazed_terracotta',
  'minecraft:magenta_glazed_terracotta',
  'minecraft:light_blue_glazed_terracotta',
  'minecraft:yellow_glazed_terracotta',
  'minecraft:lime_glazed_terracotta',
  'minecraft:pink_glazed_terracotta',
  'minecraft:gray_glazed_terracotta',
  'minecraft:light_gray_glazed_terracotta',
  'minecraft:cyan_glazed_terracotta',
  'minecraft:purple_glazed_terracotta',
  'minecraft:blue_glazed_terracotta',
  'minecraft:brown_glazed_terracotta',
  'minecraft:green_glazed_terracotta',
  'minecraft:red_glazed_terracotta',
  'minecraft:black_glazed_terracotta',

  // ── METAL & MINERAL BLOCKS ────────────────────────────────────────────────
  'minecraft:iron_block',
  'minecraft:gold_block',
  'minecraft:diamond_block',
  'minecraft:emerald_block',
  'minecraft:lapis_block',
  'minecraft:redstone_block',
  'minecraft:coal_block',
  'minecraft:netherite_block',
  'minecraft:copper_block',
  'minecraft:exposed_copper',
  'minecraft:weathered_copper',
  'minecraft:oxidized_copper',
  'minecraft:cut_copper',
  'minecraft:exposed_cut_copper',
  'minecraft:weathered_cut_copper',
  'minecraft:oxidized_cut_copper',
  'minecraft:waxed_copper_block',
  'minecraft:waxed_exposed_copper',
  'minecraft:waxed_weathered_copper',
  'minecraft:waxed_oxidized_copper',
  'minecraft:raw_iron_block',
  'minecraft:raw_gold_block',
  'minecraft:raw_copper_block',
  'minecraft:amethyst_block',
  'minecraft:budding_amethyst',

  // ── ORES ──────────────────────────────────────────────────────────────────
  'minecraft:coal_ore',
  'minecraft:deepslate_coal_ore',
  'minecraft:iron_ore',
  'minecraft:deepslate_iron_ore',
  'minecraft:copper_ore',
  'minecraft:deepslate_copper_ore',
  'minecraft:gold_ore',
  'minecraft:deepslate_gold_ore',
  'minecraft:redstone_ore',
  'minecraft:deepslate_redstone_ore',
  'minecraft:lapis_ore',
  'minecraft:deepslate_lapis_ore',
  'minecraft:diamond_ore',
  'minecraft:deepslate_diamond_ore',
  'minecraft:emerald_ore',
  'minecraft:deepslate_emerald_ore',
  'minecraft:nether_gold_ore',
  'minecraft:nether_quartz_ore',
  'minecraft:ancient_debris',

  // ── DEEPSLATE ─────────────────────────────────────────────────────────────
  'minecraft:deepslate',
  'minecraft:cobbled_deepslate',
  'minecraft:polished_deepslate',
  'minecraft:chiseled_deepslate',
  'minecraft:deepslate_bricks',
  'minecraft:cracked_deepslate_bricks',
  'minecraft:deepslate_tiles',
  'minecraft:cracked_deepslate_tiles',

  // ── BRICKS ────────────────────────────────────────────────────────────────
  'minecraft:bricks',
  'minecraft:nether_bricks',
  'minecraft:cracked_nether_bricks',
  'minecraft:chiseled_nether_bricks',
  'minecraft:red_nether_bricks',
  'minecraft:end_stone_bricks',
  'minecraft:blackstone',
  'minecraft:polished_blackstone',
  'minecraft:polished_blackstone_bricks',
  'minecraft:cracked_polished_blackstone_bricks',
  'minecraft:chiseled_polished_blackstone',
  'minecraft:gilded_blackstone',

  // ── QUARTZ ────────────────────────────────────────────────────────────────
  'minecraft:quartz_block',
  'minecraft:quartz_bricks',
  'minecraft:quartz_pillar',
  'minecraft:chiseled_quartz_block',
  'minecraft:smooth_quartz',

  // ── NETHER ────────────────────────────────────────────────────────────────
  'minecraft:netherrack',
  'minecraft:soul_sand',
  'minecraft:soul_soil',
  'minecraft:glowstone',
  'minecraft:magma_block',
  'minecraft:crying_obsidian',
  'minecraft:basalt',
  'minecraft:polished_basalt',
  'minecraft:smooth_basalt',

  // ── END ───────────────────────────────────────────────────────────────────
  'minecraft:end_stone',
  'minecraft:purpur_block',
  'minecraft:purpur_pillar',

  // ── ICE & SNOW ────────────────────────────────────────────────────────────
  'minecraft:ice',
  'minecraft:packed_ice',
  'minecraft:blue_ice',
  'minecraft:snow_block',

  // ── SPECIAL & FUNCTIONAL ──────────────────────────────────────────────────
  'minecraft:obsidian',
  'minecraft:bedrock',
  'minecraft:tnt',
  'minecraft:sponge',
  'minecraft:wet_sponge',
  'minecraft:hay_block',
  'minecraft:bone_block',
  'minecraft:dried_kelp_block',
  'minecraft:honeycomb_block',
  'minecraft:honey_block',
  'minecraft:slime_block',
  'minecraft:moss_block',
  'minecraft:bookshelf',
  'minecraft:chiseled_bookshelf',
  'minecraft:crafting_table',
  'minecraft:furnace',
  'minecraft:blast_furnace',
  'minecraft:smoker',
  'minecraft:dispenser',
  'minecraft:dropper',
  'minecraft:chest',
  'minecraft:ender_chest',
  'minecraft:barrel',
  'minecraft:beacon',
  'minecraft:jukebox',
  'minecraft:note_block',
  'minecraft:observer',
  'minecraft:piston',
  'minecraft:sticky_piston',
  'minecraft:loom',
  'minecraft:cartography_table',
  'minecraft:fletching_table',
  'minecraft:smithing_table',
  'minecraft:lectern',
  'minecraft:jack_o_lantern',
  'minecraft:pumpkin',
  'minecraft:melon',
  'minecraft:sea_lantern',
  'minecraft:prismarine',
  'minecraft:prismarine_bricks',
  'minecraft:dark_prismarine',

  // ── SKULLS / HEADS (rendered as full cube) ────────────────────────────────
  'minecraft:skeleton_skull',
  'minecraft:wither_skeleton_skull',
  'minecraft:zombie_head',
  'minecraft:creeper_head',
  'minecraft:piglin_head',
  'minecraft:player_head',
  'minecraft:dragon_head',
]

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK TEXTURES
// For blocks where the expected filename doesn't match a simple derivation.
// Maps minecraft: ID → texture filename (without .png)
// Only needed when the ID → filename rule doesn't produce the right name.
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_TEXTURES = {
  'minecraft:grass_block':              'grass_block_side',  // side used as default for single-face fallback
  'minecraft:oak_leaves':               'oak_leaves',
  'minecraft:birch_leaves':             'birch_leaves',
  'minecraft:spruce_leaves':            'spruce_leaves',
  'minecraft:jungle_leaves':            'jungle_leaves',
  'minecraft:acacia_leaves':            'acacia_leaves',
  'minecraft:dark_oak_leaves':          'dark_oak_leaves',
  'minecraft:mangrove_leaves':          'mangrove_leaves',
  'minecraft:cherry_leaves':            'cherry_leaves',
  'minecraft:pale_oak_leaves':          'pale_oak_leaves',
  'minecraft:white_carpet':             'white_wool',
  'minecraft:orange_carpet':            'orange_wool',
  'minecraft:magenta_carpet':           'magenta_wool',
  'minecraft:light_blue_carpet':        'light_blue_wool',
  'minecraft:yellow_carpet':            'yellow_wool',
  'minecraft:lime_carpet':              'lime_wool',
  'minecraft:pink_carpet':              'pink_wool',
  'minecraft:gray_carpet':              'gray_wool',
  'minecraft:light_gray_carpet':        'light_gray_wool',
  'minecraft:cyan_carpet':              'cyan_wool',
  'minecraft:purple_carpet':            'purple_wool',
  'minecraft:blue_carpet':              'blue_wool',
  'minecraft:brown_carpet':             'brown_wool',
  'minecraft:green_carpet':             'green_wool',
  'minecraft:red_carpet':               'red_wool',
  'minecraft:black_carpet':             'black_wool',
  'minecraft:lapis_block':              'lapis_block',
  'minecraft:iron_block':               'iron_block',
  'minecraft:gold_block':               'gold_block',
  'minecraft:diamond_block':            'diamond_block',
  'minecraft:emerald_block':            'emerald_block',
  'minecraft:coal_block':               'coal_block',
  'minecraft:redstone_block':           'redstone_block',
  'minecraft:netherite_block':          'netherite_block',
  'minecraft:amethyst_block':           'amethyst_block',
  'minecraft:prismarine':               'prismarine',
  'minecraft:prismarine_bricks':        'prismarine_bricks',
  'minecraft:dark_prismarine':          'dark_prismarine',
  'minecraft:sea_lantern':              'sea_lantern',
  'minecraft:bricks':                   'bricks',
  'minecraft:nether_bricks':            'nether_bricks',
  'minecraft:red_nether_bricks':        'red_nether_bricks',
  'minecraft:end_stone_bricks':         'end_stone_bricks',
  'minecraft:obsidian':                 'obsidian',
  'minecraft:bedrock':                  'bedrock',
  'minecraft:glowstone':                'glowstone',
  'minecraft:magma_block':              'magma',
  'minecraft:honey_block':              'honey_block_side',
  'minecraft:slime_block':              'slime_block',
  'minecraft:moss_block':               'moss_block',
  'minecraft:crying_obsidian':          'crying_obsidian',
  'minecraft:budding_amethyst':         'budding_amethyst',
  'minecraft:ancient_debris':           'ancient_debris_top',
  'minecraft:skeleton_skull':           'skeleton_skull',
  'minecraft:wither_skeleton_skull':    'wither_skeleton_skull',
  'minecraft:zombie_head':              'zombie_head',
  'minecraft:creeper_head':             'creeper_head',
  'minecraft:piglin_head':              'piglin_head',
  'minecraft:player_head':              'player_head',
  'minecraft:dragon_head':              'dragon_head',
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert 'minecraft:dark_prismarine' → 'dark_prismarine' */
function blockIdToBaseName(blockId) {
  return blockId.replace('minecraft:', '')
}

/** Look up texture filename for a block, checking fallbacks */
function resolveTextureName(blockId) {
  if (FALLBACK_TEXTURES[blockId]) return FALLBACK_TEXTURES[blockId]
  return blockIdToBaseName(blockId)
}

/** Resolve a texture filename to a full path, checking the textures folder */
function resolveTexturePath(texturesDir, textureName) {
  const p = path.join(texturesDir, `${textureName}.png`)
  if (fs.existsSync(p)) return p
  // Some animated textures have a different base — just return null if missing
  return null
}

/** Convert atlas index to UV coordinates */
function indexToUV(index) {
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  return { u: col / ATLAS_COLS, v: row / ATLAS_COLS }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const texturesDir = process.argv[2]
  if (!texturesDir) {
    console.error('Usage: node scripts/build-atlas.js <path-to-faithful-block-textures>')
    console.error('Example: node scripts/build-atlas.js ~/Downloads/Faithful-32x-1.21.8/assets/minecraft/textures/block')
    process.exit(1)
  }

  if (!fs.existsSync(texturesDir)) {
    console.error(`Textures directory not found: ${texturesDir}`)
    process.exit(1)
  }

  console.log(`Reading textures from: ${texturesDir}`)

  // ── Collect all unique texture filenames needed ──────────────────────────
  const neededTextures = new Set()
  const missing = []

  for (const blockId of ALLOW_LIST) {
    const multi = MULTI_FACE_BLOCKS[blockId]
    if (multi) {
      neededTextures.add(multi.top)
      neededTextures.add(multi.side)
      neededTextures.add(multi.bottom)
    } else {
      neededTextures.add(resolveTextureName(blockId))
    }
  }

  // ── Assign sequential indices to unique textures ─────────────────────────
  const textureIndex = new Map()  // textureName → atlas index
  let nextIndex = 0

  for (const texName of neededTextures) {
    const p = resolveTexturePath(texturesDir, texName)
    if (!p) {
      missing.push(texName)
    } else {
      textureIndex.set(texName, nextIndex++)
    }
  }

  if (missing.length > 0) {
    console.warn(`\nMissing textures (${missing.length}) — these blocks will use fallback color:`)
    missing.forEach(t => console.warn(`  ${t}.png`))
  }

  if (nextIndex > ATLAS_COLS * ATLAS_ROWS) {
    console.error(`Too many textures (${nextIndex}) for a ${ATLAS_COLS}×${ATLAS_ROWS} atlas`)
    process.exit(1)
  }

  console.log(`\nPacking ${nextIndex} unique textures into ${ATLAS_COLS}×${ATLAS_ROWS} atlas...`)

  // ── Build the atlas image ─────────────────────────────────────────────────
  // Create a blank ATLAS_PX × ATLAS_PX RGBA canvas
  const atlasBuffer = Buffer.alloc(ATLAS_PX * ATLAS_PX * 4, 0)

  for (const [texName, index] of textureIndex) {
    const texPath = resolveTexturePath(texturesDir, texName)
    const col = index % ATLAS_COLS
    const row = Math.floor(index / ATLAS_COLS)

    // Load and resize to TILE_PX × TILE_PX (should already be 32×32 for Faithful)
    const raw = await sharp(texPath)
      .resize(TILE_PX, TILE_PX, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer()

    // Blit into atlas buffer
    const destX = col * TILE_PX
    const destY = row * TILE_PX

    for (let py = 0; py < TILE_PX; py++) {
      for (let px = 0; px < TILE_PX; px++) {
        const srcOffset = (py * TILE_PX + px) * 4
        const dstOffset = ((destY + py) * ATLAS_PX + (destX + px)) * 4
        atlasBuffer[dstOffset + 0] = raw[srcOffset + 0]  // R
        atlasBuffer[dstOffset + 1] = raw[srcOffset + 1]  // G
        atlasBuffer[dstOffset + 2] = raw[srcOffset + 2]  // B
        atlasBuffer[dstOffset + 3] = raw[srcOffset + 3]  // A
      }
    }
  }

  // ── Write atlas.png ───────────────────────────────────────────────────────
  const outputDir = path.join(process.cwd(), 'client', 'public', 'textures')
  fs.mkdirSync(outputDir, { recursive: true })
  const atlasPath = path.join(outputDir, 'atlas.png')

  await sharp(atlasBuffer, {
    raw: { width: ATLAS_PX, height: ATLAS_PX, channels: 4 }
  })
    .png()
    .toFile(atlasPath)

  console.log(`Wrote: ${atlasPath}`)

  // ── Build the atlas.ts type map ───────────────────────────────────────────
  const tsLines = [
    `// AUTO-GENERATED by scripts/build-atlas.js — do not edit manually`,
    `// Source: Faithful 32x for Minecraft 1.21.8`,
    `// Run 'node scripts/build-atlas.js <textures-dir>' to regenerate`,
    ``,
    `export const ATLAS_COLS = ${ATLAS_COLS}`,
    `export const ATLAS_ROWS = ${ATLAS_ROWS}`,
    `export const TILE_SIZE  = 1 / ATLAS_COLS  // ${(1 / ATLAS_COLS).toFixed(6)}`,
    ``,
    `/** Single index = same texture all 6 faces. Object = different per face. */`,
    `export type BlockFaces = number | {`,
    `  top:    number`,
    `  side:   number`,
    `  bottom: number`,
    `}`,
    ``,
    `export const ATLAS_MAP: Record<string, BlockFaces> = {`,
  ]

  for (const blockId of ALLOW_LIST) {
    const multi = MULTI_FACE_BLOCKS[blockId]
    if (multi) {
      const topIdx    = textureIndex.get(multi.top)    ?? -1
      const sideIdx   = textureIndex.get(multi.side)   ?? -1
      const bottomIdx = textureIndex.get(multi.bottom) ?? -1
      if (topIdx === -1 || sideIdx === -1 || bottomIdx === -1) {
        tsLines.push(`  // MISSING textures for ${blockId} — skipped`)
        continue
      }
      tsLines.push(`  '${blockId}': { top: ${topIdx}, side: ${sideIdx}, bottom: ${bottomIdx} },`)
    } else {
      const texName = resolveTextureName(blockId)
      const idx = textureIndex.get(texName)
      if (idx === undefined) {
        tsLines.push(`  // MISSING texture '${texName}' for ${blockId} — skipped`)
        continue
      }
      tsLines.push(`  '${blockId}': ${idx},`)
    }
  }

  tsLines.push(`}`)
  tsLines.push(``)
  tsLines.push(`/** Total unique textures packed into the atlas */`)
  tsLines.push(`export const ATLAS_TEXTURE_COUNT = ${nextIndex}`)
  tsLines.push(``)

  const tsPath = path.join(process.cwd(), 'client', 'src', 'lib', 'atlas.ts')
  fs.mkdirSync(path.dirname(tsPath), { recursive: true })
  fs.writeFileSync(tsPath, tsLines.join('\n'))
  console.log(`Wrote: ${tsPath}`)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\nDone.`)
  console.log(`  Blocks in allow list:  ${ALLOW_LIST.length}`)
  console.log(`  Unique textures packed: ${nextIndex}`)
  console.log(`  Atlas size: ${ATLAS_PX}×${ATLAS_PX}px (${ATLAS_COLS}×${ATLAS_ROWS} grid)`)
  console.log(`  Missing textures: ${missing.length}`)
  if (missing.length === 0) {
    console.log(`\n  All textures found. Commit atlas.png and atlas.ts.`)
  } else {
    console.log(`\n  Some textures missing — check FALLBACK_TEXTURES or ALLOW_LIST.`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})