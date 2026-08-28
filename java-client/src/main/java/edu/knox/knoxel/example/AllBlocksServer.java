package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class AllBlocksServer {
    public static void main(String[] args) throws Exception
    {
        // Set these values in StudentConfig.java
        String serverUrl = StudentConfig.SERVER_URL;
        String email = StudentConfig.EMAIL;
        String password = StudentConfig.PASSWORD;
        String programName = "allblocks";
        String description = "Testing all blocks";

        Terp terp = new Terp(programName, description);

        for (TerpBlockType block :TerpBlockType.values()) {
            terp.setBlock(block);
            //System.out.println(block);
            terp.forward();
        }

        //System.out.println(terp.toJson());

        KnoxelUploader.upload(serverUrl, terp, email, password);
    }
}
