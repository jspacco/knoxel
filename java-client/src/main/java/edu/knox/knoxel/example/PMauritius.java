package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class PMauritius {
    public static void main(String[] args)
    {
        // Set these values in StudentConfig.java
        String serverUrl = StudentConfig.SERVER_URL;
        String email = StudentConfig.EMAIL;
        String password = StudentConfig.PASSWORD;
        
        String programName = "parallelflag";
        String description = "Mauritius in parallel!";

        ParallelTerp terp = new ParallelTerp(programName, description);
        
        int length = 12;
        int width = 4;
        terp.addThread(t -> {
            t.nop(width * 3);

            for (int i=0; i<width; i++) {
                t.setBlockForward(TerpBlockType.RED_WOOL, length);
                t.back(length - 1);
                t.right();
                //t.turnRight();
                //t.forward();
                //t.turnLeft();
            }
            
        });
        terp.addThread(t -> {
            for (int i=0; i<width; i++) t.right();
            t.nop(width * 2);

            for (int i=0; i<width; i++) {
                t.setBlockForward(TerpBlockType.BLUE_WOOL, length);
                t.back(length - 1);
                t.right();
            }
        });

        terp.addThread(t -> {
            t.right(width * 2);
            for (int i=0; i<width; i++) t.nop();

            for (int i=0; i<width; i++) {
                t.setBlockForward(TerpBlockType.YELLOW_WOOL, length);
                t.back(length - 1);
                t.right();
            }
        });

        terp.addThread(t -> {
            t.right(width * 3);

            for (int i=0; i<width; i++) {
                t.setBlockForward(TerpBlockType.GREEN_WOOL, length);
                t.back(length - 1);
                t.right();
            }
        });

        System.out.println(terp.toJson());

        KnoxelUploader.upload(serverUrl, terp, email, password);
    }
    
}
