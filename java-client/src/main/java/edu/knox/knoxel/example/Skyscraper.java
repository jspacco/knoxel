package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class Skyscraper {
    public static void main(String[] args)
    {
        String serverUrl = "http://127.0.0.1:8090";
        String email = "test@email.com";
        email = "jspacco@knox.edu";
        String password = "foobar123";
        String programName = "skyscraper3";
        String description = "A skyscraper building";

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
                U.nop(t, (numFloors - f) * height);
                U.up(t, (f - 1) * height);
                onefloor(t, length, width, height);
            });
            
        }
        

        KnoxelUploader.upload(serverUrl, terp, email, password);
    }

    private static void onefloor(AbstractTerp terp, int length, int width, int height) {
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
        for (int h=0; h<height-1; h++) {
            U.forward(terp, length, TerpBlockType.GLASS);
            // -1 for each of these because remember
            // we move one unit before draw something
            U.right(terp, width-1, TerpBlockType.GLASS);
            U.back(terp, length-1, TerpBlockType.GLASS);
            U.left(terp, width-1, TerpBlockType.GLASS);
            terp.up();
            terp.back();
        }
    }
}

