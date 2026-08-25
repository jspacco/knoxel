package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class AllBlocks {
    public static void main(String[] args) throws Exception
    {
        String username = "jdoe@knox.edu";
        String programName = "allblocks";
        String description = "Testing all blocks";

        Terp terp = new Terp(programName, description);

        for (TerpBlockType block :TerpBlockType.values()) {
            terp.setBlock(block);
            System.out.println(block);
            terp.forward();
        }

        String workerUrl = "https://knoxel-worker.jspacco.workers.dev";
        String pageUrl = "http://jspacco.github.io/knoxel";
        KnoxelUploader.openInBrowser(terp, username, workerUrl, pageUrl);
    }
    
}
