package edu.knox.knoxel;

import java.util.List;
import java.awt.Color;

public abstract class AbstractTerp {

    protected List<TerpInstruction> instructions;

    public AbstractTerp(List<TerpInstruction> instructions) {
        this.instructions = instructions;
    }

    protected List<TerpInstruction> getInstructions() {
        return this.instructions;
    }
    
    /**
     * Set the given block type at the Terp's current location.
     * 
     * @param terpBlockType
     */
    public void setBlock(TerpBlockType terpBlockType) {
        instructions.add(new TerpInstruction(TerpCommand.SET_BLOCK, terpBlockType));
    }

    /**
     * Set the given block type at the Terp's current location.
     * 
     * @param color
     */
    public void setBlock(Color color) {
        instructions.add(new TerpInstruction(TerpCommand.SET_BLOCK, color));
    }

    private void setBlockDirection(Color color, int num, TerpCommand direction) {
        instructions.add(new TerpInstruction(direction, num, color));
    }

    private void setBlockDirection(TerpBlockType terpBlockType, int num, TerpCommand direction) {
        instructions.add(new TerpInstruction(direction, num, terpBlockType));
    }

    public void setBlockForward(TerpBlockType terpBlockType, int num) {
        setBlockDirection(terpBlockType, num, TerpCommand.SET_BLOCK_FORWARD);
    }

    public void setBlockForward(Color color, int num) {
        setBlockDirection(color, num, TerpCommand.SET_BLOCK_FORWARD);
    }

    public void setBlockBack(TerpBlockType terpBlockType, int num) {
        setBlockDirection(terpBlockType, num, TerpCommand.SET_BLOCK_BACK);
    }

    public void setBlockBack(Color color, int num) {
        setBlockDirection(color, num, TerpCommand.SET_BLOCK_BACK);
    }

    public void setBlockLeft(TerpBlockType terpBlockType, int num) {
        setBlockDirection(terpBlockType, num, TerpCommand.SET_BLOCK_LEFT);
    }

    public void setBlockLeft(Color color, int num) {
        setBlockDirection(color, num, TerpCommand.SET_BLOCK_LEFT);
    }

    public void setBlockRight(TerpBlockType terpBlockType, int num) {
        setBlockDirection(terpBlockType, num, TerpCommand.SET_BLOCK_RIGHT);
    }

    public void setBlockRight(Color color, int num) {
        setBlockDirection(color, num, TerpCommand.SET_BLOCK_RIGHT);
    }

    public void setBlockUp(TerpBlockType terpBlockType, int num) {
        setBlockDirection(terpBlockType, num, TerpCommand.SET_BLOCK_UP);
    }

    public void setBlockUp(Color color, int num) {
        setBlockDirection(color, num, TerpCommand.SET_BLOCK_UP);
    }

    public void setBlockDown(TerpBlockType terpBlockType, int num) {
        setBlockDirection(terpBlockType, num, TerpCommand.SET_BLOCK_DOWN);
    }

    public void setBlockDown(Color color, int num) {
        setBlockDirection(color, num, TerpCommand.SET_BLOCK_DOWN);
    }

    private void move(TerpCommand direction, int num) {
        instructions.add(new TerpInstruction(direction, num));
    }

    /**
     * Move the Terp forward one block.
     */
    public void forward() {
        add(TerpCommand.FORWARD);
    }

   
    public void forward(int num) {
        move(TerpCommand.FORWARD, num);
    }

    /**
     * Move the Terp back one block.
     */
    public void back() {
        add(TerpCommand.BACK);
    }

    public void back(int num) {
        move(TerpCommand.BACK, num);
    }

    /**
     * Turn the Terp left. The Terp will stay at the current block.
     */
    public void turnLeft() {
        add(TerpCommand.TURN_LEFT);
    }

    /**
     * Turn the Terp right. The Terp wil stay at the current block.
     */
    public void turnRight() {
        add(TerpCommand.TURN_RIGHT);
    }

    /**
     * Move the Terp one block to the left.
     */
    public void left() {
        add(TerpCommand.LEFT);
    }

    public void left(int num) {
        move(TerpCommand.LEFT, num);
    }

    /**
     * Move the Terp one block to the right.
     */
    public void right() {
        add(TerpCommand.RIGHT);
    }

    public void right(int num) {
        move(TerpCommand.RIGHT, num);
    }

    /**
     * Move the Terp up one block.
     * 
     * The Terp cannot move up above the max height of the server.
     */
    public void up() {
        add(TerpCommand.UP);
    }

    public void up(int num) {
        move(TerpCommand.UP, num);
    }

    /**
     * Move the Terp down one block. 
     * 
     * The Terp cannot move below the ground level,
     * which is -60 on modern Minecraft servers.
     * 
     */
    public void down() {
        add(TerpCommand.DOWN);
    }

    public void down(int num) {
        move(TerpCommand.UP, num);
    }

    /**
     * No operation. The Terp sits there for 1 tick and does nothing.
     * 
     * Nops allow threads to be paused should parallel programs want to line up
     * and synchronize their threads.
     */
    public void nop() {
        add(TerpCommand.NOP);
    }

    public void nop(int num) {
        move(TerpCommand.NOP, num);
    }

    protected void add(TerpCommand cmd) {
        instructions.add(new TerpInstruction(cmd));
    }
}
