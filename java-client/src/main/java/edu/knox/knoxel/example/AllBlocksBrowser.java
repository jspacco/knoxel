package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class AllBlocksBrowser {
    public static void main(String[] args) throws Exception
    {
        // THIS DOES NOT SAVE YOUR CODE
        String username = "jdoe@knox.edu";
        String programName = "allblocks";
        String description = "Testing all blocks";

        Terp terp = new Terp(programName, description);

        for (TerpBlockType block :TerpBlockType.values()) {
            terp.setBlock(block);
            //System.out.println(block);
            terp.forward();
        }

        //System.out.println(terp.toJson());

        KnoxelUploader.openInBrowser(terp, username);
    }
    
}
