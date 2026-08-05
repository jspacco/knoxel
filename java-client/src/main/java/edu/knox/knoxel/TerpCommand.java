package edu.knox.knoxel;

enum TerpCommand 
{
    FORWARD("forward"),
    BACK("back"),
    TURN_LEFT("turnLeft"),
    LEFT("left"),
    TURN_RIGHT("turnRight"),
    RIGHT("right"),
    UP("up"),
    DOWN("down"),
    NOP("nop"),
    SET_BLOCK("setBlock"),

    SET_BLOCK_FORWARD("setBlockForward"),
    SET_BLOCK_BACK("setBlockBack"),
    SET_BLOCK_LEFT("setBlockLeft"),
    SET_BLOCK_RIGHT("setBlockRight"),
    SET_BLOCK_UP("setBlockUp"),
    SET_BLOCK_DOWN("setBlockDown"),
    ;

    private final String id;

    TerpCommand(String id) {
        this.id = id;
    }

    public String getId() {
        return id;
    }

    @Override
    public String toString() {
        return id;
    }
}
