package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class U {
    public static enum Direction {
        FORWARD,
        BACK,
        LEFT,
        RIGHT,
        UP,
        DOWN,
        NOP
    }

    public static void forward(AbstractTerp t, int n) {
        draw(t, n, Direction.FORWARD, null);
    }

    public static void forward(AbstractTerp t, int n, TerpBlockType block) {
        draw(t, n, Direction.FORWARD, block);
    }

    public static void back(AbstractTerp t, int n) {
        draw(t, n, Direction.BACK, null);
    }

    public static void back(AbstractTerp t, int n, TerpBlockType block) {
        draw(t, n, Direction.BACK, block);
    }

    public static void left(AbstractTerp t, int n) {
        draw(t, n, Direction.LEFT, null);
    }

    public static void left(AbstractTerp t, int n, TerpBlockType block) {
        draw(t, n, Direction.LEFT, block);
    }

    public static void right(AbstractTerp t, int n) {
        draw(t, n, Direction.RIGHT, null);
    }

    public static void right(AbstractTerp t, int n, TerpBlockType block) {
        draw(t, n, Direction.RIGHT, block);
    }

    public static void up(AbstractTerp t, int n) {
        draw(t, n, Direction.UP, null);
    }

    public static void up(AbstractTerp t, int n, TerpBlockType block) {
        draw(t, n, Direction.UP, block);
    }

    public static void down(AbstractTerp t, int n) {
        draw(t, n, Direction.DOWN, null);
    }

    public static void down(Terp t, int n, TerpBlockType block) {
        draw(t, n, Direction.DOWN, block);
    }

    public static void nop(AbstractTerp t, int n) {
        draw(t, n, Direction.NOP, null);
    }

    public static void draw(AbstractTerp t, int n, Direction dir, TerpBlockType block) {
        for (int i=0; i<n; i++) {
            switch (dir) {
                case FORWARD:
                    t.forward();
                    break;
                case BACK:
                    t.back();
                    break;
                case LEFT:
                    t.left();
                    break;
                case RIGHT:
                    t.right();
                    break;
                case UP:
                    t.up();
                    break;
                case DOWN:
                    t.down();
                    break;
                case NOP:
                    t.nop();
                    break;

            }
            if (block != null) t.setBlock(block);
        }
    }

    public static void onefloor(AbstractTerp terp, int length, int width, int height) {
        // let's do the floor
        for (int i=0; i<width; i++) {

            U.forward(terp, length, TerpBlockType.IRON_BLOCK);
            U.back(terp, length);
            terp.right();
        }
        // up by one
        terp.up();
        // move back to where we started (I hope?)
        U.left(terp, width);
        
        // now the glass that goes on top
        for (int h=0; h<height; h++) {
            U.forward(terp, length, TerpBlockType.GLASS);
            U.right(terp, width-1, TerpBlockType.GLASS);
            U.back(terp, length-1, TerpBlockType.GLASS);
            U.left(terp, width-1, TerpBlockType.GLASS);
            terp.up();
            terp.back();
        }
    }
}

