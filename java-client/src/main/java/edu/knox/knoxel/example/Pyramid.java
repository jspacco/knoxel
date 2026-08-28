package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class Pyramid {
    public static void main(String[] args) throws Exception
    {
        // Set these values in StudentConfig.java
        String serverUrl = StudentConfig.SERVER_URL;
        String email = StudentConfig.EMAIL;
        String password = StudentConfig.PASSWORD;
        
        String programName = "pyramid";
        String description = "Draw a pyramid.";

        Terp terp = new Terp(programName, description);
        
        for (int base=8; base>=0; base-=2){
            for (int i=0; i<base; i++) {
                terp.setBlockForward(TerpBlockType.OBSIDIAN, base);
                terp.back(base-1);
                terp.right();
            }
            terp.left(base);
            terp.forward();
            terp.right();
            terp.up();
        }

        KnoxelUploader.upload(serverUrl, terp, email, password);
    }
}
