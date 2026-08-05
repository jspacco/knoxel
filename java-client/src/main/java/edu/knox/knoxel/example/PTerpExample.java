package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class PTerpExample 
{

    public static void main(String[] args)
    {
        String programName = "parallelpyramid";
        String description = "Draw a pyramid. In Parallel!";
        String serverUrl = "http://localhost:8080";
        String minecraftPlayer = "dev";
        String username = "test";
        String password = "foobar123";
        
        ParallelTerp terp = new ParallelTerp(programName, description);

        // first thread
        terp.addThread(t -> {
            t.nop();
            t.nop();
            t.nop();
            int base = 16;
            for (int i=0; i<base; i++) {
                for (int j=0; j<base; j++) {
                    t.forward();
                    t.setBlock(TerpBlockType.OBSIDIAN);
                }
                for (int j=0; j<base; j++) {
                    t.back();
                }
                t.right();
            }
        });
        // second thread
        terp.addThread(t -> {
            t.forward();
            t.up();
            t.right();
            int base = 16;
            for (int i=0; i<base; i++) {
                for (int j=0; j<base; j++) {
                    t.forward();
                    t.setBlock(TerpBlockType.OBSIDIAN);
                }
                for (int j=0; j<base; j++) {
                    t.back();
                }
                t.right();
            }
        });
        // upload to server
        KnoxelUploader.upload(serverUrl, terp, username, password);
    }
    
}
