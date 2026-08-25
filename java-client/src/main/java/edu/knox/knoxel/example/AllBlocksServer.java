package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class AllBlocksServer {
    public static void main(String[] args) throws Exception
    {
        // SERVER_URL
        String serverUrl = "http://localhost:8090";
        String email = "jdoe@knox.edu";
        String password = "";
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
