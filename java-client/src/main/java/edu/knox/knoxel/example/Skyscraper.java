package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class Skyscraper {
    public static void main(String[] args)
    throws Exception
    {
        // server
        // SERVER_URL
        String serverUrl = "http://127.0.0.1:8090";
        // your full college email
        String email = "test@email.com";
        // if your instructor gave you a pasword, put it here
        // if not then the password is not necessary
        String password = "";
        String programName = "skyscraper";
        String description = "Build a skyscraper";

        ParallelTerp terp = new ParallelTerp(programName, description);

        int length = 7;
        int width = 7;
        int height = 5;
        int numFloors = 5;

        // floor == 1:
        //      (numFloors - floor) * height NOPs
        //      up(floor - 1)
        // floor == 2: 
        //      (numFloors - floor) * height NOPs
        //      up(floor - 1)
        // floor == 3:
        //      (numFloors - floor) * height NOPs
        //      up(floor - 1)
        //
        for (int floor=1; floor <= numFloors; floor++) {
            // annoying final variable required for each floor
            // ugh
            final int f = floor;
            terp.addThread(t -> {
                t.nop((numFloors - f) * height);
                t.up((f - 1) * height);
                onefloor(t, length, width, height);
            });
            
        }

        KnoxelUploader.upload(serverUrl, terp, email, password);
    }

    private static void onefloor(AbstractTerp terp, int length, int width, int height) {
        // let's do one 
        for (int i=0; i<width; i++) {

            terp.setBlockForward(TerpBlockType.IRON_BLOCK, length);
            terp.back(length - 1);
            terp.right();
        }
        // up by one
        terp.up();
        // move back to where we started (I hope?)
        terp.left(width);
        
        // now the glass that goes on top
        for (int h=0; h<height-1; h++) {
            terp.setBlockForward(TerpBlockType.GLASS, length);
            terp.setBlockRight(TerpBlockType.GLASS, width);
            terp.setBlockBack(TerpBlockType.GLASS, length);
            terp.setBlockLeft(TerpBlockType.GLASS, width);
            terp.up();
        }
    }
}

