package edu.knox.knoxel.example;

// This import is necessary! 
// We strip out the package when we distribute to students
import edu.knox.knoxel.*;

public class PyramidBrowser {
    public static void main(String[] args) throws Exception
    {
        // SERVER_URL
        String serverUrl = "http://localhost:8080";
        // TODO: your full college email address
        String email = "jdoe@mycollege.edu";
        // TODO: the password provided for you by your instructor
        String password = "";
        
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

        //KnoxelUploader.upload(serverUrl, terp, email, password);
        KnoxelUploader.openInBrowser(terp, email);
    }
    
}
