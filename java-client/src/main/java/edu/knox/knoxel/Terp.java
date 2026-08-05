package edu.knox.knoxel;

import java.util.LinkedList;

public class Terp extends AbstractTerp
{
    private final String programName;
    private final String description;

    /**
     * Create a Terp with the given name and description.
     * 
     * @param programName
     * @param description
     */
    public Terp(String programName, String description)
    {
        super(new LinkedList<TerpInstruction>());
        if (programName == null || description == null) {
            throw new IllegalArgumentException("programName and description cannot be null!");
        }
        this.programName = programName;
        this.description = description;
    }

    public String getProgramName() {
        return programName;
    }

    public String getDescription() {
        return description;
    }

    public String toJson() {
        return KnoxelUploader.toJson(this, "fakeuser@domain.com");
    }

}
