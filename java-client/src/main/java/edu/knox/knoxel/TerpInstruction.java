package edu.knox.knoxel;

import java.awt.Color;

class TerpInstruction {
    // the command string e.g. "forward", "setBlock"
    @SuppressWarnings("unused")
    private final String cmd;
    
    // nullable — block ID or hex color string
    @SuppressWarnings("unused")
    private final String blk;
    
    // nullable — for forward(n), setBlockForward(n) etc
    @SuppressWarnings("unused")
    private final Integer n;

    // movement command, no block
    TerpInstruction(TerpCommand command) {
        this.cmd = command.getId();
        this.blk = null;
        this.n = null;
    }

    // movement command with n
    TerpInstruction(TerpCommand command, int n) {
        this.cmd = command.getId();
        this.blk = null;
        this.n = n;
    }

    // setBlock with a TerpBlockType
    TerpInstruction(TerpCommand command, TerpBlockType blockType) {
        this.cmd = command.getId();
        this.blk = blockType.getId();
        this.n = null;
    }

    // setBlock with a java.awt.Color
    TerpInstruction(TerpCommand command, Color color) {
        this.cmd = command.getId();
        this.blk = colorToHex(color);
        this.n = null;
    }

    // setBlockForward(n, TerpBlockType)
    TerpInstruction(TerpCommand command, int n, TerpBlockType blockType) {
        this.cmd = command.getId();
        this.blk = blockType.getId();
        this.n = n;
    }

    // setBlockForward(n, Color)
    TerpInstruction(TerpCommand command, int n, Color color) {
        this.cmd = command.getId();
        this.blk = colorToHex(color);
        this.n = n;
    }

    private static String colorToHex(Color c) {
        if (c.getAlpha() < 255) {
            return String.format("#%02x%02x%02x%02x",
                c.getRed(), c.getGreen(), c.getBlue(), c.getAlpha());
        }
        return String.format("#%02x%02x%02x",
            c.getRed(), c.getGreen(), c.getBlue());
    }
}