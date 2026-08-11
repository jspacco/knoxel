package edu.knox.knoxel.example;

// This import is necessary! 
// We strip out the package when we distribute to students
import edu.knox.knoxel.*;

public class PyramidExample {
    public static void main(String[] args)
    {
        // Example usage of the Uploader class
        String serverUrl = "http://localhost:8080";
        // TODO: your college email username
        String username = "test";
        // TODO: the password provided for you by your instructor
        String password = "foobar123";
        
        String programName = "pyramid";
        String description = "Draw a pyramid.";

        Terp terp = new Terp(programName, description);
        
        for (int base=8; base>=0; base-=2){
            for (int i=0; i<base; i++) {
                for (int j=0; j<base; j++) {
                    terp.forward();
                    terp.setBlock(TerpBlockType.OBSIDIAN);
                }
                for (int j=0; j<base; j++) {
                    terp.back();
                }
                terp.right();
            }
            for (int i=0; i<base; i++) {
                terp.left();
            }
            terp.forward();
            terp.right();
            terp.up();
        }

        KnoxelUploader.upload(serverUrl, terp, username, password);
    }
    
}
