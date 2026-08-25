package edu.knox.knoxel.example;

import edu.knox.knoxel.*;

public class MauritiusBrowser {
    public static void main(String[] args)
    throws Exception
    {
        String email = "";
        String programName = "flag";
        String description = "Flag of Mauritius";

        Terp terp = new Terp(programName, description);

        int length = 12;
        int width = 4;
        for (int i=0; i<width*4; i++) {
            if (i / 4 == 0)
                terp.setBlockForward(TerpBlockType.RED_WOOL, length);
            else if (i / 4 == 1)
                terp.setBlockForward(TerpBlockType.BLUE_WOOL, length);
            else if (i / 4 == 2)
                terp.setBlockForward(TerpBlockType.YELLOW_WOOL, length);
            else
                terp.setBlockForward(TerpBlockType.GREEN_WOOL, length);
            
            // forward includes the current square
            // so we only go back length - 1
            terp.back(length - 1);
            terp.right();
        }

        //System.out.println(terp.toJson());

        KnoxelUploader.openInBrowser(terp, email);
    }

}
