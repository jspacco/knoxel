package edu.knox.knoxel.example;

import edu.knox.knoxel.*;
import java.awt.Color;

/**
 * "Messy" version that uses unnecessarily complicated commands
 * such as "turnleft-forward-turnright" instead of just "left"
 * 
 * PMauritiusMessy
 */
public class PMauritiusMessy {
    public static void main(String[] args)
    {
        // Set these values in StudentConfig.java
        String serverUrl = StudentConfig.SERVER_URL;
        String email = StudentConfig.EMAIL;
        String password = StudentConfig.PASSWORD;

        String programName = "pflag2";
        String description = "Mauritius in parallel!";

        ParallelTerp terp = new ParallelTerp(programName, description);
        
        int length = 12;
        int width = 4;
        terp.addThread(t -> {
            t.nop(width * 3);

            for (int i=0; i<width; i++) {
                t.setBlockForward(Color.RED, length);
                t.back(length - 1);
                t.turnLeft();
                t.forward();
                t.turnRight();
            }
            
        });
        terp.addThread(t -> {
            Color blue = new Color(0, 0, 255, 128);
            for (int i=0; i<width; i++) t.left();
            t.nop(width * 2);

            for (int i=0; i<width; i++) {
                t.setBlockForward(blue, length);
                t.back(length - 1);
                t.turnLeft();
                t.forward();
                t.turnRight();
            }
        });

        terp.addThread(t -> {
            t.left(width * 2);
            for (int i=0; i<width; i++) t.nop();

            for (int i=0; i<width; i++) {
                t.setBlockForward(Color.YELLOW, length);
                t.back(length - 1);
                t.turnLeft();
                t.forward();
                t.turnRight();
            }
        });

        terp.addThread(t -> {
            t.left(width * 3);

            for (int i=0; i<width; i++) {
                //t.setBlockForward(TerpBlockType.GREEN_WOOL, length);
                t.setBlock(Color.GREEN);
                for (int j=0; j<length-1; j++) {
                    t.forward();
                    t.setBlock(Color.GREEN);
                }
                for (int j=0; j<(length - 1); j++) t.back();
                t.turnLeft();
                t.forward();
                t.turnRight();
            }
        });

        System.out.println(terp.toJson());

        KnoxelUploader.upload(serverUrl, terp, email, password);
    }
    
}

